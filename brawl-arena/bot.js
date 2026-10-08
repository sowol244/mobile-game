// Bot brains. A bot looks at the match and returns the same control a thumb would: { mx, my, fire }.
// Walking around walls uses a distance field (BFS) from the goal tile, cached per tile since walls never move.

import { BOT_LEVELS } from './config.js';
import { tileAt, blocksWalk, lineOfSight, canFire, hitsWall, BLUE } from './game.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function field(m, gx, gy) {
  const map = m.map;
  map.fields ||= new Map();
  const key = gy * map.w + gx;
  let f = map.fields.get(key);
  if (f) return f;
  f = new Int16Array(map.w * map.h).fill(-1);
  const q = [key]; f[key] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], cx = c % map.w, cy = (c - cx) / map.w;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (blocksWalk(tileAt(map, nx, ny))) continue;
      if (dx && dy && (blocksWalk(tileAt(map, cx + dx, cy)) || blocksWalk(tileAt(map, cx, cy + dy)))) continue; // no corner cutting
      const k = ny * map.w + nx;
      if (f[k] < 0) { f[k] = f[c] + 1; q.push(k); }
    }
  }
  map.fields.set(key, f);
  return f;
}

// True if a body of radius r can slide in a straight line from a to b without touching a wall.
function clearPath(map, ax, ay, bx, by, r) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.15));
  for (let i = 1; i <= n; i++) if (hitsWall(map, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, r)) return false;
  return true;
}

// Unit vector that walks from b toward (gx, gy) around walls. Follows the distance field a few
// tiles ahead and heads for the farthest tile it can reach in a straight line, so bots cut
// corners smoothly instead of rubbing against them.
export function walkToward(m, b, gx, gy) {
  const map = m.map, tx = Math.floor(b.x), ty = Math.floor(b.y);
  const gtx = Math.min(map.w - 1, Math.max(0, Math.floor(gx))), gty = Math.min(map.h - 1, Math.max(0, Math.floor(gy)));
  if (clearPath(map, b.x, b.y, gx, gy, b.r + 0.02) || blocksWalk(tileAt(map, gtx, gty))) return norm(gx - b.x, gy - b.y);
  const f = field(m, gtx, gty);
  const path = [];
  let cx = tx, cy = ty;
  for (let k = 0; k < 6; k++) {
    let best = null, bestD = f[cy * map.w + cx] < 0 ? 1e9 : f[cy * map.w + cx];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (blocksWalk(tileAt(map, nx, ny))) continue;
      if (dx && dy && (blocksWalk(tileAt(map, cx + dx, cy)) || blocksWalk(tileAt(map, cx, cy + dy)))) continue;
      const d = f[ny * map.w + nx];
      if (d >= 0 && d < bestD) { bestD = d; best = [nx, ny]; }
    }
    if (!best) break;
    [cx, cy] = best; path.push([cx + 0.5, cy + 0.5]);
    if (bestD === 0) break;
  }
  if (!path.length) return norm(gx - b.x, gy - b.y);
  let aim = path[0];
  for (let k = path.length - 1; k > 0; k--) if (clearPath(map, b.x, b.y, path[k][0], path[k][1], b.r + 0.02)) { aim = path[k]; break; }
  return norm(aim[0] - b.x, aim[1] - b.y);
}

const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

export function makeBrain(level = 0) {
  return { skill: BOT_LEVELS[Math.max(0, Math.min(BOT_LEVELS.length - 1, level))], react: 0.5, target: null, strafe: 1, strafeT: 0, stuckT: 0, unstick: null, lastX: 0, lastY: 0 };
}

export function botControl(m, b, brain, dt) {
  const at = b.def.attack, R = at.range;
  const out = { mx: 0, my: 0, fire: null };
  brain.react -= dt; brain.strafeT -= dt;

  // Stuck on a corner for a while: walk somewhere random for a moment.
  if (brain.unstick) {
    brain.unstick.t -= dt; out.mx = brain.unstick.x; out.my = brain.unstick.y;
    if (brain.unstick.t <= 0) brain.unstick = null;
    return out;
  }

  const foes = m.brawlers.filter(o => o.alive && o.team !== b.team);
  let target = null, best = 1e9;
  for (const o of foes) {
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d > 11) continue;
    const score = d + (lineOfSight(m.map, b.x, b.y, o.x, o.y) ? 0 : 4) + (o.id === brain.target ? -1.5 : 0) + o.hp / o.maxHp * 2;
    if (score < best) { best = score; target = o; }
  }
  // Teammates of the player help with whatever the player is shooting at.
  const player = m.brawlers.find(o => o.isPlayer && o.team === b.team && o.alive);
  if (player && player.lastTarget != null) {
    const pt = m.brawlers[player.lastTarget];
    if (pt && pt.alive && Math.hypot(pt.x - b.x, pt.y - b.y) < 10) target = pt;
  }
  brain.target = target ? target.id : null;

  let dir = { x: 0, y: 0 };
  if (target) {
    const d = Math.hypot(target.x - b.x, target.y - b.y), los = lineOfSight(m.map, b.x, b.y, target.x, target.y);
    const low = b.hp < b.maxHp * 0.3;
    if (low && d < R + 1.5) {
      const home = m.map.spawns[b.team][b.slot];
      dir = walkToward(m, b, home.x, home.y);
    } else if (!los) {
      dir = walkToward(m, b, target.x, target.y);
    } else {
      const want = R * 0.62, ux = (target.x - b.x) / d, uy = (target.y - b.y) / d;
      const radial = d > want + 0.8 ? 1 : d < want - 0.8 ? -0.8 : 0;
      if (brain.strafeT <= 0) { brain.strafe = m.rand() < 0.5 ? -1 : 1; brain.strafeT = 0.5 + m.rand() * 0.9; }
      // Don't strafe into a wall: switch sides when that way is blocked.
      if (hitsWall(m.map, b.x - uy * brain.strafe * 0.6, b.y + ux * brain.strafe * 0.6, b.r)) { brain.strafe = -brain.strafe; brain.strafeT = 0.6; }
      dir = { x: ux * radial - uy * brain.strafe * 0.85, y: uy * radial + ux * brain.strafe * 0.85 };
      // Something solid (a wall, or water between us) right ahead: walk around it on the path instead.
      const dl = Math.hypot(dir.x, dir.y);
      if (dl > 0.1 && hitsWall(m.map, b.x + dir.x / dl * 0.35, b.y + dir.y / dl * 0.35, b.r)) dir = radial >= 0 ? walkToward(m, b, target.x, target.y) : { x: -ux, y: -uy };
    }
    if (los && d < R * 0.95 && brain.react <= 0 && canFire(b) && (b.ammo >= 2 || d < R * 0.6 || low)) {
      const lead = d / at.speed * brain.skill.lead;
      const ax = target.x + target.vx * lead, ay = target.y + target.vy * lead;
      out.fire = Math.atan2(ay - b.y, ax - b.x) + (m.rand() - 0.5) * 2 * brain.skill.aimError;
      brain.react = brain.skill.reaction * (0.7 + m.rand() * 0.6);
    }
  } else if (player && player !== b && Math.hypot(player.x - b.x, player.y - b.y) > 3.5) {
    dir = walkToward(m, b, player.x, player.y);
  } else {
    // Nobody in sight: push toward the enemy side, a little off-centre per slot.
    const goalY = b.team === BLUE ? m.map.h * 0.3 : m.map.h * 0.7;
    const lane = 0.25 + 0.25 * b.slot, goalX = m.map.w * (b.team === BLUE ? lane : 1 - lane);
    dir = Math.hypot(goalX - b.x, goalY - b.y) > 1.5 ? walkToward(m, b, goalX, goalY) : { x: 0, y: 0 };
  }
  out.mx = dir.x; out.my = dir.y;

  const wants = Math.hypot(out.mx, out.my) > 0.3, moved = Math.hypot(b.x - brain.lastX, b.y - brain.lastY);
  brain.stuckT = wants && moved < 0.3 * dt * b.def.speed ? brain.stuckT + dt : 0;
  brain.lastX = b.x; brain.lastY = b.y;
  if (brain.stuckT > 0.5) { const a = m.rand() * Math.PI * 2; brain.unstick = { x: Math.cos(a), y: Math.sin(a), t: 0.35 }; brain.stuckT = 0; }
  return out;
}
