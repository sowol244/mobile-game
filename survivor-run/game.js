const UPGRADE = [
  { kind: 'squad', label: '+2 생존자' },
  { kind: 'rapid', label: '연사 +20%' },
  { kind: 'power', label: '화력 +1' },
  { kind: 'heal', label: '방패 +1' },
];

export function createGame(w, h) {
  return {
    w, h, t: 0, playing: true, finished: null,
    x: w / 2, targetX: w / 2, y: h * 0.79,
    hp: 3, maxHp: 3, squad: 3, fireRate: 0.42, firePower: 1,
    score: 0, kills: 0, distance: 0, bosses: 0,
    roadOffset: 0, fireTimer: 0.2, spawnTimer: 0.8,
    gateTimer: 5.5, gateNo: 0, bossTimer: 14,
    invulnerable: 0, flash: 0, boss: null, bossNo: 0,
    zombies: [], bullets: [], hazards: [], gates: [], pickups: [],
    events: [],
  };
}

export function resizeGame(s, w, h) {
  const sx = w / s.w, sy = h / s.h;
  s.x *= sx;
  s.targetX *= sx;
  s.y = h * 0.79;
  for (const list of [s.zombies, s.bullets, s.hazards, s.gates, s.pickups]) {
    for (const item of list) { item.x *= sx; item.y *= sy; }
  }
  if (s.boss) { s.boss.x *= sx; s.boss.y = h * 0.2; }
  s.w = w; s.h = h;
}

function spawnZombie(s) {
  const lane = Math.floor(Math.random() * 3);
  const roadL = s.w * 0.18, roadW = s.w * 0.64;
  const x = roadL + roadW * (lane + 0.5) / 3 + (Math.random() - 0.5) * roadW * 0.12;
  const r = Math.random();
  const kind = r < 0.16 ? 'runner' : r > 0.86 ? 'brute' : 'walker';
  const hp = kind === 'brute' ? 4 : kind === 'runner' ? 1 : 2;
  s.zombies.push({
    kind, x, y: -28, homeX: x,
    r: kind === 'brute' ? 20 : kind === 'runner' ? 12 : 15,
    hp, maxHp: hp,
    speed: (kind === 'runner' ? 82 : kind === 'brute' ? 35 : 53) + Math.min(30, s.t * 0.28),
    phase: Math.random() * 8,
  });
}

function spawnGate(s) {
  const left = UPGRADE[s.gateNo % UPGRADE.length];
  let right = UPGRADE[(s.gateNo + 1 + Math.floor(s.gateNo / UPGRADE.length)) % UPGRADE.length];
  if (left.kind === right.kind) right = UPGRADE[(s.gateNo + 2) % UPGRADE.length];
  s.gates.push({ y: -52, left, right, checked: false });
  s.gateNo++;
}

function upgrade(s, choice) {
  if (choice.kind === 'squad') {
    const before = s.squad;
    s.squad = Math.min(12, s.squad + 2);
    return before === 12 ? '생존자 최대' : '생존자 합류 +' + (s.squad - before);
  }
  if (choice.kind === 'rapid') {
    const before = s.fireRate;
    s.fireRate = Math.max(0.18, s.fireRate * 0.8);
    return before === s.fireRate ? '연사 최대' : '연사 강화';
  }
  if (choice.kind === 'power') {
    const before = s.firePower;
    s.firePower = Math.min(4, s.firePower + 1);
    return before === 4 ? '화력 최대' : '화력 강화';
  }
  s.maxHp = Math.min(5, s.maxHp + 1);
  s.hp = Math.min(s.maxHp, s.hp + 1);
  return '방패 충전';
}

function hitPlayer(s, events) {
  if (s.invulnerable > 0 || s.finished) return;
  s.hp = Math.max(0, s.hp - 1);
  s.invulnerable = 1.05;
  s.flash = 0.28;
  events.push('hurt');
  if (s.hp === 0) {
    s.finished = 'lose';
    s.playing = false;
    events.push('lose');
  }
}

function popZombie(s, z, events) {
  z.dead = true;
  s.kills++;
  s.score += z.kind === 'brute' ? 140 : z.kind === 'runner' ? 110 : 90;
  events.push('kill');
  if (z.kind === 'runner' && Math.random() < 0.4) {
    s.pickups.push({ x: z.x, y: z.y, kind: 'survivor', vy: 52, phase: Math.random() * 8 });
  }
}

export function updateGame(s, dt, targetX) {
  if (!s.playing) return [];
  const events = [];
  dt = Math.min(0.04, Math.max(0, dt));
  s.t += dt;
  s.distance = Math.floor(s.t * 12);
  s.score += dt * 4;
  s.y = s.h * 0.79;
  if (targetX != null) s.targetX = Math.max(s.w * 0.2, Math.min(s.w * 0.8, targetX));
  s.x += (s.targetX - s.x) * Math.min(1, dt * 12);
  s.roadOffset = (s.roadOffset + dt * 205) % 120;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.flash = Math.max(0, s.flash - dt);

  if (!s.boss && s.bosses < 3 && s.t >= s.bossTimer) {
    s.bossNo = s.bosses + 1;
    s.boss = { x: s.w / 2, y: s.h * 0.2, hp: 20 + s.bossNo * 8, maxHp: 20 + s.bossNo * 8, phase: 0, shotTimer: 1.5 };
    s.zombies = [];
    events.push('bossStart');
  }

  if (!s.boss) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      spawnZombie(s);
      s.spawnTimer = Math.max(0.58, 1.42 - s.t * 0.004) * (0.76 + Math.random() * 0.42);
    }
    s.gateTimer -= dt;
    if (s.gateTimer <= 0) {
      spawnGate(s);
      s.gateTimer = 10.5;
    }
  }

  if (s.boss) {
    const b = s.boss;
    b.phase += dt;
    b.x = s.w / 2 + Math.sin(b.phase * 0.72) * s.w * 0.22;
    b.shotTimer -= dt;
    if (b.shotTimer <= 0) {
      const lane = Math.floor(Math.random() * 3);
      const roadL = s.w * 0.18, roadW = s.w * 0.64;
      s.hazards.push({ x: roadL + roadW * (lane + 0.5) / 3, y: b.y + 36, vy: 170, r: 11 });
      b.shotTimer = Math.max(0.85, 1.55 - s.bossNo * 0.12);
      events.push('bossShot');
    }
  }

  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    const count = Math.min(7, s.squad);
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * Math.min(12, s.w * 0.031);
      s.bullets.push({ x: s.x + offset, y: s.y - 18, vy: 510, damage: s.firePower, r: 3.5 });
    }
    s.fireTimer = s.fireRate;
    events.push('shot');
  }

  for (const z of s.zombies) {
    z.y += z.speed * dt;
    z.x = z.homeX + Math.sin(s.t * 1.15 + z.phase) * 5;
    if (z.y >= s.y - 22) {
      if (Math.abs(z.x - s.x) < z.r + 13) hitPlayer(s, events);
      z.dead = true;
    }
  }

  for (const b of s.bullets) b.y -= b.vy * dt;
  for (const b of s.bullets) {
    if (b.dead) continue;
    if (s.boss && Math.abs(b.x - s.boss.x) < 46 && Math.abs(b.y - s.boss.y) < 42) {
      s.boss.hp -= b.damage;
      b.dead = true;
      events.push('hit');
      if (s.boss.hp <= 0) {
        s.boss = null;
        s.bosses++;
        s.score += 650;
        events.push('bossDown');
        if (s.bosses >= 3) {
          s.finished = 'win';
          s.playing = false;
          events.push('win');
        } else {
          s.bossTimer = s.t + 12;
        }
      }
      continue;
    }
    for (const z of s.zombies) {
      if (z.dead || Math.abs(b.x - z.x) > z.r + 4 || Math.abs(b.y - z.y) > z.r + 5) continue;
      z.hp -= b.damage;
      b.dead = true;
      events.push('hit');
      if (z.hp <= 0) popZombie(s, z, events);
      break;
    }
  }

  for (const h of s.hazards) {
    h.y += h.vy * dt;
    if (Math.abs(h.x - s.x) < h.r + 12 && Math.abs(h.y - s.y) < h.r + 12) {
      hitPlayer(s, events);
      h.dead = true;
    }
  }

  for (const g of s.gates) {
    g.y += 154 * dt;
    if (!g.checked && g.y >= s.y - 14) {
      g.checked = true;
      const leftX = s.w * 0.34, rightX = s.w * 0.66;
      const dl = Math.abs(s.x - leftX), dr = Math.abs(s.x - rightX);
      if (Math.min(dl, dr) < s.w * 0.13) {
        const label = upgrade(s, dl < dr ? g.left : g.right);
        events.push({ type: 'gate', label });
      } else events.push({ type: 'gateMiss' });
    }
  }

  for (const p of s.pickups) {
    p.y += p.vy * dt;
    p.phase += dt * 4;
    if (Math.hypot(p.x - s.x, p.y - s.y) < 28) {
      p.dead = true;
      s.squad = Math.min(12, s.squad + 1);
      s.score += 35;
      events.push('pickup');
    }
  }

  s.zombies = s.zombies.filter(z => !z.dead && z.y < s.h + 30);
  s.bullets = s.bullets.filter(b => !b.dead && b.y > -20);
  s.hazards = s.hazards.filter(h => !h.dead && h.y < s.h + 30);
  s.gates = s.gates.filter(g => g.y < s.h + 70);
  s.pickups = s.pickups.filter(p => !p.dead && p.y < s.h + 30);
  s.score = Math.floor(s.score);
  s.events = events;
  return events;
}
