// Bot brains. A bot looks at the match and returns the same control a thumb would: { mx, my, fire }.
// Walking around walls uses a distance field (BFS) from the goal tile, cached per tile since walls never move.

import { BOT_LEVELS } from './config.js';
import { tileAt, blocksWalk, lineOfSight, canFire, superReady, hitsWall, visibleTo, BLUE } from './game.js';

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
  return {
    skill: BOT_LEVELS[Math.max(0, Math.min(BOT_LEVELS.length - 1, level))],
    react: 0.5, target: null, seen: null, strafe: 1, strafeT: 0, flipT: 0,
    stuckT: 0, unstick: null, lastX: 0, lastY: 0, following: false, atGoal: false,
  };
}

export function botControl(m, b, brain, dt) {
  const def = b.def, at = def.attack, R = at.range, lobber = at.type === 'lob';
  const out = { mx: 0, my: 0, fire: null, sup: null };
  brain.react -= dt; brain.strafeT -= dt; brain.flipT -= dt;

  // Stuck on a corner for a while: walk somewhere random for a moment.
  if (brain.unstick) {
    brain.unstick.t -= dt; out.mx = brain.unstick.x; out.my = brain.unstick.y;
    if (brain.unstick.t <= 0) brain.unstick = null;
    return out;
  }

  // Only enemies this team can actually see (bushes hide people).
  let target = null, best = 1e9;
  for (const o of m.brawlers) {
    if (o.team === b.team || !visibleTo(m, b.team, o)) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d > 11) continue;
    const blocked = !lobber && !lineOfSight(m.map, b.x, b.y, o.x, o.y);
    const score = d + (blocked ? 4 : 0) + (o.id === brain.target ? -1.5 : 0) + o.hp / o.maxHp * 2;
    if (score < best) { best = score; target = o; }
  }
  // Teammates of the player help with whatever the player is shooting at.
  const player = m.brawlers.find(o => o.isPlayer && o.team === b.team && o.alive);
  if (player && player.lastTarget != null) {
    const pt = m.brawlers[player.lastTarget];
    if (pt && visibleTo(m, b.team, pt) && Math.hypot(pt.x - b.x, pt.y - b.y) < 10) target = pt;
  }
  brain.target = target ? target.id : null;
  if (target) brain.seen = { x: target.x, y: target.y, t: 1.5 };
  else if (brain.seen && (brain.seen.t -= dt) <= 0) brain.seen = null;

  let dir = { x: 0, y: 0 };
  if (target) {
    const d = Math.hypot(target.x - b.x, target.y - b.y), los = lineOfSight(m.map, b.x, b.y, target.x, target.y);
    const low = b.hp < b.maxHp * 0.3;
    const ux = (target.x - b.x) / d, uy = (target.y - b.y) / d;
    if (low && d < R + 1.5) {
      const home = m.map.spawns[b.team][b.slot % m.map.spawns[b.team].length];
      dir = walkToward(m, b, home.x, home.y);
    } else if (!los && !lobber) {
      dir = walkToward(m, b, target.x, target.y);
    } else {
      const want = R * def.prefer;
      const radial = d > want + 0.8 ? 1 : d < want - 0.8 ? -0.8 : 0;
      if (brain.strafeT <= 0) { brain.strafe = m.rand() < 0.5 ? -1 : 1; brain.strafeT = 0.5 + m.rand() * 0.9; }
      // Don't strafe into a wall: switch sides when that way is blocked (not every frame, or it shivers).
      const blockedSide = s => hitsWall(m.map, b.x - uy * s * 0.6, b.y + ux * s * 0.6, b.r);
      let strafe = brain.strafe;
      if (blockedSide(strafe)) {
        if (brain.flipT <= 0 && !blockedSide(-strafe)) { brain.strafe = strafe = -strafe; brain.strafeT = 0.6; brain.flipT = 0.4; }
        else strafe = 0;
      }
      dir = { x: ux * radial - uy * strafe * 0.85, y: uy * radial + ux * strafe * 0.85 };
      // Something solid (a wall, or water between us) right ahead: walk around it on the path instead.
      const dl = Math.hypot(dir.x, dir.y);
      if (dl > 0.1 && hitsWall(m.map, b.x + dir.x / dl * 0.35, b.y + dir.y / dl * 0.35, b.r)) dir = radial >= 0 ? walkToward(m, b, target.x, target.y) : { x: -ux, y: -uy };
    }

    const lead = t => ({ x: target.x + target.vx * t * brain.skill.lead, y: target.y + target.vy * t * brain.skill.lead });
    const err = () => (m.rand() - 0.5) * 2 * brain.skill.aimError;
    const flight = lobber ? at.flight * (0.55 + 0.45 * Math.min(1, d / R)) : d / at.speed;
    if (brain.react <= 0 && superReady(b)) {
      const sp = def.super;
      const ok = sp.type === 'storm' ? d < 3.8 && los : sp.type === 'firebomb' ? d < sp.range : d < sp.range * 0.9;
      if (ok) {
        const p = lead(sp.type === 'pierce' ? d / sp.speed : sp.type === 'firebomb' ? sp.flight : 0);
        out.sup = { a: Math.atan2(p.y - b.y, p.x - b.x) + err() * 0.5, d: Math.hypot(p.x - b.x, p.y - b.y) };
        brain.react = brain.skill.reaction;
      }
    }
    const canHit = lobber ? d < R : los && d < R * 0.95;
    if (!out.sup && canHit && brain.react <= 0 && canFire(b) && (b.ammo >= 2 || d < R * 0.6 || low)) {
      const p = lead(flight);
      out.fire = { a: Math.atan2(p.y - b.y, p.x - b.x) + err(), d: Math.hypot(p.x - b.x, p.y - b.y) * (1 + err() * 0.5) };
      brain.react = brain.skill.reaction * (0.7 + m.rand() * 0.6);
    }
  } else if (brain.seen) {
    // Lost sight (they ducked into a bush): check where they were last seen.
    dir = Math.hypot(brain.seen.x - b.x, brain.seen.y - b.y) > 0.8 ? walkToward(m, b, brain.seen.x, brain.seen.y) : { x: 0, y: 0 };
  } else if (player && player !== b) {
    // Escort the player. Start following beyond 4.5 tiles, stop within 2.5 — the gap keeps bots from
    // flip-flopping between "follow" and "wait" every frame (that was the shivering at the start).
    const d = Math.hypot(player.x - b.x, player.y - b.y);
    if (d > 4.5) brain.following = true; else if (d < 2.5) brain.following = false;
    if (brain.following) dir = walkToward(m, b, player.x, player.y);
  } else {
    // Nobody in sight: push toward the enemy side, a little off-centre per slot.
    const goalY = b.team === BLUE ? m.map.h * 0.3 : m.map.h * 0.7;
    const lane = 0.25 + 0.25 * (b.slot % 3), goalX = m.map.w * (b.team === BLUE ? lane : 1 - lane);
    const d = Math.hypot(goalX - b.x, goalY - b.y);
    if (d < 1) brain.atGoal = true; else if (d > 2.5) brain.atGoal = false;
    if (!brain.atGoal) dir = walkToward(m, b, goalX, goalY);
  }
  out.mx = dir.x; out.my = dir.y;

  const wants = Math.hypot(out.mx, out.my) > 0.3, moved = Math.hypot(b.x - brain.lastX, b.y - brain.lastY);
  brain.stuckT = wants && moved < 0.3 * dt * b.def.speed ? brain.stuckT + dt : 0;
  brain.lastX = b.x; brain.lastY = b.y;
  if (brain.stuckT > 0.5) { const a = m.rand() * Math.PI * 2; brain.unstick = { x: Math.cos(a), y: Math.sin(a), t: 0.35 }; brain.stuckT = 0; }
  return out;
}
