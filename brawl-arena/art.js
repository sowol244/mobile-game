// Hand-drawn look for the arena: ground, ponds, obstacles and the brawlers themselves.
// Pure canvas drawing, no image files. render.js decides where and when; this file decides how things look.

import { tileAt } from './game.js';

// Stable pseudo-random number per tile, so decorations never flicker.
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export const PAL = {
  grass: '#58ad5c', grassDark: '#3f8f47', grassLight: '#7cc96b',
  dirt: '#c9a86a', sand: '#e8d39a',
  water: '#3aa0e8', waterDeep: '#2b7fc4', waterHi: '#bfe6ff',
  team: ['#3fb6ff', '#ff5267'], teamDark: ['#1b6ea8', '#a8243a'],
  skin: '#ffd2a8', skinDark: '#e9a978', hair: '#2a2230', pants: '#3a3f5c', shoe: '#2a2533',
  gun: '#33343f', gunWood: '#8a5a34', me: '#ffd23f',
};

// ---------- obstacle styles ----------
// Walls that touch form one obstacle; each obstacle gets a look from its shape:
//   long rows → stone wall, pairs → wooden crates, single tiles or columns → boulders.
export function obstacleStyles(map) {
  if (map.styles) return map.styles;
  const style = new Array(map.w * map.h).fill(null), seen = new Uint8Array(map.w * map.h);
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== '#' || seen[i]) continue;
    const group = [i]; seen[i] = 1;
    for (let k = 0; k < group.length; k++) {
      const c = group[k], cx = c % map.w, cy = (c - cx) / map.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, n = ny * map.w + nx;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || seen[n] || map.tiles[n] !== '#') continue;
        seen[n] = 1; group.push(n);
      }
    }
    const xs = group.map(c => c % map.w), ys = group.map(c => Math.floor(c / map.w));
    const wide = Math.max(...xs) - Math.min(...xs) + 1, tall = Math.max(...ys) - Math.min(...ys) + 1;
    const s = wide >= 3 ? 'stone' : group.length === 2 && wide === 2 ? 'crate' : 'rock';
    for (const c of group) style[c] = s;
  }
  map.styles = style;
  return style;
}

const isWall = (map, x, y) => tileAt(map, x, y) === '#' && x >= 0 && y >= 0 && x < map.w && y < map.h;
const isWater = (map, x, y) => tileAt(map, x, y) === '~';

// A tile-sized rectangle whose corners are rounded only where the shape ends (outer corners),
// so neighbouring tiles melt into one smooth blob instead of a grid of squares.
function blobTile(ctx, px, py, s, same, r, grow = 0, keepPath = false) {
  const n = same(0, -1), e = same(1, 0), so = same(0, 1), w = same(-1, 0);
  // Sides shared with a neighbour overlap by a hair so no anti-aliasing seam shows between tiles.
  const o = 0.75, l = px - (w ? o : grow), t = py - (n ? o : grow), rr = px + s + (e ? o : grow), b = py + s + (so ? o : grow);
  const tl = !n && !w ? r : 0, tr = !n && !e ? r : 0, br = !so && !e ? r : 0, bl = !so && !w ? r : 0;
  if (!keepPath) ctx.beginPath();
  ctx.moveTo(l + tl, t); ctx.lineTo(rr - tr, t); tr ? ctx.quadraticCurveTo(rr, t, rr, t + tr) : 0;
  ctx.lineTo(rr, b - br); br ? ctx.quadraticCurveTo(rr, b, rr - br, b) : 0;
  ctx.lineTo(l + bl, b); bl ? ctx.quadraticCurveTo(l, b, l, b - bl) : 0;
  ctx.lineTo(l, t + tl); tl ? ctx.quadraticCurveTo(l, t, l + tl, t) : 0;
  ctx.closePath();
}

// ---------- ground (grass, dirt, ponds) — painted once into an offscreen canvas ----------
export function paintGround(map, T, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(map.w * T * dpr); c.height = Math.ceil(map.h * T * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = PAL.grass; g.fillRect(0, 0, map.w * T, map.h * T);

  // Soft light/dark patches instead of a checkerboard.
  for (let i = 0; i < map.w * map.h / 3; i++) {
    const x = hash(i, 1) * map.w * T, y = hash(i, 2) * map.h * T, r = T * (0.8 + hash(i, 3) * 1.6);
    g.fillStyle = hash(i, 4) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,40,0,0.06)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, hash(i, 5) * 3, 0, Math.PI * 2); g.fill();
  }
  // Worn dirt around each team's start.
  for (const team of map.spawns) {
    const cx = team.reduce((a, s) => a + s.x, 0) / team.length, cy = team[0].y;
    g.fillStyle = 'rgba(201,168,106,0.55)';
    g.beginPath(); g.ellipse(cx * T, cy * T, T * 4.6, T * 1.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(201,168,106,0.35)';
    g.beginPath(); g.ellipse(cx * T, cy * T, T * 5.6, T * 1.8, 0, 0, Math.PI * 2); g.fill();
  }
  // Grass tufts, flowers and pebbles.
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (tileAt(map, x, y) !== '.') continue;
    const h = hash(x, y);
    if (h < 0.45) {
      const tx = (x + 0.2 + hash(x, y, 1) * 0.6) * T, ty = (y + 0.3 + hash(x, y, 2) * 0.5) * T;
      g.strokeStyle = PAL.grassDark; g.lineWidth = Math.max(1.2, T * 0.04); g.lineCap = 'round';
      g.beginPath();
      for (const k of [-1, 0, 1]) { g.moveTo(tx + k * T * 0.06, ty); g.lineTo(tx + k * T * 0.1, ty - T * (0.14 + (k === 0 ? 0.05 : 0))); }
      g.stroke();
    } else if (h < 0.52) {
      const fx = (x + 0.3 + hash(x, y, 3) * 0.4) * T, fy = (y + 0.3 + hash(x, y, 4) * 0.4) * T;
      g.fillStyle = hash(x, y, 5) < 0.5 ? '#fff6d6' : '#ffd84a';
      for (let p = 0; p < 4; p++) { g.beginPath(); g.arc(fx + Math.cos(p * 1.57) * T * 0.05, fy + Math.sin(p * 1.57) * T * 0.05, T * 0.04, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e9902a'; g.beginPath(); g.arc(fx, fy, T * 0.03, 0, Math.PI * 2); g.fill();
    } else if (h < 0.56) {
      g.fillStyle = 'rgba(90,90,80,0.35)';
      g.beginPath(); g.ellipse((x + 0.5) * T, (y + 0.6) * T, T * 0.07, T * 0.05, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // Ponds: sandy shore, then water, both with rounded outer corners.
  const same = (x, y) => (dx, dy) => isWater(map, x + dx, y + dy);
  // Each layer is one path, so the tiles of a pond fill as a single seamless shape.
  for (const pass of ['sand', 'water', 'deep']) {
    g.beginPath();
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (!isWater(map, x, y)) continue;
      if (pass === 'deep') blobTile(g, x * T, y * T, T, same(x, y), T * 0.3, -T * 0.24, true);
      else blobTile(g, x * T, y * T, T, same(x, y), T * 0.45, pass === 'sand' ? T * 0.1 : -T * 0.02, true);
    }
    g.fillStyle = pass === 'sand' ? PAL.sand : pass === 'water' ? PAL.water : PAL.waterDeep;
    g.globalAlpha = pass === 'deep' ? 0.5 : 1; g.fill(); g.globalAlpha = 1;
  }
  return c;
}

// Small moving ripples on the water, drawn every frame on top of the painted ground.
export function drawRipples(ctx, map, t, sx, sy, T, x0, y0, x1, y1) {
  ctx.strokeStyle = PAL.waterHi; ctx.lineWidth = Math.max(1.5, T * 0.05); ctx.lineCap = 'round';
  ctx.globalAlpha = 0.7;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!isWater(map, x, y)) continue;
    const ph = t * 1.6 + hash(x, y) * 6, px = sx(x + 0.3 + hash(x, y, 1) * 0.3), py = sy(y + 0.45 + Math.sin(ph) * 0.06);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + T * 0.12, py - T * 0.06, px + T * 0.24, py); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- obstacles (drawn in y-order with the brawlers) ----------
export const WALL_LIFT = 0.42; // how tall obstacles look, in tiles

export function drawObstacle(ctx, map, x, y, sx, sy, T) {
  const style = obstacleStyles(map)[y * map.w + x], px = sx(x), py = sy(y), L = T * WALL_LIFT;
  const same = (dx, dy) => isWall(map, x + dx, y + dy) && obstacleStyles(map)[(y + dy) * map.w + x + dx] === style;

  if (style === 'stone') {
    const front = !same(0, 1);
    // Shadow on the ground.
    if (front) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px, py + T - 1, T + 0.5, T * 0.16); }
    // Front face with a brick pattern.
    if (front) {
      const fl = !same(-1, 0), fr = !same(1, 0), r = T * 0.22, fy0 = py + T - L, fy1 = py + T;
      ctx.fillStyle = '#7d7f8f';
      ctx.beginPath(); ctx.moveTo(px, fy0); ctx.lineTo(px + T, fy0);
      fr ? (ctx.lineTo(px + T, fy1 - r), ctx.quadraticCurveTo(px + T, fy1, px + T - r, fy1)) : ctx.lineTo(px + T, fy1);
      fl ? (ctx.lineTo(px + r, fy1), ctx.quadraticCurveTo(px, fy1, px, fy1 - r)) : ctx.lineTo(px, fy1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,60,0.35)'; ctx.lineWidth = 1;
      const fy = py + T - L;
      ctx.beginPath(); ctx.moveTo(px, fy + L * 0.5); ctx.lineTo(px + T, fy + L * 0.5);
      for (const k of [0.25, 0.75]) { ctx.moveTo(px + T * k, fy); ctx.lineTo(px + T * k, fy + L * 0.5); }
      ctx.moveTo(px + T * 0.5, fy + L * 0.5); ctx.lineTo(px + T * 0.5, fy + L);
      ctx.stroke();
    }
    // Top face.
    ctx.fillStyle = '#b9bccb'; blobTile(ctx, px, py - L, T, same, T * 0.22); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let k = 0; k < 2; k++) { const h = hash(x, y, 10 + k); ctx.beginPath(); ctx.ellipse(px + T * (0.25 + h * 0.5), py - L + T * (0.25 + hash(x, y, 20 + k) * 0.5), T * 0.12, T * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!same(0, -1)) { ctx.fillStyle = '#6fbf5b'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(px + T * (0.15 + k * 0.35 + hash(x, y, k) * 0.1), py - L + T * 0.06, T * (0.07 + hash(x, y, k + 5) * 0.05), 0, Math.PI * 2); ctx.fill(); } }
  } else if (style === 'crate') {
    const i = T * 0.05, s = T - i * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px + i, py + T - 2, s, T * 0.14);
    ctx.fillStyle = '#8f5a2b'; ctx.fillRect(px + i, py + T - L - 2, s, L);              // front
    ctx.strokeStyle = '#6b3f1c'; ctx.lineWidth = Math.max(1.5, T * 0.05);
    ctx.beginPath(); ctx.moveTo(px + i, py + T - L - 2); ctx.lineTo(px + i + s, py + T - 2); ctx.moveTo(px + i + s, py + T - L - 2); ctx.lineTo(px + i, py + T - 2); ctx.stroke();
    ctx.fillStyle = '#d09455'; ctx.fillRect(px + i, py - L + i, s, T - i * 2);            // top
    ctx.strokeStyle = '#a86d35'; ctx.lineWidth = Math.max(1, T * 0.035);
    ctx.strokeRect(px + i * 2, py - L + i * 2, s - i * 2, T - i * 4);
    ctx.beginPath(); for (const k of [0.36, 0.64]) { ctx.moveTo(px + i * 2, py - L + T * k); ctx.lineTo(px + i + s - i, py - L + T * k); } ctx.stroke();
  } else {
    // Boulder: a lumpy rock, slightly bigger than its tile.
    const cx = px + T / 2, cy = py + T / 2 - L * 0.55, R = T * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, py + T * 0.95, R * 0.95, R * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    const pts = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = R * (0.82 + hash(x, y, k) * 0.22); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (a > 0 && a < Math.PI ? 1.05 : 0.85)]); }
    ctx.fillStyle = '#7a7468'; ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a39c8d'; ctx.beginPath(); pts.forEach(([a, b], k) => { const yy = b - (b - (cy - R)) * 0.18 - T * 0.1; k ? ctx.lineTo(a, yy) : ctx.moveTo(a, yy); }); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(cx - R * 0.3, cy - R * 0.45, R * 0.28, R * 0.14, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(60,55,45,0.45)'; ctx.lineWidth = Math.max(1, T * 0.03);
    ctx.beginPath(); ctx.moveTo(cx + R * 0.1, cy - R * 0.2); ctx.lineTo(cx + R * 0.3, cy + R * 0.1); ctx.lineTo(cx + R * 0.2, cy + R * 0.35); ctx.stroke();
  }
}

// ---------- brawlers ----------
// A small chibi person: big round head, tiny body and stubby legs that waddle when walking,
// holding a little rifle toward the aim. Team colour is the shirt (and the ring under the feet).
export const PERSON_SCALE = 1.12;

export function drawPerson(ctx, b, x, y, T, walk, flash) {
  const u = T * PERSON_SCALE, face = b.face, dirX = Math.cos(face), dirY = Math.sin(face);
  const flip = dirX < -0.05 ? -1 : 1;
  const moving = Math.hypot(b.vx, b.vy) > 0.3;
  const swing = moving ? Math.sin(walk) : 0, bob = moving ? Math.abs(Math.cos(walk)) * u * 0.04 : Math.sin(performance.now() / 400 + b.id) * u * 0.008;
  const tilt = moving ? swing * 0.06 : 0; // little side-to-side waddle
  const team = PAL.team[b.team], teamDark = PAL.teamDark[b.team];
  const white = c => (flash ? '#ffffff' : c);

  // Feet: two round shoes stepping in turn.
  for (const side of [-1, 1]) {
    const lift = Math.max(0, side * swing) * u * 0.05;
    ctx.fillStyle = white(PAL.shoe);
    ctx.beginPath(); ctx.ellipse(x + side * u * 0.09, y - u * 0.03 - lift, u * 0.07, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save(); ctx.translate(x, y - bob); ctx.rotate(tilt);

  const by = -u * 0.17; // body centre
  const gunBehind = dirY < -0.35;
  const drawGun = () => {
    ctx.save(); ctx.translate(flip * u * 0.05, by + u * 0.02); ctx.rotate(face - tilt);
    if (flip < 0) ctx.scale(1, -1);
    ctx.fillStyle = PAL.gunWood; roundRect(ctx, -u * 0.08, -u * 0.03, u * 0.12, u * 0.07, u * 0.025); ctx.fill();
    ctx.fillStyle = PAL.gun; roundRect(ctx, u * 0.02, -u * 0.04, u * 0.24, u * 0.08, u * 0.03); ctx.fill();
    ctx.fillRect(u * 0.24, -u * 0.02, u * 0.1, u * 0.04);
    ctx.fillStyle = white(PAL.skin);
    ctx.beginPath(); ctx.arc(u * 0.02, u * 0.03, u * 0.045, 0, Math.PI * 2); ctx.arc(u * 0.17, u * 0.03, u * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  if (gunBehind) drawGun();

  // Body: a short rounded shirt.
  ctx.fillStyle = white(team); ctx.strokeStyle = teamDark; ctx.lineWidth = Math.max(1.2, u * 0.025);
  ctx.beginPath(); ctx.ellipse(0, by, u * 0.16, u * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  if (!gunBehind) drawGun();

  // Big round head.
  const hr = u * 0.25, hx = dirX * u * 0.02, hy = by - u * 0.3;
  ctx.fillStyle = white(PAL.skin); ctx.strokeStyle = PAL.skinDark; ctx.lineWidth = Math.max(1, u * 0.022);
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const back = dirY < -0.55; // walking away from the camera: back of the head
  ctx.fillStyle = white(PAL.hair);
  ctx.beginPath();
  if (back) ctx.arc(hx, hy, hr * 1.03, 0, Math.PI * 2);
  else {
    // Bowl cut with a soft fringe swept toward the facing side.
    ctx.arc(hx, hy, hr * 1.03, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(hx + hr * 0.7, hy - hr * 0.05, hx + flip * hr * 0.25, hy - hr * 0.3);
    ctx.quadraticCurveTo(hx - hr * 0.3, hy - hr * 0.05, hx - hr * 1.03, hy + hr * 0.05);
  }
  ctx.fill();
  // A single curl sticking up on top.
  ctx.strokeStyle = white(PAL.hair); ctx.lineWidth = Math.max(1.5, u * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx, hy - hr * 0.95); ctx.quadraticCurveTo(hx + flip * hr * 0.1, hy - hr * 1.45, hx + flip * hr * 0.45, hy - hr * 1.3); ctx.stroke();

  if (!back) {
    const ex = dirX * hr * 0.25, ey = hr * 0.18 + Math.max(0, dirY) * hr * 0.1;
    for (const s of [-1, 1]) {
      const cx = hx + s * hr * 0.36 + ex, cy = hy + ey;
      ctx.fillStyle = '#231a14'; ctx.beginPath(); ctx.ellipse(cx, cy, hr * 0.12, hr * 0.17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + hr * 0.04, cy - hr * 0.06, hr * 0.055, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - hr * 0.04, cy + hr * 0.06, hr * 0.025, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,120,0.4)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * hr * 0.62 + ex * 0.6, hy + hr * 0.45, hr * 0.15, hr * 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#7a3b2a'; ctx.lineWidth = Math.max(1, u * 0.02);
    ctx.beginPath(); ctx.arc(hx + ex * 0.8, hy + hr * 0.42, hr * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  ctx.restore();
  return y - bob + hy - hr * 1.3; // top of the head, for the name and health bar
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
