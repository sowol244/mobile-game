// 대난투 아레나 — entry point: menus, the frame loop, HUD, results and the local ranking.
// Rules live in game.js, bots in bot.js, drawing in render.js, thumbsticks in input.js.

import { MAPS } from './maps.js';
import { TROPHY, botLevelFor } from './config.js';
import { createMatch, step, lineOfSight, timeLeft, mvpOf, BLUE } from './game.js';
import { makeBrain, botControl } from './bot.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), overlay = $('overlay');
const pMain = $('pMain'), pHelp = $('pHelp'), pRank = $('pRank'), pPause = $('pPause');
const titleEl = $('title'), msgEl = $('msg'), finalEl = $('final'), toast = $('toast');
const startBtn = $('start'), homeBtn = $('home'), helpBtn = $('helpBtn'), menuLink = $('toMenu'), pauseBtn = $('pause');
const rowsEl = $('rows'), rankNote = $('rankNote'), bannerEl = $('banner');
const hud = { trophy: $('trophy'), score: $('score'), clock: $('clock') };

const KEY_TOP = 'brawl-top', KEY_TROPHY = 'brawl-trophy';
const STEP = 1 / 60;

function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: play on without saving */ } }

const input = createInput(stage);
const view = createRenderer($('c'));

let state = 'title'; // title | play | paused | over
let match = null, brains = [], me = null, acc = 0, last = performance.now();
let trophies = load(KEY_TROPHY, 0), lastEntry = null;
let bannerT = 0;

// ---------- menus ----------
function panel(name) { pMain.hidden = name !== 'main'; pHelp.hidden = name !== 'help'; pRank.hidden = name !== 'rank'; pPause.hidden = name !== 'pause'; }
function buttons(onTitle) { helpBtn.hidden = !onTitle; menuLink.hidden = !onTitle; homeBtn.hidden = onTitle; }

function renderTop(highlight) {
  const top = load(KEY_TOP, []);
  rowsEl.replaceChildren();
  top.forEach((e, i) => {
    const li = document.createElement('li');
    if (highlight && e.id === highlight) li.className = 'me';
    const cells = [[`${i + 1}`, 'rk'], [`${e.result} · 처치 ${e.kills}`, 'nm'], [`${e.trophy >= 0 ? '+' : ''}${e.trophy}`, 'sc'], [e.date, 'dt']];
    for (const [text, cls] of cells) { const s = document.createElement('span'); s.className = cls; s.textContent = text; li.append(s); }
    rowsEl.append(li);
  });
  rankNote.textContent = top.length ? '트로피를 많이 얻은 판 순서예요. 이 폰에만 저장돼요.' : '아직 기록이 없어요. 한 판 해 보세요!';
}

function showTitle() {
  state = 'title'; input.enabled = false; pauseBtn.hidden = true; toast.textContent = '';
  bannerEl.classList.remove('on'); bannerT = 0;
  titleEl.textContent = '대난투 아레나';
  msgEl.innerHTML = '<b>3:3 팀전</b> · 아군 봇 2명과 함께<br>먼저 <b>10번</b> 쓰러뜨리는 팀이 승리!';
  finalEl.hidden = true; startBtn.textContent = '시작';
  buttons(true); panel('main'); overlay.hidden = false;
  newAttract();
}

helpBtn.addEventListener('click', () => panel('help'));
$('rankBtn').addEventListener('click', () => { renderTop(lastEntry); panel('rank'); });
homeBtn.addEventListener('click', showTitle);
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => panel('main')));
startBtn.addEventListener('click', startMatch);
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

function startMatch() {
  match = createMatch({ mapDef: MAPS.team, seed: (Math.random() * 1e9) | 0 });
  const level = botLevelFor(trophies);
  brains = match.brawlers.map(b => (b.isPlayer ? null : makeBrain(level)));
  me = match.brawlers.find(b => b.isPlayer);
  view.reset(); acc = 0; last = performance.now(); lastEntry = null;
  state = 'play'; input.enabled = true; overlay.hidden = true; pauseBtn.hidden = false;
  banner('시작!', 1.2);
}

// Tap-to-fire picks the closest enemy in reach that can actually be hit; otherwise shoot straight ahead.
function autoAim(b) {
  let best = null, bd = 1e9;
  for (const o of match.brawlers) {
    if (!o.alive || o.team === b.team) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d > b.def.attack.range + 0.5 || !lineOfSight(match.map, b.x, b.y, o.x, o.y)) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return b.face;
  const t = bd / b.def.attack.speed * 0.6;
  return Math.atan2(best.y + best.vy * t - b.y, best.x + best.vx * t - b.x);
}

function controls() {
  return match.brawlers.map((b, i) => {
    if (!b.alive) return null;
    if (b === me) {
      const mv = input.moveVec(), q = input.take();
      return { mx: mv.x, my: mv.y, fire: q == null ? null : q === 'auto' ? autoAim(b) : q };
    }
    return botControl(match, b, brains[i], STEP);
  });
}

function watchEvents() {
  for (const e of match.events) {
    if (e.type === 'kill' && me) {
      if (e.by === me.id) banner('처치!', 0.9);
      else if (e.id === me.id) banner('쓰러졌어요!', 1.2);
    } else if (e.type === 'sudden') banner('서든데스! 다음 처치로 승부', 2);
    else if (e.type === 'spawn' && me && e.id === me.id) banner('부활!', 0.8);
  }
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
  const d = new Date(), entry = { id: Date.now(), result, kills: me.kills, trophy: gain, date: `${d.getMonth() + 1}/${d.getDate()}` };
  const top = load(KEY_TOP, []); top.push(entry);
  top.sort((a, b) => b.trophy - a.trophy || b.kills - a.kills || b.id - a.id);
  save(KEY_TOP, top.slice(0, 10)); lastEntry = entry.id;

  titleEl.textContent = draw ? '무승부' : won ? '승리!' : '패배';
  msgEl.innerHTML = `파랑 <b>${match.score[0]}</b> : <b>${match.score[1]}</b> 빨강`;
  finalEl.replaceChildren();
  const line = (text, cls) => { const s = document.createElement('div'); s.textContent = text; if (cls) s.className = cls; finalEl.append(s); };
  line(`처치 ${me.kills} · 쓰러짐 ${me.deaths}${mvp ? ' · MVP!' : ''}`);
  line(`트로피 ${gain >= 0 ? '+' : ''}${gain}  (총 ${trophies})`, 'tr');
  finalEl.hidden = false; startBtn.textContent = '다시 하기';
  buttons(false); panel('main'); overlay.hidden = false;
  updateHud();
}

function updateHud() {
  hud.trophy.textContent = trophies;
  const [bs, rs] = hud.score.children;
  bs.textContent = match.score[0]; rs.textContent = match.score[1];
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
      if (state === 'play') { watchEvents(); if (match.phase === 'over') { finish(); break; } }
      else if (match.phase === 'over') newAttract();
    }
    if (acc > STEP * 5) acc = 0;
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  if (state === 'play' && me && !me.alive && bannerT <= 0) { bannerEl.textContent = `부활까지 ${Math.ceil(me.respawnT)}`; bannerEl.classList.add('on'); }
  if (state === 'play' && me && me.alive && bannerT <= 0) bannerEl.classList.remove('on');

  const focus = me || match.brawlers.find(b => b.alive) || null;
  view.draw(match, {
    meId: me ? me.id : null,
    aim: state === 'play' ? input.aiming() : null,
    input: state === 'play' ? input.state : null,
    focus,
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
resize(); showTitle();
requestAnimationFrame(frame);

// Test hook (used by the automated checks; harmless in play).
window.__brawl = { get match() { return match; }, get state() { return state; }, get me() { return me; }, input };
