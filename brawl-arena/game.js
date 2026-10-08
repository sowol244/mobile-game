// Match rules. No DOM here: the browser and the node tests drive the same code.
// A match is stepped with a control per brawler: { mx, my, fire }
//   mx, my  movement, length 0..1
//   fire    null, or an angle in radians (0 = right, π/2 = down)

import { BRAWLERS, TEAM_MODE, HEAL } from './config.js';
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

function hitsWall(map, x, y, r) {
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

// ---------- match ----------
const BOT_NAMES = [['봇 하늘', '봇 바다'], ['봇 불꽃', '봇 번개', '봇 태풍']];

export function createMatch({ mapDef, seed = 1, playerKind = 'gyo', botsOnly = false } = {}) {
  const map = parseMap(mapDef.rows);
  const m = {
    map, rand: rng(seed), t: 0, tick: 0,
    phase: 'play', // play → sudden → over
    score: [0, 0], winner: null, // BLUE, RED, or 'draw'
    brawlers: [], bullets: [], events: [],
  };
  for (const team of [BLUE, RED]) {
    for (let i = 0; i < 3; i++) {
      const isPlayer = !botsOnly && team === BLUE && i === 1;
      const kind = isPlayer ? playerKind : 'gyo';
      const name = isPlayer ? '나' : team === BLUE ? BOT_NAMES[0][i === 0 ? 0 : 1] : BOT_NAMES[1][i];
      m.brawlers.push(newBrawler(m, m.brawlers.length, team, i, kind, name, isPlayer));
    }
  }
  return m;
}

function newBrawler(m, id, team, slot, kind, name, isPlayer) {
  const def = BRAWLERS[kind];
  const b = {
    id, team, slot, kind, def, name, isPlayer,
    x: 0, y: 0, vx: 0, vy: 0, face: team === BLUE ? -Math.PI / 2 : Math.PI / 2,
    r: def.radius, maxHp: def.hp, hp: def.hp,
    ammo: def.ammo, reloadT: 0, fireCd: 0, burst: null,
    alive: true, respawnT: 0, shieldT: 0, calm: 0, hurtFlash: 0,
    kills: 0, deaths: 0, damage: 0,
  };
  placeAtSpawn(m, b);
  return b;
}

function placeAtSpawn(m, b) {
  const s = m.map.spawns[b.team][b.slot % m.map.spawns[b.team].length];
  b.x = s.x; b.y = s.y; b.vx = b.vy = 0;
  b.face = b.team === BLUE ? -Math.PI / 2 : Math.PI / 2;
  b.hp = b.maxHp; b.ammo = b.def.ammo; b.reloadT = 0; b.fireCd = 0; b.burst = null;
  b.alive = true; b.shieldT = TEAM_MODE.spawnShield; b.calm = 0;
}

export const enemiesOf = (m, b) => m.brawlers.filter(o => o.team !== b.team);
export const alliesOf = (m, b) => m.brawlers.filter(o => o.team === b.team && o !== b);

export function canFire(b) { return b.alive && b.ammo >= 1 && b.fireCd <= 0 && !b.burst; }

export function step(m, dt, controls) {
  if (m.phase === 'over') return;
  m.t += dt; m.tick++;

  for (const b of m.brawlers) {
    if (!b.alive) {
      b.respawnT -= dt;
      if (b.respawnT <= 0) { placeAtSpawn(m, b); m.events.push({ type: 'spawn', id: b.id }); }
      continue;
    }
    const c = controls[b.id] || { mx: 0, my: 0, fire: null };
    move(m, b, c, dt);
    if (c.fire != null && canFire(b)) {
      b.ammo -= 1; b.fireCd = b.def.fireCd; b.face = c.fire; b.calm = 0; b.shieldT = 0;
      b.burst = { left: b.def.attack.bullets, t: 0, angle: c.fire };
    }
    if (b.burst) {
      b.burst.t -= dt;
      while (b.burst && b.burst.t <= 0) {
        shoot(m, b, b.burst.angle);
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
    b.calm += dt;
    if (b.calm >= HEAL.delay && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * HEAL.rate * dt);
  }
  separate(m);
  moveBullets(m, dt);
  clock(m);
}

function move(m, b, c, dt) {
  let mx = c.mx || 0, my = c.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const px = b.x, py = b.y, sp = b.def.speed;
  const nx = b.x + mx * sp * dt;
  if (!hitsWall(m.map, nx, b.y, b.r)) b.x = nx;
  const ny = b.y + my * sp * dt;
  if (!hitsWall(m.map, b.x, ny, b.r)) b.y = ny;
  b.vx = (b.x - px) / dt; b.vy = (b.y - py) / dt;
  if (len > 0.1 && !b.burst) b.face = Math.atan2(my, mx);
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

function shoot(m, b, angle) {
  const at = b.def.attack, a = angle + (m.rand() - 0.5) * 2 * at.spread;
  const sx = b.x + Math.cos(angle) * b.r, sy = b.y + Math.sin(angle) * b.r;
  // Muzzle inside a wall (hugging it): the bullet is spent immediately.
  if (blocksShot(tileAt(m.map, Math.floor(sx), Math.floor(sy)))) return;
  m.bullets.push({ x: sx, y: sy, vx: Math.cos(a) * at.speed, vy: Math.sin(a) * at.speed, left: at.range - b.r, dmg: at.damage, r: at.radius, team: b.team, owner: b.id });
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
      if (blocksShot(tileAt(m.map, Math.floor(s.x), Math.floor(s.y)))) { dead = true; m.events.push({ type: 'spark', x: s.x, y: s.y }); break; }
      for (const o of m.brawlers) {
        if (!o.alive || o.team === s.team) continue;
        if (Math.hypot(o.x - s.x, o.y - s.y) > o.r + s.r) continue;
        dead = true;
        if (o.shieldT > 0) { m.events.push({ type: 'spark', x: s.x, y: s.y }); break; }
        hurt(m, o, s.dmg, m.brawlers[s.owner]);
        break;
      }
    }
    if (!dead) keep.push(s);
  }
  m.bullets = keep;
}

export function hurt(m, o, dmg, by) {
  o.hp -= dmg; o.calm = 0; o.hurtFlash = 0.12;
  if (by) { by.damage += dmg; by.lastTarget = o.id; }
  m.events.push({ type: 'hit', id: o.id, by: by ? by.id : null, dmg, x: o.x, y: o.y });
  if (o.hp > 0) return;
  o.hp = 0; o.alive = false; o.respawnT = TEAM_MODE.respawn; o.deaths++; o.burst = null;
  if (by) { by.kills++; m.score[by.team]++; }
  for (const x of m.brawlers) if (x.lastTarget === o.id) x.lastTarget = null;
  m.events.push({ type: 'kill', id: o.id, by: by ? by.id : null, x: o.x, y: o.y });
  if (m.phase === 'sudden' && by) finish(m, by.team);
  else if (by && m.score[by.team] >= TEAM_MODE.killsToWin) finish(m, by.team);
}

function clock(m) {
  if (m.phase === 'play' && m.t >= TEAM_MODE.time) {
    if (m.score[BLUE] !== m.score[RED]) finish(m, m.score[BLUE] > m.score[RED] ? BLUE : RED);
    else { m.phase = 'sudden'; m.events.push({ type: 'sudden' }); }
  } else if (m.phase === 'sudden' && m.t >= TEAM_MODE.time + TEAM_MODE.suddenDeathMax) finish(m, 'draw');
}

function finish(m, winner) {
  if (m.phase === 'over') return;
  m.phase = 'over'; m.winner = winner; m.bullets = [];
  m.events.push({ type: 'over', winner });
}

export const timeLeft = m => (m.phase === 'sudden' ? 0 : Math.max(0, TEAM_MODE.time - m.t));

// Most kills in the whole match, ties broken by damage dealt.
export function mvpOf(m) {
  return [...m.brawlers].sort((a, b) => b.kills - a.kills || b.damage - a.damage)[0];
}
