// 난투 아레나 — entry point. Stage 0: title menu, local ranking list, zoom lock,
// and a decorative arena behind the menu. The match itself arrives in stage 1 (see PLAN.md).

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d'), stage = $('stage');
const pMain = $('pMain'), pHelp = $('pHelp'), pRank = $('pRank');
const rowsEl = $('rows'), rankNote = $('rankNote'), toast = $('toast');

const KEY_TOP = 'brawl-top', KEY_TROPHY = 'brawl-trophy';

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}

// ---------- menu ----------
function panel(name) { pMain.hidden = name !== 'main'; pHelp.hidden = name !== 'help'; pRank.hidden = name !== 'rank'; }

function renderTop() {
  const top = load(KEY_TOP, []);
  rowsEl.replaceChildren();
  top.slice(0, 10).forEach((e, i) => {
    const li = document.createElement('li');
    const cells = [[`${i + 1}`, 'rk'], [`${e.place}등 · ${e.brawler}`, 'nm'], [`${e.trophy >= 0 ? '+' : ''}${e.trophy}`, 'sc'], [e.date, 'dt']];
    for (const [text, cls] of cells) { const s = document.createElement('span'); s.className = cls; s.textContent = text; li.append(s); }
    rowsEl.append(li);
  });
  rankNote.textContent = top.length ? '이 기록은 이 폰에만 저장돼요.' : '아직 기록이 없어요. 게임이 완성되면 여기에 쌓여요!';
}

$('helpBtn').addEventListener('click', () => panel('help'));
$('rankBtn').addEventListener('click', () => { renderTop(); panel('rank'); });
document.querySelectorAll('.back').forEach(b => b.addEventListener('click', () => panel('main')));
$('start').addEventListener('click', () => { toast.textContent = '지금은 기획 단계예요. 곧 1단계(생존전)가 열려요!'; });
$('trophy').textContent = load(KEY_TROPHY, 0);

// ---------- decorative arena behind the menu ----------
const T = 32;
const MAP = [
  '..............',
  '..##....**....',
  '..#.....**..B.',
  '......~~......',
  '.**...~~...##.',
  '.**.......B.#.',
  '......##......',
  '..B...#....**.',
  '...........**.',
  '.##..~~~......',
  '.....~~~..#...',
  '.**.......#.B.',
  '.**..##.......',
  '..............',
];
const COLORS = ['#ff5d6c', '#4cc3ff', '#ffc93c', '#9b7bff', '#5ee08a'];
const OPEN = [[1, 1], [12, 0], [4, 5], [8, 8], [2, 13], [11, 12]];
const dots = COLORS.map((c, i) => ({ x: OPEN[i][0] * 32 + 16, y: OPEN[i][1] * 32 + 16, vx: 0, vy: 0, c, t: 0, cd: 1 + i * 0.4 }));
const shots = [];
let W = 0, H = 0, ox = 0, oy = 0;

function resize() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ox = (W - MAP[0].length * T) / 2; oy = (H - MAP.length * T) / 2;
}
const solid = (x, y) => { const ch = MAP[Math.floor(y / T)]?.[Math.floor(x / T)]; return ch === undefined || ch === '#' || ch === '~' || ch === 'B'; };

function step(dt) {
  for (const d of dots) {
    d.t -= dt;
    if (d.t <= 0) { const a = Math.random() * Math.PI * 2; d.vx = Math.cos(a) * 60; d.vy = Math.sin(a) * 60; d.t = 1 + Math.random() * 2; }
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (!solid(nx, d.y)) d.x = nx; else d.vx = -d.vx;
    if (!solid(d.x, ny)) d.y = ny; else d.vy = -d.vy;
    d.cd -= dt;
    if (d.cd <= 0) {
      const o = dots[(dots.indexOf(d) + 1 + Math.floor(Math.random() * 4)) % dots.length];
      const a = Math.atan2(o.y - d.y, o.x - d.x);
      shots.push({ x: d.x, y: d.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, c: d.c, life: 0.9 });
      d.cd = 1.2 + Math.random() * 1.5;
    }
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0 || solid(s.x, s.y)) shots.splice(i, 1);
  }
}

function draw() {
  // Grass covers the whole canvas (aligned to the map grid) so tall phones show no empty band.
  ctx.save(); ctx.translate(ox, oy);
  const x0 = Math.floor(-ox / T), y0 = Math.floor(-oy / T);
  for (let y = y0; y * T < H - oy; y++) for (let x = x0; x * T < W - ox; x++) {
    ctx.fillStyle = ((x + y) % 2 + 2) % 2 ? '#3a8a52' : '#35804c'; ctx.fillRect(x * T, y * T, T, T);
  }
  for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
    const ch = MAP[y][x], px = x * T, py = y * T;
    if (ch === '#') { ctx.fillStyle = '#8a5a3c'; ctx.fillRect(px, py, T, T); ctx.fillStyle = '#a8724e'; ctx.fillRect(px, py, T, T - 8); }
    else if (ch === '~') { ctx.fillStyle = '#2f8fd8'; ctx.fillRect(px, py, T, T); }
    else if (ch === 'B') { ctx.fillStyle = '#d9a441'; ctx.fillRect(px + 4, py + 4, T - 8, T - 8); ctx.strokeStyle = '#8a5a14'; ctx.lineWidth = 3; ctx.strokeRect(px + 4, py + 4, T - 8, T - 8); }
  }
  for (const s of shots) { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill(); }
  for (const d of dots) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 11, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1238'; ctx.lineWidth = 3; ctx.stroke();
  }
  // Bushes on top so brawlers can hide in them.
  for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) if (MAP[y][x] === '*') {
    ctx.fillStyle = '#1f6b2e'; ctx.beginPath(); ctx.arc(x * T + T / 2, y * T + T / 2, T * 0.62, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt); draw();
  requestAnimationFrame(frame);
}

// ---------- no pinch zoom (two thumbs on screen during play) ----------
['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

new ResizeObserver(resize).observe(stage);
resize(); panel('main');
requestAnimationFrame(frame);
