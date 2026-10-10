// 룩스 앤 움브라 — rules and physics. Pure: no DOM, no canvas, no audio, so node tests can run it.
//
// The world is a tile grid (1 unit = 1 tile, y grows downward). Light comes from
//   · lamps   : fixed point lights ('radial') or spotlights ('beam'), switched by levers through groups
//   · zones   : room lights, a rectangle lit evenly (no shadows), switched the same way
//   · the torch: the player's flashlight cone, plus a halo around the player while inside fog
// Rock and crates stop light; coloured glass tints it. Every light-sensitive tile asks "which colours reach me?"
// and becomes solid or not from that answer. A tile never turns solid on top of a body standing in it — it waits.

import { PHYS, LIGHT, COL, DEATH_TIME } from './config.js';

const REACTIVE = new Set(['L', 'S', 'R', 'B', 'H']);
const ENTITY = new Set(['P', 'K', 'M', 'o']);
const MIRROR = { '/': 0, '\\': 1, '{': 0, '}': 1 }; // '/' '\' fixed, '{' '}' turn when touched

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
const wrapAng = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ---------- level parsing ----------
export function parseLevel(def) {
  const rows = def.rows, h = rows.length, w = Math.max(...rows.map(r => r.length));
  const tiles = new Array(w * h).fill('.');
  const out = { w, h, tiles, start: null, crates: [], statues: [], shard: null, levers: [], lenses: [], signs: [], checks: [], lamps: [], doors: [], mirrors: [] };
  let li = 0, ni = 0, si = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x] || '#';
    const i = y * w + x;
    if (ENTITY.has(c)) {
      tiles[i] = '.';
      if (c === 'P') out.start = { x, y };
      else if (c === 'K') out.crates.push({ x, y });
      else if (c === 'M') out.statues.push({ x, y });
      else if (c === 'o') out.shard = { x, y };
      continue;
    }
    tiles[i] = c;
    if (c === '=') { const d = (def.levers || [])[li++] || 'a'; out.levers.push({ x, y, g: typeof d === 'string' ? d : d.g, time: typeof d === 'string' ? 0 : d.t || 0 }); }
    else if (c in MIRROR) out.mirrors.push({ x, y, i, state: MIRROR[c], turn: c === '{' || c === '}' });
    else if (c === '%') out.lenses.push({ x, y, col: (def.lenses || [])[ni++] || 'w' });
    else if (c === '?') out.signs.push({ x, y, text: (def.signs || [])[si++] || '' });
    else if (c === 'C') out.checks.push({ x, y });
    else if (c === 'D' || c === 'H') out.doors.push({ x, y, hidden: c === 'H' });
    else if (c >= '1' && c <= '9') {
      const L = (def.lamps || {})[c] || {};
      out.lamps.push({
        x: x + 0.5 + (L.ox || 0), y: y + 0.5 + (L.oy || 0), kind: L.kind || 'radial', dir: ((L.dir ?? 0) * Math.PI) / 180,
        half: ((L.spread ?? 25) * Math.PI) / 180, range: L.range ?? 8, col: COL[L.color || 'w'], g: L.g || null, on: L.on ?? true, id: c,
        move: L.move || null, period: L.period || 4, phase: L.phase || 0, reflect: L.reflect, dyn: !!L.move,
      });
      const lp = out.lamps[out.lamps.length - 1]; lp.x0 = lp.x; lp.y0 = lp.y;
      tiles[i] = '.';
    }
  }
  if (!out.start) throw new Error(`level ${def.id}: no P`);
  return out;
}

// ---------- state ----------
export function createGame(def) {
  const lv = parseLevel(def);
  const { w, h } = lv;
  const s = {
    def, w, h, tiles: lv.tiles,
    solid: new Uint8Array(w * h), light: new Uint8Array(w * h), reveal: new Uint8Array(w * h),
    reactive: [],
    lamps: lv.lamps, levers: lv.levers.map(l => ({ ...l, touch: false, timer: 0 })), mirrors: lv.mirrors.map(m => ({ ...m, touch: false })), lenses: lv.lenses.map(l => ({ ...l, touch: false })),
    signs: lv.signs, checks: lv.checks.map(c => ({ ...c, on: false })), doors: lv.doors,
    zones: (def.zones || []).map(z => ({ x: z.x, y: z.y, w: z.w, h: z.h, col: COL[z.color || 'w'], g: z.g || null, on: z.on ?? true })),
    groups: { ...(def.groups || {}) },
    p: null, fl: { on: false, dark: false, aim: LIGHT.defaultAim, col: COL.w },
    crates: lv.crates.map(c => ({ x: c.x + (1 - PHYS.cw) / 2, y: c.y, w: PHYS.cw, h: 1, vx: 0, vy: 0, hx: c.x, hy: c.y })),
    statues: lv.statues.map(m => ({ x: m.x + (1 - PHYS.sw) / 2, y: m.y + 1 - PHYS.sh, w: PHYS.sw, h: PHYS.sh, vy: 0, vx: 0, awake: false, face: -1, walk: 0, hx: m.x, hy: m.y })),
    shard: lv.shard ? { ...lv.shard, got: false } : null,
    t: 0, deaths: 0, cleared: false, events: [], snap: null, startPos: lv.start, ghostT: new Float32Array(w * h).fill(-9), ghostN: new Uint8Array(w * h), shakeTile: -1, shakeUntil: -1,
  };
  for (let i = 0; i < w * h; i++) if (REACTIVE.has(lv.tiles[i])) s.reactive.push(i);
  s.mirrorAt = new Map(s.mirrors.map(m => [m.i, m]));
  // fog: rectangles from the level data plus 'f' tiles. Nothing but your own halo reaches into it.
  s.fog = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (lv.tiles[i] === 'f') s.fog[i] = 1;
  for (const f of def.fog || []) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) s.fog[y * w + x] = 1;
  moveLamps(s);
  // a lamp / zone with a group follows that group; groups default to the lamp's own "on"
  for (const L of [...s.lamps, ...s.zones]) if (L.g) for (const g of L.g) if (!(g in s.groups)) s.groups[g] = L.on;
  s.p = makePlayer(lv.start.x, lv.start.y);
  updateLight(s, true);
  s.snap = snapshot(s, lv.start);
  return s;
}

function makePlayer(tx, ty) {
  return { x: tx + (1 - PHYS.pw) / 2, y: ty + 1 - PHYS.ph, w: PHYS.pw, h: PHYS.ph, vx: 0, vy: 0, onGround: false, face: 1, coyote: 0, jbuf: 0, dead: 0, pushing: false, air: 0 };
}

function snapshot(s, at) {
  return {
    at: { ...at },
    crates: s.crates.map(c => ({ ...c })), statues: s.statues.map(m => ({ ...m })),
    groups: { ...s.groups }, reveal: s.reveal.slice(), lens: s.fl.col,
    mirrors: s.mirrors.map(m => m.state), timers: s.levers.map(l => l.timer),
  };
}

function restore(s) {
  const sn = s.snap;
  s.crates = sn.crates.map(c => ({ ...c })); s.statues = sn.statues.map(m => ({ ...m }));
  s.groups = { ...sn.groups }; s.reveal = sn.reveal.slice(); s.fl.col = sn.lens; s.fl.on = false;
  const face = s.p.face;
  s.p = makePlayer(sn.at.x, sn.at.y); s.p.face = face;
  s.fl.aim = face > 0 ? LIGHT.defaultAim : Math.PI - LIGHT.defaultAim;
  s.levers.forEach((l, k) => { l.touch = false; l.timer = sn.timers[k]; });
  s.mirrors.forEach((m, k) => { m.touch = false; m.state = sn.mirrors[k]; });
  for (const l of s.lenses) l.touch = false;
  updateLight(s, true);
}

// ---------- tiles ----------
export const tileAt = (s, x, y) => (x < 0 || x >= s.w || y < 0 ? '#' : y >= s.h ? '.' : s.tiles[y * s.w + x]);

export function isSolid(s, x, y) {
  if (x < 0 || x >= s.w || y < 0) return true;
  if (y >= s.h) return false;
  const i = y * s.w + x, c = s.tiles[i];
  if (c === '#' || c === 'r' || c === 'b' || c in MIRROR) return true;
  if (c === 'H') return !s.reveal[i];
  if (c === 'L' || c === 'S' || c === 'R' || c === 'B') return s.solid[i] === 1;
  return false;
}

function isOpaque(s, x, y) {
  if (x < 0 || x >= s.w || y < 0 || y >= s.h) return true;
  const i = y * s.w + x, c = s.tiles[i];
  return c === '#' || s.fog[i] === 1 || c in MIRROR || (c === 'H' && !s.reveal[i]);
}

// Lamps on rails slide back and forth (smoothly) with the clock.
function moveLamps(s) {
  for (const L of s.lamps) {
    if (!L.move) continue;
    const k = (1 - Math.cos(2 * Math.PI * (s.t / L.period + L.phase))) / 2;
    L.x = L.x0 + L.move[0] * k; L.y = L.y0 + L.move[1] * k;
  }
}

const tint = (col, glass) => (glass === 'r' ? (col & (COL.w | COL.r) ? COL.r : 0) : col & (COL.w | COL.b) ? COL.b : 0);

// Segment vs box (slab test); true if the open segment (0,1) passes through the box.
function segHitsBox(x0, y0, x1, y1, b) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, d, lo, hi] of [[x0, dx, b.x, b.x + b.w], [y0, dy, b.y, b.y + b.h]]) {
    if (Math.abs(d) < 1e-9) { if (p <= lo || p >= hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 >= t1) return false;
  }
  return t1 > 0.001 && t0 < 0.999;
}

// Colour that survives the trip from (x0,y0) to (x1,y1): 0 if blocked. Tiles at both ends don't block.
export function trace(s, x0, y0, x1, y1, col) {
  let tx = Math.floor(x0), ty = Math.floor(y0);
  const ex = Math.floor(x1), ey = Math.floor(y1), dx = x1 - x0, dy = y1 - y0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tmx = dx !== 0 ? (dx > 0 ? tx + 1 - x0 : x0 - tx) * tdx : Infinity;
  let tmy = dy !== 0 ? (dy > 0 ? ty + 1 - y0 : y0 - ty) * tdy : Infinity;
  for (let guard = 0; guard < 400; guard++) {
    if (tx === ex && ty === ey) break;
    if (Math.min(tmx, tmy) > 1) break;
    if (tmx < tmy) { tx += sx; tmx += tdx; } else { ty += sy; tmy += tdy; }
    if (tx === ex && ty === ey) break;
    if (isOpaque(s, tx, ty)) return 0;
    const c = tileAt(s, tx, ty);
    if (c === 'r' || c === 'b') { col = tint(col, c); if (!col) return 0; }
  }
  for (const c of s.crates) if (segHitsBox(x0, y0, x1, y1, c)) return 0;
  return col;
}

// Every light in the scene right now (lamps, room lights, the torch).
export function lightSources(s) {
  const out = [];
  for (const L of s.lamps) if (L.g ? s.groups[L.g] : L.on) out.push(L);
  for (const z of s.zones) if (z.g ? s.groups[z.g] : z.on) out.push({ kind: 'zone', ...z });
  if (torchLit(s) && !s.p.dead && !s.cleared) {
    const o = torchOrigin(s);
    out.push({ kind: 'beam', x: o.x, y: o.y, dir: s.fl.aim, half: LIGHT.flashHalf, range: LIGHT.flashRange, col: s.fl.col, torch: true, dyn: true });
    if (inFog(s, o.x, o.y)) out.push({ kind: 'radial', x: o.x, y: o.y, range: LIGHT.fogHalo, col: s.fl.col, torch: true, halo: true, dyn: true });
  }
  if (s.mirrors.length) reflect(s, out);
  return out;
}

// Mirrors: light reaching a mirror's centre leaves it as a narrow beam, turned 90°.
// '/' sends rightward light up, '\' sends rightward light down. Up to 4 bounces.
function reflect(s, out) {
  let front = out.filter(src => src.kind !== 'zone' && !src.halo);
  const seen = new Set();
  for (let depth = 0; depth < 4 && front.length; depth++) {
    const next = [];
    for (const m of s.mirrors) {
      const cx = m.x + 0.5, cy = m.y + 0.5;
      for (const src of front) {
        if (src.from === m) continue;
        const col = reach(s, src, cx, cy);
        if (!col) continue;
        let dx = cx - src.x, dy = cy - src.y;
        if (Math.abs(dx) >= Math.abs(dy)) { dx = Math.sign(dx); dy = 0; } else { dy = Math.sign(dy); dx = 0; }
        const ox = m.state === 0 ? -dy : dy, oy = m.state === 0 ? -dx : dx;
        const key = `${m.i}|${ox},${oy}|${col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const reach2 = src.reflect ?? 16; // a lamp can say how far its reflections carry
        next.push({ kind: 'beam', x: cx, y: cy, dir: Math.atan2(oy, ox), half: 0.17, range: reach2, reflect: reach2, col, from: m, mirror: true, dyn: !!src.dyn });
      }
    }
    out.push(...next);
    front = next;
  }
}

// The torch shines when it is switched on and the 깜빡 (blink) control isn't held.
export const torchLit = s => s.fl.on && !s.fl.dark;

export const torchOrigin = s => ({ x: s.p.x + s.p.w / 2, y: s.p.y + 0.35 });

export const inFog = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.fog[Math.floor(y) * s.w + Math.floor(x)] === 1;

function reach(s, src, px, py) {
  if (!src.halo && inFog(s, px, py)) return 0;
  if (src.kind === 'zone') return px >= src.x && px <= src.x + src.w && py >= src.y && py <= src.y + src.h ? src.col : 0;
  const dx = px - src.x, dy = py - src.y, d = Math.hypot(dx, dy);
  if (d > src.range) return 0;
  if (src.kind === 'beam' && d > 0.35 && Math.abs(wrapAng(Math.atan2(dy, dx) - src.dir)) > src.half) return 0;
  return trace(s, src.x, src.y, px, py, src.col);
}

const SAMPLES = [[0.5, 0.5], [0.14, 0.14], [0.86, 0.14], [0.14, 0.86], [0.86, 0.86]];
export function tileLight(s, tx, ty, srcs = lightSources(s)) {
  let m = 0;
  for (const src of srcs) for (const [ox, oy] of SAMPLES) {
    const r = reach(s, src, tx + ox, ty + oy);
    if (r) { m |= r; break; }
  }
  return m;
}
export function pointLight(s, x, y, srcs = lightSources(s)) {
  let m = 0;
  for (const src of srcs) m |= reach(s, src, x, y);
  return m;
}

const wants = (c, m) => (c === 'L' ? m !== 0 : c === 'S' ? m === 0 : c === 'R' ? (m & COL.r) !== 0 : c === 'B' ? (m & COL.b) !== 0 : false);

function bodies(s) {
  const out = [...s.crates, ...s.statues];
  if (!s.p.dead) out.push(s.p);
  return out;
}

// Landing assist: a block that appears just after the hero's feet sank past its top still catches them
// (about 0.12 s of falling, at most 0.65 tile), as long as there is room to stand on it. Not for a block that has just gone
// dark under you three times in a row: that is a beam grazing it as you sink, and lifting you each time made you shake.
function catchPlayer(s, x, y) {
  const p = s.p;
  if (p.dead || p.vy <= 0) return false;
  const depth = p.y + p.h - y;
  if (depth <= 0 || depth > Math.min(0.65, p.vy * 0.12 + 0.05)) return false;
  if (s.shakeTile === y * s.w + x && s.t < s.shakeUntil) return false;
  const lifted = { x: p.x, y: y - p.h, w: p.w, h: p.h };
  if (tileHits(s, lifted).length) return false;
  if ([...s.crates, ...s.statues].some(b => overlap(b, lifted))) return false;
  p.y = lifted.y; p.vy = 0; p.onGround = true; p.coyote = PHYS.coyote;
  return true;
}

// Light from fixed sources only changes when crates move, levers flip, mirrors turn or a door opens:
// it is cached per tile and only the moving lights (torch, lamps on rails) are traced every step.
function staticKey(s) {
  let k = '';
  for (const c of s.crates) k += `${c.x.toFixed(3)},${c.y.toFixed(3)};`;
  for (const g in s.groups) k += s.groups[g] ? '1' : '0';
  for (const m of s.mirrors) k += m.state;
  let r = 0; for (const d of s.doors) if (d.hidden) r += s.reveal[d.y * s.w + d.x];
  return k + '|' + r;
}

function updateLight(s, initial = false) {
  const srcs = lightSources(s), bs = bodies(s);
  const stat = [], dyn = [];
  for (const src of srcs) (src.dyn ? dyn : stat).push(src);
  const key = staticKey(s);
  if (key !== s.lightKey || !s.staticLight) {
    s.lightKey = key; s.staticLight = s.staticLight || new Uint8Array(s.w * s.h);
    for (const i of s.reactive) s.staticLight[i] = tileLight(s, i % s.w, (i / s.w) | 0, stat);
  }
  for (const i of s.reactive) {
    const x = i % s.w, y = (i / s.w) | 0, c = s.tiles[i];
    let m = s.staticLight[i];
    for (const src of dyn) {
      if (Math.abs(x + 0.5 - src.x) > src.range + 1 || Math.abs(y + 0.5 - src.y) > src.range + 1) continue;
      m |= tileLight(s, x, y, [src]);
    }
    s.light[i] = m;
    if (c === 'H') { if (m && !s.reveal[i]) { s.reveal[i] = 1; if (!initial) s.events.push({ type: 'reveal', x, y }); } continue; }
    const want = wants(c, m);
    if (want && !s.solid[i]) {
      const box = { x, y, w: 1, h: 1 };
      const inside = bs.filter(b => overlap(b, box));
      if (!inside.length || (!initial && inside.length === 1 && inside[0] === s.p && catchPlayer(s, x, y))) {
        s.solid[i] = 1; if (!initial) s.events.push({ type: 'solid', x, y, c });
      }
    } else if (!want && s.solid[i]) {
      s.solid[i] = 0; if (!initial) s.events.push({ type: 'ghost', x, y, c });
      if (overlap(s.p, { x, y: y - 0.06, w: 1, h: 1.06 })) { // it was holding you; three times in a row, 0.4 s apart or less = shaking
        s.ghostN[i] = s.t - s.ghostT[i] < 0.4 ? s.ghostN[i] + 1 : 1;
        if (s.ghostN[i] >= 3) { s.shakeTile = i; s.shakeUntil = s.t + 0.6; }
        s.ghostT[i] = s.t;
      }
    }
  }
  for (const m of s.statues) {
    const cx = m.x + m.w / 2;
    const lit = pointLight(s, cx, m.y + 0.3, srcs) | pointLight(s, cx, m.y + m.h / 2, srcs) | pointLight(s, cx, m.y + m.h - 0.25, srcs);
    const awake = lit !== 0;
    if (awake !== m.awake && !initial) s.events.push({ type: awake ? 'wake' : 'freeze', x: cx, y: m.y });
    m.awake = awake;
  }
}

// ---------- movement ----------
function tileHits(s, b) {
  const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-7), y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-7);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isSolid(s, x, y)) out.push({ x, y, w: 1, h: 1 });
  return out;
}

// Move one axis, stop at tiles and the given boxes. Returns the box that stopped us (or null).
function moveAxis(s, b, d, axis, others) {
  if (!d) return null;
  b[axis] += d;
  const hits = tileHits(s, b);
  for (const o of others) if (o !== b && overlap(b, o)) hits.push(o);
  if (!hits.length) return null;
  const size = axis === 'x' ? 'w' : 'h';
  let stop = null;
  if (d > 0) { let lim = Infinity; for (const o of hits) if (o[axis] < lim) { lim = o[axis]; stop = o; } b[axis] = Math.min(b[axis], lim - b[size]); }
  else { let lim = -Infinity; for (const o of hits) if (o[axis] + o[size] > lim) { lim = o[axis] + o[size]; stop = o; } b[axis] = Math.max(b[axis], lim); }
  return stop;
}

const frozenStatues = s => s.statues.filter(m => !m.awake);

function grounded(s, b, others) {
  const probe = { x: b.x, y: b.y + b.h, w: b.w, h: 0.04 };
  if (tileHits(s, probe).length) return true;
  return others.some(o => o !== b && overlap(probe, o));
}

function stepPlayer(s, inp, dt) {
  const p = s.p;
  const solidsForPlayer = [...s.crates, ...frozenStatues(s)];
  const target = clamp(inp.mx || 0, -1, 1) * (p.pushing ? PHYS.push : PHYS.run);
  p.vx = approach(p.vx, target, (p.onGround ? PHYS.accGround : PHYS.accAir) * dt);
  if (inp.jumpPress) p.jbuf = PHYS.buffer; else p.jbuf = Math.max(0, p.jbuf - dt);
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
  if (p.jbuf > 0 && p.coyote > 0) { p.vy = -PHYS.jumpV; p.jbuf = 0; p.coyote = 0; p.onGround = false; s.events.push({ type: 'jump' }); }
  if (!inp.jump && p.vy < PHYS.cutV) p.vy = PHYS.cutV;
  p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.grav * dt);

  // horizontal, pushing crates when standing on something
  const dx = p.vx * dt;
  p.pushing = false;
  if (dx) {
    const test = { x: p.x + dx, y: p.y + 0.05, w: p.w, h: p.h - 0.1 };
    for (const c of s.crates) {
      if (!overlap(test, c) || !p.onGround) continue;
      if (c.y + c.h < p.y + 0.3) continue; // crate is underfoot
      const need = dx > 0 ? test.x + test.w - c.x : test.x - (c.x + c.w);
      moveAxis(s, c, need, 'x', [...s.crates, ...s.statues]);
      p.pushing = true;
    }
  }
  if (moveAxis(s, p, dx, 'x', solidsForPlayer)) p.vx = 0;
  const vyBefore = p.vy;
  const stopY = moveAxis(s, p, p.vy * dt, 'y', solidsForPlayer);
  const wasGround = p.onGround;
  if (stopY) { if (p.vy > 0) p.onGround = true; p.vy = 0; }
  else p.onGround = p.vy >= 0 && grounded(s, p, solidsForPlayer);
  if (p.onGround && !wasGround && vyBefore > 6) s.events.push({ type: 'land', v: vyBefore });
  if (!p.onGround) p.air += dt; else p.air = 0;
}

function stepCrates(s, dt) {
  for (const c of s.crates) {
    c.vy = Math.min(PHYS.maxFall, c.vy + PHYS.grav * dt);
    const others = [...s.crates, ...s.statues];
    if (!s.p.dead) others.push(s.p);
    const v0 = c.vy;
    if (moveAxis(s, c, c.vy * dt, 'y', others)) { if (v0 > 8) s.events.push({ type: 'thud', x: c.x + 0.5, y: c.y + 1 }); c.vy = 0; }
    const onSpikes = tileAt(s, Math.floor(c.x + c.w / 2), Math.floor(c.y + c.h - 0.05)) === '^';
    if (c.y > s.h + 2 || onSpikes) { // fell out of the world or onto spikes: it comes back where it started
      c.x = c.hx + (1 - c.w) / 2; c.y = c.hy; c.vy = 0;
      s.events.push({ type: 'crateBack', x: c.x, y: c.y });
    }
  }
}

function stepStatues(s, dt) {
  const p = s.p;
  for (const m of s.statues) {
    const others = [...s.crates, ...s.statues];
    m.vx = 0;
    if (m.awake && !p.dead) {
      const dx = p.x + p.w / 2 - (m.x + m.w / 2), dy = p.y + p.h - (m.y + m.h);
      if (Math.abs(dx) > 0.15 && Math.abs(dx) < PHYS.statueSight && Math.abs(dy) < 3.5) {
        const dir = Math.sign(dx);
        m.face = dir;
        // never walk off a ledge
        const fx = dir > 0 ? m.x + m.w + 0.05 : m.x - 0.05;
        const below = Math.floor(m.y + m.h + 0.1);
        const support = isSolid(s, Math.floor(fx), below) || others.some(o => o !== m && fx > o.x && fx < o.x + o.w && Math.abs(o.y - (m.y + m.h)) < 0.1);
        if (support) m.vx = dir * PHYS.statueSpeed;
      }
    }
    if (m.vx) { moveAxis(s, m, m.vx * dt, 'x', others); m.walk += Math.abs(m.vx) * dt; }
    m.vy = Math.min(PHYS.maxFall, m.vy + PHYS.grav * dt);
    if (moveAxis(s, m, m.vy * dt, 'y', others)) m.vy = 0;
  }
}

function touches(p, tx, ty, x0, y0, x1, y1) {
  return p.x < tx + x1 && p.x + p.w > tx + x0 && p.y < ty + y1 && p.y + p.h > ty + y0;
}

function die(s, why) {
  const p = s.p;
  if (p.dead) return;
  p.dead = DEATH_TIME; s.deaths++;
  s.events.push({ type: 'die', why, x: p.x + p.w / 2, y: p.y + p.h / 2 });
}

function interact(s) {
  const p = s.p;
  if (p.y > s.h + 1) return die(s, 'fall');
  const x0 = Math.floor(p.x), x1 = Math.floor(p.x + p.w - 1e-7), y0 = Math.floor(p.y), y1 = Math.floor(p.y + p.h - 1e-7);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = tileAt(s, x, y);
    if (c === '^' && touches(p, x, y, 0.15, 0.5, 0.85, 1)) return die(s, 'spike');
    if (c === 'v' && touches(p, x, y, 0.15, 0, 0.85, 0.5)) return die(s, 'spike');
  }
  for (const m of s.statues) if (m.awake && overlap(p, { x: m.x + 0.08, y: m.y + 0.08, w: m.w - 0.16, h: m.h - 0.1 })) return die(s, 'statue');

  for (const l of s.levers) {
    const t = touches(p, l.x, l.y, 0.2, 0, 0.8, 1);
    if (t && !l.touch && !l.timer) {
      for (const g of l.g) s.groups[g] = !s.groups[g];
      if (l.time) l.timer = l.time;
      s.events.push({ type: 'lever', x: l.x, y: l.y, on: s.groups[l.g[0]] });
    }
    l.touch = t;
  }
  for (const m of s.mirrors) {
    if (!m.turn) continue;
    const t = touches(p, m.x, m.y, -0.06, -0.06, 1.06, 1.06); // bump into it or stand on it
    if (t && !m.touch) { m.state ^= 1; s.events.push({ type: 'mirror', x: m.x, y: m.y }); }
    m.touch = t;
  }
  for (const l of s.lenses) {
    const t = touches(p, l.x, l.y, 0.15, 0, 0.85, 1);
    if (t && !l.touch && s.fl.col !== COL[l.col]) { s.fl.col = COL[l.col]; s.events.push({ type: 'lens', col: l.col, x: l.x, y: l.y }); }
    l.touch = t;
  }
  for (const c of s.checks) {
    if (!c.on && touches(p, c.x, c.y, 0.1, -0.5, 0.9, 1)) {
      for (const o of s.checks) o.on = false;
      c.on = true; s.snap = snapshot(s, c);
      s.events.push({ type: 'check', x: c.x, y: c.y });
    }
  }
  if (s.shard && !s.shard.got) {
    const dx = p.x + p.w / 2 - (s.shard.x + 0.5), dy = p.y + p.h / 2 - (s.shard.y + 0.5);
    if (Math.abs(dx) < 0.65 && Math.abs(dy) < 0.8) { s.shard.got = true; s.events.push({ type: 'shard', x: s.shard.x, y: s.shard.y }); }
  }
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (const d of s.doors) {
    if (d.hidden && !s.reveal[d.y * s.w + d.x]) continue;
    if (cx > d.x + 0.1 && cx < d.x + 0.9 && cy > d.y - 0.6 && cy < d.y + 1) { s.cleared = true; s.events.push({ type: 'clear' }); return; }
  }
}

// ---------- one fixed step ----------
// inp: { mx: -1..1, jump: held, jumpPress: edge, toggle: edge, lightSet: true|false|undefined,
//        aim: absolute angle (rad) | undefined, aimRot: -1..1 (rotate the aim, keyboard) }
export function step(s, inp, dt) {
  if (s.cleared) return;
  const p = s.p;
  if (p.dead) {
    p.dead -= dt;
    if (p.dead <= 0) { restore(s); s.events.push({ type: 'respawn' }); }
    else { stepCrates(s, dt); stepStatues(s, dt); }
    return;
  }
  s.t += dt;
  moveLamps(s);
  for (const l of s.levers) if (l.timer > 0) {
    l.timer -= dt;
    if (l.timer <= 0) { l.timer = 0; for (const g of l.g) s.groups[g] = !s.groups[g]; s.events.push({ type: 'leverBack', x: l.x, y: l.y }); }
  }
  // torch
  const was = torchLit(s);
  if (inp.toggle) s.fl.on = !s.fl.on;
  if (inp.lightSet === true || inp.lightSet === false) s.fl.on = inp.lightSet;
  s.fl.dark = !!inp.dark;
  if (torchLit(s) !== was) s.events.push({ type: torchLit(s) ? 'torchOn' : 'torchOff' });
  if (typeof inp.aim === 'number') {
    s.fl.aim = wrapAng(inp.aim);
    const f = Math.cos(s.fl.aim) >= 0 ? 1 : -1;
    p.face = f;
  } else {
    const mx = inp.mx || 0;
    const f = mx > 0.1 ? 1 : mx < -0.1 ? -1 : p.face;
    if (f !== p.face) { p.face = f; s.fl.aim = wrapAng(Math.PI - s.fl.aim); }
    if (inp.aimRot) s.fl.aim = wrapAng(s.fl.aim + inp.aimRot * 2.6 * dt * p.face);
  }
  updateLight(s);
  stepPlayer(s, inp, dt);
  stepCrates(s, dt);
  stepStatues(s, dt);
  interact(s);
}

export function anyLightOn(s) {
  if (torchLit(s)) return true;
  for (const L of [...s.lamps, ...s.zones]) if (L.g && s.groups[L.g]) return true;
  return false;
}

// Stars for a finished run: clear, shard, time at or under par.
export function starsFor(s) {
  return [true, !!(s.shard && s.shard.got), s.t <= (s.def.par || 60)];
}

// For drawing: walk a ray from (x,y) at angle a up to maxD; returns colour segments [{d0,d1,col}].
export function castRay(s, x, y, a, maxD, col) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let tx = Math.floor(x), ty = Math.floor(y);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : Infinity, tdy = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : Infinity;
  let tmx = Math.abs(dx) > 1e-9 ? (dx > 0 ? tx + 1 - x : x - tx) * tdx : Infinity;
  let tmy = Math.abs(dy) > 1e-9 ? (dy > 0 ? ty + 1 - y : y - ty) * tdy : Infinity;
  // nearest crate along the ray
  let crateD = maxD;
  for (const c of s.crates) {
    if (segHitsBox(x, y, x + dx * maxD, y + dy * maxD, c)) {
      // find entry distance
      let t0 = 0, t1 = maxD;
      for (const [p, d, lo, hi] of [[x, dx, c.x, c.x + c.w], [y, dy, c.y, c.y + c.h]]) {
        if (Math.abs(d) < 1e-9) continue;
        let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      }
      if (t0 < crateD) crateD = Math.max(0, t0);
    }
  }
  const segs = [];
  let d0 = 0;
  for (let guard = 0; guard < 200; guard++) {
    const dNext = Math.min(tmx, tmy);
    if (dNext >= crateD) { segs.push({ d0, d1: crateD, col }); return segs; }
    if (tmx < tmy) { tx += sx; tmx += tdx; } else { ty += sy; tmy += tdy; }
    if (isOpaque(s, tx, ty)) { segs.push({ d0, d1: dNext, col }); return segs; }
    const c = tileAt(s, tx, ty);
    if (c === 'r' || c === 'b') {
      const nc = tint(col, c);
      segs.push({ d0, d1: dNext, col }); d0 = dNext; col = nc;
      if (!col) return segs;
    }
  }
  segs.push({ d0, d1: crateD, col });
  return segs;
}

// Give up on this life and go back to the last checkpoint (for a crate pushed into a corner).
export function retry(s) { if (!s.p.dead && !s.cleared) die(s, 'retry'); }
