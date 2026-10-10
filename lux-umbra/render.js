// 룩스 앤 움브라 — drawing. Reads the game state, never changes it.
//
// Layers, back to front:
//   cold background + parallax silhouettes → light (half-res canvas, added, plus a blurred bloom copy)
//   → rock silhouettes (pre-rendered per level) → warm rims where light falls (masked by the light canvas)
//   → light-sensitive blocks (solid = filled & glowing, ghost = dashed outline) → props and characters
//   → particles, sign bubbles, vignette.
// World drawing uses tile units: the canvas transform maps 1 unit to one tile.

import { castRay, lightSources, torchOrigin, torchLit, tileAt, pointLight } from './game.js';
import { COL } from './config.js';
import { drawPlayer, drawStatue, drawCrate } from './art.js';

const TAU = Math.PI * 2;
const RGB = { [COL.w]: [255, 214, 150], [COL.r]: [255, 92, 78], [COL.b]: [96, 160, 255] };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BLOCK = {
  L: { fill: [255, 230, 172], edge: [255, 205, 110], glow: COL.w },
  S: { fill: [22, 14, 44], edge: [150, 118, 255], glow: 0 },
  R: { fill: [255, 98, 84], edge: [255, 150, 130], glow: COL.r },
  B: { fill: [92, 150, 255], edge: [150, 200, 255], glow: COL.b },
};

// drawImage with the source rectangle clipped to the image (Safari draws nothing if it sticks out)
function blit(g, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  const kx = dw / sw, ky = dh / sh;
  let x0 = sx, y0 = sy, x1 = sx + sw, y1 = sy + sh;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(img.width, x1); y1 = Math.min(img.height, y1);
  if (x1 <= x0 || y1 <= y0) return;
  g.drawImage(img, x0, y0, x1 - x0, y1 - y0, dx + (x0 - sx) * kx, dy + (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
}

function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const light = document.createElement('canvas'), lctx = light.getContext('2d');
  const bloom = document.createElement('canvas'), bctx = bloom.getContext('2d');
  const rimTmp = document.createElement('canvas'), rctx = rimTmp.getContext('2d');
  let W = 300, H = 300, dpr = 1, T = 30;
  const cam = { x: 0, y: 0, ready: false };
  let fakes = [];
  let layer = null, warm = null, layerKey = '', vig = null, layerPx = 1;
  let fade = null, fadeFor = null;
  let parts = [];
  let shake = 0;
  let lastS = null;

  function resize(w, h, d) {
    W = Math.max(1, w); H = Math.max(1, h); dpr = d;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    light.width = Math.ceil(canvas.width / 2); light.height = Math.ceil(canvas.height / 2);
    bloom.width = Math.ceil(canvas.width / 10); bloom.height = Math.ceil(canvas.height / 10);
    rimTmp.width = light.width; rimTmp.height = light.height;
    baseT = clamp(Math.min(W / 12.5, H / 9.4), 22, 60); vig = null;
    T = baseT; levelH = 0;
    layerKey = '';
  }
  let baseT = 30, levelH = 0;
  // zoom in a little on short levels so a tall phone screen isn't mostly empty
  function fitLevel(s) {
    if (levelH === s.h) return;
    levelH = s.h;
    T = Math.round(clamp(Math.max(baseT, Math.min(H / s.h, W / 10.5)), 22, 64));
  }

  // ---------- static rock layer, rendered once per level / size ----------
  function solidStatic(s, x, y) { const c = tileAt(s, x, y); return c === '#' || c === 'H' || c === 'x'; }
  // false rock looks like rock but is not the edge of anything: its neighbours draw a rim towards it, which reads as a seam
  const edgeSolid = (s, x, y) => solidStatic(s, x, y) && tileAt(s, x, y) !== 'x';
  function buildLayer(s) {
    // long stages: keep each layer under ~6M pixels (phones refuse bigger canvases); it is scaled up when drawn
    const px = Math.min(T * dpr, Math.sqrt(6e6 / (s.w * s.h)));
    layerPx = px;
    const cw = Math.ceil(s.w * px), ch = Math.ceil(s.h * px);
    layer = document.createElement('canvas'); layer.width = cw; layer.height = ch;
    warm = document.createElement('canvas'); warm.width = cw; warm.height = ch;
    const g = layer.getContext('2d'), wg = warm.getContext('2d');
    g.setTransform(px, 0, 0, px, 0, 0); wg.setTransform(px, 0, 0, px, 0, 0);
    const falseRock = []; for (let i = 0; i < s.w * s.h; i++) if (s.tiles[i] === 'x') falseRock.push(i);
    fakes = falseRock;
    // rock mass
    g.fillStyle = '#04050a';
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (solidStatic(s, x, y)) g.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);
    // edges: cool rim everywhere, warm rim copy for the lit mask; grass and roots for the silhouette look
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      if (!solidStatic(s, x, y)) continue;
      const seed = (y * 977 + x * 131) | 0;
      const up = !edgeSolid(s, x, y - 1) && y > 0, dn = !edgeSolid(s, x, y + 1) && y < s.h - 1;
      const lf = !edgeSolid(s, x - 1, y) && x > 0, rt = !edgeSolid(s, x + 1, y) && x < s.w - 1;
      g.lineCap = 'round';
      if (up) {
        g.strokeStyle = 'rgba(96,128,210,0.55)'; g.lineWidth = 0.05;
        g.beginPath(); g.moveTo(x, y + 0.025); g.lineTo(x + 1, y + 0.025); g.stroke();
        wg.fillStyle = 'rgba(255,224,170,1)'; wg.fillRect(x, y, 1, 0.07);
        const grd = wg.createLinearGradient(0, y, 0, y + 0.45); grd.addColorStop(0, 'rgba(255,200,130,0.35)'); grd.addColorStop(1, 'rgba(255,200,130,0)');
        wg.fillStyle = grd; wg.fillRect(x, y, 1, 0.45);
        // grass blades
        g.strokeStyle = '#04050a'; g.lineWidth = 0.035;
        const nb = 2 + Math.floor(hash(seed) * 4);
        for (let k = 0; k < nb; k++) {
          const bx = x + hash(seed + k * 7) * 0.95 + 0.02, bh = 0.08 + hash(seed + k * 13) * 0.18, lean = (hash(seed + k * 3) - 0.5) * 0.12;
          g.beginPath(); g.moveTo(bx, y + 0.02); g.quadraticCurveTo(bx + lean * 0.3, y - bh * 0.5, bx + lean, y - bh); g.stroke();
        }
      }
      if (dn) {
        g.strokeStyle = 'rgba(70,96,170,0.35)'; g.lineWidth = 0.035;
        g.beginPath(); g.moveTo(x, y + 0.98); g.lineTo(x + 1, y + 0.98); g.stroke();
        if (hash(seed + 5) < 0.3) { // hanging root
          g.strokeStyle = '#04050a'; g.lineWidth = 0.03; const rx = x + 0.2 + hash(seed + 9) * 0.6, rl = 0.2 + hash(seed + 11) * 0.5;
          g.beginPath(); g.moveTo(rx, y + 1); g.quadraticCurveTo(rx + 0.08, y + 1 + rl * 0.6, rx - 0.03, y + 1 + rl); g.stroke();
        }
      }
      if (lf) { g.strokeStyle = 'rgba(80,110,190,0.4)'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(x + 0.02, y); g.lineTo(x + 0.02, y + 1); g.stroke(); wg.fillStyle = 'rgba(255,220,160,0.8)'; wg.fillRect(x, y, 0.06, 1); }
      if (rt) { g.strokeStyle = 'rgba(80,110,190,0.4)'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(x + 0.98, y); g.lineTo(x + 0.98, y + 1); g.stroke(); wg.fillStyle = 'rgba(255,220,160,0.8)'; wg.fillRect(x + 0.94, y, 0.06, 1); }
    }
    // false rock: a hairline crack and a few lighter grains
    for (const i of falseRock) {
      const x = i % s.w, y = (i / s.w) | 0, seed = (y * 977 + x * 131) | 0;
      g.strokeStyle = 'rgba(120,150,225,0.3)'; g.lineWidth = 0.03; g.beginPath();
      let cx = x + 0.3 + hash(seed) * 0.4; g.moveTo(cx, y + 0.05);
      for (let k = 1; k <= 4; k++) { cx += (hash(seed + k) - 0.5) * 0.3; g.lineTo(cx, y + 0.05 + k * 0.22); }
      g.stroke();
      g.fillStyle = 'rgba(140,165,230,0.28)';
      for (let k = 0; k < 3; k++) g.fillRect(x + 0.1 + hash(seed + 20 + k) * 0.8, y + 0.1 + hash(seed + 30 + k) * 0.8, 0.04, 0.04);
    }
    // spikes
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const c = tileAt(s, x, y);
      if (c !== '^' && c !== 'v') continue;
      const up = c === '^';
      g.fillStyle = '#04050a';
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const bx = x + k / 3, mid = bx + 1 / 6;
        if (up) { g.moveTo(bx, y + 1); g.lineTo(mid, y + 0.38); g.lineTo(bx + 1 / 3, y + 1); }
        else { g.moveTo(bx, y); g.lineTo(mid, y + 0.62); g.lineTo(bx + 1 / 3, y); }
      }
      g.fill();
      g.strokeStyle = 'rgba(150,170,230,0.55)'; g.lineWidth = 0.025;
      g.beginPath();
      for (let k = 0; k < 3; k++) { const mid = x + k / 3 + 1 / 6; if (up) { g.moveTo(mid - 0.05, y + 0.52); g.lineTo(mid, y + 0.38); } else { g.moveTo(mid - 0.05, y + 0.48); g.lineTo(mid, y + 0.62); } }
      g.stroke();
      wg.fillStyle = 'rgba(255,220,160,0.9)';
      for (let k = 0; k < 3; k++) { const mid = x + k / 3 + 1 / 6; wg.beginPath(); if (up) { wg.moveTo(mid - 0.06, y + 0.6); wg.lineTo(mid, y + 0.38); wg.lineTo(mid + 0.03, y + 0.6); } else { wg.moveTo(mid - 0.06, y + 0.4); wg.lineTo(mid, y + 0.62); wg.lineTo(mid + 0.03, y + 0.4); } wg.fill(); }
    }
    layerKey = `${s.def.id}|${T}|${dpr}|${s.w}x${s.h}`;
  }

  // ---------- camera ----------
  function follow(s, dt, snap) {
    const vw = W / T, vh = H / T, p = s.p;
    let tx = p.x + p.w / 2 + p.face * 1.2 - vw / 2;
    let ty = p.y + p.h / 2 - vh * 0.52;
    tx = s.w <= vw ? (s.w - vw) / 2 : clamp(tx, 0, s.w - vw);
    ty = s.h <= vh ? (s.h - vh) / 2 : clamp(ty, 0, s.h - vh);
    if (snap || !cam.ready) { cam.x = tx; cam.y = ty; cam.ready = true; return; }
    const k = 1 - Math.exp(-dt * 6);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }

  // ---------- light ----------
  function fanPolys(s, src, rays) {
    // returns { col: [quads...] } where quad = 4 points
    const out = new Map();
    const N = rays.length;
    const segsAll = rays.map(a => ({ a, segs: castRay(s, src.x, src.y, a, src.range, src.col) }));
    for (let i = 0; i < N - 1; i++) {
      const A = segsAll[i], B = segsAll[i + 1];
      const n = Math.min(A.segs.length, B.segs.length);
      for (let k = 0; k < n; k++) {
        const sa = A.segs[k], sb = B.segs[k];
        if (!sa.col) continue;
        const ca = Math.cos(A.a), sa_ = Math.sin(A.a), cb = Math.cos(B.a), sb_ = Math.sin(B.a);
        const q = [src.x + ca * sa.d0, src.y + sa_ * sa.d0, src.x + ca * sa.d1, src.y + sa_ * sa.d1, src.x + cb * sb.d1, src.y + sb_ * sb.d1, src.x + cb * sb.d0, src.y + sb_ * sb.d0];
        if (!out.has(sa.col)) out.set(sa.col, []);
        out.get(sa.col).push(q);
      }
    }
    return out;
  }
  function fillFan(g, src, polys, strength) {
    for (const [col, qs] of polys) {
      const c = RGB[col] || RGB[COL.w];
      const grd = g.createRadialGradient(src.x, src.y, 0, src.x, src.y, src.range);
      grd.addColorStop(0, rgba(c, 0.62 * strength)); grd.addColorStop(0.35, rgba(c, 0.36 * strength)); grd.addColorStop(1, rgba(c, 0));
      g.fillStyle = grd;
      g.beginPath();
      for (const q of qs) { g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.lineTo(q[4], q[5]); g.lineTo(q[6], q[7]); g.closePath(); }
      g.fill();
    }
  }

  const glows = {};
  function glowSprite(col) {
    if (glows[col]) return glows[col];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), c = RGB[col];
    const grd = g.createRadialGradient(32, 32, 2.5, 32, 32, 32);
    grd.addColorStop(0, rgba(c, 0.35)); grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return (glows[col] = cv);
  }

  function drawLight(s, t) {
    const k = dpr / 2 * T;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, light.width, light.height);
    lctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    lctx.globalCompositeOperation = 'lighter';
    const srcs = lightSources(s);
    for (const src of srcs) {
      if (src.kind === 'zone') {
        const c = RGB[src.col];
        const grd = lctx.createLinearGradient(0, src.y, 0, src.y + src.h);
        grd.addColorStop(0, rgba(c, 0.34)); grd.addColorStop(1, rgba(c, 0.15));
        lctx.fillStyle = grd; lctx.fillRect(src.x, src.y, src.w, src.h);
        continue;
      }
      if (src.halo) {
        const c = RGB[src.col];
        const grd = lctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, src.range * 1.15);
        grd.addColorStop(0, rgba(c, 0.5)); grd.addColorStop(1, rgba(c, 0));
        lctx.fillStyle = grd; lctx.beginPath(); lctx.arc(src.x, src.y, src.range * 1.15, 0, TAU); lctx.fill();
        continue;
      }
      const rays = [];
      if (src.kind === 'beam') {
        const n = Math.max(14, Math.round(src.half * 2 / 0.025));
        for (let i = 0; i <= n; i++) rays.push(src.dir - src.half + (2 * src.half * i) / n);
      } else {
        const n = 96; for (let i = 0; i <= n; i++) rays.push((i / n) * TAU);
      }
      const flicker = src.torch ? 1 : 0.92 + 0.08 * Math.sin(t * 7 + src.x);
      fillFan(lctx, src, fanPolys(s, src, rays), src.torch ? 1.05 : 0.9 * flicker);
    }
    // glowing things also glow
    for (const i of s.reactive) {
      const c = s.tiles[i];
      if (!s.solid[i] || c === 'S' || c === 'H') continue;
      const x = i % s.w, y = (i / s.w) | 0;
      lctx.drawImage(glowSprite(BLOCK[c].glow), x - 0.8, y - 0.8, 2.6, 2.6);
    }
    for (const d of s.doors) {
      if (d.hidden && !s.reveal[d.y * s.w + d.x]) continue;
      const pul = 0.75 + 0.25 * Math.sin(t * 2.5);
      const grd = lctx.createRadialGradient(d.x + 0.5, d.y + 0.2, 0.1, d.x + 0.5, d.y + 0.2, 2.2);
      grd.addColorStop(0, `rgba(255,236,190,${0.55 * pul})`); grd.addColorStop(1, 'rgba(255,236,190,0)');
      lctx.fillStyle = grd; lctx.fillRect(d.x - 2, d.y - 2, 5, 5);
    }
    for (const c of s.checks) if (c.on) {
      const grd = lctx.createRadialGradient(c.x + 0.5, c.y + 0.1, 0.05, c.x + 0.5, c.y + 0.1, 1.6);
      grd.addColorStop(0, 'rgba(255,190,110,0.45)'); grd.addColorStop(1, 'rgba(255,190,110,0)');
      lctx.fillStyle = grd; lctx.fillRect(c.x - 1.5, c.y - 1.5, 4, 4);
    }
    for (const q of s.shards) if (!q.got) {
      const grd = lctx.createRadialGradient(q.x + 0.5, q.y + 0.5, 0.05, q.x + 0.5, q.y + 0.5, 1.2);
      grd.addColorStop(0, 'rgba(255,250,220,0.5)'); grd.addColorStop(1, 'rgba(255,250,220,0)');
      lctx.fillStyle = grd; lctx.fillRect(q.x - 1, q.y - 1, 3, 3);
    }
    lctx.globalCompositeOperation = 'source-over';
    // bloom: a tiny copy, stretched back up
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bloom.width, bloom.height);
    bctx.drawImage(light, 0, 0, bloom.width, bloom.height);
    return srcs;
  }

  // ---------- background ----------
  // one mood per chapter: sky gradient, far/near silhouette colours, share of pillars (vs spires), mote colour
  const THEMES = [
    { sky: ['#060a17', '#0c1532', '#151f42'], sil: ['#0f1934', '#0a1128'], pil: 0.5, mote: '170,200,255' },  // night forest
    { sky: ['#0a0716', '#170f33', '#241a4a'], sil: ['#1a1238', '#110b28'], pil: 0.3, mote: '190,170,255' },  // violet dusk
    { sky: ['#06100f', '#0d2224', '#173538'], sil: ['#10292b', '#0a1c1e'], pil: 0.85, mote: '160,240,220' }, // teal ruins
    { sky: ['#110a06', '#26150b', '#3a2414'], sil: ['#2a1a10', '#1c1109'], pil: 0.6, mote: '255,200,140' },  // lamp-lit amber
    { sky: ['#14060c', '#2a0e1e', '#1a1442'], sil: ['#2a1028', '#1a0a1c'], pil: 0.4, mote: '255,150,170' },  // red and blue
    { sky: ['#050c16', '#0b2036', '#12344e'], sil: ['#0e2a40', '#08192a'], pil: 0.9, mote: '180,230,255' },  // glass halls
    { sky: ['#0b0b0d', '#1a1a20', '#2a2a32'], sil: ['#202026', '#141418'], pil: 0.95, mote: '210,210,220' }, // stone gallery
    { sky: ['#0b1014', '#1c252c', '#36424a'], sil: ['#2a343c', '#1c242a'], pil: 0.2, mote: '220,230,240', mist: true }, // fog
  ];
  function drawBackground(s, t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = THEMES[s.def.ch] || THEMES[0];
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, th.sky[0]); grd.addColorStop(0.6, th.sky[1]); grd.addColorStop(1, th.sky[2]);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    // parallax silhouettes: far pillars and near trees; each stage varies their height and mix
    const seed = [...s.def.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const tall = 0.75 + 0.5 * hash(seed + 3), pil = clamp(th.pil + (hash(seed + 4) - 0.5) * 0.3, 0, 1);
    for (const [par, col, base, hgt] of [[0.18, th.sil[0], 0.78, 0.5 * tall], [0.4, th.sil[1], 0.86, 0.38 * tall]]) {
      ctx.fillStyle = col;
      const span = 3.2 * T, off = -(cam.x * T * par) % span;
      const i0 = Math.floor((cam.x * T * par) / span);
      for (let i = -1; i < W / span + 2; i++) {
        const k = i + i0, r = hash(seed + k * 17 + Math.round(par * 100));
        const x = off + i * span + r * span * 0.5, h = H * hgt * (0.45 + r * 0.7), w = T * (0.4 + r * 0.9);
        const yb = H * base - cam.y * T * par * 0.3 + H * 0.3;
        ctx.beginPath();
        if (r < pil) { ctx.rect(x, yb - h, w, h + H); ctx.moveTo(x - w * 0.4, yb - h); ctx.lineTo(x + w * 1.4, yb - h); ctx.lineTo(x + w * 1.4, yb - h + T * 0.25); ctx.lineTo(x - w * 0.4, yb - h + T * 0.25); }
        else { ctx.moveTo(x, yb + H); ctx.lineTo(x + w * 0.35, yb - h); ctx.lineTo(x + w * 0.65, yb - h); ctx.lineTo(x + w, yb + H); }
        ctx.fill();
      }
    }
    if (th.mist) { // low mist bank
      const mg = ctx.createLinearGradient(0, H * 0.45, 0, H);
      mg.addColorStop(0, 'rgba(200,215,225,0)'); mg.addColorStop(1, 'rgba(200,215,225,0.16)');
      ctx.fillStyle = mg; ctx.fillRect(0, H * 0.45, W, H * 0.55);
    }
    // floating motes
    ctx.fillStyle = `rgba(${th.mote},0.25)`;
    for (let i = 0; i < 26; i++) {
      const r1 = hash(seed + i * 3), r2 = hash(seed + i * 5 + 1);
      const x = ((r1 * W + t * (6 + r2 * 10)) % W + W) % W, y = ((r2 * H - t * (3 + r1 * 6)) % H + H) % H;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }

  // ---------- blocks ----------
  function stepFade(s, dt) {
    if (fadeFor !== s) { fade = new Float32Array(s.w * s.h); for (const i of s.reactive) fade[i] = s.solid[i]; fadeFor = s; }
    const k = Math.min(1, dt * 12);
    for (const i of s.reactive) fade[i] += (s.solid[i] - fade[i]) * k;
  }

  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }

  // Block looks are drawn once per tile size into small sprites, then stamped (much cheaper than paths each frame).
  let sprites = null, spriteKey = '';
  function blockSprites() {
    const key = `${T}|${dpr}`;
    if (spriteKey === key) return sprites;
    spriteKey = key; sprites = {};
    const px = Math.ceil(T * dpr);
    for (const c of 'LSRB') {
      const B = BLOCK[c];
      for (const solid of [0, 1]) {
        const cv = document.createElement('canvas'); cv.width = cv.height = px;
        const g = cv.getContext('2d'); g.setTransform(px, 0, 0, px, 0, 0);
        if (!solid) { // ghost: dashed outline + a small sun / moon mark, so the level stays readable
          g.setLineDash([0.12, 0.09]);
          g.strokeStyle = rgba(B.edge, c === 'S' ? 0.42 : 0.6); g.lineWidth = 0.045;
          roundRect(g, 0.08, 0.08, 0.84, 0.84, 0.1); g.stroke(); g.setLineDash([]);
          g.fillStyle = rgba(B.edge, 0.07); g.fill();
          g.fillStyle = rgba(B.edge, c === 'S' ? 0.28 : 0.4);
          if (c === 'S') { g.beginPath(); g.arc(0.5, 0.5, 0.11, 0, TAU); g.arc(0.56, 0.46, 0.09, 0, TAU, true); g.fill('evenodd'); }
          else { g.beginPath(); g.arc(0.5, 0.5, 0.06, 0, TAU); g.fill(); }
        } else if (c === 'S') {
          g.fillStyle = '#0c0718'; roundRect(g, 0.02, 0.02, 0.96, 0.96, 0.08); g.fill();
          g.strokeStyle = rgba(B.edge, 0.85); g.lineWidth = 0.05; g.stroke();
          g.strokeStyle = rgba(B.edge, 0.22); g.lineWidth = 0.03;
          g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(0.15 + k * 0.28, 0.85); g.lineTo(0.4 + k * 0.28, 0.15); } g.stroke();
        } else {
          const grd = g.createLinearGradient(0, 0, 0, 1);
          grd.addColorStop(0, rgba(B.fill.map(v => Math.min(255, v + 30)), 1)); grd.addColorStop(1, rgba(B.fill.map(v => v * 0.75), 1));
          g.fillStyle = grd; roundRect(g, 0.03, 0.03, 0.94, 0.94, 0.08); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.04;
          g.beginPath(); g.moveTo(0.12, 0.12); g.lineTo(0.88, 0.12); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(0.5, 0.52, 0.12, 0, TAU); g.fill();
        }
        sprites[c + solid] = cv;
      }
    }
    return sprites;
  }

  function drawBlocks(s, t, vx0, vy0, vx1, vy1) {
    const sp = blockSprites();
    for (const i of s.reactive) {
      const x = i % s.w, y = (i / s.w) | 0, c = s.tiles[i];
      if (c === 'H' || x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      const a = fade[i];
      if (s.secret[i] && a < 0.99) { // a hidden light block: only a faint outline and a twinkle until the beam finds it
        ctx.globalAlpha = (1 - a) * 0.13; ctx.drawImage(sp.L0, x, y, 1, 1);
        ctx.globalAlpha = (1 - a) * (0.25 + 0.35 * Math.sin(t * 2.2 + hash(i) * 9)); ctx.fillStyle = '#ffe6ae';
        ctx.fillRect(x + 0.2 + hash(i + 1) * 0.6, y + 0.2 + hash(i + 2) * 0.6, 0.05, 0.05);
      } else if (a < 0.99) { ctx.globalAlpha = 1 - a; ctx.drawImage(sp[c + 0], x, y, 1, 1); }
      if (a > 0.01) { ctx.globalAlpha = a; ctx.drawImage(sp[c + 1], x, y, 1, 1); }
    }
    ctx.globalAlpha = 1;
  }


  // grains of dust drifting down out of false rock
  function drawDust(vx0, vy0, vx1, vy1, t) {
    ctx.fillStyle = '#9fb4e6';
    for (const i of fakes) {
      const x = i % lastS.w, y = (i / lastS.w) | 0;
      if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.32 + hash(i * 3 + k) * 3) % 1;
        ctx.globalAlpha = 0.5 * Math.sin(ph * Math.PI);
        ctx.fillRect(x + 0.15 + hash(i * 5 + k) * 0.7, y + 1 + ph * 0.9, 0.045, 0.045);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- props ----------
  function drawProps(s, t, srcs) {
    // glass panes
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const c = tileAt(s, x, y);
      if (c !== 'r' && c !== 'b') continue;
      const col = c === 'r' ? [255, 80, 80] : [80, 150, 255];
      ctx.fillStyle = rgba(col, 0.38); ctx.fillRect(x + 0.08, y, 0.84, 1);
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 0.05; ctx.strokeRect(x + 0.08, y + 0.02, 0.84, 0.96);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(x + 0.25, y + 0.75); ctx.lineTo(x + 0.6, y + 0.2); ctx.stroke();
    }
    // lamps (rails first for the moving ones)
    for (const L of s.lamps) if (L.move) {
      ctx.strokeStyle = 'rgba(110,130,190,0.45)'; ctx.lineWidth = 0.05; ctx.setLineDash([0.12, 0.1]);
      ctx.beginPath(); ctx.moveTo(L.x0, L.y0); ctx.lineTo(L.x0 + L.move[0], L.y0 + L.move[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const L of s.lamps) {
      const on = L.g ? s.groups[L.g] : L.on, c = RGB[L.col];
      ctx.save(); ctx.translate(L.x, L.y);
      if (L.kind === 'beam') ctx.rotate(L.dir);
      ctx.fillStyle = '#0a0b12'; ctx.strokeStyle = 'rgba(120,140,200,0.5)'; ctx.lineWidth = 0.03;
      if (L.kind === 'beam') { ctx.beginPath(); ctx.moveTo(-0.3, -0.18); ctx.lineTo(0.12, -0.26); ctx.lineTo(0.12, 0.26); ctx.lineTo(-0.3, 0.18); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, 0, 0.26, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = on ? rgba(c, 1) : '#2a2d3a';
      if (on) { ctx.shadowColor = rgba(c, 1); ctx.shadowBlur = 14; }
      if (L.kind === 'beam') ctx.fillRect(0.08, -0.2, 0.08, 0.4); else { ctx.beginPath(); ctx.arc(0, 0, 0.14, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // room-light fixtures
    for (const z of s.zones) {
      const on = z.g ? s.groups[z.g] : z.on, c = RGB[z.col];
      const cx = z.x + z.w / 2;
      for (const fx of z.w > 8 ? [z.x + z.w * 0.25, z.x + z.w * 0.75] : [cx]) {
        ctx.strokeStyle = '#0a0b12'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.moveTo(fx, z.y - 0.1); ctx.lineTo(fx, z.y + 0.5); ctx.stroke();
        ctx.fillStyle = '#0a0b12'; ctx.beginPath(); ctx.moveTo(fx - 0.35, z.y + 0.8); ctx.lineTo(fx + 0.35, z.y + 0.8); ctx.lineTo(fx + 0.15, z.y + 0.45); ctx.lineTo(fx - 0.15, z.y + 0.45); ctx.closePath(); ctx.fill();
        ctx.fillStyle = on ? rgba(c, 1) : '#262a38';
        if (on) { ctx.shadowColor = rgba(c, 1); ctx.shadowBlur = 16; }
        ctx.beginPath(); ctx.arc(fx, z.y + 0.84, 0.12, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    // doors
    for (const d of s.doors) {
      const shown = !d.hidden || s.reveal[d.y * s.w + d.x];
      if (!shown) {
        // looks like rock; a faint shimmer hints at it
        const k = (Math.sin(t * 1.7 + d.x) + 1) / 2;
        ctx.fillStyle = `rgba(200,220,255,${0.05 + 0.1 * k})`;
        for (let i = 0; i < 3; i++) { const a = t * 0.8 + i * 2.1; ctx.fillRect(d.x + 0.5 + Math.cos(a) * 0.3, d.y + 0.5 + Math.sin(a * 1.3) * 0.35, 0.04, 0.04); }
        continue;
      }
      const top = d.y - 0.75, pul = 0.8 + 0.2 * Math.sin(t * 2.5);
      if (d.hidden) { ctx.fillStyle = '#04050a'; ctx.fillRect(d.x, d.y, 1, 1); }
      ctx.fillStyle = '#04050a';
      ctx.beginPath(); ctx.moveTo(d.x - 0.08, d.y + 1); ctx.lineTo(d.x - 0.08, top + 0.4); ctx.arc(d.x + 0.5, top + 0.4, 0.58, Math.PI, 0); ctx.lineTo(d.x + 1.08, d.y + 1); ctx.closePath(); ctx.fill();
      const grd = ctx.createLinearGradient(0, top, 0, d.y + 1);
      grd.addColorStop(0, `rgba(255,250,230,${pul})`); grd.addColorStop(1, `rgba(255,200,120,${0.85 * pul})`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(d.x + 0.08, d.y + 1); ctx.lineTo(d.x + 0.08, top + 0.42); ctx.arc(d.x + 0.5, top + 0.42, 0.42, Math.PI, 0); ctx.lineTo(d.x + 0.92, d.y + 1); ctx.closePath(); ctx.fill();
    }
    // levers
    for (const l of s.levers) {
      const on = s.groups[l.g[0]];
      ctx.fillStyle = '#0a0b12'; ctx.fillRect(l.x + 0.22, l.y + 0.82, 0.56, 0.18);
      ctx.save(); ctx.translate(l.x + 0.5, l.y + 0.86); ctx.rotate(on ? 0.6 : -0.6);
      ctx.strokeStyle = '#0a0b12'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.55); ctx.stroke();
      ctx.fillStyle = on ? '#ffd27a' : '#5a6380'; if (on) { ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(0, -0.58, 0.1, 0, TAU); ctx.fill();
      ctx.restore();
      if (l.time) { // clock lever: a dial, and a ring that runs down while it is pulled
        ctx.strokeStyle = 'rgba(140,165,230,0.7)'; ctx.lineWidth = 0.035;
        ctx.beginPath(); ctx.arc(l.x + 0.5, l.y + 0.2, 0.16, 0, TAU); ctx.stroke();
        if (l.timer > 0) {
          ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 0.07;
          ctx.beginPath(); ctx.arc(l.x + 0.5, l.y + 0.2, 0.16, -Math.PI / 2, -Math.PI / 2 + TAU * (l.timer / l.time)); ctx.stroke();
        }
      }
    }
    // mirrors: a silver plate on a dark frame; turning ones have a round base
    for (const m of s.mirrors) {
      ctx.fillStyle = '#0a0b12'; ctx.fillRect(m.x, m.y, 1, 1);
      ctx.strokeStyle = 'rgba(120,140,200,0.55)'; ctx.lineWidth = 0.03; ctx.strokeRect(m.x + 0.03, m.y + 0.03, 0.94, 0.94);
      const a = m.state === 0 ? [m.x + 0.14, m.y + 0.86, m.x + 0.86, m.y + 0.14] : [m.x + 0.14, m.y + 0.14, m.x + 0.86, m.y + 0.86];
      const grd = ctx.createLinearGradient(a[0], a[1], a[2], a[3]);
      grd.addColorStop(0, '#9fb4e8'); grd.addColorStop(0.5, '#f4f8ff'); grd.addColorStop(1, '#8aa0d8');
      ctx.strokeStyle = grd; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[2], a[3]); ctx.stroke(); ctx.lineCap = 'butt';
      if (m.turn) {
        ctx.strokeStyle = 'rgba(255,210,122,0.75)'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(m.x + 0.5, m.y + 0.5, 0.36, 0.3, 1.3); ctx.stroke();
        ctx.beginPath(); ctx.arc(m.x + 0.5, m.y + 0.5, 0.36, Math.PI + 0.3, Math.PI + 1.3); ctx.stroke();
      }
    }
    // lens stands
    for (const l of s.lenses) {
      const c = RGB[COL[l.col]];
      ctx.fillStyle = '#0a0b12'; ctx.fillRect(l.x + 0.38, l.y + 0.45, 0.24, 0.55); ctx.fillRect(l.x + 0.25, l.y + 0.92, 0.5, 0.08);
      const bob = Math.sin(t * 2 + l.x) * 0.04;
      ctx.fillStyle = rgba(c, 0.85); ctx.shadowColor = rgba(c, 1); ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.ellipse(l.x + 0.5, l.y + 0.25 + bob, 0.2, 0.24, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(l.x + 0.46, l.y + 0.2 + bob, 0.1, Math.PI, Math.PI * 1.5); ctx.stroke();
    }
    // checkpoints: a lantern on a post
    for (const c of s.checks) {
      ctx.fillStyle = '#0a0b12'; ctx.fillRect(c.x + 0.45, c.y + 0.1, 0.1, 0.9);
      ctx.fillRect(c.x + 0.3, c.y - 0.12, 0.4, 0.06);
      ctx.fillStyle = c.on ? '#ffbf6a' : '#2b3040'; if (c.on) { ctx.shadowColor = '#ffb050'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.ellipse(c.x + 0.5, c.y + 0.03, 0.13, 0.15 + (c.on ? Math.sin(t * 9) * 0.015 : 0), 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    // signs
    for (const g of s.signs) {
      ctx.fillStyle = '#0a0b12'; ctx.fillRect(g.x + 0.45, g.y + 0.4, 0.1, 0.6);
      roundRect(ctx, g.x + 0.12, g.y + 0.05, 0.76, 0.45, 0.06); ctx.fill();
      ctx.strokeStyle = 'rgba(140,165,230,0.6)'; ctx.lineWidth = 0.03; ctx.stroke();
      ctx.fillStyle = 'rgba(200,215,255,0.85)'; ctx.font = '0.36px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', g.x + 0.5, g.y + 0.29);
    }
    // shard
    for (const q of s.shards) if (!q.got) {
      const x = q.x + 0.5, y = q.y + 0.5 + Math.sin(t * 2.4) * 0.08, w = 0.2 * Math.abs(Math.cos(t * 1.8)) + 0.05;
      ctx.fillStyle = '#fffbe6'; ctx.shadowColor = '#fff2b0'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(x, y - 0.3); ctx.lineTo(x + w, y); ctx.lineTo(x, y + 0.3); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function drawActors(s, t, srcs) {
    for (const c of s.crates) {
      const lit = pointLight(s, c.x + 0.5, c.y + 0.3, srcs) !== 0;
      drawCrate(ctx, c.x, c.y, c.w, c.h, lit);
    }
    for (const m of s.statues) drawStatue(ctx, m.x + m.w / 2, m.y + m.h, { awake: m.awake, t, face: m.face, lit: m.awake });
    const p = s.p;
    if (!p.dead) {
      const c = RGB[s.fl.col];
      drawPlayer(ctx, p.x + p.w / 2, p.y + p.h, { face: p.face, aim: s.fl.aim, on: torchLit(s), walk: walkPhase, air: !p.onGround, t, col: c });
      if (!torchLit(s)) {
        // faint aim hint while the torch is off
        const o = torchOrigin(s);
        ctx.strokeStyle = 'rgba(255,230,180,0.22)'; ctx.lineWidth = 0.035; ctx.setLineDash([0.08, 0.12]);
        ctx.beginPath(); ctx.moveTo(o.x + Math.cos(s.fl.aim) * 0.5, o.y + Math.sin(s.fl.aim) * 0.5); ctx.lineTo(o.x + Math.cos(s.fl.aim) * 1.6, o.y + Math.sin(s.fl.aim) * 1.6); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  let walkPhase = 0;

  // fog: soft dark clouds drifting over their tiles
  function drawFog(s, t, vx0, vy0, vx1, vy1) {
    if (!s.fog.some(v => v)) return;
    for (let y = Math.max(0, vy0); y <= Math.min(s.h - 1, vy1); y++) for (let x = Math.max(0, vx0); x <= Math.min(s.w - 1, vx1); x++) {
      if (!s.fog[y * s.w + x]) continue;
      const k = hash(x * 31 + y * 7), ox = Math.sin(t * 0.5 + k * 6) * 0.15, oy = Math.cos(t * 0.4 + k * 5) * 0.1;
      const grd = ctx.createRadialGradient(x + 0.5 + ox, y + 0.5 + oy, 0.1, x + 0.5 + ox, y + 0.5 + oy, 0.95);
      grd.addColorStop(0, 'rgba(24,20,44,0.85)'); grd.addColorStop(0.6, 'rgba(30,26,54,0.55)'); grd.addColorStop(1, 'rgba(30,26,54,0)');
      ctx.fillStyle = grd; ctx.fillRect(x - 0.5, y - 0.5, 2, 2);
    }
  }

  function drawParticles(dt) {
    const next = [];
    for (const q of parts) {
      q.life -= dt; if (q.life <= 0) continue;
      q.vy += (q.g ?? 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const a = Math.min(1, q.life / q.max * 1.5);
      ctx.fillStyle = rgba(q.col, a);
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      next.push(q);
    }
    parts = next;
  }

  function burst(x, y, col, n = 12, speed = 3, life = 0.6, size = 0.08, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, col, size, g });
    }
  }

  function onEvent(s, e) {
    const p = s.p, cx = p.x + p.w / 2;
    switch (e.type) {
      case 'die': burst(e.x, e.y, [255, 246, 220], 26, 5, 0.8, 0.09, 6); burst(e.x, e.y, [10, 10, 16], 18, 3, 0.9, 0.14, 4); shake = 0.35; break;
      case 'solid': burst(e.x + 0.5, e.y + 0.5, RGB[BLOCK[e.c].glow] || [160, 130, 255], 4, 1.4, 0.35, 0.06); break;
      case 'reveal': burst(e.x + 0.5, e.y + 0.5, [255, 236, 180], 22, 2.5, 1, 0.07); break;
      case 'shard': burst(e.x + 0.5, e.y + 0.5, [255, 250, 220], 30, 4, 0.9, 0.08); break;
      case 'check': burst(e.x + 0.5, e.y, [255, 190, 110], 16, 2.5, 0.8, 0.07, -1); break;
      case 'lever': case 'leverBack': burst(e.x + 0.5, e.y + 0.3, [255, 220, 150], 8, 2, 0.4, 0.06); break;
      case 'mirror': burst(e.x + 0.5, e.y + 0.5, [220, 235, 255], 12, 2, 0.5, 0.06); break;
      case 'lens': burst(e.x + 0.5, e.y + 0.25, RGB[COL[e.col]], 14, 2.2, 0.6, 0.07); break;
      case 'wake': burst(e.x, e.y + 0.4, [140, 130, 140], 10, 1.5, 0.7, 0.07, 3); break;
      case 'land': burst(cx, p.y + p.h, [40, 50, 80], 6, 1.6, 0.35, 0.06, 2); break;
      case 'jump': burst(cx, p.y + p.h, [40, 50, 80], 4, 1.2, 0.3, 0.05, 2); break;
      case 'thud': burst(e.x, e.y, [50, 45, 40], 8, 1.8, 0.4, 0.07, 3); shake = Math.max(shake, 0.12); break;
      case 'clear': burst(cx, p.y + 0.4, [255, 240, 200], 40, 5, 1.2, 0.08); break;
      case 'respawn': burst(cx, p.y + 0.5, [255, 230, 190], 14, 2, 0.6, 0.06); break;
      default: break;
    }
  }

  function wrapText(text, maxW) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) { const tryS = cur ? cur + ' ' + w : w; if (ctx.measureText(tryS).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryS; }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawSigns(s) {
    const p = s.p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${Math.round(clamp(T * 0.5, 13, 17))}px Jua, "Apple SD Gothic Neo", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of s.signs) {
      const dx = p.x + p.w / 2 - (g.x + 0.5), dy = p.y + p.h / 2 - (g.y + 0.5);
      const near = Math.abs(dx) < 2.6 && Math.abs(dy) < 2.2;
      g.vis = (g.vis || 0) + ((near ? 1 : 0) - (g.vis || 0)) * 0.15;
      if (g.vis < 0.02 || !g.text) continue;
      const lines = wrapText(g.text, W - 40);
      const lh = Math.round(clamp(T * 0.5, 13, 17)) * 1.3;
      const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22, h = lines.length * lh + 12;
      // pinned under the corner buttons so it never hides the action
      const x = W / 2, y = 56 + h / 2;
      ctx.globalAlpha = g.vis;
      ctx.fillStyle = 'rgba(10,14,30,0.88)'; ctx.strokeStyle = 'rgba(255,214,150,0.6)'; ctx.lineWidth = 1;
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3d6';
      lines.forEach((l, i) => ctx.fillText(l, x, y - h / 2 + 6 + lh * (i + 0.5)));
      ctx.globalAlpha = 1;
    }
  }

  // ---------- frame ----------
  function draw(s, t, dt, opts = {}) {
    if (s !== lastS) { lastS = s; parts = []; cam.ready = false; levelH = 0; }
    fitLevel(s);
    const key = `${s.def.id}|${T}|${dpr}|${s.w}x${s.h}`;
    if (key !== layerKey) buildLayer(s);
    follow(s, dt, opts.snap);
    stepFade(s, dt);
    const p = s.p;
    if (p.onGround && Math.abs(p.vx) > 0.3) walkPhase += Math.abs(p.vx) * dt * 2.2; else if (p.onGround) walkPhase *= 0.85;
    let sx = 0, sy = 0;
    if (shake > 0) { shake = Math.max(0, shake - dt); sx = (Math.random() - 0.5) * shake * 0.5; sy = (Math.random() - 0.5) * shake * 0.5; }
    const cx = cam.x + sx, cy = cam.y + sy;

    drawBackground(s, t);
    const srcs = drawLight(s, t);
    // light onto the background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(light, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.55; ctx.drawImage(bloom, 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // rock
    const px = T * dpr, lp = layerPx, k = lp / px;
    blit(ctx, layer, cx * lp, cy * lp, canvas.width * k, canvas.height * k, 0, 0, canvas.width, canvas.height);
    // warm rims where light falls: copy the rim layer at half-res, keep it only where the light canvas has light
    rctx.globalCompositeOperation = 'source-over';
    rctx.setTransform(1, 0, 0, 1, 0, 0);
    rctx.clearRect(0, 0, rimTmp.width, rimTmp.height);
    blit(rctx, warm, cx * lp, cy * lp, canvas.width * k, canvas.height * k, 0, 0, rimTmp.width, rimTmp.height);
    rctx.globalCompositeOperation = 'destination-in';
    rctx.drawImage(light, 0, 0);
    rctx.globalCompositeOperation = 'lighter';
    rctx.drawImage(rimTmp, 0, 0); // light is dim in alpha: double it here, at half size
    rctx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(rimTmp, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    // world-space things
    ctx.setTransform(px, 0, 0, px, -cx * px, -cy * px);
    ctx.fillStyle = '#04050a'; // outside the map is solid rock
    ctx.fillRect(-60, -60, 60, s.h + 120); ctx.fillRect(s.w, -60, 60, s.h + 120); ctx.fillRect(0, -60, s.w, 60); ctx.fillRect(0, s.h, s.w, 60);
    const vx0 = Math.floor(cx) - 1, vy0 = Math.floor(cy) - 1, vx1 = Math.ceil(cx + W / T) + 1, vy1 = Math.ceil(cy + H / T) + 1;
    drawBlocks(s, t, vx0, vy0, vx1, vy1);
    drawDust(vx0, vy0, vx1, vy1, t);
    drawProps(s, t, srcs);
    drawActors(s, t, srcs);
    drawFog(s, t, vx0, vy0, vx1, vy1);
    // bright torch core on top of everything
    if (torchLit(s) && !p.dead) {
      const o = torchOrigin(s), c = RGB[s.fl.col];
      ctx.globalCompositeOperation = 'lighter';
      const hx = o.x + Math.cos(s.fl.aim) * 0.42 + 0.05 * p.face, hy = o.y + Math.sin(s.fl.aim) * 0.42 - 0.07;
      const grd = ctx.createRadialGradient(hx, hy, 0, hx, hy, 0.6);
      grd.addColorStop(0, rgba(c, 0.8)); grd.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = grd; ctx.fillRect(hx - 0.6, hy - 0.6, 1.2, 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawParticles(dt);
    if (s.cleared) {
      const ct = opts.clearT || 0, k = ct < 0.3 ? ct / 0.3 : clamp(1 - (ct - 0.3) / 0.9, 0, 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(255,244,220,${0.35 * k})`; ctx.fillRect(0, 0, W, H);
    }
    // vignette
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!vig) { // cached per size
      vig = document.createElement('canvas'); vig.width = Math.ceil(W / 2); vig.height = Math.ceil(H / 2);
      const vctx = vig.getContext('2d');
      const vg = vctx.createRadialGradient(vig.width / 2, vig.height / 2, Math.min(vig.width, vig.height) * 0.35, vig.width / 2, vig.height / 2, Math.max(vig.width, vig.height) * 0.75);
      vg.addColorStop(0, 'rgba(2,3,10,0)'); vg.addColorStop(1, 'rgba(2,3,10,0.6)');
      vctx.fillStyle = vg; vctx.fillRect(0, 0, vig.width, vig.height);
    }
    ctx.drawImage(vig, 0, 0, W, H);
    if (p.dead) { ctx.fillStyle = `rgba(0,0,0,${clamp(1 - p.dead / 0.7, 0, 1) * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (!opts.noSigns) drawSigns(s);
  }

  return {
    resize, draw, onEvent, burst,
    get T() { return T; },
    // screen (CSS px inside the canvas) → world, for mouse aiming
    toWorld(x, y) { return { x: cam.x + x / T, y: cam.y + y / T }; },
    reset() { cam.ready = false; parts = []; },
  };
}
