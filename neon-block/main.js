import { SIZE, newState, canPlace, applyMove, generateTray, isGameOver, linesIfPlaced } from './logic.js';
import { cleanName, submitScore, fetchTop, rankOf } from './leaderboard.js';

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d'), stage = $('stage');
const scoreEl = $('score'), bestEl = $('best'), comboEl = $('combo');
const overlay = $('overlay'), titleEl = $('title'), msgEl = $('msg'), finalEl = $('final'), startBtn = $('start');
const regEl = $('reg'), nickEl = $('nick'), submitBtn = $('submit'), netEl = $('net'), rowsEl = $('rows'), boardBtn = $('showBoard');

const COLORS = ['', '#00f0ff', '#ff2fd1', '#7dff3a', '#ffe600', '#ff8a1f', '#9a5bff', '#ff3d6e'];

let W = 360, H = 640, dpr = 1, L = {};
let submitted = false;
let st = newState(), tray = [], phase = 'title', drag = null, fx = [], pops = [], dirty = true, best = 0, bestAtStart = 0, last = 0;
try { best = +localStorage.getItem('neonblock-best') || 0; } catch (e) {}
bestEl.textContent = best;

/* ---------- layout ---------- */
function layout() {
  const pad = 12;
  const cell = Math.max(16, Math.floor(Math.min(W - pad * 2, H * 0.58) / SIZE));
  const bs = cell * SIZE, bx = Math.floor((W - bs) / 2);
  const gap = Math.max(18, Math.round(cell * 0.7)), trayH = Math.round(cell * 3.6), slotW = W / 3;
  const by = Math.max(pad, Math.round((H - (bs + gap + trayH)) * 0.35)); // keep the board + tray block slightly above centre
  const trayY = by + bs + gap;
  const tcell = Math.max(10, Math.floor(Math.min(cell * 0.75, slotW / 5.3, trayH * 0.9 / 5)));
  L = { cell, bs, bx, by, trayY, trayH, slotW, tcell };
  sprites.clear();
}
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = stage.clientWidth; H = stage.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout(); dirty = true;
}

/* ---------- drawing ---------- */
const sprites = new Map();
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Glowing cell, rendered once per (color, size) and then stamped with drawImage.
function sprite(color, size) {
  const key = color + '|' + size;
  let s = sprites.get(key);
  if (s) return s;
  const m = Math.ceil(size * 0.5), dim = size + 2 * m;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(dim * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const ins = Math.max(1, size * 0.07), r = size * 0.22;
  g.shadowColor = COLORS[color]; g.shadowBlur = size * 0.5;
  g.fillStyle = COLORS[color]; rr(g, m + ins, m + ins, size - 2 * ins, size - 2 * ins, r); g.fill();
  g.shadowBlur = 0;
  const gr = g.createLinearGradient(0, m, 0, m + size);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = gr; rr(g, m + ins, m + ins, size - 2 * ins, size - 2 * ins, r); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.2; rr(g, m + ins + 0.6, m + ins + 0.6, size - 2 * ins - 1.2, size - 2 * ins - 1.2, r); g.stroke();
  s = { c, dim }; sprites.set(key, s);
  return s;
}
function stamp(color, x, y, size, alpha = 1, scale = 1) {
  const s = sprite(color, size), d = s.dim * scale, cx = x + size / 2, cy = y + size / 2;
  ctx.globalAlpha = alpha; ctx.drawImage(s.c, cx - d / 2, cy - d / 2, d, d); ctx.globalAlpha = 1;
}
function drawPiece(item, cx, cy, size, alpha = 1) {
  const px = cx - item.shape.w * size / 2, py = cy - item.shape.h * size / 2;
  for (const [dr, dc] of item.shape.cells) stamp(item.color, px + dc * size, py + dr * size, size, alpha);
}

function dragGeom() {
  const item = tray[drag.idx], { cell } = L;
  const cx = drag.x, cy = drag.y - (cell * 1.6 + item.shape.h * cell / 2); // lifted above the finger
  const c0 = Math.round((cx - item.shape.w * cell / 2 - L.bx) / cell);
  const r0 = Math.round((cy - item.shape.h * cell / 2 - L.by) / cell);
  return { item, cx, cy, r0, c0, ok: canPlace(st.board, item.shape, r0, c0) };
}

function render() {
  ctx.clearRect(0, 0, W, H);
  const { cell, bs, bx, by } = L;

  ctx.save();
  ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18; ctx.strokeStyle = 'rgba(0,240,255,0.55)'; ctx.lineWidth = 2;
  ctx.fillStyle = '#090920'; rr(ctx, bx - 6, by - 6, bs + 12, bs + 12, 12); ctx.fill(); ctx.stroke();
  ctx.restore();

  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const x = bx + c * cell, y = by + r * cell, v = st.board[r][c];
    if (v) stamp(v, x, y, cell);
    else { ctx.fillStyle = '#14143a'; rr(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, cell * 0.18); ctx.fill(); }
  }

  let g = null;
  if (drag) {
    g = dragGeom();
    if (g.ok) {
      const { rows, cols } = linesIfPlaced(st.board, g.item.shape, g.r0, g.c0);
      ctx.fillStyle = COLORS[g.item.color]; ctx.globalAlpha = 0.2;
      for (const r of rows) ctx.fillRect(bx, by + r * cell, bs, cell);
      for (const c of cols) ctx.fillRect(bx + c * cell, by, cell, bs);
      ctx.globalAlpha = 1;
      for (const [dr, dc] of g.item.shape.cells) stamp(g.item.color, bx + (g.c0 + dc) * cell, by + (g.r0 + dr) * cell, cell, 0.45);
    }
  }

  for (const f of fx) {
    const p = f.t / 0.4;
    stamp(f.color, bx + f.c * cell, by + f.r * cell, cell, 1 - p, 1 + p * 0.5);
  }

  tray.forEach((item, i) => {
    if (!item || (drag && drag.idx === i)) return;
    drawPiece(item, L.slotW * (i + 0.5), L.trayY + L.trayH / 2, L.tcell);
  });
  if (g) drawPiece(g.item, g.cx, g.cy, cell, 0.95);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of pops) {
    const k = p.t / 0.9;
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    ctx.font = `900 ${p.size}px Orbitron, sans-serif`;
    ctx.shadowColor = p.color; ctx.shadowBlur = 12; ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - k * 40);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t;
  for (const f of fx) f.t += dt;
  for (const p of pops) p.t += dt;
  fx = fx.filter(f => f.t < 0.4); pops = pops.filter(p => p.t < 0.9);
  if (dirty || drag || fx.length || pops.length) { render(); dirty = false; }
  requestAnimationFrame(frame);
}

/* ---------- game flow ---------- */
function hud() {
  scoreEl.textContent = st.score;
  if (st.score > best) { best = st.score; bestEl.textContent = best; }
  comboEl.textContent = st.combo >= 2 ? `COMBO x${st.combo}` : '';
}

function start() {
  st = newState(); tray = generateTray(st.board); drag = null; fx = []; pops = []; bestAtStart = best;
  phase = 'play'; overlay.hidden = true; hud(); dirty = true;
  submitted = false; regEl.hidden = true; rowsEl.hidden = true; netEl.textContent = '';
}

function doMove(idx, r0, c0) {
  const item = tray[idx];
  const res = applyMove(st, item.shape, r0, c0, item.color);
  tray[idx] = null;
  const { cell, bx, by } = L;
  for (const k of res.cleared.cells) fx.push({ r: k.r, c: k.c, color: k.color, t: 0 });
  pops.push({ text: '+' + res.gained, x: bx + (c0 + item.shape.w / 2) * cell, y: by + (r0 + item.shape.h / 2) * cell, color: '#ffffff', size: 20, t: 0 });
  if (res.allClear) pops.push({ text: 'ALL CLEAR!', x: W / 2, y: by + L.bs / 2, color: '#ffe600', size: 30, t: 0 });
  else if (res.cleared.count >= 2 || res.combo >= 2) {
    const txt = (res.cleared.count >= 2 ? res.cleared.count + ' LINES' : '') + (res.combo >= 2 ? (res.cleared.count >= 2 ? '  ' : '') + 'COMBO x' + res.combo : '');
    pops.push({ text: txt, x: W / 2, y: by + L.bs / 2, color: '#ff2fd1', size: 24, t: 0 });
  }
  if (res.cleared.count > 0 && navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
  if (tray.every(t => !t)) tray = generateTray(st.board);
  hud(); dirty = true;
  if (isGameOver(st.board, tray)) { phase = 'locked'; setTimeout(gameOver, 600); }
}

function gameOver() {
  phase = 'over';
  const isBest = st.score > 0 && st.score > bestAtStart;
  try { if (isBest) localStorage.setItem('neonblock-best', best); } catch (e) {}
  titleEl.textContent = isBest ? '새 기록!' : '게임 오버';
  msgEl.innerHTML = isBest ? '최고 기록을 갱신했어요.' : `최고 기록은 <b>${best}</b>점이에요.<br>놓을 자리가 없어졌어요.`;
  finalEl.textContent = st.score; finalEl.hidden = false;
  startBtn.textContent = '다시 하기';
  rowsEl.hidden = true; netEl.textContent = '';
  regEl.hidden = st.score <= 0 || submitted; submitBtn.disabled = false;
  try { nickEl.value = localStorage.getItem('neonblock-name') || ''; } catch (e) {}
  overlay.hidden = false;
}

/* ---------- high score board ---------- */
const netMsg = err => err && err.code === 'timeout' ? '연결이 느려요. 잠시 뒤 순위 보기에서 확인해 보세요.'
  : err && err.code === 'permission-denied' ? '점수를 등록할 수 없어요. (서버 규칙에서 거절됨)'
  : '순위표에 연결할 수 없어요. 잠시 뒤 다시 해 보세요.';

function renderRows(rows, mineId) {
  rowsEl.replaceChildren();
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.id === mineId) li.className = 'me';
    for (const [cls, text] of [['rk', i + 1], ['nm', r.name], ['sc', r.score]]) {
      const sp = document.createElement('span'); sp.className = cls; sp.textContent = text; li.append(sp); // textContent: names come from other players
    }
    rowsEl.append(li);
  });
  rowsEl.hidden = rows.length === 0;
}

async function showBoard(mineId) {
  netEl.textContent = '불러오는 중…';
  try {
    const rows = await fetchTop(10);
    netEl.textContent = rows.length ? '' : '아직 등록된 점수가 없어요.';
    renderRows(rows, mineId);
  } catch (err) { rowsEl.hidden = true; netEl.textContent = netMsg(err); }
}

async function onSubmit() {
  const name = cleanName(nickEl.value);
  if (!name) { netEl.textContent = '닉네임을 입력해 주세요.'; nickEl.focus(); return; }
  if (submitted) return;
  submitBtn.disabled = true; netEl.textContent = '등록 중…';
  try {
    const id = await submitScore(name, st.score);
    submitted = true;
    try { localStorage.setItem('neonblock-name', name); } catch (e) {}
    regEl.hidden = true;
    const rank = await rankOf(st.score).catch(() => null);
    await showBoard(id);
    if (rank) netEl.textContent = `등록 완료! 현재 ${rank}위`;
  } catch (err) {
    netEl.textContent = netMsg(err);
    if (!(err && err.code === 'timeout')) submitBtn.disabled = false; // a timed-out write may still arrive later; don't allow a duplicate
  }
}
submitBtn.addEventListener('click', onSubmit);
nickEl.addEventListener('keydown', e => { if (e.key === 'Enter') onSubmit(); });
boardBtn.addEventListener('click', () => showBoard(null));

/* ---------- input ---------- */
const pos = e => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
cv.addEventListener('pointerdown', e => {
  if (phase !== 'play' || drag) return;
  const p = pos(e);
  if (p.y < L.trayY - 14) return;
  const idx = Math.min(2, Math.floor(p.x / L.slotW));
  if (!tray[idx]) return;
  drag = { id: e.pointerId, idx, x: p.x, y: p.y };
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  dirty = true;
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const p = pos(e); drag.x = p.x; drag.y = p.y;
});
cv.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const g = dragGeom(), idx = drag.idx;
  drag = null; dirty = true;
  if (g.ok) doMove(idx, g.r0, g.c0);
});
cv.addEventListener('pointercancel', () => { drag = null; dirty = true; });
cv.addEventListener('contextmenu', e => e.preventDefault());
startBtn.addEventListener('click', start);

new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);
resize();
tray = generateTray(st.board);
requestAnimationFrame(frame);

// Test hook so automated checks can read state; harmless in normal play.
window.__neon = { get state() { return st; }, get tray() { return tray; }, get layout() { return L; }, get phase() { return phase; } };
