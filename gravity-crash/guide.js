// Block guide: names, two short lines and a looping mini demo per block type. Drawn with the game's own painters
// (passed in from main.js), so the cards look exactly like the board.
export const ORDER = ['n', 'w', 'i', 'a', 'h', 'k'];
export const INFO = {
  n: { name: '색 블록', lines: ['같은 색 <b>4개 이상</b>이 상하좌우로 붙으면 터져요.', '중력을 돌려 같은 색끼리 모으세요.'] },
  w: { name: '벽', lines: ['절대 움직이지 않고 부서지지도 않아요.', '블록을 원하는 칸에 <b>멈춰 세우는 받침</b>으로 쓰세요.'] },
  i: { name: '얼음', lines: ['중력으로 움직이지만 짝이 없어 혼자선 안 터져요.', '<b>바로 옆</b>에서 색 블록이 터지면 함께 깨져요.'] },
  a: { name: '화살표 블록', lines: ['같은 색과 함께 터지면 <b>화살표 방향</b>으로 레이저!', '그 줄의 블록을 벽 앞까지 모두 부숴요.'] },
  h: { name: '블랙홀', lines: ['멈췄을 때 주변 8칸에 색 블록이 <b>3개 이상</b>이면', '가장 많은 색으로 바꾸고 사라져요.'] },
  k: { name: '코어 · 출구', lines: ['코어는 부서지지 않아요. <b>주황 출구</b>로 내보내세요.', '출구 바깥쪽으로 중력을 돌리면 빠져나가요.'] },
};
// Block types present on a board (an arrow counts as 'a', not 'n').
export function typesOn(board) {
  const s = new Set();
  for (const row of board) for (const b of row) if (b) s.add(b.t);
  return ORDER.filter(t => s.has(t));
}

const COLS = 7, ROWS = 3;
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
const ease = k => k * k; // falling: accelerate

// P = { paintBlock, drawHole, arrowPath, rr }. Returns draw(t) for a canvas whose CSS size is w×h.
export function makeDemo(canvas, type, P, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = Math.floor(Math.min((w - 8) / COLS, (h - 8) / ROWS)), ox = Math.round((w - s * COLS) / 2), oy = Math.round((h - s * ROWS) / 2);
  const X = c => ox + c * s, Y = r => oy + r * s;
  function block(b, r, c, { alpha = 1, scale = 1, white = 0 } = {}) {
    if (alpha <= 0 || scale <= 0.02) return;
    const ins = s * 0.07, bw = s - ins * 2, cx = X(c) + s / 2, cy = Y(r) + s / 2;
    g.save(); g.globalAlpha = alpha; g.translate(cx, cy); g.scale(scale, scale);
    if (b.t === 'h') P.drawHole(g, 0, 0, bw, performance.now() / 1000, 1);
    else P.paintBlock(g, b, -bw / 2, -bw / 2, bw);
    if (white > 0) { g.globalAlpha = alpha * white; g.fillStyle = '#fff'; P.rr(g, -bw / 2, -bw / 2, bw, bw, bw * 0.2); g.fill(); }
    g.restore();
  }
  function frame(grav) {
    g.fillStyle = 'rgba(6,6,24,0.95)'; P.rr(g, ox - 3, oy - 3, s * COLS + 6, s * ROWS + 6, 8); g.fill();
    g.strokeStyle = 'rgba(0,240,255,0.55)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(90,90,200,0.15)'; g.lineWidth = 1; g.beginPath();
    for (let k = 1; k < COLS; k++) { g.moveTo(X(k) + 0.5, oy); g.lineTo(X(k) + 0.5, oy + s * ROWS); }
    for (let k = 1; k < ROWS; k++) { g.moveTo(ox, Y(k) + 0.5); g.lineTo(ox + s * COLS, Y(k) + 0.5); }
    g.stroke();
    // floor glow on the gravity side
    g.save(); g.strokeStyle = '#7ff8ff'; g.shadowColor = '#00f0ff'; g.shadowBlur = 10; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
    if (grav === 'down') { g.moveTo(ox + 4, oy + s * ROWS + 3); g.lineTo(ox + s * COLS - 4, oy + s * ROWS + 3); }
    if (grav === 'left') { g.moveTo(ox - 3, oy + 4); g.lineTo(ox - 3, oy + s * ROWS - 4); }
    if (grav === 'right') { g.moveTo(ox + s * COLS + 3, oy + 4); g.lineTo(ox + s * COLS + 3, oy + s * ROWS - 4); }
    g.stroke(); g.restore();
  }
  function sparks(r, c, k, color) {
    if (k <= 0 || k >= 1) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = color; g.globalAlpha = 1 - k;
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + r * 2 + c, d = s * (0.2 + k * 0.8); g.fillRect(X(c) + s / 2 + Math.cos(a) * d - 2, Y(r) + s / 2 + Math.sin(a) * d - 1, 4, 2); }
    g.restore();
  }
  const C = c => ({ t: 'n', c });
  const T = 2.8;
  return function draw(time) {
    const p = (time % T) / T;
    g.clearRect(0, 0, w, h);
    if (type === 'n') {
      frame('left');
      const k = ease(seg(p, 0.12, 0.36)), pop = seg(p, 0.42, 0.62);
      [0, 2, 4, 6].forEach((c0, i) => {
        const c = lerp(c0, i, k);
        block(C(0), 2, c, { alpha: 1 - pop, scale: 1 + pop * 0.4, white: p > 0.38 && p < 0.5 ? 0.7 : 0 });
        sparks(2, i, seg(p, 0.45, 0.8), '#00f0ff');
      });
    } else if (type === 'w') {
      frame('left');
      block({ t: 'w' }, 2, 3); block({ t: 'w' }, 1, 3);
      const k = ease(seg(p, 0.15, 0.4)), k2 = ease(seg(p, 0.15, 0.32));
      block(C(1), 2, lerp(6, 4, k)); block(C(3), 1, lerp(6, 4, k2)); block(C(2), 2, lerp(2, 0, k));
    } else if (type === 'i') {
      frame('down');
      const fall = ease(seg(p, 0.1, 0.3)), pop = seg(p, 0.38, 0.55), crack = seg(p, 0.42, 0.62);
      for (const c of [0, 1, 2]) block(C(0), 2, c, { alpha: 1 - pop, scale: 1 + pop * 0.4, white: p > 0.32 && p < 0.42 ? 0.7 : 0 });
      block(C(0), lerp(0, 2, fall), 3, { alpha: 1 - pop, scale: 1 + pop * 0.4 });
      block({ t: 'i' }, 1, 1, { alpha: 1 - crack, scale: 1 + crack * 0.25, white: crack > 0 ? 0.5 * (1 - crack) : 0 });
      block({ t: 'i' }, 2, 5); // far ice: not touching the explosion, survives
      if (crack > 0) sparks(1, 1, crack, '#c9f3ff');
      for (const c of [0, 1, 2, 3]) sparks(2, c, seg(p, 0.4, 0.75), '#00f0ff');
    } else if (type === 'a') {
      frame('down');
      const fall = ease(seg(p, 0.1, 0.3)), pop = seg(p, 0.38, 0.55), beam = seg(p, 0.38, 0.6);
      block({ t: 'a', c: 3, d: 'right' }, 2, 0, { alpha: 1 - pop, scale: 1 + pop * 0.4 });
      for (const c of [1, 2]) block(C(3), 2, c, { alpha: 1 - pop, scale: 1 + pop * 0.4 });
      block(C(3), lerp(0, 2, fall), 3, { alpha: 1 - pop, scale: 1 + pop * 0.4 });
      [[1, 4], [0, 5], [2, 6]].forEach(([col, c]) => { block(C(col), 2, c, { alpha: 1 - seg(p, 0.42, 0.6) }); sparks(2, c, seg(p, 0.45, 0.8), ['#00f0ff', '#ff2fd1', '#7dff3a'][col]); });
      block(C(1), 1, 6); // another row: the laser only takes its own line
      if (beam > 0 && beam < 1) {
        g.save(); g.strokeStyle = `rgba(255,255,255,${1 - beam})`; g.shadowColor = '#fff'; g.shadowBlur = 16; g.lineWidth = s * 0.45 * (1 - beam * 0.7); g.lineCap = 'round';
        g.beginPath(); g.moveTo(X(0) + s / 2, Y(2) + s / 2); g.lineTo(X(7), Y(2) + s / 2); g.stroke(); g.restore();
      }
    } else if (type === 'h') {
      frame('down');
      const fall = ease(seg(p, 0.08, 0.24)), act = seg(p, 0.3, 0.55), pop = seg(p, 0.62, 0.78);
      const swap = act > 0.5;
      for (const c of [1, 2, 4]) block(C(1), 2, c, { alpha: 1 - pop, scale: 1 + pop * 0.4 });
      block(C(swap ? 1 : 0), 2, 3, { alpha: 1 - pop, scale: (1 + pop * 0.4) * (act > 0.3 && act < 0.8 ? 1.12 : 1) });
      block(C(2), 2, 6);
      if (act < 1) block({ t: 'h' }, lerp(0, 1, fall), 3, { scale: Math.max(0, 1 + 0.3 * Math.sin(act * Math.PI) - act * 1.1) });
      for (const c of [1, 2, 3, 4]) sparks(2, c, seg(p, 0.65, 0.9), '#ff2fd1');
    } else if (type === 'k') {
      frame('right');
      // exit gate on the right edge of the bottom row
      g.save(); g.strokeStyle = '#ff9a3c'; g.shadowColor = '#ff9a3c'; g.shadowBlur = 10; g.lineWidth = 3; g.lineCap = 'round';
      g.fillStyle = 'rgba(255,154,60,0.18)'; g.fillRect(X(6) + 1, Y(2) + 1, s - 2, s - 2);
      const gx = X(7) + 3; g.beginPath(); g.moveTo(gx - 4, Y(2)); g.lineTo(gx + 4, Y(2)); g.moveTo(gx - 4, Y(3)); g.lineTo(gx + 4, Y(3)); g.stroke();
      g.restore();
      block({ t: 'w' }, 1, 4);
      const k = ease(seg(p, 0.15, 0.45)), out = seg(p, 0.45, 0.6);
      block({ t: 'k' }, 2, lerp(1, 7, k) + out * 0.6, { alpha: 1 - seg(p, 0.42, 0.6) });
      block(C(2), 1, lerp(1, 3, ease(seg(p, 0.15, 0.3)))); // blocked by the wall: stays inside
      sparks(2, 7, seg(p, 0.45, 0.8), '#ff9a3c');
    }
  };
}
