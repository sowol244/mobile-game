// 룩스 앤 움브라 — entry point: menus, stage select, the frame loop, HUD, results, local ranking.
// Rules live in game.js, drawing in render.js/art.js, controls in input.js, sound in sound.js.

import { LEVELS, CHAPTERS } from './levels.js';
import { SOLUTIONS } from './solutions.js';
import { createGame, step, starsFor, anyLightOn, torchOrigin, retry } from './game.js';
import { driver } from './bot.js';
import { STEP, COL } from './config.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawPlayer } from './art.js';
import { sfx, unlock, isMuted, setMuted, music, musicLight } from './sound.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), overlay = $('overlay'), canvas = $('c');
const panels = { main: $('pMain'), stages: $('pStages'), help: $('pHelp'), rank: $('pRank'), pause: $('pPause') };
const titleEl = $('title'), msgEl = $('msg'), finalEl = $('final'), eyebrow = $('eyebrow');
const startBtn = $('start'), homeBtn = $('home'), helpBtn = $('helpBtn'), rankBtn = $('rankBtn'), againBtn = $('again'), menuLink = $('toMenu');
const pauseBtn = $('pause'), retryBtn = $('retry'), muteBtn = $('mute'), bannerEl = $('banner');
const hud = { stage: $('hStage'), name: $('hName'), shard: $('hShard'), shardLabel: $('hShardLabel'), time: $('hTime'), timeLabel: $('hTimeLabel') };
const torchBtn = $('torch'), knob = $('knob'), blinkBtn = $('blink');
let blinkWarned = false; // one hint per press of 깜빡 while the torch is off

const KEY_PROG = 'lux-progress', KEY_TOP = 'lux-top';
function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: play on without saving */ } }

const view = createRenderer(canvas);
const input = createInput({ stage, left: $('left'), right: $('right'), jump: $('jump'), blink: $('blink'), torch: torchBtn, knob });

let state = 'title';      // title | play | paused | clear
let game = null, idx = 0, demo = null, bot = null;
// { '1-1': { s: [clear, shard, time], best: seconds } }. Saves from older builds are kept by stage id;
// anything malformed or for a stage that no longer exists is dropped instead of crashing the menus.
let progress = cleanProgress(load(KEY_PROG, {}));
function cleanProgress(p) {
  const out = {}, ids = new Set(LEVELS.map(L => L.id));
  if (!p || typeof p !== 'object' || Array.isArray(p)) return out;
  for (const [id, v] of Object.entries(p)) {
    if (!ids.has(id) || !v || typeof v !== 'object') continue;
    const st = Array.isArray(v.s) ? [0, 1, 2].map(k => !!v.s[k]) : [true, false, false];
    st[0] = true;
    const best = Number.isFinite(v.best) && v.best > 0 ? v.best : LEVELS.find(L => L.id === id).par;
    out[id] = { s: st, best };
  }
  return out;
}
const cleanTop = t => (Array.isArray(t) ? t.filter(e => e && typeof e === 'object' && typeof e.stage === 'string' && Number.isFinite(e.time) && Number.isFinite(e.stars)).slice(0, 10) : []);
let lastEntry = null, clearT = 0, resultShown = false, bannerT = 0;
let acc = 0, last = performance.now(), clock = 0;

const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const starCount = id => (progress[id] ? progress[id].s.filter(Boolean).length : 0);
const totalStars = () => LEVELS.reduce((a, L) => a + starCount(L.id), 0);
const unlocked = i => i === 0 || !!progress[LEVELS[i - 1].id];
const firstOpen = () => { const i = LEVELS.findIndex(L => !progress[L.id]); return i < 0 ? 0 : i; };

// ---------- panels ----------
function panel(name) { for (const [k, el] of Object.entries(panels)) el.hidden = k !== name; overlay.hidden = false; overlay.scrollTop = 0; }
function secButtons(afterRun) { helpBtn.hidden = afterRun; menuLink.hidden = afterRun; homeBtn.hidden = !afterRun; againBtn.hidden = !afterRun; }

function showTitle() {
  state = 'title'; input.enabled = false; input.reset();
  pauseBtn.hidden = true; retryBtn.hidden = true; banner('');
  eyebrow.hidden = false; titleEl.textContent = '룩스 앤 움브라';
  msgEl.textContent = '빛을 켜고 꺼서 길을 여는 퍼즐 게임';
  finalEl.hidden = true; startBtn.textContent = '시작';
  secButtons(false); panel('main');
  startDemo();
  paintHud();
}

function startDemo() {
  const i = 0;
  game = createGame(LEVELS[i]); idx = i; view.reset();
  demo = driver(game, SOLUTIONS[LEVELS[i].id]);
  clearT = 0;
}

// Stage select: one chapter (10 stages) per page, ◀ ▶ / dots / swipe to change chapter.
let page = null;
function buildStages(ch) {
  const next = firstOpen();
  if (ch != null) page = ch;
  else if (page == null || state === 'title') page = LEVELS[next].ch;
  page = Math.max(0, Math.min(CHAPTERS.length - 1, page));
  $('starTotal').textContent = `★ ${totalStars()} / ${LEVELS.length * 3}`;
  const C = CHAPTERS[page], list = LEVELS.map((L, i) => [L, i]).filter(([L]) => L.ch === page);
  const got = list.reduce((a, [L]) => a + starCount(L.id), 0);
  $('chName').textContent = `${page + 1}. ${C.name}`;
  $('chSub').textContent = `${C.sub} · ★ ${got}/${list.length * 3}`;
  $('chPrev').disabled = page === 0; $('chNext').disabled = page === CHAPTERS.length - 1;
  const dots = $('chDots'); dots.replaceChildren();
  CHAPTERS.forEach((D, ci) => {
    const d = document.createElement('button'); d.type = 'button'; d.setAttribute('role', 'tab');
    d.setAttribute('aria-selected', String(ci === page)); d.setAttribute('aria-label', `${ci + 1}장 ${D.name}`);
    if (LEVELS.filter(L => L.ch === ci).every(L => progress[L.id])) d.className = 'done';
    d.addEventListener('click', () => { sfx.click(); buildStages(ci); });
    dots.append(d);
  });
  const grid = $('stageGrid'); grid.replaceChildren();
  for (const [L, i] of list) {
    const open = unlocked(i);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'stg' + (i === next && !progress[L.id] ? ' next' : '');
    btn.disabled = !open;
    const id = document.createElement('span'); id.className = 'id'; id.textContent = open ? L.id : '🔒';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = open ? L.name : '잠김';
    const meta = document.createElement('span'); meta.className = 'meta';
    const sr = document.createElement('span'); sr.className = 'sr';
    (progress[L.id] ? progress[L.id].s : [false, false, false]).forEach(g => { const e = document.createElement(g ? 'b' : 'span'); e.textContent = '★'; sr.append(e); });
    const bt = document.createElement('span'); bt.className = 'bt'; bt.textContent = progress[L.id] ? fmt(progress[L.id].best) : '';
    meta.append(sr, bt);
    btn.append(id, nm, meta);
    btn.setAttribute('aria-label', `${L.id} ${L.name}${open ? '' : ' 잠김'}, 별 ${starCount(L.id)}개`);
    btn.addEventListener('click', () => { unlock(); sfx.click(); startStage(i); });
    grid.append(btn);
  }
}
$('chPrev').addEventListener('click', () => { sfx.click(); buildStages(page - 1); });
$('chNext').addEventListener('click', () => { sfx.click(); buildStages(page + 1); });
{ // swipe sideways on the grid to turn the page
  let sx = null, sy = 0;
  const grid = $('stageGrid');
  grid.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  grid.addEventListener('pointerup', e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) buildStages(page + (dx < 0 ? 1 : -1));
  });
}

function renderTop(highlight) {
  const rows = $('rows'), top = cleanTop(load(KEY_TOP, []));
  rows.replaceChildren();
  top.forEach((e, i) => {
    const li = document.createElement('li');
    if (highlight && e.uid === highlight) li.className = 'me';
    for (const [text, cls] of [[`${i + 1}`, 'rk'], [`${e.stage} ${e.name}`, 'nm'], ['★'.repeat(e.stars) + '☆'.repeat(3 - e.stars), 'st'], [fmt(e.time), 'tm']]) {
      const s = document.createElement('span'); s.className = cls; s.textContent = text; li.append(s);
    }
    rows.append(li);
  });
  $('rankNote').textContent = top.length ? '별이 많고 빠른 기록 순서예요. 이 기기에만 저장돼요.' : '아직 기록이 없어요.';
}

helpBtn.addEventListener('click', () => { sfx.click(); panel('help'); });
rankBtn.addEventListener('click', () => { sfx.click(); renderTop(lastEntry); panel('rank'); });
homeBtn.addEventListener('click', () => { sfx.click(); showTitle(); });
againBtn.addEventListener('click', () => { unlock(); sfx.click(); startStage(idx); });
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => { sfx.click(); panel('main'); }));
startBtn.addEventListener('click', () => {
  unlock(); sfx.click();
  if (state === 'clear') {
    if (idx + 1 < LEVELS.length) return startStage(idx + 1);
    buildStages(); return panel('stages');
  }
  buildStages(); panel('stages');
});
$('resume').addEventListener('click', () => pause(false));
$('restart').addEventListener('click', () => { sfx.click(); startStage(idx); });
$('toStages').addEventListener('click', () => { sfx.click(); const c = LEVELS[idx].ch; showTitle(); buildStages(c); panel('stages'); });
$('quit').addEventListener('click', () => { sfx.click(); showTitle(); });
pauseBtn.addEventListener('click', () => pause(true));
retryBtn.addEventListener('click', () => { if (state === 'play') retry(game); });
input.onPause = () => { if (state === 'play') pause(true); else if (state === 'paused') pause(false); };
input.onRetry = () => { if (state === 'play') retry(game); };
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(true); });

function paintMute() { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; muteBtn.setAttribute('aria-pressed', String(isMuted())); muteBtn.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기'); }
muteBtn.addEventListener('click', () => { unlock(); setMuted(!isMuted()); paintMute(); if (!isMuted()) sfx.click(); });
paintMute();

function pause(on) {
  if (on && state === 'play') { state = 'paused'; input.enabled = false; input.reset(); pauseBtn.hidden = true; retryBtn.hidden = true; banner(''); panel('pause'); music(false); }
  else if (!on && state === 'paused') { state = 'play'; input.enabled = true; pauseBtn.hidden = false; retryBtn.hidden = false; overlay.hidden = true; last = performance.now(); music(true); }
}

function banner(html, sec = 0) {
  bannerEl.innerHTML = html; bannerT = sec;
  bannerEl.classList.toggle('on', !!html && sec > 0);
}

// ---------- stages ----------
function startStage(i) {
  idx = i; demo = null; bot = null;
  game = createGame(LEVELS[i]); view.reset();
  state = 'play'; input.enabled = true; input.reset();
  overlay.hidden = true; pauseBtn.hidden = false; retryBtn.hidden = false;
  clearT = 0; resultShown = false; acc = 0; last = performance.now();
  const L = LEVELS[i];
  banner(`<small>${L.id} · ${CHAPTERS[L.ch].name}</small>${L.name}`, 1.8);
  music(true);
  paintHud();
}

function finishStage() {
  const L = LEVELS[idx], st = starsFor(game), n = st.filter(Boolean).length;
  const prev = progress[L.id];
  const isNew = !prev || game.t < prev.best;
  progress[L.id] = { s: prev ? prev.s.map((v, k) => v || st[k]) : st, best: prev ? Math.min(prev.best, game.t) : game.t };
  save(KEY_PROG, progress);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const top = cleanTop(load(KEY_TOP, []));
  top.push({ uid, stage: L.id, name: L.name, stars: n, time: Math.round(game.t * 10) / 10 });
  top.sort((a, b) => b.stars - a.stars || a.time - b.time);
  const kept = top.slice(0, 10);
  save(KEY_TOP, kept);
  lastEntry = kept.some(e => e.uid === uid) ? uid : null;

  state = 'clear'; input.enabled = false; input.reset(); pauseBtn.hidden = true; retryBtn.hidden = true; banner('');
  music(false);
  const lastStage = idx + 1 >= LEVELS.length;
  eyebrow.hidden = true;
  titleEl.textContent = lastStage ? '모든 빛을 찾았어요!' : '클리어!';
  msgEl.textContent = `${L.id} ${L.name}`;
  finalEl.replaceChildren();
  const stars = document.createElement('div'); stars.className = 'stars';
  st.forEach(g => { const e = document.createElement(g ? 'b' : 'span'); e.textContent = '★'; stars.append(e); });
  const why = document.createElement('div'); why.className = 'why';
  [['클리어', true], ['빛 조각', st[1]], [`${fmt(game.t)} / 기준 ${fmt(L.par)}`, st[2]]].forEach(([t, ok]) => { const s = document.createElement('span'); s.textContent = (ok ? '✓ ' : '· ') + t; if (ok) s.className = 'ok'; why.append(s); });
  finalEl.append(stars, why);
  if (isNew && prev) { const nw = document.createElement('div'); nw.className = 'new'; nw.textContent = '최고 기록!'; finalEl.append(nw); }
  finalEl.hidden = false;
  startBtn.textContent = lastStage ? '스테이지 선택' : '다음 스테이지';
  secButtons(true);
  panel('main');
  st.forEach((g, k) => { if (g) setTimeout(() => sfx.star(k), 250 + k * 180); });
}

// ---------- HUD ----------
let hudCache = '';
function paintHud() {
  let key;
  if (state === 'play' || state === 'paused' || state === 'clear') {
    const L = LEVELS[idx];
    key = `${L.id}|${game.shard && game.shard.got}|${Math.floor(game.t)}`;
    if (key === hudCache) return; hudCache = key;
    hud.stage.textContent = `${L.id} · ${CHAPTERS[L.ch].name}`; hud.name.textContent = L.name;
    hud.shardLabel.textContent = '빛 조각';
    const got = game.shard && game.shard.got;
    hud.shard.textContent = got ? '◆' : '◇'; hud.shard.classList.toggle('got', !!got);
    hud.timeLabel.textContent = `기준 ${fmt(L.par)}`; hud.time.textContent = fmt(game.t);
  } else {
    key = `menu|${totalStars()}`;
    if (key === hudCache) return; hudCache = key;
    hud.stage.textContent = '룩스 앤 움브라'; hud.name.textContent = 'Lux & Umbra';
    hud.shardLabel.textContent = '별'; hud.shard.textContent = `★ ${totalStars()}`; hud.shard.classList.remove('got');
    hud.timeLabel.textContent = '스테이지'; hud.time.textContent = `${LEVELS.filter((L, i) => progress[L.id]).length}/${LEVELS.length}`;
  }
}

// ---------- events → sound ----------
function events() {
  for (const e of game.events) {
    view.onEvent(game, e);
    if (demo) continue; // the title demo plays silently
    switch (e.type) {
      case 'torchOn': sfx.torchOn(); break;
      case 'torchOff': sfx.torchOff(); break;
      case 'lever': case 'leverBack': sfx.lever(); break;
      case 'mirror': sfx.lens(); break;
      case 'lens': sfx.lens(); break;
      case 'jump': sfx.jump(); break;
      case 'land': sfx.land(); break;
      case 'die': sfx.die(); break;
      case 'respawn': sfx.respawn(); break;
      case 'shard': sfx.shard(); banner('빛 조각!', 0.9); break;
      case 'check': sfx.check(); break;
      case 'reveal': sfx.reveal(); break;
      case 'wake': sfx.wake(); break;
      case 'freeze': sfx.freeze(); break;
      case 'solid': sfx.solid(); break;
      case 'thud': sfx.thud(); break;
      case 'clear': sfx.clear(); break;
      default: break;
    }
  }
  game.events.length = 0;
}

// mouse: screen point → aim angle from the torch
function aimFromScreen(px, py) {
  const w = view.toWorld(px, py), o = torchOrigin(game);
  return Math.atan2(w.y - o.y, w.x - o.x);
}

// ---------- loop ----------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  const running = state === 'play' || state === 'title' || state === 'clear';
  if (running && game) {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 12) {
      acc -= STEP;
      let inp = {};
      if (demo) inp = demo();
      else if (bot) inp = bot();
      else if (state === 'play') { inp = input.read(aimFromScreen); input.consume(); }
      step(game, inp, STEP);
      events();
      if (game.cleared) break;
    }
    if (acc > STEP * 12) acc = 0;
    if (game.cleared) {
      clearT += dt;
      if (demo && clearT > 1.2) startDemo();
      else if (!demo && state === 'play' && clearT > 0.9 && !resultShown) { resultShown = true; finishStage(); }
    }
    if (demo && game.t > 40) startDemo();
  }
  if (game) {
    view.draw(game, clock, dt, { clearT, noSigns: !!demo });
    if (!demo && state === 'play') musicLight(anyLightOn(game));
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.classList.remove('on'); }
  // torch button mirrors the torch
  if (game) {
    const on = game.fl.on && state === 'play';
    torchBtn.classList.toggle('lit', on);
    torchBtn.classList.toggle('dim', on && game.fl.dark);
    torchBtn.classList.toggle('red', game.fl.col === COL.r);
    torchBtn.classList.toggle('blue', game.fl.col === COL.b);
    knob.style.transform = `rotate(${game.fl.aim}rad)`;
    // 깜빡 only works while the torch is on: dim it otherwise, and say so if pressed
    blinkBtn.classList.toggle('idle', !game.fl.on);
    if (state === 'play' && game.fl.dark && !game.fl.on) { if (!blinkWarned) { blinkWarned = true; banner('<small>깜빡은</small>손전등을 켠 채 눌러요', 1.4); } }
    else if (!game.fl.dark) blinkWarned = false;
  }
  paintHud();
  requestAnimationFrame(frame);
}

function resize() {
  const r = stage.getBoundingClientRect();
  view.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 1.5)); // 1.5× is sharp enough and keeps phones smooth
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);

// Two thumbs on the screen must never start the browser's pinch zoom.
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => {
  if (window.visualViewport.scale <= 1.01) return;
  const m = document.querySelector('meta[name=viewport]'); if (!m) return;
  const c = m.content; m.content = c + ', maximum-scale=1'; setTimeout(() => { m.content = c; }, 80);
});
// first touch anywhere wakes up audio
window.addEventListener('pointerdown', () => unlock(), { once: true });

resize();
showTitle();
requestAnimationFrame(frame);

// ---------- test hook (automation; harmless in normal play) ----------
window.__lux = {
  get state() { return state; },
  get game() { return game; },
  get idx() { return idx; },
  levels: LEVELS.map(L => L.id),
  start(i) { startStage(i); },
  // play the current stage with its scripted solution, in real time
  autoplay(on = true) { bot = on && game ? driver(game, SOLUTIONS[game.def.id]) : null; },
  // solve a stage instantly (no rendering), returns the outcome
  solve(i) {
    const s = createGame(LEVELS[i]), next = driver(s, SOLUTIONS[LEVELS[i].id]);
    for (let k = 0; k < 120 / STEP && !s.cleared; k++) { step(s, next(), STEP); s.events.length = 0; }
    return { id: LEVELS[i].id, cleared: s.cleared, deaths: s.deaths, shard: !!(s.shard && s.shard.got), t: Math.round(s.t * 10) / 10 };
  },
  stepSim(n) { for (let k = 0; k < n; k++) { step(game, {}, STEP); events(); } },
  unlockAll() { LEVELS.forEach(L => { if (!progress[L.id]) progress[L.id] = { s: [true, false, false], best: L.par }; }); save(KEY_PROG, progress); },
  resetProgress() { progress = {}; save(KEY_PROG, {}); save(KEY_TOP, []); },
  progress: () => progress,
  // the home-screen icon, drawn with the game's own art
  icon(size = 192) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), k = size / 4;
    const bg = g.createLinearGradient(0, 0, 0, size); bg.addColorStop(0, '#0a1024'); bg.addColorStop(1, '#141f44');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.setTransform(k, 0, 0, k, 0, 0); // 4 tiles across
    // torch cone
    const ox = 1.55, oy = 2.55, a = -0.32;
    const cone = g.createRadialGradient(ox, oy, 0, ox, oy, 3.2);
    cone.addColorStop(0, 'rgba(255,224,160,0.95)'); cone.addColorStop(0.5, 'rgba(255,214,150,0.45)'); cone.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = cone; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, 3.2, a - 0.36, a + 0.36); g.closePath(); g.fill();
    // light block glowing in the beam, shadow block in the dark
    g.shadowColor = '#ffd27a'; g.shadowBlur = 14;
    const lb = g.createLinearGradient(0, 1.2, 0, 2.0); lb.addColorStop(0, '#fff3cf'); lb.addColorStop(1, '#ffc865');
    g.fillStyle = lb; g.fillRect(2.95, 1.25, 0.8, 0.8); g.shadowBlur = 0;
    g.fillStyle = '#120a26'; g.fillRect(2.95, 2.95, 0.8, 0.8); g.strokeStyle = '#9a7cff'; g.lineWidth = 0.05; g.strokeRect(2.95, 2.95, 0.8, 0.8);
    // ground
    g.fillStyle = '#04050a'; g.fillRect(0, 3.25, 2.6, 0.75);
    g.strokeStyle = 'rgba(255,224,170,0.9)'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 3.27); g.lineTo(2.6, 3.27); g.stroke();
    drawPlayer(g, 1.3, 3.25, { face: 1, aim: a, on: true, t: 1, scale: 1.75, col: [255, 226, 160] });
    return c.toDataURL('image/png');
  },
};
