// 대난투 아레나 — entry point: menus, brawler select, tutorial, the frame loop, HUD, results and the local ranking.
// Rules live in game.js, bots in bot.js, drawing in render.js/art.js, thumbsticks in input.js.

import { MAPS, stageMap } from './maps.js';
import { BRAWLERS, KINDS, TROPHY, LEVELS, SURVIVAL, STAGES, botLevelFor, levelFor } from './config.js';
import { createMatch, step, lineOfSight, visibleTo, timeLeft, mvpOf, poisonInset, BLUE, RED } from './game.js';
import { sfx, unlock, isMuted, setMuted } from './sound.js';
import { makeBrain, botControl } from './bot.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawPerson } from './art.js';
import { STEPS } from './tutorial.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), overlay = $('overlay');
const panels = { main: $('pMain'), help: $('pHelp'), rank: $('pRank'), pause: $('pPause'), select: $('pSelect'), ask: $('pAsk') };
const titleEl = $('title'), msgEl = $('msg'), finalEl = $('final'), toast = $('toast');
const startBtn = $('start'), homeBtn = $('home'), helpBtn = $('helpBtn'), menuLink = $('toMenu'), pauseBtn = $('pause');
const rowsEl = $('rows'), rankNote = $('rankNote'), bannerEl = $('banner');
const coach = $('coach'), cstep = $('cstep'), ctext = $('ctext');
const hud = { trophy: $('trophy'), score: $('score'), clock: $('clock'), alive: $('alive'), midLabel: $('midLabel'), clockLabel: $('clockLabel') };
const muteBtn = $('mute');

const KEY_TOP = 'brawl-top', KEY_TROPHY = 'brawl-trophy', KEY_TUT = 'brawl-tutorial', KEY_PICK = 'brawl-pick', KEY_BY = 'brawl-trophy-by', KEY_MODE = 'brawl-mode', KEY_STAGE = 'brawl-stage';
const STEP = 1 / 60;

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: play on without saving */ } }

const input = createInput(stage);
const view = createRenderer($('c'));

let state = 'title';   // title | play | paused | over
let mode = 'team';     // team | survival | tutorial | tutorial-done
let chosenMode = load(KEY_MODE, 'team') === 'survival' ? 'survival' : 'team';
// Stage (탄) per mode: { team: 1..5, survival: 1..5, cleared: { team, survival } }.
let stages = load(KEY_STAGE, {});
const stageOf = md => Math.min(STAGES.count, Math.max(1, stages[md] || 1));
const MODE_NAME = { team: '3:3 팀전', survival: '생존전' };
let trophyBy = load(KEY_BY, {}); // trophies per brawler → its level
let match = null, brains = [], me = null, acc = 0, last = performance.now();
let trophies = load(KEY_TROPHY, 0), lastEntry = null, pick = KINDS.includes(load(KEY_PICK, 'gyo')) ? load(KEY_PICK, 'gyo') : 'gyo';
let bannerT = 0;
let autoNext = 0; // seconds until the next stage starts by itself after a win
let tut = null; // { i, autoHits, aimHits, supers, okT }
let lastShotMode = null; // 'auto' | 'aim', for the tutorial's checks

// ---------- menus ----------
function panel(name) { for (const [k, el] of Object.entries(panels)) el.hidden = k !== name; }
function buttons(onTitle) { helpBtn.hidden = !onTitle; menuLink.hidden = !onTitle; homeBtn.hidden = onTitle; }

function renderTop(highlight) {
  const top = load(KEY_TOP, []);
  rowsEl.replaceChildren();
  top.forEach((e, i) => {
    const li = document.createElement('li');
    if (highlight && e.id === highlight) li.className = 'me';
    const cells = [[`${i + 1}`, 'rk'], [`${e.result} · ${e.brawler || '교행이'} · 처치 ${e.kills}`, 'nm'], [`${e.trophy >= 0 ? '+' : ''}${e.trophy}`, 'sc'], [e.date, 'dt']];
    for (const [text, cls] of cells) { const s = document.createElement('span'); s.className = cls; s.textContent = text; li.append(s); }
    rowsEl.append(li);
  });
  rankNote.textContent = top.length ? '트로피를 많이 얻은 판 순서예요. 이 폰에만 저장돼요.' : '아직 기록이 없어요. 한 판 해 보세요!';
}

function showTitle() {
  autoNext = 0;
  state = 'title'; mode = 'team'; input.enabled = false; pauseBtn.hidden = true; coach.hidden = true; toast.textContent = '';
  bannerEl.classList.remove('on'); bannerT = 0;
  titleEl.textContent = '대난투 아레나';
  msgEl.textContent = '봇과 총을 쏘며 겨루는 난투 게임';
  finalEl.hidden = true; startBtn.textContent = '시작';
  buttons(true); panel('main'); overlay.hidden = false;
  newAttract();
}

// Brawler cards with a little portrait each.
function buildCards() {
  const wrap = $('cards'); wrap.replaceChildren();
  for (const kind of KINDS) {
    const d = BRAWLERS[kind];
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'card'; card.setAttribute('role', 'radio'); card.dataset.kind = kind;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    drawPerson(g, { kind, face: Math.PI / 2 - 0.35, vx: 0, vy: 0, team: BLUE, id: 0 }, 64, 108, 120, 0, false);
    const info = document.createElement('div');
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = d.name;
    const role = document.createElement('small'); role.textContent = d.role; nm.append(role);
    const bl = document.createElement('div'); bl.className = 'bl'; bl.textContent = d.blurb;
    const lv = document.createElement('span'); lv.className = 'lv'; nm.append(lv);
    const st = document.createElement('div'); st.className = 'st'; st.textContent = `체력 ${d.hp} · 사거리 ${d.attack.range}칸 · 필살기 ${d.super.name}`;
    const nx = document.createElement('div'); nx.className = 'st nx';
    info.append(nm, bl, st, nx);
    card.append(cv, info);
    card.addEventListener('click', () => { pick = kind; save(KEY_PICK, pick); markPick(); });
    wrap.append(card);
  }
  markPick();
}
function markPick() {
  for (const c of document.querySelectorAll('.card')) {
    const k = c.dataset.kind, tr = trophyBy[k] || 0, lv = levelFor(tr), next = LEVELS.at[lv];
    c.setAttribute('aria-checked', String(k === pick));
    c.querySelector('.lv').textContent = `Lv.${lv}`;
    c.querySelector('.nx').textContent = next != null ? `트로피 ${tr} · 다음 레벨까지 ${next - tr}` : `트로피 ${tr} · 최고 레벨!`;
  }
  for (const b of document.querySelectorAll('.mode')) {
    b.classList.toggle('on', b.dataset.mode === chosenMode);
    const md = b.dataset.mode, cleared = stages.cleared && stages.cleared[md];
    b.querySelector('small').textContent = cleared ? `${stageOf(md)}탄 · 클리어!` : `${stageOf(md)}탄`;
  }
}
for (const b of document.querySelectorAll('.mode')) b.addEventListener('click', () => { chosenMode = b.dataset.mode; save(KEY_MODE, chosenMode); markPick(); });

helpBtn.addEventListener('click', () => panel('help'));
$('rankBtn').addEventListener('click', () => { renderTop(lastEntry); panel('rank'); });
homeBtn.addEventListener('click', showTitle);
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => panel('main')));
startBtn.addEventListener('click', () => {
  unlock(); sfx.click();
  if (state === 'over' && (mode === 'team' || mode === 'survival')) return startMatch();   // 다시 하기: same brawler and mode
  if (!load(KEY_TUT, false) && mode !== 'tutorial-done') return panel('ask');              // first time: offer the tutorial
  markPick(); panel('select');
});
$('askYes').addEventListener('click', () => { unlock(); startTutorial(); });
$('askNo').addEventListener('click', () => { save(KEY_TUT, true); markPick(); panel('select'); });
function paintMute() { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; muteBtn.setAttribute('aria-pressed', String(isMuted())); muteBtn.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기'); }
muteBtn.addEventListener('click', () => { unlock(); setMuted(!isMuted()); paintMute(); if (!isMuted()) sfx.click(); });
paintMute();
$('go').addEventListener('click', () => { unlock(); startMatch(); });
$('tutBtn').addEventListener('click', startTutorial);
$('cskip').addEventListener('click', () => finishTutorial(true));
pauseBtn.addEventListener('click', () => pause(true));
$('resume').addEventListener('click', () => pause(false));
$('quit').addEventListener('click', showTitle);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(true); });

function pause(on) {
  if (on && state === 'play') { state = 'paused'; input.enabled = false; pauseBtn.hidden = true; panel('pause'); overlay.hidden = false; }
  else if (!on && state === 'paused') { state = 'play'; input.enabled = true; pauseBtn.hidden = false; overlay.hidden = true; last = performance.now(); }
}

// ---------- matches ----------
// Behind the title menu: six bots playing on their own.
function newAttract() {
  match = createMatch({ mapDef: MAPS.team, seed: (Math.random() * 1e9) | 0, botsOnly: true });
  brains = match.brawlers.map(() => makeBrain(2)); me = null; view.reset();
}

function begin() {
  me = match.brawlers.find(b => b.isPlayer);
  view.reset(); acc = 0; last = performance.now(); lastEntry = null;
  state = 'play'; input.enabled = true; overlay.hidden = true; pauseBtn.hidden = false;
}

function startMatch() {
  mode = chosenMode; coach.hidden = true;
  const survival = mode === 'survival';
  const st = stageOf(mode);
  match = createMatch({
    mapDef: stageMap(mode, st), mode, seed: (Math.random() * 1e9) | 0,
    playerKind: pick, level: levelFor(trophyBy[pick] || 0), botHp: STAGES.botHp[st - 1],
  });
  match.stage = st;
  const skill = botLevelFor(trophies);
  brains = match.brawlers.map(b => (b.isPlayer ? null : makeBrain(skill)));
  begin();
  autoNext = 0;
  banner(`${st}탄 · ${match.mapDef.name}`, 1.6);
}

function startTutorial() {
  mode = 'tutorial';
  match = createMatch({
    mapDef: MAPS.tutorial, seed: 7, endless: true, respawn: 1.5,
    roster: [
      { team: BLUE, slot: 0, kind: 'gyo', name: '나', isPlayer: true },
      { team: RED, slot: 0, kind: 'gyo', name: '연습 상대', dummy: true },
    ],
  });
  brains = [null, null];
  tut = { i: -1, autoHits: 0, aimHits: 0, supers: 0, okT: 0 };
  begin();
  coach.hidden = false; nextTutorialStep();
}

function nextTutorialStep() {
  tut.i++;
  if (tut.i >= STEPS.length) return finishTutorial(false);
  const s = STEPS[tut.i];
  if (s.enter) s.enter(me);
  cstep.textContent = `튜토리얼 ${tut.i + 1} / ${STEPS.length}`;
  ctext.innerHTML = s.text; ctext.classList.remove('ok');
}

function finishTutorial(skipped) {
  save(KEY_TUT, true); coach.hidden = true; tut = null;
  state = 'over'; input.enabled = false; pauseBtn.hidden = true;
  titleEl.textContent = skipped ? '튜토리얼 건너뜀' : '튜토리얼 완료!';
  msgEl.innerHTML = '이제 브롤러를 골라 <b>3:3 팀전</b>에 나가 볼까요?<br>튜토리얼은 <b>게임 설명</b>에서 다시 볼 수 있어요.';
  finalEl.hidden = true; startBtn.textContent = '브롤러 고르기';
  mode = 'tutorial-done';
  buttons(false); panel('main'); overlay.hidden = false;
}

// Tap-to-fire picks the closest enemy in reach that can actually be hit; otherwise shoot straight ahead.
function autoAim(b, spec) {
  const lobbed = spec.type === 'lob' || spec.type === 'firebomb';
  const reach = spec.type === 'storm' ? spec.dash + spec.range : spec.range;
  let best = null, bd = 1e9;
  for (const o of match.brawlers) {
    if (!o.alive || o.team === b.team || !visibleTo(match, b.team, o)) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d > reach + 0.5 || (!lobbed && spec.type !== 'pierce' && !lineOfSight(match.map, b.x, b.y, o.x, o.y))) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return { a: b.face, d: null };
  const t = lobbed ? spec.flight * 0.8 : spec.speed ? bd / spec.speed * 0.6 : 0;
  const px = best.x + best.vx * t, py = best.y + best.vy * t;
  return { a: Math.atan2(py - b.y, px - b.x), d: Math.hypot(px - b.x, py - b.y) };
}

function controls() {
  return match.brawlers.map((b, i) => {
    if (!b.alive) return null;
    if (b === me) {
      const mv = input.moveVec(), q = input.take();
      const c = { mx: mv.x, my: mv.y, fire: null, sup: null };
      if (q) {
        const spec = q.type === 'super' ? b.def.super : b.def.attack;
        const aim = q.auto ? autoAim(b, spec) : { a: q.a, d: (spec.range || 0) * q.f };
        if (q.type === 'super') c.sup = aim; else c.fire = aim;
        lastShotMode = q.auto ? 'auto' : 'aim';
      }
      return c;
    }
    if (b.dummy) return { mx: 0, my: 0, fire: null, sup: null };
    return botControl(match, b, brains[i], STEP);
  });
}

function watchEvents() {
  for (const e of match.events) {
    playSound(e);
    if (tut) {
      if (e.type === 'hit' && e.by === me.id) { if (lastShotMode === 'auto') tut.autoHits++; else tut.aimHits++; }
      if (e.type === 'super' && e.id === me.id) tut.supers++;
      continue;
    }
    if (e.type === 'kill' && me) {
      if (e.by === me.id) banner('처치!', 0.9);
      else if (e.id === me.id) banner('쓰러졌어요!', 1.2);
    } else if (e.type === 'sudden') banner('서든데스! 다음 처치로 승부', 2);
    else if (e.type === 'spawn' && me && e.id === me.id) banner('부활!', 0.8);
    else if (e.type === 'cube' && me && e.id === me.id) banner(`파워 큐브 ◆${me.cubes}`, 0.8);
    else if (e.type === 'kill' && match.mode === 'survival' && e.by === me.id) banner('처치!', 0.9);
    else if (e.type === 'super' && me && e.id === me.id) banner(`★ ${me.def.super.name}!`, 0.9);
  }
}

function tutorialTick(dt) {
  if (!tut) return;
  const s = STEPS[tut.i];
  if (tut.okT > 0) { tut.okT -= dt; if (tut.okT <= 0) nextTutorialStep(); return; }
  if (s.done(tut, me, match)) { ctext.textContent = '잘했어요! 👍'; ctext.classList.add('ok'); tut.okT = 1.1; }
  // The dummy heals up so it never runs out, and the super step keeps the gauge full until used.
  const dummy = match.brawlers.find(b => b.dummy);
  if (dummy && dummy.alive && dummy.hp < dummy.maxHp * 0.3) dummy.hp = dummy.maxHp;
}

// Sounds: my own actions at full volume, other fights quieter with distance, far ones not at all.
function playSound(e) {
  if (!me) return;
  const near = (x, y) => { const d = Math.hypot(x - me.x, y - me.y); return d > 9 ? 0 : 1 - d / 12; };
  const who = e.id != null ? match.brawlers[e.id] : null;
  if (e.type === 'attack') { const v = e.id === me.id ? 1 : near(who.x, who.y) * 0.6; if (v > 0) sfx.shot(e.kind, v); }
  else if (e.type === 'hit') { if (e.id === me.id) sfx.hurt(); else if (e.by === me.id) sfx.hit(); }
  else if (e.type === 'splash') { const v = near(e.x, e.y); if (v > 0) sfx.splash(v); }
  else if (e.type === 'kill') { if (e.by === me.id || e.id === me.id) sfx.kill(); }
  else if (e.type === 'super') { if (e.id === me.id) sfx.super(); }
  else if (e.type === 'cube') { if (e.id === me.id) sfx.cube(); }
  else if (e.type === 'boxbreak') { const v = near(e.x, e.y); if (v > 0) sfx.box(v); }
}

function banner(text, t) { bannerEl.textContent = text; bannerEl.classList.add('on'); bannerT = t; }

function finish() {
  state = 'over'; input.enabled = false; pauseBtn.hidden = true;
  bannerEl.classList.remove('on'); bannerT = 0;
  const survival = match.mode === 'survival';
  const place = survival ? (me.alive ? 1 : me.place) : 0;
  const won = survival ? place === 1 : match.winner === BLUE, draw = !survival && match.winner === 'draw';
  const mvp = !survival && mvpOf(match) === me && me.kills > 0;
  const gain = survival ? TROPHY.survival[place - 1] : (draw ? TROPHY.draw : won ? TROPHY.win : TROPHY.lose) + (mvp ? TROPHY.mvp : 0);
  const lvBefore = levelFor(trophyBy[me.kind] || 0);
  trophies = Math.max(0, trophies + gain); save(KEY_TROPHY, trophies);
  trophyBy[me.kind] = Math.max(0, (trophyBy[me.kind] || 0) + gain); save(KEY_BY, trophyBy);
  const lvUp = levelFor(trophyBy[me.kind]) > lvBefore;
  if (won || (survival && place <= 3)) sfx.win(); else sfx.lose();
  // Winning (team win, or 1st in survival) unlocks the next stage.
  const md = match.mode, st = match.stage || 1;
  let stageNote = '';
  if (won) {
    if (st < STAGES.count) { stages[md] = st + 1; stageNote = `다음은 ${st + 1}탄!`; autoNext = 3; }
    else { stages.cleared = { ...(stages.cleared || {}), [md]: true }; stageNote = `🏆 ${MODE_NAME[md]} ${STAGES.count}탄 클리어!`; }
    save(KEY_STAGE, stages);
  }
  const first = survival ? `생존전 ${st}탄 ${place}등` : `팀전 ${st}탄 ${draw ? '무승부' : won ? '승리' : '패배'}`;
  const result = survival ? first : `${first} ${match.score[0]}:${match.score[1]}`;
  const d = new Date(), entry = { id: Date.now(), result, brawler: me.def.name, kills: me.kills, trophy: gain, date: `${d.getMonth() + 1}/${d.getDate()}` };
  const top = load(KEY_TOP, []); top.push(entry);
  top.sort((a, b) => b.trophy - a.trophy || b.kills - a.kills || b.id - a.id);
  save(KEY_TOP, top.slice(0, 10)); lastEntry = entry.id;

  titleEl.textContent = survival ? (place === 1 ? '1등! 최후의 생존자' : `${place}등`) : draw ? '무승부' : won ? '승리!' : '패배';
  msgEl.innerHTML = survival ? `6명 중 <b>${place}등</b> · 파워 큐브 <b>${me.cubes}</b>개` : `파랑 <b>${match.score[0]}</b> : <b>${match.score[1]}</b> 빨강`;
  finalEl.replaceChildren();
  const line = (text, cls) => { const s = document.createElement('div'); s.textContent = text; if (cls) s.className = cls; finalEl.append(s); };
  line(`${me.def.name} · 처치 ${me.kills} · 쓰러짐 ${me.deaths}${mvp ? ' · MVP!' : ''}`);
  line(`트로피 ${gain >= 0 ? '+' : ''}${gain}  (총 ${trophies})`, 'tr');
  if (lvUp) line(`🎉 ${me.def.name} Lv.${levelFor(trophyBy[me.kind])} 달성!`, 'tr');
  if (stageNote) line(stageNote);
  finalEl.hidden = false; startBtn.textContent = autoNext ? `${st + 1}탄 시작 (${autoNext})` : '다시 하기';
  buttons(false); panel('main'); overlay.hidden = false;
  updateHud();
}

function updateHud() {
  hud.trophy.textContent = trophies;
  const survival = match.mode === 'survival';
  hud.score.hidden = survival; hud.alive.hidden = !survival;
  hud.midLabel.textContent = survival ? '남은 인원' : '파랑 : 빨강';
  hud.clockLabel.textContent = survival ? '독구름' : '시간';
  if (survival) {
    hud.alive.textContent = match.brawlers.filter(b => b.alive).length;
    const until = Math.ceil(SURVIVAL.poisonStart - match.t);
    hud.clock.textContent = until > 0 ? `${Math.floor(until / 60)}:${String(until % 60).padStart(2, '0')}` : '좁혀지는 중';
    hud.clock.classList.toggle('hot', until <= 10);
    return;
  }
  const [bs, rs] = hud.score.children;
  bs.textContent = match.score[0]; rs.textContent = match.score[1];
  if (mode === 'tutorial') { hud.clock.textContent = '연습'; hud.clock.classList.remove('hot'); return; }
  if (match.phase === 'sudden') { hud.clock.textContent = '서든데스'; hud.clock.classList.add('hot'); }
  else {
    const s = Math.ceil(timeLeft(match));
    hud.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    hud.clock.classList.toggle('hot', s <= 30);
  }
}

// ---------- loop ----------
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state === 'play' || state === 'title') {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      step(match, STEP, controls());
      if (state === 'play') {
        watchEvents(); tutorialTick(STEP);
        if (match.phase === 'over' || (match.mode === 'survival' && !me.alive)) { finish(); break; }
        if (state !== 'play') break;
      } else if (match.phase === 'over') newAttract();
    }
    if (acc > STEP * 5) acc = 0;
  }
  // After a win the next stage starts by itself (the button starts it right away).
  if (state === 'over' && autoNext > 0 && !panels.main.hidden) {
    const before = Math.ceil(autoNext); autoNext -= dt;
    if (autoNext <= 0) { autoNext = 0; startMatch(); }
    else if (Math.ceil(autoNext) !== before) startBtn.textContent = `${match.stage + 1}탄 시작 (${Math.ceil(autoNext)})`;
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  if (state === 'play' && match.mode === 'survival' && match.t >= SURVIVAL.poisonStart && !match.warned) { match.warned = true; banner('독구름이 몰려와요!', 1.6); }
  if (state === 'play' && me && !me.alive && bannerT <= 0 && match.mode !== 'survival') { bannerEl.textContent = `부활까지 ${Math.ceil(me.respawnT)}`; bannerEl.classList.add('on'); }
  if (state === 'play' && me && me.alive && bannerT <= 0) bannerEl.classList.remove('on');

  input.state.superReady = !!(me && me.alive && me.charge >= 1 && !me.dash);
  const playing = state === 'play' || state === 'paused';
  view.draw(match, {
    meId: me ? me.id : null,
    aim: state === 'play' ? input.aiming() : null,
    input: playing && me ? input.state : null,
    focus: me || match.brawlers.find(b => b.alive) || null,
    viewTeam: me ? BLUE : null,
    marker: tut && STEPS[tut.i] && STEPS[tut.i].marker ? match.mapDef.marker : null,
    tilesAcross: me ? 10 : 12,
    minimap: !!me && mode !== 'tutorial',
  }, state === 'play' || state === 'title' ? dt : 0);
  if (me) updateHud(); else hud.trophy.textContent = trophies;
  requestAnimationFrame(frame);
}

// ---------- no pinch zoom (two thumbs on screen during play) ----------
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => {
  if (window.visualViewport.scale <= 1.01) return;
  const mv = document.querySelector('meta[name=viewport]'); if (!mv) return;
  const c = mv.content; mv.content = c + ', maximum-scale=1'; setTimeout(() => { mv.content = c; }, 80);
});

function resize() { const r = stage.getBoundingClientRect(); view.resize(r.width, r.height); }
new ResizeObserver(resize).observe(stage);
resize(); buildCards(); showTitle();
requestAnimationFrame(frame);

// Test hook (used by the automated checks; harmless in play).
window.__brawl = { get match() { return match; }, get state() { return state; }, get me() { return me; }, get tut() { return tut; }, input };
