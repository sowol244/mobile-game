const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const STAGE_DURATION = 75;

export function roadHalfWidth(w, h, y) {
  const depth = clamp((y - h * 0.13) / (h * 0.84), 0, 1);
  return w * (0.23 + depth * 0.21);
}

export function laneX(w, h, y, lane) {
  return w * 0.5 + (lane - 1) * roadHalfWidth(w, h, y) * 0.58;
}

function closestLane(s, x) {
  let best = 0, distance = Infinity;
  for (let lane = 0; lane < 3; lane++) {
    const next = Math.abs(laneX(s.w, s.h, s.y, lane) - x);
    if (next < distance) { distance = next; best = lane; }
  }
  return best;
}

export function createGame(w, h) {
  return {
    w, h, t: 0, finished: null,
    x: w * 0.5, targetX: w * 0.5, y: h * 0.76,
    hp: 100, maxHp: 100, invulnerable: 0, flash: 0,
    weapon: 'pistol', weaponLevel: { pistol: 1, smg: 0 },
    damageBonus: 0, fireTimer: 0.15,
    score: 0, kills: 0, barrelsBroken: 0, distance: 0,
    roadOffset: 0, spawnTimer: 0.7,
    barrelTimer: 9.5, barrelWave: 0, explosiveTimer: 23,
    boss: null, bossStarted: false, bossDefeated: false,
    zombies: [], barrels: [], bullets: [], hazards: [], effects: [],
    events: [],
  };
}

export function resizeGame(s, w, h) {
  const sx = w / s.w, sy = h / s.h;
  s.x *= sx;
  s.targetX *= sx;
  s.y = h * 0.76;
  for (const item of [...s.zombies, ...s.barrels, ...s.bullets, ...s.hazards, ...s.effects]) {
    item.x *= sx;
    item.y *= sy;
    if (item.vx != null) item.vx *= sx;
    if (item.vy != null) item.vy *= sy;
  }
  if (s.boss) { s.boss.x *= sx; s.boss.y = h * 0.2; }
  s.w = w;
  s.h = h;
}

function spawnZombie(s, forcedKind) {
  if (s.zombies.length >= 40) return;
  const kind = forcedKind || (s.t > 17 && Math.random() < 0.34 ? 'runner' : 'walker');
  const lane = Math.floor(Math.random() * 3);
  const y = s.h * (0.15 + Math.random() * 0.035);
  const hp = kind === 'runner' ? 15 : 20;
  s.zombies.push({
    kind, lane, x: laneX(s.w, s.h, y, lane), y,
    hp, maxHp: hp, radius: kind === 'runner' ? 13 : 16,
    speed: s.h * (kind === 'runner' ? 0.42 : 0.29) * (1 + Math.min(0.2, s.t / 500)),
    phase: Math.random() * Math.PI * 2, dead: false, dying: 0,
  });
}

function spawnBarrelPair(s) {
  const pair = s.barrelWave % 2 === 0
    ? [{ lane: 0, kind: 'weapon', hp: 60 }, { lane: 2, kind: 'upgrade', hp: 50 }]
    : [{ lane: 0, kind: 'upgrade', hp: 50 }, { lane: 2, kind: 'weapon', hp: 60 }];
  for (const item of pair) {
    const y = s.h * 0.16;
    s.barrels.push({
      lane: item.lane, kind: item.kind, hp: item.hp, maxHp: item.hp,
      x: laneX(s.w, s.h, y, item.lane), y, radius: 20, dead: false,
    });
  }
  s.barrelWave++;
}

function spawnExplosiveBarrel(s, lane) {
  const y = s.h * 0.155;
  const chosen = lane == null ? Math.floor(Math.random() * 3) : lane;
  s.barrels.push({
    lane: chosen, kind: 'explosive', hp: 30, maxHp: 30,
    x: laneX(s.w, s.h, y, chosen), y, radius: 21, dead: false,
  });
}

function hurtPlayer(s, damage, events) {
  if (s.invulnerable > 0 || s.finished) return;
  s.hp = Math.max(0, s.hp - damage);
  s.invulnerable = 0.6;
  s.flash = 0.22;
  events.push('hurt');
  if (s.hp <= 0) {
    s.finished = 'lose';
    events.push('lose');
  }
}

function rewardBarrel(s, barrel, events) {
  if (barrel.kind === 'weapon') {
    if (s.weapon === 'pistol') {
      s.weapon = 'smg';
      s.weaponLevel.smg = 1;
      events.push({ type: 'reward', label: '기관단총 획득' });
    } else {
      s.weaponLevel.smg = Math.min(5, s.weaponLevel.smg + 1);
      s.damageBonus += 1;
      events.push({ type: 'reward', label: '기관단총 강화 Lv.' + s.weaponLevel.smg });
    }
  } else if (barrel.kind === 'upgrade') {
    s.damageBonus += 4;
    events.push({ type: 'reward', label: '화력 강화 +4' });
  }
  s.barrelsBroken++;
  s.score += 35;
  events.push('barrelDown');
}

function addExplosion(s, x, y, radius, events) {
  const queue = [{ x, y }];
  const exploded = new Set();
  while (queue.length) {
    const point = queue.shift();
    for (const other of s.barrels) {
      if (other.kind !== 'explosive' || other.dead || exploded.has(other)) continue;
      if (Math.hypot(other.x - point.x, other.y - point.y) <= radius) {
        other.dead = true;
        exploded.add(other);
        s.barrelsBroken++;
        s.score += 20;
        queue.push(other);
      }
    }
    for (const zombie of s.zombies) {
      if (zombie.dead || Math.hypot(zombie.x - point.x, zombie.y - point.y) > radius) continue;
      zombie.hp -= 65;
      if (zombie.hp <= 0) killZombie(s, zombie, events);
    }
    if (s.boss && Math.hypot(s.boss.x - point.x, s.boss.y - point.y) < radius * 0.85) {
      s.boss.hp -= 65;
      if (s.boss.hp <= 0) defeatBoss(s, events);
    }
    s.effects.push({ x: point.x, y: point.y, kind: 'explosion', life: 0.62, total: 0.62, radius });
  }
  events.push('explosion');
}

function killZombie(s, zombie, events) {
  if (zombie.dead) return;
  zombie.dead = true;
  zombie.dying = 0.28;
  s.kills++;
  s.score += zombie.kind === 'runner' ? 15 : 10;
  events.push('kill');
}

function defeatBoss(s, events) {
  if (!s.boss || s.bossDefeated) return;
  s.boss = null;
  s.bossDefeated = true;
  s.score += 500;
  events.push('bossDown');
  s.finished = 'win';
  events.push('win');
}

function findTarget(s) {
  const side = roadHalfWidth(s.w, s.h, s.y) * 1.13;
  const targets = [];
  for (const zombie of s.zombies) if (!zombie.dead) targets.push(zombie);
  for (const barrel of s.barrels) if (!barrel.dead) targets.push(barrel);
  if (s.boss) targets.push({ ...s.boss, radius: 52, targetType: 'boss' });
  let best = null, bestScore = Infinity;
  for (const target of targets) {
    const dx = Math.abs(target.x - s.x);
    const dy = s.y - target.y;
    if (dy < 15 || dx > side) continue;
    const score = dy + dx * 1.2;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

function shoot(s, events) {
  const target = findTarget(s);
  const tx = target ? target.x : s.x;
  const ty = target ? target.y : s.h * 0.16;
  const dx = tx - s.x, dy = ty - (s.y - 26);
  const length = Math.max(1, Math.hypot(dx, dy));
  const smg = s.weapon === 'smg';
  const damage = (smg ? 6 : 10) + s.damageBonus;
  s.bullets.push({
    x: s.x, y: s.y - 28,
    vx: dx / length * 730, vy: dy / length * 730,
    damage, weapon: s.weapon, life: 1.25,
  });
  if (smg && s.weaponLevel.smg >= 3) {
    for (const spread of [-0.07, 0.07]) {
      s.bullets.push({
        x: s.x, y: s.y - 28,
        vx: (dx / length + spread) * 730, vy: dy / length * 730,
        damage: damage * 0.68, weapon: s.weapon, life: 1.25,
      });
    }
  }
  events.push('shot');
}

function damageTarget(s, target, damage, events) {
  if (target === s.boss) {
    target.hp -= damage;
    events.push('hit');
    if (target.hp <= 0) defeatBoss(s, events);
    return;
  }
  target.hp -= damage;
  events.push('hit');
  if (target.hp > 0) return;
  if (target.kind === 'walker' || target.kind === 'runner') {
    killZombie(s, target, events);
  } else if (target.kind === 'explosive') {
    target.dead = true;
    s.barrelsBroken++;
    s.score += 20;
    addExplosion(s, target.x, target.y, s.w * 0.21, events);
  } else {
    target.dead = true;
    rewardBarrel(s, target, events);
  }
}

function updateBoss(s, dt, events) {
  if (s.t >= 60 && !s.bossStarted) {
    s.bossStarted = true;
    const y = s.h * 0.2;
    s.boss = {
      x: s.w * 0.5, y, hp: 500, maxHp: 500,
      phase: 0, attackTimer: 3.2, warning: 0, attackLane: 1,
    };
    events.push('bossStart');
  }
  if (!s.boss) return;
  const boss = s.boss;
  boss.phase += dt;
  boss.x = s.w * 0.5 + Math.sin(boss.phase * 0.8) * roadHalfWidth(s.w, s.h, boss.y) * 0.36;
  if (boss.warning > 0) {
    boss.warning -= dt;
    if (boss.warning <= 0) {
      const targetX = s.x;
      const targetY = s.y - 18;
      const dx = targetX - boss.x, dy = targetY - boss.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      s.hazards.push({ x: boss.x, y: boss.y + 16, vx: dx / len * 320, vy: dy / len * 320, radius: 13, damage: 16 });
      boss.attackTimer = 2.8;
      events.push('bossShot');
    }
  } else {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackLane = closestLane(s, s.x);
      boss.warning = 0.95;
      events.push('bossWarn');
    }
  }
}

export function updateGame(s, dt, targetX) {
  if (s.finished) return [];
  const events = [];
  dt = Math.min(0.04, Math.max(0, dt));
  s.t += dt;
  s.distance = Math.floor(s.t * 10);
  s.roadOffset = (s.roadOffset + dt * 0.42) % 1;
  s.y = s.h * 0.76;
  if (targetX != null) {
    const reach = roadHalfWidth(s.w, s.h, s.y) * 0.88;
    s.targetX = clamp(targetX, s.w * 0.5 - reach, s.w * 0.5 + reach);
  }
  s.x += (s.targetX - s.x) * Math.min(1, dt * 12);
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.flash = Math.max(0, s.flash - dt);

  if (s.t < 60) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      spawnZombie(s);
      s.spawnTimer = Math.max(0.56, 1.12 - s.t * 0.006) * (0.78 + Math.random() * 0.4);
    }
  }
  s.barrelTimer -= dt;
  if (s.barrelTimer <= 0 && s.barrelWave < 4) {
    spawnBarrelPair(s);
    s.barrelTimer = [15, 15, 14, 99][s.barrelWave - 1];
  }
  s.explosiveTimer -= dt;
  if (s.explosiveTimer <= 0 && s.t < 60) {
    const lane = Math.floor(Math.random() * 2);
    spawnExplosiveBarrel(s, lane);
    spawnExplosiveBarrel(s, lane + 1);
    s.explosiveTimer = 14;
  }

  updateBoss(s, dt, events);
  for (const zombie of s.zombies) {
    zombie.y += zombie.speed * dt;
    zombie.x = laneX(s.w, s.h, zombie.y, zombie.lane) + Math.sin(s.t * 2.1 + zombie.phase) * 3;
    if (zombie.dead) { zombie.dying -= dt; continue; }
    if (zombie.y >= s.y - 24) {
      if (Math.abs(zombie.x - s.x) < zombie.radius + 20) hurtPlayer(s, zombie.kind === 'runner' ? 15 : 10, events);
      zombie.dead = true;
    }
  }
  for (const barrel of s.barrels) {
    barrel.y += s.h * 0.19 * dt;
    barrel.x = laneX(s.w, s.h, barrel.y, barrel.lane);
    if (barrel.y >= s.y - 28) barrel.dead = true;
  }

  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    shoot(s, events);
    s.fireTimer = s.weapon === 'smg' ? 0.11 : 0.25;
  }
  for (const bullet of s.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) { bullet.dead = true; continue; }
    let hit = false;
    for (const barrel of s.barrels) {
      if (barrel.dead) continue;
      if (Math.hypot(bullet.x - barrel.x, bullet.y - barrel.y) > barrel.radius + 5) continue;
      damageTarget(s, barrel, bullet.damage, events);
      bullet.dead = true; hit = true; break;
    }
    if (hit) continue;
    for (const zombie of s.zombies) {
      if (zombie.dead) continue;
      if (Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y) > zombie.radius + 5) continue;
      damageTarget(s, zombie, bullet.damage, events);
      bullet.dead = true; hit = true; break;
    }
    if (hit) continue;
    if (s.boss && Math.hypot(bullet.x - s.boss.x, bullet.y - s.boss.y) < 58) {
      damageTarget(s, s.boss, bullet.damage, events);
      bullet.dead = true;
    }
  }

  for (const hazard of s.hazards) {
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;
    if (Math.hypot(hazard.x - s.x, hazard.y - (s.y - 10)) < hazard.radius + 22) {
      hurtPlayer(s, hazard.damage, events);
      hazard.dead = true;
    }
  }
  for (const effect of s.effects) effect.life -= dt;
  s.zombies = s.zombies.filter(z => !z.dead || z.dying > 0);
  s.barrels = s.barrels.filter(b => !b.dead);
  s.bullets = s.bullets.filter(b => !b.dead && b.y > -20 && b.y < s.h + 20);
  s.hazards = s.hazards.filter(h => !h.dead && h.y < s.h + 30 && h.x > -30 && h.x < s.w + 30);
  s.effects = s.effects.filter(e => e.life > 0);

  if (s.t >= STAGE_DURATION && s.bossDefeated) {
    s.finished = 'win';
    events.push('win');
  } else if (s.t >= 88 && !s.finished) {
    s.finished = 'lose';
    events.push('timeout');
    events.push('lose');
  }
  s.score = Math.floor(s.score);
  s.events = events;
  return events;
}
