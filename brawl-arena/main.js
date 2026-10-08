// 대난투 아레나 — entry point: menus, brawler select, tutorial, the frame loop, HUD, results and the local ranking.
// Rules live in game.js, bots in bot.js, drawing in render.js/art.js, thumbsticks in input.js.

import { MAPS } from './maps.js';
import { BRAWLERS, KINDS, TROPHY, botLevelFor } from './config.js';
import { createMatch, step, lineOfSight, visibleTo, timeLeft, mvpOf, BLUE, RED } from './game.js';
import { makeBrain, botControl } from './bot.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawPerson } from './art.js';
import { STEPS } from './tutorial.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), overlay = $('overlay');
const panels = { main: $('pMain'), help: $('pHelp'), rank: $('pRank'), pause: $('pPause'), select: $('pSelect') };
const titleEl = $('title'), msgEl = $('msg'), finalEl = $('final'), toast = $('toast');
const startBtn = $('start'), homeBtn = $('home'), helpBtn = $('helpBtn'), menuLink = $('toMenu'), pauseBtn = $('pause');
const rowsEl = $('rows'), rankNote = $('rankNote'), bannerEl = $('banner');
const coach = $('coach'), cstep = $('cstep'), ctext = $('ctext');
const hud = { trophy: $('trophy'), score: $('score'), clock: $('clock') };

const KEY_TOP = 'brawl-top', KEY_TROPHY = 'brawl-trophy', KEY_TUT = 'brawl-tutorial', KEY_PICK = 'brawl-pick';
const STEP = 1 / 60;

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: play on without saving */ } }

const input = createInput(stage);
const view = createRenderer($('c'));

let state = 'title';   // title | play | paused | over
let mode = 'team';     // team | tutorial
let match = null, brains = [], me = null, acc = 0, last = performance.now();
let trophies = load(KEY_TROPHY, 0), lastEntry = null, pick = KINDS.includes(load(KEY_PICK, 'gyo')) ? load(KEY_PICK, 'gyo') : 'gyo';
let bannerT = 0;
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
  state = 'title'; mode = 'team'; input.enabled = false; pauseBtn.hidden = true; coach.hidden = true; toast.textContent = '';
  bannerEl.classList.remove('on'); bannerT = 0;
  titleEl.textContent = '대난투 아레나';
  msgEl.innerHTML = '교행이 · 짬뽕이 · 소월이<br><b>3:3 팀전</b>, 먼저 <b>10번</b> 쓰러뜨리는 팀이 승리!';
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
    const st = document.createElement('div'); st.className = 'st'; st.textContent = `체력 ${d.hp} · 사거리 ${d.attack.range}칸 · 필살기 ${d.super.name}`;
    info.append(nm, bl, st);
    card.append(cv, info);
    card.addEventListener('click', () => { pick = kind; save(KEY_PICK, pick); markPick(); });
    wrap.append(card);
  }
  markPick();
}
function markPick() { for (const c of document.querySelectorAll('.card')) c.setAttribute('aria-checked', String(c.dataset.kind === pick)); }

helpBtn.addEventListener('click', () => panel('help'));
$('rankBtn').addEventListener('click', () => { renderTop(lastEntry); panel('rank'); });
homeBtn.addEventListener('click', showTitle);
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => panel('main')));
startBtn.addEventListener('click', () => {
  if (state === 'over' && mode === 'team') return startMatch();          // 다시 하기: same brawler
  if (!load(KEY_TUT, false)) return startTutorial();                     // first time: learn the controls
  panel('select');
});
$('go').addEventListener('click', startMatch);
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
  mode = 'team'; coach.hidden = true;
  match = createMatch({ mapDef: MAPS.team, seed: (Math.random() * 1e9) | 0, playerKind: pick });
  const level = botLevelFor(trophies);
  brains = match.brawlers.map(b => (b.isPlayer ? null : makeBrain(level)));
  begin();
  banner('시작!', 1.2);
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

function banner(text, t) { bannerEl.textContent = text; bannerEl.classList.add('on'); bannerT = t; }

function finish() {
  state = 'over'; input.enabled = false; pauseBtn.hidden = true;
  bannerEl.classList.remove('on'); bannerT = 0;
  const won = match.winner === BLUE, draw = match.winner === 'draw';
  const mvp = mvpOf(match) === me && me.kills > 0;
  const gain = (draw ? TROPHY.draw : won ? TROPHY.win : TROPHY.lose) + (mvp ? TROPHY.mvp : 0);
  trophies = Math.max(0, trophies + gain); save(KEY_TROPHY, trophies);
  const result = `${draw ? '무승부' : won ? '승리' : '패배'} ${match.score[0]}:${match.score[1]}`;
  const d = new Date(), entry = { id: Date.now(), result, brawler: me.def.name, kills: me.kills, trophy: gain, date: `${d.getMonth() + 1}/${d.getDate()}` };
  const top = load(KEY_TOP, []); top.push(entry);
  top.sort((a, b) => b.trophy - a.trophy || b.kills - a.kills || b.id - a.id);
  save(KEY_TOP, top.slice(0, 10)); lastEntry = entry.id;

  titleEl.textContent = draw ? '무승부' : won ? '승리!' : '패배';
  msgEl.innerHTML = `파랑 <b>${match.score[0]}</b> : <b>${match.score[1]}</b> 빨강`;
  finalEl.replaceChildren();
  const line = (text, cls) => { const s = document.createElement('div'); s.textContent = text; if (cls) s.className = cls; finalEl.append(s); };
  line(`${me.def.name} · 처치 ${me.kills} · 쓰러짐 ${me.deaths}${mvp ? ' · MVP!' : ''}`);
  line(`트로피 ${gain >= 0 ? '+' : ''}${gain}  (총 ${trophies})`, 'tr');
  finalEl.hidden = false; startBtn.textContent = '다시 하기';
  buttons(false); panel('main'); overlay.hidden = false;
  updateHud();
}

function updateHud() {
  hud.trophy.textContent = trophies;
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
        if (match.phase === 'over') { finish(); break; }
        if (state !== 'play') break;
      } else if (match.phase === 'over') newAttract();
    }
    if (acc > STEP * 5) acc = 0;
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  if (state === 'play' && me && !me.alive && bannerT <= 0) { bannerEl.textContent = `부활까지 ${Math.ceil(me.respawnT)}`; bannerEl.classList.add('on'); }
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
