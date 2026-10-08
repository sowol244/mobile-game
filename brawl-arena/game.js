// Match rules. No DOM here: the browser and the node tests drive the same code.
// A match is stepped with a control per brawler: { mx, my, fire, sup }
//   mx, my     movement, length 0..1
//   fire, sup  null, or { a, d }: aim angle in radians (0 = right, π/2 = down) and
//              distance in tiles (only lobbed attacks use d; null means full range)

import { BRAWLERS, KINDS, TEAM_MODE, HEAL, BUSH } from './config.js';
import { parseMap } from './maps.js';

export const BLUE = 0, RED = 1;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- map queries ----------
export const tileAt = (map, tx, ty) => (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? '#' : map.tiles[ty * map.w + tx]);
export const blocksWalk = ch => ch === '#' || ch === '~';
export const blocksShot = ch => ch === '#';
export const inBush = (map, x, y) => tileAt(map, Math.floor(x), Math.floor(y)) === '*';

export function hitsWall(map, x, y, r) {
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++)
      if (blocksWalk(tileAt(map, tx, ty))) return true;
  return false;
}

export function lineOfSight(map, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.2);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocksShot(tileAt(map, Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t)))) return false;
  }
  return true;
}

// Can the given team see brawler o? Teammates always; enemies unless hidden in a bush.
export function visibleTo(m, team, o) {
  if (!o.alive) return false;
  if (o.team === team || o.revealT > 0 || !inBush(m.map, o.x, o.y)) return true;
  return m.brawlers.some(v => v.alive && v.team === team && Math.hypot(v.x - o.x, v.y - o.y) <= BUSH.seeDist);
}

// ---------- match setup ----------
const BOT_NAMES = [['봇 하늘', '봇 바다'], ['봇 불꽃', '봇 번개', '봇 태풍']];

// The usual 3:3 line-up: the player in the middle of the blue team, bots on random brawlers.
export function teamRoster({ playerKind = 'gyo', botsOnly = false, rand = Math.random } = {}) {
  const pick = () => KINDS[Math.floor(rand() * KINDS.length)];
  const roster = [];
  for (const team of [BLUE, RED]) for (let slot = 0; slot < 3; slot++) {
    const isPlayer = !botsOnly && team === BLUE && slot === 1;
    roster.push({
      team, slot, isPlayer,
      kind: isPlayer ? playerKind : pick(),
      name: isPlayer ? '나' : team === BLUE ? BOT_NAMES[0][slot === 0 ? 0 : 1] : BOT_NAMES[1][slot],
    });
  }
  return roster;
}

// endless: practice matches (the tutorial) never end and keep no time limit.
export function createMatch({ mapDef, seed = 1, roster = null, playerKind = 'gyo', botsOnly = false, respawn = TEAM_MODE.respawn, endless = false } = {}) {
  const map = parseMap(mapDef.rows);
  const m = {
    map, mapDef, rand: rng(seed), t: 0, tick: 0, respawn, endless,
    phase: 'play', // play → sudden → over
    score: [0, 0], winner: null, // BLUE, RED, or 'draw'
    brawlers: [], bullets: [], lobs: [], zones: [], events: [],
  };
  const list = roster || teamRoster({ playerKind, botsOnly, rand: m.rand });
  for (const r of list) m.brawlers.push(newBrawler(m, m.brawlers.length, r));
  return m;
}

function newBrawler(m, id, { team, slot = 0, kind = 'gyo', name = '', isPlayer = false, dummy = false }) {
  const def = BRAWLERS[kind];
  const b = {
    id, team, slot, kind, def, name, isPlayer, dummy,
    x: 0, y: 0, vx: 0, vy: 0, face: team === BLUE ? -Math.PI / 2 : Math.PI / 2,
    r: def.radius, maxHp: def.hp, hp: def.hp,
    ammo: def.ammo, reloadT: 0, fireCd: 0, burst: null, dash: null,
    charge: 0, revealT: 0,
    alive: true, respawnT: 0, shieldT: 0, calm: 0, hurtFlash: 0,
    kills: 0, deaths: 0, damage: 0, lastTarget: null,
  };
  placeAtSpawn(m, b);
  return b;
}

function placeAtSpawn(m, b) {
  const list = m.map.spawns[b.team], s = list[b.slot % list.length];
  b.x = s.x; b.y = s.y; b.vx = b.vy = 0;
  b.face = b.team === BLUE ? -Math.PI / 2 : Math.PI / 2;
  b.hp = b.maxHp; b.ammo = b.def.ammo; b.reloadT = 0; b.fireCd = 0; b.burst = null; b.dash = null;
  b.alive = true; b.shieldT = TEAM_MODE.spawnShield; b.calm = 0; b.revealT = 0;
}

export function canFire(b) { return b.alive && b.ammo >= 1 && b.fireCd <= 0 && !b.burst && !b.dash; }
export const superReady = b => b.alive && b.charge >= 1 && !b.dash;

// ---------- the tick ----------
export function step(m, dt, controls) {
  if (m.phase === 'over') return;
  m.t += dt; m.tick++;

  for (const b of m.brawlers) {
    if (!b.alive) {
      b.respawnT -= dt;
      if (b.respawnT <= 0) { placeAtSpawn(m, b); m.events.push({ type: 'spawn', id: b.id }); }
      continue;
    }
    const c = controls[b.id] || {};
    if (b.dash) dashStep(m, b, dt); else move(m, b, c, dt);
    if (c.sup && superReady(b)) useSuper(m, b, c.sup);
    else if (c.fire && canFire(b)) attack(m, b, c.fire);
    if (b.burst) {
      b.burst.t -= dt;
      while (b.burst && b.burst.t <= 0) {
        shoot(m, b, b.burst.angle, b.def.attack, false);
        b.burst.left--; b.burst.t += b.def.attack.gap;
        if (b.burst.left <= 0) b.burst = null;
      }
    }
    b.fireCd -= dt;
    if (b.ammo < b.def.ammo) {
      b.reloadT += dt;
      if (b.reloadT >= b.def.reload) { b.ammo++; b.reloadT = 0; }
    } else b.reloadT = 0;
    b.shieldT = Math.max(0, b.shieldT - dt);
    b.hurtFlash = Math.max(0, b.hurtFlash - dt);
    b.revealT = Math.max(0, b.revealT - dt);
    b.calm += dt;
    if (b.calm >= HEAL.delay && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * HEAL.rate * dt);
  }
  separate(m);
  moveBullets(m, dt);
  moveLobs(m, dt);
  burnZones(m, dt);
  clock(m);
}

function acted(b) { b.calm = 0; b.shieldT = 0; b.revealT = Math.max(b.revealT, 1); }

function attack(m, b, aim) {
  const at = b.def.attack;
  b.ammo -= 1; b.fireCd = b.def.fireCd; b.face = aim.a; acted(b);
  if (at.type === 'burst') b.burst = { left: at.bullets, t: 0, angle: aim.a };
  else if (at.type === 'arrow') shoot(m, b, aim.a, at, false);
  else if (at.type === 'lob') lob(m, b, aim, at, false);
  m.events.push({ type: 'attack', id: b.id, kind: at.type });
}

function useSuper(m, b, aim) {
  const sp = b.def.super;
  b.charge = 0; b.face = aim.a; acted(b);
  if (sp.type === 'storm') b.dash = { vx: Math.cos(aim.a) * sp.dash / sp.dashTime, vy: Math.sin(aim.a) * sp.dash / sp.dashTime, t: sp.dashTime };
  else if (sp.type === 'pierce') shoot(m, b, aim.a, sp, true);
  else if (sp.type === 'firebomb') lob(m, b, aim, sp, true);
  m.events.push({ type: 'super', id: b.id, kind: sp.type, x: b.x, y: b.y });
}

// 교행이's super: a quick roll, then bullets in every direction.
function dashStep(m, b, dt) {
  const px = b.x, py = b.y, d = b.dash;
  const nx = b.x + d.vx * dt, ny = b.y + d.vy * dt;
  if (!hitsWall(m.map, nx, b.y, b.r)) b.x = nx;
  if (!hitsWall(m.map, b.x, ny, b.r)) b.y = ny;
  b.vx = (b.x - px) / dt; b.vy = (b.y - py) / dt;
  d.t -= dt;
  if (d.t <= 0) {
    b.dash = null;
    const sp = b.def.super;
    for (let i = 0; i < sp.bullets; i++) shoot(m, b, (i / sp.bullets) * Math.PI * 2 + 0.1, sp, true, true);
    m.events.push({ type: 'storm', x: b.x, y: b.y });
  }
}

function move(m, b, c, dt) {
  let mx = c.mx || 0, my = c.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const px = b.x, py = b.y, sp = b.def.speed;
  const nx = b.x + mx * sp * dt;
  if (!hitsWall(m.map, nx, b.y, b.r)) b.x = nx;
  else if (Math.abs(mx) > 0.2 && Math.abs(my) < 0.5) slideAround(m, b, 'x', Math.sign(mx), sp * dt);
  const ny = b.y + my * sp * dt;
  if (!hitsWall(m.map, b.x, ny, b.r)) b.y = ny;
  else if (Math.abs(my) > 0.2 && Math.abs(mx) < 0.5) slideAround(m, b, 'y', Math.sign(my), sp * dt);
  b.vx = (b.x - px) / dt; b.vy = (b.y - py) / dt;
  if (len > 0.1 && !b.burst) b.face = Math.atan2(my, mx);
}

// Corner assist: walking straight into the edge of an obstacle slips sideways around it
// (when the way is open within half a tile) instead of grinding to a stop.
function slideAround(m, b, axis, dir, dist) {
  const other = axis === 'x' ? 'y' : 'x';
  for (let off = 0.05; off <= 0.5; off += 0.05) {
    for (const s of [-1, 1]) {
      const p = { x: b.x, y: b.y }; p[other] += s * off; p[axis] += dir * dist;
      if (hitsWall(m.map, p.x, p.y, b.r)) continue;
      const q = { x: b.x, y: b.y }; q[other] += s * Math.min(off, dist);
      if (!hitsWall(m.map, q.x, q.y, b.r)) { b.x = q.x; b.y = q.y; }
      return;
    }
  }
}

// Brawlers push each other apart a little so they never stack on one spot.
function separate(m) {
  const list = m.brawlers.filter(b => b.alive);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
    if (d >= min || d === 0) continue;
    const push = (min - d) / 2, ux = dx / d, uy = dy / d;
    if (!hitsWall(m.map, a.x - ux * push, a.y - uy * push, a.r)) { a.x -= ux * push; a.y -= uy * push; }
    if (!hitsWall(m.map, b.x + ux * push, b.y + uy * push, b.r)) { b.x += ux * push; b.y += uy * push; }
  }
}

// ---------- straight shots (bullets, arrows) ----------
function shoot(m, b, angle, spec, isSuper, fromCentre = false) {
  const a = angle + (spec.spread ? (m.rand() - 0.5) * 2 * spec.spread : 0);
  const off = fromCentre ? 0 : b.r;
  const sx = b.x + Math.cos(angle) * off, sy = b.y + Math.sin(angle) * off;
  // Muzzle inside a wall (hugging it): the shot is spent immediately, unless it pierces walls.
  if (spec.type !== 'pierce' && blocksShot(tileAt(m.map, Math.floor(sx), Math.floor(sy)))) return;
  m.bullets.push({
    x: sx, y: sy, vx: Math.cos(a) * spec.speed, vy: Math.sin(a) * spec.speed, left: spec.range - off,
    dmg: spec.damage, r: spec.radius, team: b.team, owner: b.id, kind: spec.type, isSuper,
    pierce: spec.type === 'pierce', hit: spec.type === 'pierce' ? new Set() : null,
  });
  m.events.push({ type: 'shot', id: b.id });
}

function moveBullets(m, dt) {
  const keep = [];
  for (const s of m.bullets) {
    const stepLen = Math.hypot(s.vx, s.vy) * dt, n = Math.max(1, Math.ceil(stepLen / 0.15));
    let dead = false;
    for (let k = 0; k < n && !dead; k++) {
      s.x += s.vx * dt / n; s.y += s.vy * dt / n; s.left -= stepLen / n;
      if (s.left <= 0) { dead = true; break; }
      if (!s.pierce && blocksShot(tileAt(m.map, Math.floor(s.x), Math.floor(s.y)))) { dead = true; m.events.push({ type: 'spark', x: s.x, y: s.y }); break; }
      for (const o of m.brawlers) {
        if (!o.alive || o.team === s.team || (s.hit && s.hit.has(o.id))) continue;
        if (Math.hypot(o.x - s.x, o.y - s.y) > o.r + s.r) continue;
        if (s.pierce) s.hit.add(o.id); else dead = true;
        if (o.shieldT > 0) { m.events.push({ type: 'spark', x: s.x, y: s.y }); break; }
        hurt(m, o, s.dmg, m.brawlers[s.owner], !s.isSuper);
        break;
      }
    }
    if (!dead) keep.push(s);
  }
  m.bullets = keep;
}

// ---------- lobbed bowls (fly over walls, splash where they land) ----------
function lob(m, b, aim, spec, isSuper) {
  const d = Math.max(1, Math.min(spec.range, aim.d ?? spec.range));
  const tx = b.x + Math.cos(aim.a) * d, ty = b.y + Math.sin(aim.a) * d;
  m.lobs.push({ sx: b.x, sy: b.y, tx, ty, t: 0, dur: spec.flight * (0.55 + 0.45 * d / spec.range), spec, isSuper, team: b.team, owner: b.id });
}

function moveLobs(m, dt) {
  const keep = [];
  for (const l of m.lobs) {
    l.t += dt;
    if (l.t < l.dur) { keep.push(l); continue; }
    const by = m.brawlers[l.owner];
    m.events.push({ type: 'splash', x: l.tx, y: l.ty, r: l.spec.blast, isSuper: l.isSuper });
    for (const o of m.brawlers) {
      if (!o.alive || o.team === l.team || o.shieldT > 0) continue;
      if (Math.hypot(o.x - l.tx, o.y - l.ty) <= l.spec.blast + o.r * 0.5) hurt(m, o, l.spec.damage, by, !l.isSuper);
    }
    if (l.spec.burn) m.zones.push({ x: l.tx, y: l.ty, r: l.spec.burn.radius, t: l.spec.burn.time, dps: l.spec.burn.dps, tick: 0, team: l.team, owner: l.owner });
  }
  m.lobs = keep;
}

function burnZones(m, dt) {
  for (const z of m.zones) {
    z.t -= dt; z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick = 0.5;
    for (const o of m.brawlers) {
      if (!o.alive || o.team === z.team || o.shieldT > 0) continue;
      if (Math.hypot(o.x - z.x, o.y - z.y) <= z.r) hurt(m, o, Math.round(z.dps * 0.5), m.brawlers[z.owner], false);
    }
  }
  m.zones = m.zones.filter(z => z.t > 0);
}

// ---------- damage, score, clock ----------
export function hurt(m, o, dmg, by, charges = true) {
  if (!o.alive) return;
  o.hp -= dmg; o.calm = 0; o.hurtFlash = 0.12; o.revealT = Math.max(o.revealT, BUSH.reveal);
  if (by) {
    by.damage += dmg; by.lastTarget = o.id;
    if (charges) by.charge = Math.min(1, by.charge + dmg / by.def.superCharge);
  }
  m.events.push({ type: 'hit', id: o.id, by: by ? by.id : null, dmg, x: o.x, y: o.y });
  if (o.hp > 0) return;
  o.hp = 0; o.alive = false; o.respawnT = m.respawn; o.deaths++; o.burst = null; o.dash = null;
  if (by) { by.kills++; m.score[by.team]++; }
  for (const x of m.brawlers) if (x.lastTarget === o.id) x.lastTarget = null;
  m.events.push({ type: 'kill', id: o.id, by: by ? by.id : null, x: o.x, y: o.y });
  if (m.endless) return;
  if (m.phase === 'sudden' && by) finish(m, by.team);
  else if (by && m.score[by.team] >= TEAM_MODE.killsToWin) finish(m, by.team);
}

function clock(m) {
  if (m.endless) return;
  if (m.phase === 'play' && m.t >= TEAM_MODE.time) {
    if (m.score[BLUE] !== m.score[RED]) finish(m, m.score[BLUE] > m.score[RED] ? BLUE : RED);
    else { m.phase = 'sudden'; m.events.push({ type: 'sudden' }); }
  } else if (m.phase === 'sudden' && m.t >= TEAM_MODE.time + TEAM_MODE.suddenDeathMax) finish(m, 'draw');
}

function finish(m, winner) {
  if (m.phase === 'over') return;
  m.phase = 'over'; m.winner = winner; m.bullets = []; m.lobs = []; m.zones = [];
  m.events.push({ type: 'over', winner });
}

export const timeLeft = m => (m.phase === 'sudden' ? 0 : Math.max(0, TEAM_MODE.time - m.t));

// Most kills in the whole match, ties broken by damage dealt.
export function mvpOf(m) {
  return [...m.brawlers].sort((a, b) => b.kills - a.kills || b.damage - a.damage)[0];
}
