const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const STAGE_DURATION = 75;

const WAVE_PLAN = [
  { start: 0.35, count: 8, interval: 1.08, pattern: ['walker'] },
  { start: 12.2, count: 6, interval: 1.34, pattern: ['walker', 'runner'] },
  { start: 25.15, count: 15, interval: 0.63, pattern: ['walker', 'walker', 'runner'] },
  { start: 41.5, count: 9, interval: 1.23, pattern: ['walker', 'runner', 'walker'] },
  { start: 55.1, count: 25, interval: 0.16, pattern: ['walker', 'runner', 'runner', 'walker'] },
];

const PHASE_CUES = [
  { at: 0.35, label: '좌우로 움직여 자동 사격의 표적을 바꾸세요', duration: 2.5 },
  { at: 10, label: '첫 보급 선택 · 동료 또는 기관단총', duration: 2.2 },
  { at: 25, label: '강화 화력으로 좀비 웨이브를 돌파하세요', duration: 2 },
  { at: 40, label: '두 번째 보급 선택 · 화력 강화 또는 동료', duration: 2.2 },
  { at: 55, label: '대규모 웨이브 · 폭발통을 노리세요', duration: 2 },
];

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
    damageBonus: 0, fireTimer: 0.15, powerFlash: 0,
    companions: [], companionPower: 1,
    score: 0, kills: 0, barrelsBroken: 0, distance: 0,
    roadOffset: 0, waveIndex: 0, waveSpawned: 0, cueIndex: 0,
    firstChoiceSpawned: false, secondChoiceSpawned: false,
    explosivesSpawned: false, obstacleSpawned: false,
    boss: null, bossStarted: false, bossDefeated: false,
    zombies: [], barrels: [], obstacles: [], bullets: [], hazards: [], effects: [],
    target: null, events: [],
  };
}

export function resizeGame(s, w, h) {
  const sx = w / s.w, sy = h / s.h;
  s.x *= sx;
  s.targetX *= sx;
  s.y = h * 0.76;
  for (const item of [...s.zombies, ...s.barrels, ...s.obstacles, ...s.bullets, ...s.hazards, ...s.effects]) {
    item.x *= sx;
    item.y *= sy;
    if (item.vx != null) item.vx *= sx;
    if (item.vy != null) item.vy *= sy;
    if (item.recoilX != null) item.recoilX *= sx;
  }
  if (s.boss) { s.boss.x *= sx; s.boss.y = h * 0.2; }
  s.w = w;
  s.h = h;
}

function spawnZombie(s, forcedKind) {
  if (s.zombies.filter(zombie => !zombie.dead).length >= 40) return;
  const kind = forcedKind || 'walker';
  const lane = Math.floor(Math.random() * 3);
  const y = s.h * (0.15 + Math.random() * 0.035);
  const hp = kind === 'runner' ? 15 : 20;
  s.zombies.push({
    kind, lane, x: laneX(s.w, s.h, y, lane), y,
    hp, maxHp: hp, radius: kind === 'runner' ? 13 : 16,
    speed: s.h * (kind === 'runner' ? 0.42 : 0.29) * (1 + Math.min(0.2, s.t / 500)),
    phase: Math.random() * Math.PI * 2, dead: false, dying: 0,
    hitFlash: 0, recoilX: 0, recoilY: 0, deathSide: 1,
  });
}

function spawnBarrelPair(s, rewards) {
  const offer = {};
  for (const item of rewards) {
    const y = s.h * 0.18;
    s.barrels.push({
      lane: item.lane, kind: item.kind, hp: item.hp, maxHp: item.hp,
      x: laneX(s.w, s.h, y, item.lane), y, radius: 21, dead: false, hitFlash: 0, offer,
    });
  }
}

function spawnExplosiveBarrel(s, lane) {
  const y = s.h * 0.17;
  s.barrels.push({
    lane, kind: 'explosive', hp: 30, maxHp: 30,
    x: laneX(s.w, s.h, y, lane), y, radius: 21, dead: false, hitFlash: 0,
  });
}

function spawnObstacle(s, lane = 1) {
  const y = s.h * 0.2;
  s.obstacles.push({
    lane, x: laneX(s.w, s.h, y, lane), y,
    radius: roadHalfWidth(s.w, s.h, y) * 0.2, passed: false, dead: false,
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
  s.powerFlash = 1.15;
  if (barrel.kind === 'weapon') {
    if (s.weapon === 'pistol') {
      s.weapon = 'smg';
      s.weaponLevel.smg = 1;
      events.push({ type: 'reward', label: '기관단총 획득 · 연사 화력 강화' });
    } else {
      s.weaponLevel.smg = Math.min(5, s.weaponLevel.smg + 1);
      s.damageBonus += 1;
      events.push({ type: 'reward', label: '기관단총 강화 Lv.' + s.weaponLevel.smg });
    }
  } else if (barrel.kind === 'upgrade') {
    const key = s.weapon;
    s.weaponLevel[key] = Math.min(5, (s.weaponLevel[key] || 1) + 1);
    s.damageBonus += key === 'smg' ? 2 : 4;
    events.push({
      type: 'reward',
      label: key === 'smg' ? '기관단총 강화 · 관통탄 Lv.' + s.weaponLevel[key] : '권총 강화 · 화력 +4',
    });
  } else if (barrel.kind === 'companion') {
    if (s.companions.length < 2) {
      s.companions.push({ id: s.companions.length + 1, fireTimer: 0.2 + s.companions.length * 0.12 });
      events.push({ type: 'reward', label: '동료 합류 · 후방 자동 사격' });
    } else {
      s.companionPower = Math.min(1.6, s.companionPower + 0.2);
      events.push({ type: 'reward', label: '동료 화력 강화 +20%' });
    }
  }
  s.barrelsBroken++;
  s.score += 35;
  if (barrel.offer) {
    for (const other of s.barrels) {
      if (other !== barrel && other.offer === barrel.offer) other.dead = true;
    }
  }
  events.push('barrelDown');
}

function addHitEffect(s, x, y, radius = 12) {
  s.effects.push({ kind: 'hit', x, y, life: 0.18, total: 0.18, radius });
}

function killZombie(s, zombie, sourceX, events) {
  if (zombie.dead) return;
  zombie.dead = true;
  zombie.dying = 0.48;
  zombie.deathSide = Math.sign(zombie.x - sourceX) || (zombie.phase % 2 ? -1 : 1);
  s.kills++;
  s.score += zombie.kind === 'runner' ? 15 : 10;
  events.push('kill');
}

function damageZombie(s, zombie, damage, sourceX, events, quiet = false) {
  if (zombie.dead) return;
  zombie.hp -= damage;
  zombie.hitFlash = 0.14;
  zombie.recoilX = (zombie.x >= sourceX ? 1 : -1) * 14;
  zombie.recoilY = 105;
  addHitEffect(s, zombie.x, zombie.y - 15, 10);
  if (!quiet) events.push('hit');
  if (zombie.hp <= 0) killZombie(s, zombie, sourceX, events);
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
      damageZombie(s, zombie, 65, point.x, events, true);
    }
    if (s.boss && Math.hypot(s.boss.x - point.x, s.boss.y - point.y) < radius * 0.85) {
      s.boss.hp -= 65;
      s.boss.hitFlash = 0.16;
      if (s.boss.hp <= 0) defeatBoss(s, events);
    }
    s.effects.push({ kind: 'explosion', x: point.x, y: point.y, life: 0.62, total: 0.62, radius });
  }
  events.push('explosion');
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

function findTarget(s, fromX = s.x, fromY = s.y - 28) {
  const side = roadHalfWidth(s.w, s.h, s.y) * 1.15;
  const targets = [];
  for (const zombie of s.zombies) if (!zombie.dead) targets.push(zombie);
  for (const barrel of s.barrels) if (!barrel.dead) targets.push(barrel);
  if (s.boss) targets.push(s.boss);
  let best = null, bestScore = Infinity;
  for (const target of targets) {
    const dx = Math.abs(target.x - fromX);
    const dy = fromY - target.y;
    if (dy < 12 || dx > side) continue;
    const isSupply = target.kind === 'weapon' || target.kind === 'upgrade' || target.kind === 'companion';
    const isExplosive = target.kind === 'explosive';
    const bossFocus = target === s.boss ? 320 : 0;
    const priority = isSupply ? 34 : isExplosive ? 40 : bossFocus;
    const score = dy * 0.22 + dx * 1.8 - priority;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}

function shoot(s, events, owner = 'player', fromX = s.x, fromY = s.y - 28, damageScale = 1) {
  const target = findTarget(s, fromX, fromY);
  const tx = target ? target.x : fromX;
  const ty = target ? target.y : s.h * 0.16;
  const dx = tx - fromX, dy = ty - fromY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const smg = s.weapon === 'smg';
  const damage = ((smg ? 7 : 10) + s.damageBonus) * damageScale;
  const spreads = owner === 'player' && smg && s.weaponLevel.smg >= 3 ? [-0.075, 0, 0.075] : [0];
  for (const spread of spreads) {
    s.bullets.push({
      x: fromX, y: fromY,
      vx: (dx / length + spread) * 760, vy: dy / length * 760,
      damage: damage * (spread ? 0.68 : 1), weapon: s.weapon, owner, life: 1.25,
    });
  }
  events.push(owner === 'player' ? 'shot' : 'allyShot');
}

function damageTarget(s, target, damage, events, sourceX) {
  if (target === s.boss) {
    target.hp -= damage;
    target.hitFlash = 0.13;
    events.push('hit');
    if (target.hp <= 0) defeatBoss(s, events);
    return;
  }
  if (target.kind === 'walker' || target.kind === 'runner') {
    damageZombie(s, target, damage, sourceX, events);
    return;
  }
  target.hp -= damage;
  target.hitFlash = 0.12;
  events.push('hit');
  if (target.hp > 0) return;
  if (target.kind === 'explosive') {
    target.dead = true;
    s.barrelsBroken++;
    s.score += 20;
    addExplosion(s, target.x, target.y, s.w * 0.24, events);
  } else {
    target.dead = true;
    rewardBarrel(s, target, events);
  }
}

function spawnWaves(s) {
  while (s.waveIndex < WAVE_PLAN.length) {
    const wave = WAVE_PLAN[s.waveIndex];
    if (s.waveSpawned >= wave.count) {
      s.waveIndex++;
      s.waveSpawned = 0;
      continue;
    }
    const spawnAt = wave.start + s.waveSpawned * wave.interval;
    if (s.t < spawnAt) break;
    spawnZombie(s, wave.pattern[s.waveSpawned % wave.pattern.length]);
    s.waveSpawned++;
  }
}

function spawnScriptedObjects(s) {
  if (s.t >= 10 && !s.firstChoiceSpawned) {
    s.firstChoiceSpawned = true;
    spawnBarrelPair(s, [
      { lane: 0, kind: 'companion', hp: 30 },
      { lane: 2, kind: 'weapon', hp: 40 },
    ]);
  }
  if (s.t >= 30 && !s.explosivesSpawned) {
    s.explosivesSpawned = true;
    spawnExplosiveBarrel(s, 0);
    spawnExplosiveBarrel(s, 1);
  }
  if (s.t >= 40 && !s.secondChoiceSpawned) {
    s.secondChoiceSpawned = true;
    spawnBarrelPair(s, [
      { lane: 0, kind: 'upgrade', hp: 80 },
      { lane: 2, kind: 'companion', hp: 50 },
    ]);
  }
  if (s.t >= 45 && !s.obstacleSpawned) {
    s.obstacleSpawned = true;
    spawnObstacle(s, 1);
  }
}

function updateBoss(s, dt, events) {
  if (s.t >= 65 && !s.bossStarted) {
    s.bossStarted = true;
    const y = s.h * 0.2;
    s.boss = {
      x: s.w * 0.5, y, hp: 450, maxHp: 450,
      phase: 0, attackTimer: 1.65, warning: 0, attackLane: 1, hitFlash: 0,
    };
    events.push('bossStart');
  }
  if (!s.boss) return;
  const boss = s.boss;
  boss.phase += dt;
  boss.x = s.w * 0.5 + Math.sin(boss.phase * 0.8) * roadHalfWidth(s.w, s.h, boss.y) * 0.36;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  if (boss.warning > 0) {
    boss.warning -= dt;
    if (boss.warning <= 0) {
      const x = laneX(s.w, s.h, s.h * 0.75, boss.attackLane);
      s.effects.push({
        kind: 'slam', x, y: s.h * 0.75,
        radius: roadHalfWidth(s.w, s.h, s.h * 0.75) * 0.2,
        lane: boss.attackLane, life: 0.62, total: 0.62,
      });
      if (closestLane(s, s.x) === boss.attackLane) hurtPlayer(s, 18, events);
      boss.attackTimer = 3.05;
      events.push('bossSlam');
    }
  } else {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackLane = closestLane(s, s.x);
      boss.warning = 1.25;
      events.push('bossWarn');
    }
  }
}

function updateObstacle(s, dt, events) {
  for (const obstacle of s.obstacles) {
    if (obstacle.dead) continue;
    obstacle.y += s.h * 0.18 * dt;
    obstacle.x = laneX(s.w, s.h, obstacle.y, obstacle.lane);
    if (!obstacle.passed && obstacle.y >= s.y - 48) {
      obstacle.passed = true;
      if (closestLane(s, s.x) === obstacle.lane) hurtPlayer(s, 16, events);
    }
    if (obstacle.y > s.h + 80) obstacle.dead = true;
  }
}

export function updateGame(s, dt, targetX) {
  if (s.finished) return [];
  const events = [];
  dt = Math.min(0.04, Math.max(0, dt));
  s.t = Math.min(STAGE_DURATION, s.t + dt);
  s.distance = Math.floor(s.t * 10);
  s.roadOffset = (s.roadOffset + dt * 0.42) % 1;
  s.y = s.h * 0.76;
  s.powerFlash = Math.max(0, s.powerFlash - dt);
  if (targetX != null) {
    const reach = roadHalfWidth(s.w, s.h, s.y) * 0.88;
    s.targetX = clamp(targetX, s.w * 0.5 - reach, s.w * 0.5 + reach);
  }
  s.x += (s.targetX - s.x) * Math.min(1, dt * 12);
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.flash = Math.max(0, s.flash - dt);

  while (s.cueIndex < PHASE_CUES.length && s.t >= PHASE_CUES[s.cueIndex].at) {
    const cue = PHASE_CUES[s.cueIndex++];
    events.push({ type: 'cue', label: cue.label, duration: cue.duration });
  }
  spawnWaves(s);
  spawnScriptedObjects(s);
  updateBoss(s, dt, events);

  for (const zombie of s.zombies) {
    if (zombie.dead) { zombie.dying -= dt; continue; }
    zombie.hitFlash = Math.max(0, zombie.hitFlash - dt);
    zombie.recoilX *= Math.exp(-dt * 8);
    zombie.recoilY *= Math.exp(-dt * 8);
    zombie.y += zombie.speed * dt - zombie.recoilY * dt;
    zombie.x = laneX(s.w, s.h, zombie.y, zombie.lane) + Math.sin(s.t * 2.1 + zombie.phase) * 3 + zombie.recoilX;
    if (zombie.y >= s.y - 24) {
      if (Math.abs(zombie.x - s.x) < zombie.radius + 20) hurtPlayer(s, zombie.kind === 'runner' ? 15 : 10, events);
      zombie.dead = true;
      zombie.dying = 0.22;
    }
  }
  for (const barrel of s.barrels) {
    barrel.y += s.h * 0.19 * dt;
    barrel.x = laneX(s.w, s.h, barrel.y, barrel.lane);
    barrel.hitFlash = Math.max(0, barrel.hitFlash - dt);
    if (barrel.y >= s.y - 28) barrel.dead = true;
  }
  updateObstacle(s, dt, events);

  s.target = findTarget(s);
  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    shoot(s, events);
    s.fireTimer = s.weapon === 'smg' ? Math.max(0.075, 0.12 - (s.weaponLevel.smg || 1) * 0.008) : 0.25;
  }
  for (let index = 0; index < s.companions.length; index++) {
    const companion = s.companions[index];
    companion.fireTimer -= dt;
    if (companion.fireTimer <= 0) {
      const offset = (index === 0 ? -1 : 1) * Math.min(31, 19 + index * 5);
      shoot(s, events, 'companion', s.x + offset, s.y - 8, 0.5 * s.companionPower);
      companion.fireTimer = s.weapon === 'smg' ? 0.14 : 0.25;
    }
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
      damageTarget(s, barrel, bullet.damage, events, bullet.x);
      bullet.dead = true; hit = true; break;
    }
    if (hit) continue;
    for (const zombie of s.zombies) {
      if (zombie.dead) continue;
      if (Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y) > zombie.radius + 5) continue;
      damageTarget(s, zombie, bullet.damage, events, bullet.x);
      bullet.dead = true; hit = true; break;
    }
    if (hit) continue;
    if (s.boss && Math.hypot(bullet.x - s.boss.x, bullet.y - s.boss.y) < 58) {
      damageTarget(s, s.boss, bullet.damage, events, bullet.x);
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
  s.zombies = s.zombies.filter(zombie => !zombie.dead || zombie.dying > 0);
  s.barrels = s.barrels.filter(barrel => !barrel.dead);
  s.obstacles = s.obstacles.filter(obstacle => !obstacle.dead);
  s.bullets = s.bullets.filter(bullet => !bullet.dead && bullet.y > -20 && bullet.y < s.h + 20);
  s.hazards = s.hazards.filter(hazard => !hazard.dead && hazard.y < s.h + 30 && hazard.x > -30 && hazard.x < s.w + 30);
  s.effects = s.effects.filter(effect => effect.life > 0);

  if (s.t >= STAGE_DURATION && !s.finished) {
    s.finished = s.bossDefeated ? 'win' : 'lose';
    events.push(s.bossDefeated ? 'win' : 'timeout');
    if (!s.bossDefeated) events.push('lose');
  }
  s.score = Math.floor(s.score);
  s.events = events;
  return events;
}

