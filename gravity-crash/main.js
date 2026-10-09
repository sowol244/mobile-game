// 그라비티 크래시 — entry point: menus, puzzle / crash / tutorial flows, the animation timeline, rendering and input.
// All rules live in logic.js; this file only animates the step list that logic.resolve() returns.
import {
  N, DIRS, DV, OPP, cloneBoard, cloneState, settle, resolve, stageState, goalMet, solve, starsFor, createAids, migrateSave,
  rng, dailySeed, crashLevel, spawnInterval, planWave, blockedLines, spawnWave, crashStart, entryCell,
  shuffleColors, commonColor, colorBomb, nextCombo, FEVER_COMBO, FEVER_TIME, fillCount, parseBoard, mk,
} from './logic.js';
import { STAGES, CHAPTERS } from './stages.js';
import { STEPS } from './tutorial.js';
import { createSound } from './sound.js';
import { INFO, ORDER, typesOn, makeDemo } from './guide.js';

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d'), stageEl = $('stage');
const overlay = $('overlay');
const panels = { main: $('pMain'), ask: $('pAsk'), mode: $('pMode'), stages: $('pStages'), result: $('pResult'), pause: $('pPause'), help: $('pHelp'), rank: $('pRank'), intro: $('pIntro'), guide: $('pGuide'), diff: $('pDiff') };
const titleEl = $('title'), msgEl = $('msg'), finalEl = $('final'), toastEl = $('toast'), startBtn = $('start');
const homeBtn = $('home'), helpBtn = $('helpBtn'), rankBtn = $('rankBtn'), menuLink = $('toMenu');
const muteBtn = $('mute'), pauseBtn = $('pause'), barEl = $('bar');
const coachEl = $('coach'), cstepEl = $('cstep'), ctextEl = $('ctext');
const H = { lLabel: $('lLabel'), lVal: $('lVal'), mLabel: $('mLabel'), gauge: $('gauge'), gfill: $('gfill'), glabel: $('glabel'), rLabel: $('rLabel'), rVal: $('rVal') };
const tools = [1, 2, 3].map(i => ({ btn: $('t' + i), n: $(`t${i}n`), ic: $(`t${i}i`), l: $(`t${i}l`), k: $(`t${i}k`) }));
const INTRO = msgEl.innerHTML, TITLE = titleEl.innerHTML;

/* ---------- storage (prefix gcrash-) ---------- */
function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem('gcrash-' + key)); return v ?? fallback; } catch { return fallback; } }
function save(key, v) { try { localStorage.setItem('gcrash-' + key, JSON.stringify(v)); } catch { /* private mode: play on without saving */ } }

const sound = createSound();
const COL = ['#00f0ff', '#ff2fd1', '#7dff3a', '#ffe600'];
const RGB = ['0,240,255', '255,47,209', '125,255,58', '255,230,0'];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => 1 - (1 - k) ** 3;

/* ---------- game state ---------- */
let phase = 'title';      // title | play | paused | over | result
let mode = 'crash';       // puzzle | crash | daily | tutorial
let st = null;            // logic state { board, gravity }
let anim = null;          // { steps, i, t, dur, done, speed }
let parts = [], pops = [], shake = null, tilt = null, warp = 0, lockFlash = 0, flash = 0, time = 0, last = 0;
let preview = null;       // ghost landing preview { dir, ghosts }
let hintDir = null, deadWarn = false;
// puzzle
let stageIdx = 0, movesUsed = 0, undoSnap = null, hinted = false, puzzleDone = false;
const aids = createAids();   // undo 1 · hint 2 per stage
// v2 save cleanup (core goal removed): drop unknown block types from the seen list, sanitize stars.
const migrated = migrateSave({ stars: load('stars', []), seen: load('seen', []) }, STAGES.length);
let stars = migrated.stars;
save('stars', stars); save('seen', migrated.seen); save('ver', 2);
// 초급 (easy) warns when the stage can no longer be cleared; 고급 (hard) never does. null = not chosen yet.
let level = ['easy', 'hard'].includes(load('level', null)) ? load('level', null) : null;
// crash
let C = null;             // { daily, Rs, Ri, score, shown, combo, fever, stopT, elapsed, level, spawnT, wave, items, prog, cleared, warned }
let best = load('best', 0), lastEntry = null;
// tutorial
let tut = null;           // { i, auto, token }
let attract = null;

/* ---------- layout ---------- */
let W = 360, Hh = 600, dpr = 1, Lay = { cell: 36, bx: 0, by: 0, bs: 324 };
function layout() {
  const cell = Math.max(18, Math.floor(Math.min((W - 6) / (N + 1.0), (Hh - 6) / (N + 1.0))));
  const bs = cell * N;
  Lay = { cell, bs, bx: Math.round((W - bs) / 2), by: Math.round((Hh - bs) / 2) };
  sprites.clear();
}
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = stageEl.clientWidth; Hh = stageEl.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout();
  initStreaks();
}

/* ---------- sprites ---------- */
const sprites = new Map();
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function glyph(g, c, cx, cy, s) { // small shape per color so colors never rely on hue alone
  g.beginPath();
  if (c === 0) g.arc(cx, cy, s * 0.5, 0, 7);
  else if (c === 1) { g.moveTo(cx, cy - s * 0.62); g.lineTo(cx + s * 0.62, cy); g.lineTo(cx, cy + s * 0.62); g.lineTo(cx - s * 0.62, cy); g.closePath(); }
  else if (c === 2) { g.moveTo(cx, cy - s * 0.6); g.lineTo(cx + s * 0.6, cy + s * 0.45); g.lineTo(cx - s * 0.6, cy + s * 0.45); g.closePath(); }
  else g.rect(cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9);
}
function arrowPath(g, d, cx, cy, s) {
  const ang = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }[d];
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.beginPath();
  g.moveTo(s * 0.55, 0); g.lineTo(-s * 0.05, -s * 0.5); g.lineTo(-s * 0.05, -s * 0.2); g.lineTo(-s * 0.55, -s * 0.2);
  g.lineTo(-s * 0.55, s * 0.2); g.lineTo(-s * 0.05, s * 0.2); g.lineTo(-s * 0.05, s * 0.5); g.closePath();
  g.restore();
}
// Draws one block tile with its top-left at (x0, y0), width w. Static parts only (black holes are drawn live).
function paintBlock(g, b, x0, y0, w) {
  const r = w * 0.2, cx = x0 + w / 2, cy = y0 + w / 2;
  if (b.t === 'n' || b.t === 'a') {
    const col = COL[b.c];
    g.shadowColor = col; g.shadowBlur = w * 0.32;
    const grd = g.createLinearGradient(0, y0, 0, y0 + w);
    grd.addColorStop(0, col); grd.addColorStop(1, `rgba(${RGB[b.c]},0.55)`);
    g.fillStyle = grd; rr(g, x0, y0, w, w, r); g.fill();
    g.shadowBlur = 0;
    g.save(); rr(g, x0, y0, w, w, r); g.clip();
    const shade = g.createLinearGradient(0, y0 + w * 0.35, 0, y0 + w); // darker lower part: marble depth
    shade.addColorStop(0, 'rgba(5,4,20,0)'); shade.addColorStop(1, 'rgba(5,4,20,0.42)');
    g.fillStyle = shade; g.fillRect(x0, y0, w, w);
    const sp = g.createRadialGradient(x0 + w * 0.3, y0 + w * 0.26, 0, x0 + w * 0.3, y0 + w * 0.26, w * 0.5);
    sp.addColorStop(0, 'rgba(255,255,255,0.75)'); sp.addColorStop(0.35, 'rgba(255,255,255,0.18)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp; g.fillRect(x0, y0, w, w);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1, w * 0.035); rr(g, x0 + 0.5, y0 + 0.5, w - 1, w - 1, r); g.stroke();
    if (b.t === 'a') {
      g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(5,4,20,0.85)'; g.lineWidth = Math.max(1.5, w * 0.07); g.lineJoin = 'round';
      arrowPath(g, b.d, cx, cy, w * 0.62); g.stroke(); g.fill();
    } else {
      g.fillStyle = 'rgba(5,4,20,0.42)'; glyph(g, b.c, cx, cy + w * 0.02, w * 0.3); g.fill();
    }
  } else if (b.t === 'w') {
    g.fillStyle = '#121130'; rr(g, x0, y0, w, w, w * 0.1); g.fill();
    g.save(); rr(g, x0, y0, w, w, w * 0.1); g.clip();
    g.strokeStyle = 'rgba(90,88,170,0.32)'; g.lineWidth = Math.max(1, w * 0.05);
    for (let k = -w; k < w * 2; k += w * 0.28) { g.beginPath(); g.moveTo(x0 + k, y0); g.lineTo(x0 + k - w, y0 + w); g.stroke(); }
    g.restore();
    g.strokeStyle = '#4b49a0'; g.lineWidth = Math.max(1, w * 0.05); rr(g, x0 + 1, y0 + 1, w - 2, w - 2, w * 0.1); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0 + 2, y0 + 2, w - 4, Math.max(1, w * 0.06));
  } else if (b.t === 'i') {
    g.shadowColor = '#a8e8ff'; g.shadowBlur = w * 0.25;
    const grd = g.createLinearGradient(x0, y0, x0 + w, y0 + w);
    grd.addColorStop(0, 'rgba(220,250,255,0.55)'); grd.addColorStop(1, 'rgba(120,200,255,0.18)');
    g.fillStyle = grd; rr(g, x0, y0, w, w, r * 0.6); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(225,250,255,0.95)'; g.lineWidth = Math.max(1, w * 0.045); rr(g, x0 + 0.5, y0 + 0.5, w - 1, w - 1, r * 0.6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(1, w * 0.03);
    g.beginPath(); g.moveTo(x0 + w * 0.18, y0 + w * 0.3); g.lineTo(x0 + w * 0.45, y0 + w * 0.5); g.lineTo(x0 + w * 0.38, y0 + w * 0.8);
    g.moveTo(x0 + w * 0.45, y0 + w * 0.5); g.lineTo(x0 + w * 0.8, y0 + w * 0.42); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)'; rr(g, x0 + w * 0.14, y0 + w * 0.12, w * 0.3, w * 0.09, w * 0.04); g.fill();
  } else if (b.t === 'h') {
    // static fallback (help icons); the board draws holes live with drawHole()
    drawHole(g, cx, cy, w, 0.7, 1);
  }
}
function sprite(b, w) {
  const key = `${b.t}${b.c ?? ''}${b.d ?? ''}|${w}|${dpr}`;
  let s = sprites.get(key);
  if (s) return s;
  const m = Math.ceil(w * 0.4), dim = w + 2 * m;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(dim * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  paintBlock(g, b, m, m, w);
  s = { c, dim }; sprites.set(key, s);
  return s;
}
function drawHole(g, cx, cy, w, t, scale = 1) {
  if (!(scale > 0.03)) return;
  const R = w * 0.5 * scale;
  g.save();
  const halo = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
  halo.addColorStop(0, 'rgba(170,60,255,0.55)'); halo.addColorStop(0.6, 'rgba(255,47,209,0.18)'); halo.addColorStop(1, 'rgba(255,47,209,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.25, 0, 7); g.fill();
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a = t * 3.2 + k * 2.094;
    g.strokeStyle = k % 2 ? 'rgba(255,47,209,0.95)' : 'rgba(190,120,255,0.95)';
    g.lineWidth = Math.max(1.5, w * 0.07);
    g.beginPath(); g.arc(cx, cy, R * (0.72 - k * 0.08), a, a + 1.5); g.stroke();
  }
  g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, R * 0.42, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,200,255,0.9)'; g.lineWidth = Math.max(1, w * 0.03); g.beginPath(); g.arc(cx, cy, R * 0.44, 0, 7); g.stroke();
  g.restore();
}
// One block at cell-space position (fr, fc) (fractional allowed).
function drawBlockAt(b, r, c, { alpha = 1, scale = 1, sx = 1, sy = 1, white = 0 } = {}) {
  const { cell, bx, by } = Lay, x = bx + c * cell, y = by + r * cell;
  const ins = cell * 0.06, w = cell - ins * 2, cx = x + cell / 2, cy = y + cell / 2;
  if (b.t === 'h') { ctx.globalAlpha = alpha; drawHole(ctx, cx, cy, w, time, scale); ctx.globalAlpha = 1; return; }
  const s = sprite(b, Math.round(w));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.scale(scale * sx, scale * sy);
  ctx.drawImage(s.c, -s.dim / 2, -s.dim / 2, s.dim, s.dim);
  if (white > 0) { ctx.globalAlpha = alpha * white; ctx.fillStyle = '#fff'; rr(ctx, -w / 2, -w / 2, w, w, w * 0.2); ctx.fill(); }
  ctx.restore();
}

/* ---------- background streaks (flow in the gravity direction) ---------- */
let streaks = [];
function initStreaks() {
  streaks = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * Hh, v: rnd(30, 110), l: rnd(6, 26), a: rnd(0.08, 0.35), h: Math.random() < 0.5 ? 0 : 1 }));
}
function gravNow() { return st ? st.gravity : 'down'; }
function updateStreaks(dt) {
  const [dy, dx] = DV[gravNow()], boost = 1 + warp * 9;
  for (const s of streaks) {
    s.x += dx * s.v * boost * dt; s.y += dy * s.v * boost * dt;
    if (s.x < -30) s.x += W + 60; if (s.x > W + 30) s.x -= W + 60;
    if (s.y < -30) s.y += Hh + 60; if (s.y > Hh + 30) s.y -= Hh + 60;
  }
}
function drawStreaks() {
  const [dy, dx] = DV[gravNow()], boost = 1 + warp * 5;
  ctx.lineCap = 'round';
  for (const s of streaks) {
    const l = s.l * boost;
    ctx.strokeStyle = s.h ? `rgba(255,47,209,${s.a})` : `rgba(0,240,255,${s.a})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - dx * l, s.y - dy * l); ctx.stroke();
  }
}

/* ---------- animation timeline ---------- */
const G_CELLS = 170; // cells / s²: blocks accelerate like a real fall
const landTime = d => Math.sqrt((2 * d) / G_CELLS);
const busy = () => !!anim;
const feverOn = () => !!C && C.fever > 0;
function playSteps(steps, done) {
  anim = { steps, i: -1, t: 0, dur: 0, done, speed: feverOn() ? 2.6 : 1 };
  nextStep();
}
function stepDur(s) {
  if (s.type === 'move') return Math.max(...s.moves.map(m => landTime(m.dist))) + 0.07;
  if (s.type === 'hole') return 0.55;
  if (s.type === 'shuffle') return 0.4;
  return 0.36; // boom
}
function nextStep() {
  anim.i++; anim.t = 0;
  if (anim.i >= anim.steps.length) { const d = anim.done; anim = null; if (d) d(); return; }
  const s = anim.steps[anim.i];
  anim.dur = stepDur(s);
  stepFx(s);
}
function finishAnim() { // fever: skip the rest so the next swipe acts at once
  if (!anim) return;
  const d = anim.done; anim = null; if (d) d();
}
function cellCenter(r, c) { return [Lay.bx + (c + 0.5) * Lay.cell, Lay.by + (r + 0.5) * Lay.cell]; }
function burst(r, c, color, n, sp = 1) {
  const [x, y] = cellCenter(r, c);
  for (let i = 0; i < n && parts.length < 700; i++) {
    const a = rnd(0, 6.283), v = rnd(70, 300) * sp;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.4, 0.85), color, size: rnd(2, 5.5) * (Lay.cell / 36), shard: Math.random() < 0.6, rot: rnd(0, 6), vr: rnd(-12, 12), g: 1 });
  }
}
function stepFx(s) {
  if (s.type === 'boom') {
    let ice = 0;
    for (const v of s.cells) {
      const col = v.b.t === 'i' ? '#c9f3ff' : v.b.t === 'h' ? '#c070ff' : (v.b.c != null ? COL[v.b.c] : '#ffffff');
      burst(v.r, v.c, col, v.b.t === 'i' ? 7 : 10);
      if (v.b.t === 'i') ice++;
    }
    const n = s.cells.length;
    shake = { t: 0, dur: 0.3, mag: Math.min(10, 2 + n * 0.45 + s.chain) };
    flash = Math.min(0.35, 0.1 + n * 0.012);
    sound.boom(s.chain, n);
    if (s.lasers.length) sound.laser();
    if (ice) sound.ice();
    const cx = s.cells.reduce((a, v) => a + v.c, 0) / n, cy = s.cells.reduce((a, v) => a + v.r, 0) / n;
    const [x, y] = cellCenter(cy, cx);
    pops.push({ text: '+' + s.gained, x, y, color: '#ffffff', size: 18, t: 0, life: 0.9 });
    if (s.chain >= 2) pops.push({ text: `CHAIN ×${s.chain}`, x: W / 2, y: Lay.by + Lay.bs * 0.42, color: s.chain >= 3 ? '#ffe600' : '#ff2fd1', size: 22 + Math.min(10, s.chain * 2), t: 0, life: 1 });
    if (navigator.vibrate) { try { navigator.vibrate(12 + Math.min(30, n * 2)); } catch {} }
  } else if (s.type === 'hole') {
    sound.hole();
    for (const h of s.holes) {
      const [x, y] = cellCenter(h.r, h.c);
      for (let i = 0; i < 26; i++) { // sucked-in sparks
        const a = rnd(0, 6.283), d = Lay.cell * rnd(0.9, 1.6);
        parts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, tx: x, ty: y, t: 0, life: rnd(0.35, 0.5), color: i % 2 ? '#ff2fd1' : COL[h.color], size: rnd(2, 4), suck: true });
      }
    }
  } else if (s.type === 'shuffle') {
    sound.item(); flash = 0.25;
  }
}
// Move steps: thud when blocks land.
function animMoveLandings(s, t0, t1) {
  let n = 0, maxD = 0;
  for (const m of s.moves) {
    const tl = landTime(m.dist);
    if (tl > t0 && tl <= t1) {
      n++; maxD = Math.max(maxD, m.dist);
      const [dy, dx] = DV[st.gravity], [x, y] = cellCenter(m.tr, m.tc);
      for (let i = 0; i < 3 && parts.length < 700; i++) {
        parts.push({ x: x + dx * Lay.cell * 0.5 + rnd(-0.4, 0.4) * Lay.cell * Math.abs(dy), y: y + dy * Lay.cell * 0.5 + rnd(-0.4, 0.4) * Lay.cell * Math.abs(dx), vx: -dx * rnd(10, 50) + rnd(-40, 40) * Math.abs(dy), vy: -dy * rnd(10, 50) + rnd(-40, 40) * Math.abs(dx), t: 0, life: 0.35, color: m.b.c != null ? COL[m.b.c] : '#c9f3ff', size: 2, g: 0 });
      }
    }
  }
  if (n) {
    sound.thud(n, Math.min(1, maxD / 5));
    if (maxD >= 3) shake = shake && shake.mag > 2.5 ? shake : { t: 0, dur: 0.12, mag: Math.min(3, 1 + n * 0.15) };
  }
}
/* ---------- rendering ---------- */
function drawFrame() {
  const { cell, bx, by, bs } = Lay, g = gravNow();
  // board base
  ctx.save();
  const locked = busy() && !feverOn() && phase === 'play';
  const edge = feverOn() ? `hsl(${(time * 240) % 360},100%,60%)` : locked ? 'rgba(120,110,200,0.55)' : 'rgba(0,240,255,0.75)';
  ctx.shadowColor = feverOn() ? edge : locked ? 'rgba(80,60,160,0.6)' : '#00f0ff'; ctx.shadowBlur = locked ? 8 : 18;
  ctx.fillStyle = 'rgba(6,6,24,0.92)'; rr(ctx, bx - 5, by - 5, bs + 10, bs + 10, 12); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  if (lockFlash > 0) { ctx.strokeStyle = `rgba(255,80,120,${lockFlash * 2})`; ctx.lineWidth = 2; rr(ctx, bx - 5, by - 5, bs + 10, bs + 10, 12); ctx.stroke(); }
  // faint grid
  ctx.strokeStyle = 'rgba(90,90,200,0.13)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < N; k++) { ctx.moveTo(bx + k * cell + 0.5, by); ctx.lineTo(bx + k * cell + 0.5, by + bs); ctx.moveTo(bx, by + k * cell + 0.5); ctx.lineTo(bx + bs, by + k * cell + 0.5); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,130,255,0.25)';
  for (let r = 1; r < N; r++) for (let c = 1; c < N; c++) ctx.fillRect(bx + c * cell - 1, by + r * cell - 1, 2, 2);
  // floor glow on the gravity side + moving chevrons
  const [dy, dx] = DV[g];
  ctx.save();
  ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16; ctx.strokeStyle = locked ? 'rgba(150,140,230,0.7)' : '#7ff8ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  if (g === 'down') { ctx.moveTo(bx + 6, by + bs + 5); ctx.lineTo(bx + bs - 6, by + bs + 5); }
  if (g === 'up') { ctx.moveTo(bx + 6, by - 5); ctx.lineTo(bx + bs - 6, by - 5); }
  if (g === 'left') { ctx.moveTo(bx - 5, by + 6); ctx.lineTo(bx - 5, by + bs - 6); }
  if (g === 'right') { ctx.moveTo(bx + bs + 5, by + 6); ctx.lineTo(bx + bs + 5, by + bs - 6); }
  ctx.stroke();
  ctx.restore();
}
function drawChevrons() {
  const { bx, by, bs, cell } = Lay, g = gravNow(), [dy, dx] = DV[g];
  const cx = bx + bs / 2 + dx * (bs / 2 + cell * 0.48), cy = by + bs / 2 + dy * (bs / 2 + cell * 0.48);
  for (let i = 0; i < 3; i++) {
    const p = ((time * 1.4 + i / 3) % 1);
    const ox = dx * (p - 0.5) * cell * 0.5, oy = dy * (p - 0.5) * cell * 0.5;
    ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(Math.atan2(dy, dx));
    ctx.strokeStyle = `rgba(0,240,255,${0.9 * Math.sin(p * Math.PI)})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-cell * 0.12, -cell * 0.22); ctx.lineTo(cell * 0.06, 0); ctx.lineTo(-cell * 0.12, cell * 0.22); ctx.stroke();
    ctx.restore();
  }
}
function drawPreviews() { // crash: where the next wave enters (ceiling side) + countdown
  if (!C || phase === 'over' || mode === 'tutorial' || mode === 'puzzle') return;
  const { cell, bx, by, bs } = Lay, g = st.gravity, [dy, dx] = DV[g];
  const blocked = blockedLines(st.board, g, C.wave);
  const iv = spawnInterval(C.level), k = feverOn() || C.stopT > 0 ? 0 : clamp(1 - C.spawnT / iv, 0, 1);
  // countdown bar along the ceiling edge
  const ce = OPP[g];
  ctx.save();
  ctx.strokeStyle = C.stopT > 0 ? 'rgba(160,200,255,0.8)' : 'rgba(255,230,0,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 8;
  ctx.beginPath();
  if (ce === 'up') { ctx.moveTo(bx, by - 5); ctx.lineTo(bx + bs * k, by - 5); }
  if (ce === 'down') { ctx.moveTo(bx + bs, by + bs + 5); ctx.lineTo(bx + bs - bs * k, by + bs + 5); }
  if (ce === 'left') { ctx.moveTo(bx - 5, by + bs); ctx.lineTo(bx - 5, by + bs - bs * k); }
  if (ce === 'right') { ctx.moveTo(bx + bs + 5, by); ctx.lineTo(bx + bs + 5, by + bs * k); }
  if (k > 0) ctx.stroke();
  ctx.restore();
  for (const w of C.wave) {
    const [r, c] = entryCell(g, w.k);
    const pr = r - dy * 0.82, pc = c - dx * 0.82; // just outside the frame
    const bad = blocked.includes(w.k), pulse = 0.5 + 0.5 * Math.sin(time * 10);
    if (bad) {
      const [x, y] = cellCenter(r, c);
      ctx.fillStyle = `rgba(255,40,80,${0.18 + 0.2 * pulse})`; ctx.fillRect(x - cell / 2 + 1, y - cell / 2 + 1, cell - 2, cell - 2);
    }
    drawBlockAt(w.b, pr, pc, { alpha: 0.55 + 0.4 * k, scale: 0.5 + 0.12 * k });
    const [x, y] = cellCenter(r - dy * 0.42, c - dx * 0.42);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx));
    ctx.strokeStyle = bad ? `rgba(255,60,90,${0.6 + 0.4 * pulse})` : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(2, 0); ctx.lineTo(-3, 4); ctx.stroke();
    ctx.restore();
  }
}
function drawStatic(board, skip) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const b = board[r][c];
    if (b && !(skip && skip.has(b.id))) drawBlockAt(b, r, c);
  }
}
function drawBlocks() {
  if (!st) return;
  if (!anim) { drawStatic(st.board); return; }
  const s = anim.steps[anim.i], t = anim.t;
  if (s.type === 'move') {
    const moving = new Set(s.moves.map(m => m.id));
    drawStatic(s.board, moving);
    const [gy, gx] = DV[st.gravity];
    for (const m of s.moves) {
      const tl = landTime(m.dist), k = Math.min(1, (0.5 * G_CELLS * t * t) / m.dist);
      const r = m.fr + (m.tr - m.fr) * k, c = m.fc + (m.tc - m.fc) * k;
      let sx = 1, sy = 1, alpha = 1;
      if (t > tl) { const q = Math.max(0, 1 - (t - tl) / 0.1); const a = 0.16 * q; if (gy) { sy = 1 - a; sx = 1 + a * 0.6; } else { sx = 1 - a; sy = 1 + a * 0.6; } }
      drawBlockAt(m.b, r, c, { sx, sy, alpha });
    }
  } else if (s.type === 'boom') {
    drawStatic(s.board);
    const k = clamp(t / anim.dur, 0, 1);
    for (const v of s.cells) drawBlockAt(v.b, v.r, v.c, { alpha: 1 - ease(k), scale: 1 + 0.45 * k, white: Math.max(0, 1 - k * 3) });
    for (const L of s.lasers) {
      const [y0, x0] = [L.r, L.c], [dy, dx] = DV[L.d];
      const [ax, ay] = cellCenter(y0, x0), [ex, ey] = cellCenter(y0 + dy * L.len, x0 + dx * L.len);
      ctx.save(); ctx.lineCap = 'round';
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 22;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = Lay.cell * 0.5 * (1 - k * 0.8);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.restore();
    }
  } else if (s.type === 'hole') {
    const k = clamp(t / anim.dur, 0, 1);
    drawStatic(s.board);
    for (const cv2 of s.conv) { // old color fades into the new one
      const fade = clamp(1 - k * 2.2, 0, 1);
      if (fade > 0) drawBlockAt({ ...s.board[cv2.r][cv2.c], c: cv2.from }, cv2.r, cv2.c, { alpha: fade });
      else if (k < 0.7) drawBlockAt(s.board[cv2.r][cv2.c], cv2.r, cv2.c, { scale: 1 + 0.15 * Math.sin((k - 0.45) / 0.25 * Math.PI) });
    }
    for (const h of s.holes) drawBlockAt({ t: 'h' }, h.r, h.c, { scale: Math.max(0, 1 + 0.4 * Math.sin(k * Math.PI) - k * 1.1), alpha: 1 - k * 0.6 });
  } else if (s.type === 'shuffle') {
    drawStatic(s.board);
  }
}
function drawGhost() {
  if (!preview || busy()) return;
  const { cell, bx, by, bs } = Lay;
  ctx.save();
  for (const gh of preview.ghosts) {
    const x = bx + gh.c * cell + cell * 0.08, y = by + gh.r * cell + cell * 0.08, w = cell * 0.84;
    const col = gh.b.c != null ? COL[gh.b.c] : '#c9f3ff';
    ctx.setLineDash([4, 3]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    rr(ctx, x, y, w, w, w * 0.2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.14;
    const [ax, ay] = cellCenter(gh.fr, gh.fc), [ex, ey] = cellCenter(gh.r, gh.c);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffffff';
  arrowPath(ctx, preview.dir, bx + bs / 2, by + bs / 2, cell * 3); ctx.fill();
  ctx.restore();
}
function drawHint() {
  if (!hintDir || busy() || mode !== 'puzzle') return;
  const { cell, bx, by, bs } = Lay, p = 0.5 + 0.5 * Math.sin(time * 6), [dy, dx] = DV[hintDir];
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.35 * p; ctx.fillStyle = '#ffe600'; ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 20;
  arrowPath(ctx, hintDir, bx + bs / 2 + dx * p * cell * 0.4, by + bs / 2 + dy * p * cell * 0.4, cell * 2.6); ctx.fill();
  ctx.restore();
}
function drawParticles() {
  if (!parts.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    const a = Math.max(0, 1 - p.t / p.life);
    ctx.globalAlpha = a; ctx.fillStyle = p.color;
    if (p.shard) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7); ctx.restore(); }
    else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}
function drawPops() {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of pops) {
    const k = p.t / p.life;
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    const sc = p.t < 0.12 ? 0.6 + p.t / 0.12 * 0.4 : 1;
    ctx.font = `900 ${Math.round(p.size * sc)}px ${p.kr ? '"Noto Sans KR"' : 'Orbitron'}, sans-serif`;
    ctx.shadowColor = p.color; ctx.shadowBlur = 14; ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - k * 36);
  }
  ctx.restore();
}
function drawCanvasNote() {
  if (mode === 'puzzle' && deadWarn && !busy() && phase === 'play') {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '700 13px "Noto Sans KR", sans-serif';
    ctx.fillStyle = `rgba(255,120,150,${0.7 + 0.3 * Math.sin(time * 4)})`;
    ctx.fillText('이대로는 못 깨요 · 되돌리기나 다시 하기', W / 2, Lay.by + Lay.bs + Lay.cell * 0.85);
    ctx.restore();
  }
  if (C && (mode === 'crash' || mode === 'daily') && phase !== 'title') {
    const ty = Math.max(48, Lay.by - Lay.cell * 0.95); // above the board, clear of the corner buttons and spawn previews
    ctx.save(); ctx.font = '700 12px Orbitron, sans-serif'; ctx.fillStyle = 'rgba(160,170,255,0.8)'; ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left'; ctx.fillText(`LV ${C.level}`, Lay.bx, ty);
    if (C.stopT > 0) { ctx.textAlign = 'right'; ctx.fillStyle = '#a8d8ff'; ctx.fillText(`TIME STOP ${C.stopT.toFixed(1)}`, Lay.bx + Lay.bs, ty); }
    ctx.restore();
  }
}
function render() {
  ctx.clearRect(0, 0, W, Hh);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.25})`; ctx.fillRect(0, 0, W, Hh); }
  drawStreaks();
  if (!st) return;
  ctx.save();
  // tilt toward the new gravity + shake
  const cx = Lay.bx + Lay.bs / 2, cy = Lay.by + Lay.bs / 2;
  if (tilt) {
    const k = tilt.t / 0.55, amp = Math.sin(Math.min(1, k) * Math.PI) * (1 - k * 0.5), [dy, dx] = DV[tilt.dir];
    ctx.translate(cx + dx * 8 * amp, cy + dy * 8 * amp);
    ctx.rotate((dx ? dx : 0) * 0.045 * amp * (tilt.from === 'up' ? -1 : 1));
    ctx.scale(1 - 0.015 * amp, 1 - 0.015 * amp);
    ctx.translate(-cx, -cy);
  }
  if (shake) { const k = 1 - shake.t / shake.dur; ctx.translate(rnd(-1, 1) * shake.mag * k, rnd(-1, 1) * shake.mag * k); }
  drawFrame();
  drawChevrons();
  drawPreviews();
  drawBlocks();
  drawIntroPulse();
  drawGhost();
  drawHint();
  ctx.restore();
  drawParticles();
  drawPops();
  drawCanvasNote();
  if (C && feverOn() && phase === 'play') { // fever vignette
    ctx.save(); const g2 = ctx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.35, W / 2, Hh / 2, Math.max(W, Hh) * 0.7);
    g2.addColorStop(0, 'rgba(255,47,209,0)'); g2.addColorStop(1, `rgba(255,47,209,${0.18 + 0.08 * Math.sin(time * 12)})`);
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, Hh); ctx.restore();
  }
}

/* ---------- update loop ---------- */
function update(dt) {
  time += dt;
  warp = Math.max(0, warp - dt * 2.2);
  lockFlash = Math.max(0, lockFlash - dt);
  flash = Math.max(0, flash - dt * 1.5);
  updateStreaks(dt);
  for (const p of parts) {
    p.t += dt;
    if (p.suck) { const k = p.t / p.life; p.x += (p.tx - p.x) * Math.min(1, dt * 9); p.y += (p.ty - p.y) * Math.min(1, dt * 9); p.size *= 1 - dt * 2 * k; continue; }
    p.vy += 560 * (p.g ?? 1) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5;
    if (p.rot != null) p.rot += p.vr * dt;
  }
  parts = parts.filter(p => p.t < p.life);
  for (const p of pops) p.t += dt;
  pops = pops.filter(p => p.t < p.life);
  if (shake) { shake.t += dt; if (shake.t >= shake.dur) shake = null; }
  if (tilt) { tilt.t += dt; if (tilt.t >= 0.55) tilt = null; }
  if (introPulse) { introPulse.t += dt; if (introPulse.t >= 3.2) introPulse = null; }
  if (anim && phase !== 'paused') {
    const s = anim.steps[anim.i], t0 = anim.t;
    anim.t += dt * anim.speed;
    if (s.type === 'move') animMoveLandings(s, t0, anim.t);
    if (anim.t >= anim.dur) nextStep();
  }
  if (phase === 'play' && C && (mode === 'crash' || mode === 'daily')) crashTick(dt);
  if (phase === 'title' || (phase !== 'play' && phase !== 'paused' && attract)) attractTick(dt);
  if (C && C.shown !== C.score && (mode === 'crash' || mode === 'daily')) {
    C.shown = Math.min(C.score, C.shown + Math.max(1, Math.ceil((C.score - C.shown) * Math.min(1, dt * 10))));
    H.lVal.textContent = C.shown;
  }
}
function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
  requestAnimationFrame(frame); // schedule first so one bad frame can never stop the game
  update(dt); render();
  if (demoDraws.length && !overlay.hidden) for (const d of demoDraws) d(t / 1000);
}

/* ---------- moves ---------- */
function startTilt(dir, from) { tilt = { t: 0, dir, from }; warp = 1; }
function tryGravity(dir) {
  sound.unlock();
  if (phase !== 'play' || !st) return;
  if (busy()) {
    if (feverOn()) finishAnim();
    else { lockFlash = 0.25; sound.locked(); return; }
  }
  if (mode === 'puzzle' && (puzzleDone || movesLeft() <= 0)) return;
  if (mode === 'tutorial' && tut && tut.done) return;
  preview = null;
  const before = mode === 'puzzle' ? cloneState(st) : null, from = st.gravity;
  const opts = feverOn() ? { min: 3, mult: 2 } : {};
  const res = resolve(st, dir, opts);
  if (!res) { // nothing would move: not a move
    sound.bump(); const [dy, dx] = DV[dir]; shake = { t: 0, dur: 0.12, mag: 2 }; tilt = { t: 0.2, dir, from };
    if (dy || dx) lockFlash = 0;
    return;
  }
  sound.whoosh(feverOn());
  startTilt(dir, from);
  hintDir = null; deadWarn = false;
  if (mode === 'puzzle') { undoSnap = { st: before, movesUsed }; movesUsed++; }
  if (mode === 'tutorial') tut.moves++;
  hud();
  playSteps(res.steps, () => afterMove(res));
}
function afterMove(res) {
  if (mode === 'puzzle') puzzleAfter();
  else if (mode === 'tutorial') tutAfter();
  else crashAfter(res, true);
  hud();
}

/* ---------- puzzle ---------- */
const movesLeft = () => STAGES[stageIdx].limit - movesUsed;
function startPuzzle(i) {
  mode = 'puzzle'; stageIdx = i; C = null; attract = null;
  st = stageState(STAGES[i]);
  movesUsed = 0; undoSnap = null; aids.reset(); hinted = false; hintDir = null; deadWarn = false; puzzleDone = false;
  resetFx(); hud(); tutCoach(false);
  introThen(typesOn(st.board), enterPlay);
}
function puzzleAfter() {
  const def = STAGES[stageIdx];
  if (goalMet(st)) { puzzleDone = true; setTimeout(() => puzzleResult(true), 650); return; }
  if (movesLeft() <= 0) { puzzleDone = true; setTimeout(() => puzzleResult(false), 600); return; }
  // Can it still be solved in the moves left? (small search; skipped quietly if it would take too long)
  const r = solve(cloneState(st), 'clear', movesLeft(), 25000);
  deadWarn = level !== 'hard' && r === null;
}
function puzzleResult(ok) {
  if (phase !== 'play') return;
  const def = STAGES[stageIdx];
  phase = 'result'; hideBar();
  const s = ok ? starsFor(movesUsed, def.par, hinted) : 0;
  if (ok) { stars[stageIdx] = Math.max(stars[stageIdx] || 0, s); save('stars', stars); sound.clear(); }
  else sound.fail();
  $('rTitle').textContent = ok ? (s === 3 ? '완벽해요!' : '클리어!') : '실패';
  $('rMsg').innerHTML = ok
    ? `${movesUsed}번 만에 풀었어요. (최소 <b>${def.par}</b>번)${hinted ? '<br>힌트를 써서 별은 최대 2개예요.' : ''}`
    : '이동 횟수를 다 썼어요.';
  const starEls = [...$('rStars').children];
  starEls.forEach(e => e.classList.remove('on'));
  starEls.forEach((e, i) => { if (i < s) setTimeout(() => { e.classList.add('on'); sound.star(i); }, 350 + i * 260); });
  const lastStage = stageIdx === STAGES.length - 1;
  $('rNext').textContent = ok ? (lastStage ? '스테이지 목록' : '다음 스테이지') : '다시 하기';
  $('rRetry').hidden = !ok;
  panel('result');
}
function undo() {
  if (mode !== 'puzzle' || phase !== 'play' || busy() || !undoSnap || puzzleDone || !aids.use('undo')) return;
  st = undoSnap.st; movesUsed = undoSnap.movesUsed; undoSnap = null; deadWarn = false; hintDir = null;
  sound.whoosh(true); warp = 0.6; hud();
}
function hint() {
  if (mode !== 'puzzle' || phase !== 'play' || busy() || puzzleDone || aids.hint <= 0) return;
  const r = solve(cloneState(st), 'clear', movesLeft(), 300000);
  if (r && r.length) {
    aids.use('hint'); hintDir = r[0]; hinted = true; sound.item();
    pops.push({ text: `힌트 (남은 ${aids.hint})`, kr: true, x: W / 2, y: Lay.by + Lay.cell, color: '#ffe600', size: 18, t: 0, life: 1.2 });
  } else { // no hint used up when there is nothing to show
    sound.bump();
    if (level === 'hard') pops.push({ text: '힌트를 찾지 못했어요', kr: true, x: W / 2, y: Lay.by + Lay.cell, color: '#ff8aa0', size: 16, t: 0, life: 1.4 });
    else deadWarn = true;
  }
  hud();
}

/* ---------- crash ---------- */
function startCrash(daily) {
  mode = daily ? 'daily' : 'crash'; attract = null;
  const seed = daily ? dailySeed() : (Math.random() * 2 ** 31) >>> 0;
  const Rs = rng(seed), Ri = rng(seed ^ 0x5bd1e995);
  st = crashStart(Rs, 3);
  C = { daily, seed, Rs, Ri, score: 0, shown: 0, combo: 0, fever: 0, stopT: 0, elapsed: 0, level: 1, spawnT: spawnInterval(1) + 1.2, wave: planWave(Rs, 1), items: { shuffle: 1, bomb: 0, stop: 0 }, prog: 0, cleared: 0, warned: false, best: daily ? dailyBest() : best };
  H.lVal.textContent = '0';
  resetFx(); enterPlay(); hud(); tutCoach(false);
}
function crashTick(dt) {
  if (!busy()) {
    const un = unseen([...typesOn(st.board), ...C.wave.map(w => w.b.t)]);
    if (un.length) { introThen(un, () => { phase = 'play'; overlay.hidden = true; }); return; }
  }
  C.elapsed += dt;
  const lv = crashLevel(C.elapsed);
  if (lv !== C.level) { C.level = lv; pops.push({ text: `LEVEL ${lv}`, x: W / 2, y: Lay.by + Lay.bs * 0.3, color: '#00f0ff', size: 20, t: 0, life: 1.2 }); }
  if (C.fever > 0) {
    C.fever -= dt;
    if (C.fever <= 0) { C.fever = 0; C.combo = 0; pops.push({ text: 'FEVER END', x: W / 2, y: Lay.by + Lay.bs * 0.5, color: '#ff2fd1', size: 18, t: 0, life: 1 }); hud(); }
    else { H.gfill.style.width = (C.fever / FEVER_TIME) * 100 + '%'; H.glabel.textContent = `FEVER ${C.fever.toFixed(1)}s`; }
    return;
  }
  if (C.stopT > 0) { C.stopT = Math.max(0, C.stopT - dt); return; }
  if (busy()) return;
  C.spawnT -= dt;
  const blocked = blockedLines(st.board, st.gravity, C.wave);
  if (blocked.length && C.spawnT < 1.3 && !C.warned) { C.warned = true; sound.warn(); }
  if (C.spawnT <= 0) doSpawn();
}
function doSpawn() {
  const res = spawnWave(st, C.wave);
  if (res.overflow) { crashOver(); return; }
  sound.spawn();
  C.wave = planWave(C.Rs, C.level);
  C.spawnT = spawnInterval(C.level); C.warned = false;
  playSteps(res.steps, () => { crashAfter(res, false); hud(); });
}
function crashAfter(res, byPlayer) {
  if (!C) return;
  if (byPlayer || res.chain > 0) C.combo = nextCombo(C.combo, res);
  if (res.gained) C.score += res.gained + (res.chain > 0 ? C.combo * 20 : 0);
  C.cleared += res.cleared; C.prog += res.cleared;
  while (C.prog >= 30) { C.prog -= 30; awardItem(); }
  if (C.combo >= 2 && res.chain > 0) pops.push({ text: `COMBO ${C.combo}`, x: W / 2, y: Lay.by + Lay.bs * 0.58, color: '#00f0ff', size: 18, t: 0, life: 0.9 });
  if (C.combo >= FEVER_COMBO && C.fever <= 0 && phase === 'play') startFever();
  if (C.score > C.best) C.best = C.score;
}
function startFever() {
  C.fever = FEVER_TIME; sound.fever(); warp = 1.5; flash = 0.4;
  pops.push({ text: '그라비티 프리!', kr: true, x: W / 2, y: Lay.by + Lay.bs * 0.45, color: '#ffe600', size: 30, t: 0, life: 1.6 });
}
function awardItem() {
  const keys = ['shuffle', 'bomb', 'stop'].filter(k => C.items[k] < 3);
  if (!keys.length) return;
  const k = keys[C.Ri.int(keys.length)];
  C.items[k]++; sound.item();
  pops.push({ text: `+${ITEM_NAME[k]}`, kr: true, x: W / 2, y: Lay.by + Lay.bs + Lay.cell * 0.2, color: '#ffe600', size: 16, t: 0, life: 1.3 });
}
const ITEM_NAME = { shuffle: '셔플', bomb: '컬러 붐', stop: '타임 스톱' };
function useItem(k) {
  sound.unlock();
  if (phase !== 'play' || !C || C.items[k] <= 0) return;
  if (busy()) { if (feverOn()) finishAnim(); else { lockFlash = 0.25; sound.locked(); return; } }
  const opts = feverOn() ? { min: 3, mult: 2 } : {};
  if (k === 'stop') { C.items.stop--; C.stopT = 10; sound.item(); pops.push({ text: 'TIME STOP', x: W / 2, y: Lay.by + Lay.bs * 0.45, color: '#a8d8ff', size: 24, t: 0, life: 1.2 }); hud(); return; }
  let pre = [], extra = 0;
  if (k === 'shuffle') {
    shuffleColors(st.board, C.Ri);
    pre = [{ type: 'shuffle', board: cloneBoard(st.board) }];
  } else {
    const color = commonColor(st.board);
    if (color < 0) { sound.bump(); return; }
    const ex = colorBomb(st.board, color);
    if (!ex) { sound.bump(); return; }
    extra = ex.cells.length;
    pre = [{ type: 'boom', chain: 1, cells: ex.cells, lasers: ex.lasers, gained: extra * 10, board: cloneBoard(st.board) }];
  }
  C.items[k]--;
  const res = resolve(st, st.gravity, { ...opts, force: true });
  res.gained += extra * 10; res.cleared += extra;
  if (extra) res.chain = Math.max(1, res.chain + 1);
  playSteps([...pre, ...res.steps], () => { crashAfter(res, false); hud(); });
  hud();
}
function dailyBest() { const d = load('daily', null); return d && d.seed === dailySeed() ? d.best : 0; }
function crashOver() {
  phase = 'over'; preview = null;
  shake = { t: 0, dur: 0.6, mag: 12 }; flash = 0.6; sound.over();
  for (let i = 0; i < 4; i++) { const r = Math.floor(Math.random() * N); burst(r, Math.floor(Math.random() * N), '#ff3d6e', 14, 1.4); }
  const entry = { id: Date.now(), score: C.score, mode: mode, lv: C.level, date: `${new Date().getMonth() + 1}/${new Date().getDate()}` };
  const top = load('top', []);
  top.push(entry); top.sort((a, b) => b.score - a.score);
  save('top', top.slice(0, 10)); lastEntry = entry.id;
  const prevBest = mode === 'daily' ? dailyBest() : best;
  const isBest = C.score > 0 && C.score > prevBest;
  if (mode === 'daily') { if (isBest) save('daily', { seed: dailySeed(), best: C.score }); }
  else if (isBest) { best = C.score; save('best', best); }
  setTimeout(() => {
    hideBar(); pauseBtn.hidden = true;
    titleEl.textContent = isBest ? '새 기록!' : '게임 오버';
    msgEl.innerHTML = (isBest ? `${mode === 'daily' ? '오늘의 ' : ''}최고 기록을 갱신했어요!` : `최고 기록은 <b>${prevBest}</b>점이에요.`) + '<br>예고된 칸이 막혀서 판이 넘쳤어요.';
    finalEl.textContent = C.score; finalEl.hidden = false; toastEl.textContent = '';
    startBtn.textContent = '다시 하기';
    buttons(false); panel('main');
  }, 1100);
}

/* ---------- tutorial ---------- */
function startTutorial(auto) {
  tut = { i: 0, auto, token: (tut ? tut.token : 0) + 1, moves: 0, done: false };
  mode = 'tutorial'; C = null; attract = null;
  enterPlay(); hideBar(); tutCoach(true);
  setupStep(0);
}
function setupStep(i) {
  const s = STEPS[i];
  tut.i = i; tut.moves = 0; tut.done = false;
  st = { board: parseBoard(s.rows), gravity: 'down' };
  resetFx();
  cstepEl.textContent = `TUTORIAL ${i + 1} / ${STEPS.length}`;
  ctextEl.innerHTML = s.text; ctextEl.className = '';
  hud();
}
function tutAfter() {
  const s = STEPS[tut.i], token = tut.token;
  if (goalMet(st)) {
    tut.done = true;
    const lastStep = tut.i === STEPS.length - 1;
    ctextEl.textContent = lastStep ? '완벽해요! 이제 진짜 게임을 시작해요.' : '좋아요!'; ctextEl.className = 'ok';
    setTimeout(() => { if (!tut || tut.token !== token || mode !== 'tutorial') return; if (lastStep) endTutorial(); else setupStep(tut.i + 1); }, lastStep ? 1500 : 1100);
  } else if (tut.moves >= s.limit) {
    tut.done = true;
    ctextEl.textContent = '다시 해 볼까요?'; ctextEl.className = 'warn';
    setTimeout(() => { if (tut && tut.token === token && mode === 'tutorial') setupStep(tut.i); }, 1100);
  }
}
function endTutorial() {
  const auto = tut ? tut.auto : false;
  save('tut', true); tut = null; tutCoach(false);
  showTitle();
  if (auto) { refreshModes(); panel('mode'); }
}
function tutCoach(on) { coachEl.hidden = !on; }

/* ---------- attract board behind the title ---------- */
function attractTick(dt) {
  sound.setQuiet(true);
  if (!attract) {
    const R = rng((Math.random() * 1e9) >>> 0);
    st = crashStart(R, 4); attract = { t: 1.4, R, i: 0 }; C = null;
  }
  if (busy()) return;
  attract.t -= dt;
  if (attract.t > 0) return;
  attract.t = 2.4;
  const order = ['left', 'up', 'right', 'down'];
  const dir = order[attract.i++ % 4];
  const res = resolve(st, dir);
  if (res) { startTilt(dir, st.gravity); playSteps(res.steps, null); }
  if (fillCount(st.board) < 22) { // top the demo board up
    for (let k = 0; k < 8; k++) { const r = attract.R.int(N), c = attract.R.int(N); if (!st.board[r][c]) st.board[r][c] = mk('n', attract.R.int(4)); }
  }
}

/* ---------- new-block intro cards, board pulse, block guide ---------- */
let seen = new Set(migrated.seen);
let introPulse = null, demoDraws = [], guideFrom = 'help';
const PAINT = { paintBlock, drawHole, arrowPath, rr };
const unseen = types => ORDER.filter(t => types.includes(t) && !seen.has(t));
// Shows a card for each block type not seen yet, then runs `done` and makes those blocks pulse on the board.
function introThen(types, done) {
  const list = unseen(types);
  if (!list.length) { done(); return; }
  phase = 'intro'; preview = null; pauseBtn.hidden = true;
  let k = 0;
  const show = () => {
    const t = list[k], info = INFO[t];
    $('introTag').textContent = list.length > 1 ? `NEW BLOCK ${k + 1}/${list.length}` : 'NEW BLOCK';
    $('introName').textContent = info.name;
    $('introText').innerHTML = info.lines.join('<br>');
    demoDraws = [makeDemo($('introDemo'), t, PAINT, Math.min(300, W - 40), 128)];
    panel('intro');
    sound.item();
    try { $('introOk').focus({ preventScroll: true }); } catch {}
  };
  introOk = () => {
    seen.add(list[k]); save('seen', [...seen]);
    if (++k < list.length) { show(); return; }
    demoDraws = []; introOk = null;
    done();
    introPulse = { types: new Set(list), t: 0 };
  };
  show();
}
let introOk = null;
$('introOk').addEventListener('click', () => { sound.click(); if (introOk) introOk(); });
function drawIntroPulse() {
  if (!introPulse || !st || phase !== 'play') return;
  const { cell, bx, by } = Lay, k = introPulse.t, a = Math.min(1, (3.2 - k) / 0.6) * (0.55 + 0.45 * Math.sin(k * 9));
  ctx.save(); ctx.strokeStyle = `rgba(255,230,0,${a})`; ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 14; ctx.lineWidth = 3;
  const ring = (r, c) => { const g = 3 + 2 * Math.sin(k * 9); rr(ctx, bx + c * cell - g + 2, by + r * cell - g + 2, cell + 2 * g - 4, cell + 2 * g - 4, cell * 0.24); ctx.stroke(); };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const b = st.board[r][c]; if (b && introPulse.types.has(b.t)) ring(r, c); }
  ctx.restore();
}
function buildGuide() {
  const ul = $('guideList'); ul.replaceChildren(); demoDraws = [];
  for (const t of ORDER) {
    const li = document.createElement('li');
    if (!seen.has(t)) li.className = 'new';
    const cv2 = document.createElement('canvas');
    demoDraws.push(makeDemo(cv2, t, PAINT, 140, 62));
    const box = document.createElement('div');
    const n = document.createElement('div'); n.className = 'gn'; n.textContent = INFO[t].name;
    const tx = document.createElement('div'); tx.className = 'gt'; tx.innerHTML = INFO[t].lines.join(' ');
    box.append(n, tx); li.append(cv2, box); ul.append(li);
  }
}
function openGuide(from) { guideFrom = from; buildGuide(); panel('guide'); }
$('guideBtn').addEventListener('click', () => { sound.click(); openGuide('help'); });
$('pGuideBtn').addEventListener('click', () => { sound.click(); openGuide('pause'); });
$('guideBack').addEventListener('click', () => { sound.click(); demoDraws = []; panel(guideFrom); });

/* ---------- HUD / bar ---------- */
function hud() {
  if (mode === 'puzzle' && st) {
    const def = STAGES[stageIdx];
    H.lLabel.textContent = '스테이지'; H.lVal.textContent = stageIdx + 1;
    H.mLabel.textContent = def.name; H.gauge.hidden = true;
    H.glabel.textContent = '색 블록 모두 부수기';
    H.rLabel.textContent = `남은 이동 · ★${def.par}`; H.rVal.textContent = movesLeft();
    H.rVal.classList.toggle('low', movesLeft() <= 1);
    setTools([
      { ic: '↶', l: '되돌리기', k: 'Z', n: '×' + aids.undo, on: !!undoSnap && aids.undo > 0 && !puzzleDone, act: undo },
      { ic: '?', l: '힌트', k: 'H', n: '×' + aids.hint, on: aids.hint > 0 && !puzzleDone, act: hint, ready: deadWarn ? false : undefined },
      { ic: '⟲', l: '다시 하기', k: 'R', n: '', on: true, act: () => startPuzzle(stageIdx), ready: deadWarn },
    ]);
    $('iprog').hidden = true;
  } else if (mode === 'tutorial') {
    H.lLabel.textContent = '튜토리얼'; H.lVal.textContent = tut ? tut.i + 1 : 1;
    H.mLabel.textContent = '연습'; H.gauge.hidden = true; H.glabel.textContent = '';
    H.rLabel.textContent = '남은 이동'; H.rVal.textContent = tut ? Math.max(0, STEPS[tut.i].limit - tut.moves) : 0; H.rVal.classList.remove('low');
  } else if (C) {
    H.lLabel.textContent = mode === 'daily' ? '오늘의 점수' : '점수';
    H.gauge.hidden = false;
    H.mLabel.textContent = feverOn() ? 'GRAVITY FREE' : 'COMBO';
    H.gauge.classList.toggle('fever', feverOn());
    H.gfill.style.width = (feverOn() ? (C.fever / FEVER_TIME) * 100 : Math.min(1, C.combo / FEVER_COMBO) * 100) + '%';
    H.glabel.textContent = feverOn() ? `FEVER ${C.fever.toFixed(1)}s` : C.combo >= 1 ? `×${C.combo}` : '';
    H.rLabel.textContent = mode === 'daily' ? '오늘 최고' : '최고 기록'; H.rVal.textContent = Math.max(C.best, C.score); H.rVal.classList.remove('low');
    setTools([
      { ic: '⇄', l: '셔플', k: '1', n: '×' + C.items.shuffle, on: C.items.shuffle > 0, act: () => useItem('shuffle') },
      { ic: '✹', l: '컬러 붐', k: '2', n: '×' + C.items.bomb, on: C.items.bomb > 0, act: () => useItem('bomb') },
      { ic: '⧗', l: '타임 스톱', k: '3', n: '×' + C.items.stop, on: C.items.stop > 0, act: () => useItem('stop') },
    ]);
    $('iprog').hidden = false; $('iprogi').style.width = (C.prog / 30) * 100 + '%';
  }
}
let toolActs = [];
function setTools(list) {
  list.forEach((t, i) => {
    const el = tools[i];
    el.ic.textContent = t.ic; el.l.textContent = t.l; el.k.textContent = t.k; el.n.textContent = t.n;
    el.btn.disabled = !t.on; el.btn.classList.toggle('ready', !!t.on && (t.ready ?? (C ? true : false)));
    el.btn.setAttribute('aria-label', t.l);
  });
  toolActs = list.map(t => t.act);
}
tools.forEach((t, i) => t.btn.addEventListener('click', () => { if (phase === 'play' && toolActs[i]) toolActs[i](); }));
function hideBar() { barEl.hidden = true; }

/* ---------- menus ---------- */
function panel(name) { for (const [k, el] of Object.entries(panels)) el.hidden = k !== name; overlay.hidden = false; overlay.scrollTop = 0; }
function buttons(onTitle) { helpBtn.hidden = !onTitle; menuLink.hidden = !onTitle; homeBtn.hidden = onTitle; }
function resetFx() { introPulse = null; anim = null; parts = []; pops = []; shake = null; tilt = null; preview = null; flash = 0; }
function enterPlay() {
  sound.setQuiet(false);
  phase = 'play'; overlay.hidden = true; pauseBtn.hidden = false;
  barEl.hidden = mode === 'tutorial';
}
function showTitle() {
  phase = 'title'; mode = 'crash'; C = null; tut = null; attract = null; resetFx();
  pauseBtn.hidden = true; hideBar(); tutCoach(false);
  titleEl.innerHTML = TITLE; msgEl.innerHTML = INTRO; finalEl.hidden = true; toastEl.textContent = '';
  startBtn.textContent = '시작';
  H.lLabel.textContent = '최고 기록'; H.lVal.textContent = best; H.mLabel.textContent = ''; H.gauge.hidden = true; H.glabel.textContent = '';
  H.rLabel.textContent = '퍼즐 ★'; H.rVal.textContent = `${starCount()}/${STAGES.length * 3}`; H.rVal.classList.remove('low');
  buttons(true); panel('main');
}
const starCount = () => stars.reduce((a, b) => a + (b || 0), 0);
function refreshModes() {
  $('mPuzzleR').textContent = `★ ${starCount()}/${STAGES.length * 3}`;
  $('mCrashR').textContent = best ? `최고 ${best}` : '';
  const d = dailyBest();
  $('mDailyR').textContent = d ? `오늘 ${d}` : '';
  const now = new Date();
  $('mDailyD').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일: 모두 같은 블록이 와요`;
}
// Stage select: one chapter (≤12 stages) per page; ‹ › buttons, chapter dots, swipe or ←/→ to turn pages.
let chapter = -1;
const unlocked = i => i === 0 || (stars[i - 1] || 0) > 0;
const chapterOf = i => CHAPTERS.findIndex(c => i >= c.from - 1 && i <= c.to - 1);
function buildStages(ch) {
  let cur = STAGES.findIndex((_, i) => !(stars[i] > 0));
  if (ch == null) ch = chapter >= 0 && phase === 'title' ? chapter : chapterOf(phase === 'result' || mode === 'puzzle' ? stageIdx : Math.max(0, cur));
  const dir = chapter < 0 || ch === chapter ? '' : ch > chapter ? 'slide-l' : 'slide-r';
  chapter = ch;
  const C0 = CHAPTERS[ch];
  const grid = $('grid'); grid.replaceChildren();
  grid.classList.remove('slide-l', 'slide-r'); void grid.offsetWidth; if (dir) grid.classList.add(dir);
  let chStars = 0;
  for (let i = C0.from - 1; i <= C0.to - 1; i++) {
    const s = STAGES[i];
    chStars += stars[i] || 0;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st' + (i === cur ? ' cur' : ''); b.disabled = !unlocked(i);
    const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.name;
    const sr = document.createElement('span'); sr.className = 'sr';
    for (let k = 0; k < 3; k++) { const e = document.createElement(k < (stars[i] || 0) ? 'i' : 'span'); e.textContent = '★'; sr.append(e); }
    b.append(no, nm, sr);
    b.setAttribute('aria-label', `${i + 1}단계 ${s.name}${stars[i] ? `, 별 ${stars[i]}개` : ''}`);
    b.addEventListener('click', () => { sound.unlock(); sound.click(); startPuzzle(i); });
    grid.append(b);
  }
  $('chNo').textContent = `CHAPTER ${ch + 1} · ${C0.from}–${C0.to}`;
  $('chName').textContent = C0.name;
  $('chStars').textContent = `★ ${chStars} / ${(C0.to - C0.from + 1) * 3}`;
  $('chPrev').disabled = ch === 0;
  $('chNext').disabled = ch === CHAPTERS.length - 1 || !unlocked(CHAPTERS[ch + 1].from - 1);
  const dots = $('dots'); dots.replaceChildren();
  CHAPTERS.forEach((c, k) => {
    const d = document.createElement('button');
    d.type = 'button'; d.textContent = k + 1; d.setAttribute('role', 'tab'); d.setAttribute('aria-selected', String(k === ch));
    d.setAttribute('aria-label', `챕터 ${k + 1} ${c.name}`);
    let all = true; for (let i = c.from - 1; i <= c.to - 1; i++) if (!(stars[i] > 0)) all = false;
    d.className = (k === ch ? 'on' : '') + (all ? ' done' : '');
    d.disabled = !unlocked(c.from - 1);
    d.addEventListener('click', () => { sound.click(); buildStages(k); });
    dots.append(d);
  });
  $('starTotal').textContent = `★ ${starCount()} / ${STAGES.length * 3}`;
}
function turnChapter(step) {
  const k = chapter + step;
  if (k < 0 || k >= CHAPTERS.length || !unlocked(CHAPTERS[k].from - 1)) return;
  sound.click(); buildStages(k);
}
$('chPrev').addEventListener('click', () => turnChapter(-1));
$('chNext').addEventListener('click', () => turnChapter(1));
{
  let sw = null; const g = $('grid');
  g.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY }; });
  g.addEventListener('pointerup', e => {
    if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turnChapter(dx < 0 ? 1 : -1);
  });
}
function renderTop() {
  const top = load('top', []), rows = $('rows');
  rows.replaceChildren();
  top.forEach((e, i) => {
    const li = document.createElement('li');
    if (e.id === lastEntry) li.className = 'me';
    for (const [text, cls] of [[`${i + 1}`, 'rk'], [`${e.mode === 'daily' ? '오늘의 크래시' : '크래시'} · LV ${e.lv} · ${e.date}`, 'nm'], [e.score, 'sc']]) {
      const s = document.createElement('span'); s.className = cls; s.textContent = text; li.append(s);
    }
    rows.append(li);
  });
  rows.hidden = !top.length;
  $('rankNote').textContent = top.length ? '크래시 모드 점수 순서예요. 이 기기에만 저장돼요.' : '아직 크래시 기록이 없어요. 한 판 해 보세요!';
  const cleared = stars.filter(s => s > 0).length;
  $('puzNote').innerHTML = `퍼즐 <b>${cleared}/${STAGES.length}</b> 스테이지 · <b>★ ${starCount()}</b>`;
}
function buildHelp() {
  const items = [
    [{ t: 'arrow' }, '<b>스와이프</b>로 중력을 바꿔요. (PC: 방향키)'],
    [{ t: 'n', c: 0 }, '같은 색 <b>4개+</b> 붙으면 터지고, 또 터지면 <b>연쇄</b>!'],
    [{ t: 'ghost' }, '끌고 멈추면 <b>착지 미리보기</b>, 떼면 결정.'],
    [{ t: 'w' }, '<b>벽</b>은 움직이지도 부서지지도 않아요.'],
    [{ t: 'i' }, '<b>얼음</b>은 옆 블록이 터질 때 깨져요.'],
    [{ t: 'a', c: 3, d: 'right' }, '<b>화살표</b>가 터지면 그 방향 줄이 사라져요.'],
    [{ t: 'h' }, '<b>블랙홀</b>은 주변 3개+를 한 색으로 바꿔요.'],
    [{ t: 'n', c: 2 }, '<b>퍼즐</b>: 정해진 횟수 안에 색 블록을 모두!'],
    [{ t: 'warn' }, '<b>크래시</b>: 예고된 칸이 막히면 게임 오버.'],
    [{ t: 'n', c: 3 }, '<b>5콤보</b>면 5초간 <b>그라비티 프리</b>!'],
    [{ t: 'item' }, '블록 30개를 부술 때마다 <b>아이템</b> 1개.'],
  ];
  const ul = $('helpList'); ul.replaceChildren();
  for (const [b, html] of items) {
    const li = document.createElement('li');
    const c = document.createElement('canvas'); c.width = c.height = 56;
    const g = c.getContext('2d'); g.scale(2, 2);
    if (b.t === 'arrow' || b.t === 'ghost' || b.t === 'warn' || b.t === 'item') {
      g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
      if (b.t === 'arrow') { g.fillStyle = '#00f0ff'; g.shadowColor = '#00f0ff'; g.shadowBlur = 6; arrowPath(g, 'down', 14, 14, 20); g.fill(); }
      if (b.t === 'ghost') { g.setLineDash([3, 2]); g.strokeStyle = '#ff2fd1'; rr(g, 5, 5, 18, 18, 4); g.stroke(); }
      if (b.t === 'warn') { g.fillStyle = 'rgba(255,40,80,0.45)'; g.fillRect(4, 4, 20, 20); g.strokeStyle = '#ff3d6e'; g.strokeRect(4, 4, 20, 20); }
      if (b.t === 'item') { g.font = '900 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe600'; g.shadowColor = '#ffe600'; g.shadowBlur = 6; g.fillText('✹', 14, 15); }
    } else paintBlock(g, b, 4, 4, 20);
    const tx = document.createElement('span'); tx.className = 'tx'; tx.innerHTML = html;
    li.append(c, tx); ul.append(li);
  }
}

/* ---------- buttons ---------- */
startBtn.addEventListener('click', () => {
  sound.unlock(); sound.click();
  if (phase === 'over') { startCrash(mode === 'daily'); return; }
  if (!load('tut', false)) { panel('ask'); return; }
  refreshModes(); panel('mode');
});
$('askYes').addEventListener('click', () => { sound.unlock(); startTutorial(true); });
$('askNo').addEventListener('click', () => { save('tut', true); refreshModes(); panel('mode'); });
$('mPuzzle').addEventListener('click', () => { sound.click(); chapter = -1; if (!level) { panel('diff'); return; } buildStages(); panel('stages'); });
function setLevel(v) { level = v; save('level', v); paintLevel(); }
function paintLevel() { for (const b of document.querySelectorAll('[data-level]')) b.setAttribute('aria-pressed', String(b.dataset.level === level)); }
for (const b of document.querySelectorAll('#pDiff [data-level]')) b.addEventListener('click', () => { sound.click(); setLevel(b.dataset.level); buildStages(); panel('stages'); });
for (const b of document.querySelectorAll('#lvl [data-level]')) b.addEventListener('click', () => { if (level !== b.dataset.level) { sound.click(); setLevel(b.dataset.level); } });
paintLevel();
$('mCrash').addEventListener('click', () => { sound.unlock(); sound.click(); startCrash(false); });
$('mDaily').addEventListener('click', () => { sound.unlock(); sound.click(); startCrash(true); });
$('stagesBack').addEventListener('click', () => { if (phase === 'result') { showTitle(); } else { refreshModes(); panel('mode'); } });
helpBtn.addEventListener('click', () => { buildHelp(); panel('help'); });
rankBtn.addEventListener('click', () => { renderTop(); panel('rank'); });
homeBtn.addEventListener('click', showTitle);
$('tutBtn').addEventListener('click', () => { sound.unlock(); startTutorial(false); });
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => panel('main')));
$('rNext').addEventListener('click', () => {
  sound.click();
  if ($('rRetry').hidden) return startPuzzle(stageIdx);           // failed: try again
  if (stageIdx < STAGES.length - 1) startPuzzle(stageIdx + 1);
  else { buildStages(); panel('stages'); }
});
$('rRetry').addEventListener('click', () => { sound.click(); startPuzzle(stageIdx); });
$('rList').addEventListener('click', () => { sound.click(); buildStages(); panel('stages'); });
$('rHome').addEventListener('click', () => { sound.click(); showTitle(); });
$('cskip').addEventListener('click', () => endTutorial());
function pauseGame() {
  if (phase !== 'play') return;
  phase = 'paused'; preview = null; panel('pause');
}
function resumeGame() { if (phase !== 'paused') return; phase = 'play'; overlay.hidden = true; }
pauseBtn.addEventListener('click', () => { if (phase === 'play') pauseGame(); else resumeGame(); });
$('resume').addEventListener('click', resumeGame);
$('pRetry').addEventListener('click', () => {
  if (mode === 'puzzle') startPuzzle(stageIdx);
  else if (mode === 'tutorial') { phase = 'play'; overlay.hidden = true; setupStep(tut.i); }
  else startCrash(mode === 'daily');
});
$('quit').addEventListener('click', () => { if (mode === 'tutorial') save('tut', true); showTitle(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'crash' || mode === 'daily')) pauseGame(); });

let muted = load('mute', false) === true;
function paintMute() {
  sound.setMuted(muted);
  muteBtn.textContent = muted ? '×' : '♪'; muteBtn.style.color = muted ? '#ff5a6e' : '';
  muteBtn.setAttribute('aria-pressed', String(muted)); muteBtn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
}
muteBtn.addEventListener('click', () => { muted = !muted; save('mute', muted); paintMute(); sound.unlock(); sound.click(); });
paintMute();

/* ---------- input: swipe (with ghost preview while held) + keyboard ---------- */
let drag = null;
const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
function computePreview(dir) {
  if (!st || dir === st.gravity) return null;
  const b = cloneBoard(st.board);
  const pos = new Map();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (b[r][c]) pos.set(b[r][c].id, [r, c]);
  const { moves } = settle(b, dir);
  if (!moves.length) return { dir, ghosts: [] };
  return { dir, ghosts: moves.map(m => ({ b: m.b, r: m.tr, c: m.tc, fr: m.fr, fc: m.fc })) };
}
cv.addEventListener('pointerdown', e => {
  sound.unlock();
  if (phase !== 'play') return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dir: null };
  try { cv.setPointerCapture(e.pointerId); } catch {}
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, d = Math.hypot(dx, dy);
  const dir = d > 14 ? dirOf(dx, dy) : null;
  if (dir !== drag.dir) { drag.dir = dir; preview = dir && !busy() ? computePreview(dir) : null; }
  if (preview && busy()) preview = null;
});
cv.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, d = Math.hypot(dx, dy), fast = performance.now() - drag.t < 260;
  drag = null; preview = null;
  if (d >= 30 || (fast && d >= 18)) tryGravity(dirOf(dx, dy));
});
cv.addEventListener('pointercancel', () => { drag = null; preview = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const dir = KEYDIR[e.code];
  if (dir && phase === 'play') {
    e.preventDefault();
    if (e.shiftKey) { preview = busy() ? null : computePreview(dir); return; } // Shift+direction: preview only
    if (!e.repeat) tryGravity(dir);
    return;
  }
  if (phase === 'play') {
    if (e.code === 'Digit1' || e.code === 'Numpad1') toolActs[0] && !tools[0].btn.disabled && toolActs[0]();
    if (e.code === 'Digit2' || e.code === 'Numpad2') toolActs[1] && !tools[1].btn.disabled && toolActs[1]();
    if (e.code === 'Digit3' || e.code === 'Numpad3') toolActs[2] && !tools[2].btn.disabled && toolActs[2]();
    if (mode === 'puzzle' && e.code === 'KeyZ') undo();
    if (mode === 'puzzle' && e.code === 'KeyH') hint();
    if (mode === 'puzzle' && e.code === 'KeyR') startPuzzle(stageIdx);
  }
  if (!panels.stages.hidden && !overlay.hidden && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { turnChapter(e.code === 'ArrowLeft' ? -1 : 1); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (phase === 'play') pauseGame(); else if (phase === 'paused') resumeGame(); }
});
window.addEventListener('keyup', e => { if (e.key === 'Shift') preview = null; });

/* ---------- pinch-zoom lock ---------- */
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());

new ResizeObserver(resize).observe(stageEl);
window.addEventListener('resize', resize);
resize();
showTitle();
requestAnimationFrame(frame);

// Test hook for automated checks; harmless in normal play.
window.__gcrash = {
  get phase() { return phase; }, get mode() { return mode; }, get state() { return st; }, get busy() { return busy(); },
  get layout() { return Lay; }, get crash() { return C; }, get stage() { return stageIdx; }, get movesUsed() { return movesUsed; },
  get tutorial() { return tut && { i: tut.i, done: tut.done }; }, get stars() { return stars; }, get seen() { return [...seen]; }, get level() { return level; }, get aids() { return { undo: aids.undo, hint: aids.hint }; }, get deadWarn() { return deadWarn; }, get pulsing() { return !!introPulse; },
  get fx() { return { parts: parts.length, pops: pops.length, shake: !!shake } },
  STAGES, tryGravity, startPuzzle, startCrash, useItem, undo, hint,
  setFever(on) { if (C) { C.combo = on ? FEVER_COMBO : 0; if (on) startFever(); else C.fever = 0; hud(); } },
  // renders a showcase board (used for the collection icon)
  icon(size = 192) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), w = size * 0.215;
    const bg = g.createRadialGradient(size / 2, size * 0.3, 0, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, '#1b1150'); bg.addColorStop(1, '#05040f'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.lineCap = 'round'; g.lineWidth = 1.5;
    for (let k = 0; k < 16; k++) { const x = 8 + ((k * 53) % (size - 16)), y = (k * 71) % size; g.strokeStyle = k % 2 ? 'rgba(255,47,209,0.25)' : 'rgba(0,240,255,0.25)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + size * 0.1); g.stroke(); }
    const x0 = size / 2 - w * 1.5, y0 = size - 16 - w * 3;
    const cells = [[0, 2, { t: 'n', c: 1 }], [1, 2, { t: 'n', c: 0 }], [2, 2, { t: 'n', c: 0 }], [1, 1, { t: 'n', c: 3 }], [2, 1, { t: 'n', c: 0 }], [2, 0, { t: 'a', c: 2, d: 'right' }], [1, 0, { t: 'n', c: 1 }]];
    for (const [r, cc, b] of cells) paintBlock(g, b, x0 + cc * w + w * 0.05, y0 + r * w + w * 0.05, w * 0.9);
    g.save(); g.shadowColor = '#00f0ff'; g.shadowBlur = 14; g.fillStyle = '#00f0ff';
    arrowPath(g, 'down', x0 + w * 0.5, y0 + w * 0.15 - size * 0.02, w * 1.15); g.fill(); g.restore();
    g.strokeStyle = '#7ff8ff'; g.lineWidth = 4; g.shadowColor = '#00f0ff'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(x0 - 6, size - 10); g.lineTo(x0 + w * 3 + 6, size - 10); g.stroke();
    return c.toDataURL('image/png');
  },
};
