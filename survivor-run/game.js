import {
  collectStageActions, createStageRuntime, DEFAULT_STAGE_ID, getStageDefinition,
} from './stages/stageManager.js?v=20261015q';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export { DEFAULT_STAGE_ID, getStageDefinition };
export const BOSS_START_AT = getStageDefinition().boss.startAt;
export const BOSS_WARNING_AT = getStageDefinition().boss.warningAt;
export const PLAYER_BASE_Y_RATIO = 0.84;
export const DEFENSE_LINE_Y_RATIO = 0.95;
export const MAX_PASS_DAMAGE_PER_SECOND = 14;
export const DIRECT_HIT_INVULNERABILITY = 0.85;
export const MOVE_TUTORIAL_DELAY = 0.9;
export const MOVE_TUTORIAL_DURATION = 2;
export const AIM_ASSIST_ANGLE = 14;
const AIM_ASSIST_ANGLE_RADIANS = AIM_ASSIST_ANGLE * Math.PI / 180;
const AIM_ASSIST_DISTANCE_TIE_EPSILON = 8;
const MAX_ACTIVE_BARRELS = 2;
export const BARREL_CONFIG = Object.freeze({
  companion: Object.freeze({ hp: 40, color: '#75836f' }),
  drone: Object.freeze({ hp: 70, color: '#a65ae8' }),
  rocket: Object.freeze({ hp: 100, color: '#f18a3f' }),
  rapidfire: Object.freeze({ hp: 35, color: '#b99a50' }),
  heal: Object.freeze({ hp: 35, color: '#4cc878' }),
  explosive: Object.freeze({ hp: 30, color: '#8d4937' }),
  twin: Object.freeze({ hp: 58, color: '#8aa0a4' }),
});
export const SUPPORT_CONFIG = Object.freeze({
  companionMaxCount: 2,
  companionSlotOffset: 52,
  companionSlotSpacing: 26,
  companionDamage: 4.5,
  companionDuplicatePower: 0.25,
  companionMaxPower: 2,
  companionFireInterval: 0.26,
  droneDuration: 8,
  droneDuplicateExtension: 4,
  droneMaxDuration: 12,
  droneDamage: 12,
  droneFireInterval: 0.5,
  droneRangeRatio: 0.72,
  rocketCount: 3,
  rocketDamage: 80,
  rocketInterval: 0.8,
  rocketFlightTime: 0.52,
  rapidFireDuration: 8,
  rapidFireDuplicateExtension: 4,
  rapidFireMaxDuration: 12,
  rapidFireMultiplier: 0.77,
  healAmount: 25,
});

function companionOffset(slot) {
  return SUPPORT_CONFIG.companionSlotOffset + SUPPORT_CONFIG.companionSlotSpacing * slot;
}
export const ZOMBIE_DAMAGE = Object.freeze({
  normal: Object.freeze({ pass: 2, collision: 9 }),
  fast: Object.freeze({ pass: 3, collision: 10 }),
  tanker: Object.freeze({ pass: 8, collision: 18 }),
  explosive: Object.freeze({ pass: 6, collision: 14 }),
  boss: Object.freeze({ pass: 16, collision: 25 }),
});

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

export function createGame(w, h, stageId = DEFAULT_STAGE_ID) {
  const stageDefinition = getStageDefinition(stageId);
  return {
    w, h, t: 0, finished: null,
    stageId: stageDefinition.id, stageDefinition,
    stageRuntime: createStageRuntime(stageDefinition.id),
    x: w * 0.5, targetX: w * 0.5, y: h * PLAYER_BASE_Y_RATIO, playerMoveAmount: 0,
    hp: 100, maxHp: 100, invulnerable: 0, flash: 0, hitShake: 0,
    passDamageWindow: 0, passDamageTaken: 0, defenseFlash: 0,
    moveTutorialShown: !stageDefinition.showMoveTutorial, moveTutorialVisible: false, moveTutorialTimer: 0,
    hasPlayerMoved: false, showAimGuide: false,
    weapon: 'pistol', weaponLevel: { pistol: 1, smg: 0, twin: 0 },
    damageBonus: 0, damageMultiplier: 1, fireTimer: 0.15, powerFlash: 0,
    playerMuzzleFlash: 0, playerRecoil: 0, killStreak: 0, killStreakTimer: 0,
    companions: [], nextCompanionId: 1, companionPower: 1, drone: null, rocketAmmo: 0, rocketTimer: 0,
    missiles: [], particles: [], rapidFireTimer: 0,
    score: 0, kills: 0, barrelsBroken: 0, distance: 0,
    roadOffset: 0,
    boss: null, bossStarted: false, bossDefeated: false, bossWarningShown: false, bossAlertTimer: 0,
    permanentRapidFire: false,
    zombies: [], barrels: [], obstacles: [], bullets: [], hazards: [], effects: [],
    target: null, events: [],
  };
}

export function resizeGame(s, w, h) {
  const sx = w / s.w, sy = h / s.h;
  s.x *= sx;
  s.targetX *= sx;
  s.y = h * PLAYER_BASE_Y_RATIO;
  for (const item of [...s.zombies, ...s.barrels, ...s.obstacles, ...s.bullets, ...s.hazards, ...s.effects, ...s.particles, ...s.missiles]) {
    item.x *= sx;
    item.y *= sy;
    if (item.targetX != null) item.targetX *= sx;
    if (item.targetY != null) item.targetY *= sy;
    if (item.vx != null) item.vx *= sx;
    if (item.vy != null) item.vy *= sy;
    if (item.recoilX != null) item.recoilX *= sx;
  }
  for (const companion of s.companions) {
    companion.x *= sx;
    companion.y = s.y + 27;
  }
  if (s.drone) {
    s.drone.x *= sx;
    s.drone.y = s.y - h * 0.16;
  }
  if (s.boss) {
    const bossConfig = s.stageDefinition.boss;
    s.boss.x *= sx;
    const entryProgress = clamp(s.boss.entryProgress ?? 1, 0, 1);
    s.boss.entryStartY = h * bossConfig.startY;
    s.boss.entryEndY = h * bossConfig.endY;
    s.boss.y = s.boss.entryTimer > 0
      ? s.boss.entryStartY + (s.boss.entryEndY - s.boss.entryStartY) * entryProgress
      : s.boss.entryEndY;
    s.boss.moveSpeed = (s.boss.moveSpeed || 0) * sx;
    if (s.boss.attackOriginX != null) s.boss.attackOriginX *= sx;
    if (s.boss.attackImpactX != null) s.boss.attackImpactX *= sx;
  }
  s.w = w;
  s.h = h;
}

export function applyPlayerDrag(s, deltaX) {
  if (!Number.isFinite(deltaX) || deltaX === 0) return s.targetX;
  const reach = roadHalfWidth(s.w, s.h, s.y) * 0.88;
  s.targetX = clamp(s.targetX + deltaX, s.w * 0.5 - reach, s.w * 0.5 + reach);
  return s.targetX;
}

function spawnZombie(s, forcedKind, forcedLane) {
  if (s.zombies.filter(zombie => !zombie.dead).length >= s.stageDefinition.maxActiveZombies) return;
  const kind = forcedKind || 'walker';
  const lane = Number.isInteger(forcedLane) ? clamp(forcedLane, 0, 2) : Math.floor(Math.random() * 3);
  const y = s.h * (0.15 + Math.random() * 0.035);
  const stageTwo = s.stageId === 'stage02';
  const hp = kind === 'tank' || kind === 'tanker'
    ? (stageTwo ? 112 : 150)
    : kind === 'runner' ? (stageTwo ? 12 : 15) : (stageTwo ? 16 : s.stageId === 'stage01' ? 15 : 20);
  s.zombies.push({
    kind, lane, x: laneX(s.w, s.h, y, lane), y,
    hp, maxHp: hp, radius: kind === 'tank' || kind === 'tanker' ? 25 : kind === 'runner' ? 13 : 16,
    speed: s.h * (kind === 'tank' || kind === 'tanker' ? 0.17 : kind === 'runner' ? 0.42 : 0.26)
      * (stageTwo ? 0.92 : s.stageId === 'stage01' ? 0.84 : 1) * (1 + Math.min(0.2, s.t / 500)),
    phase: Math.random() * Math.PI * 2, dead: false, dying: 0,
    hitFlash: 0, recoilX: 0, recoilY: 0, deathSide: 1, hasAppliedDamage: false,
  });
}

function activeBarrelCount(s) {
  return s.barrels.reduce((count, barrel) => count + (!barrel.dead ? 1 : 0), 0);
}

function spawnBarrelOffer(s, rewards) {
  if (activeBarrelCount(s) + Math.min(MAX_ACTIVE_BARRELS, rewards.length) > MAX_ACTIVE_BARRELS) return;
  const offer = {};
  for (const item of rewards.slice(0, MAX_ACTIVE_BARRELS)) {
    const y = s.h * 0.18;
    s.barrels.push({
      lane: item.lane, kind: item.kind, hp: item.hp || BARREL_CONFIG[item.kind]?.hp || 40, maxHp: item.hp || BARREL_CONFIG[item.kind]?.hp || 40,
      x: laneX(s.w, s.h, y, item.lane), y, radius: 23, dead: false, hitFlash: 0, hitShake: 0, offer,
    });
  }
}

function spawnRewardBarrel(s, lane, kind, options = {}) {
  if (activeBarrelCount(s) >= MAX_ACTIVE_BARRELS) return;
  const hp = options.hp || BARREL_CONFIG[kind]?.hp || 40;
  const y = s.h * 0.18;
  s.barrels.push({
    lane, kind, hp, maxHp: hp, permanent: Boolean(options.permanent),
    x: laneX(s.w, s.h, y, lane), y, radius: 23, dead: false, hitFlash: 0, hitShake: 0,
  });
}

function spawnExplosiveBarrel(s, lane) {
  if (activeBarrelCount(s) >= MAX_ACTIVE_BARRELS) return;
  const y = s.h * 0.17;
  s.barrels.push({
    lane, kind: 'explosive', hp: 30, maxHp: 30,
    x: laneX(s.w, s.h, y, lane), y, radius: 23, dead: false, hitFlash: 0, hitShake: 0,
  });
}

function spawnObstacle(s, lane = 1) {
  const y = s.h * 0.2;
  s.obstacles.push({
    lane, x: laneX(s.w, s.h, y, lane), y,
    radius: roadHalfWidth(s.w, s.h, y) * 0.2, passed: false, dead: false,
  });
}

function hurtPlayer(s, damage, events, options = {}) {
  if (s.finished || (!options.ignoreInvulnerability && s.invulnerable > 0)) return 0;
  const actualDamage = Math.min(s.hp, Math.max(0, damage));
  if (actualDamage <= 0) return 0;
  s.hp = clamp(s.hp - actualDamage, 0, s.maxHp);
  if (!options.ignoreInvulnerability && options.grantInvulnerability !== false) {
    s.invulnerable = DIRECT_HIT_INVULNERABILITY;
  }
  s.flash = 0.22;
  s.hitShake = Math.max(s.hitShake || 0, options.source === 'breach' ? 0.1 : 0.16);
  s.effects.push({
    kind: 'damageNumber',
    x: options.x == null ? s.x : options.x,
    y: options.y == null ? s.y - 42 : options.y,
    amount: actualDamage,
    source: options.source || 'hit',
    life: 0.82,
    total: 0.82,
  });
  events.push({ type: 'hurt', amount: actualDamage, source: options.source || 'hit' });
  if (s.hp <= 0) {
    s.finished = 'lose';
    events.push('lose');
  }
  return actualDamage;
}

function zombieDamageProfile(s, zombie) {
  if (s.stageId === 'stage02') {
    if (zombie.kind === 'runner') return { pass: 2, collision: 7 };
    if (zombie.kind === 'tank' || zombie.kind === 'tanker') return { pass: 7, collision: 18 };
    if (zombie.kind === 'explosive') return { pass: 5, collision: 12 };
    if (zombie.kind === 'boss' || zombie.kind === 'brute') return ZOMBIE_DAMAGE.boss;
    return { pass: 1, collision: 6 };
  }
  if (s.stageId === 'stage01') {
    if (zombie.kind === 'runner') return { pass: 2, collision: 8 };
    if (zombie.kind === 'tank' || zombie.kind === 'tanker') return { pass: 6, collision: 14 };
    if (zombie.kind === 'explosive') return { pass: 5, collision: 11 };
    if (zombie.kind === 'boss' || zombie.kind === 'brute') return ZOMBIE_DAMAGE.boss;
    return { pass: 1, collision: 7 };
  }
  if (zombie.kind === 'runner') return ZOMBIE_DAMAGE.fast;
  if (zombie.kind === 'tank' || zombie.kind === 'tanker') {
    return ZOMBIE_DAMAGE.tanker;
  }
  if (zombie.kind === 'explosive') return ZOMBIE_DAMAGE.explosive;
  if (zombie.kind === 'boss' || zombie.kind === 'brute') return ZOMBIE_DAMAGE.boss;
  return ZOMBIE_DAMAGE.normal;
}

function resolveZombieContact(s, zombie, contact, events) {
  if (zombie.dead || zombie.hasAppliedDamage) return;
  zombie.hasAppliedDamage = true;
  zombie.dead = true;
  zombie.dying = 0;

  const profile = zombieDamageProfile(s, zombie);
  if (contact === 'collision') {
    hurtPlayer(s, profile.collision, events, {
      source: 'collision',
      x: zombie.x,
      y: zombie.y - 12,
    });
    return;
  }

  const damageWindow = Math.floor(s.t);
  if (damageWindow !== s.passDamageWindow) {
    s.passDamageWindow = damageWindow;
    s.passDamageTaken = 0;
  }
  const passDamageLimit = s.stageDefinition.maxPassDamagePerSecond ?? MAX_PASS_DAMAGE_PER_SECOND;
  const available = Math.max(0, passDamageLimit - s.passDamageTaken);
  const requested = Math.min(profile.pass, available, s.hp);
  const lineY = s.h * DEFENSE_LINE_Y_RATIO;
  s.defenseFlash = Math.max(s.defenseFlash, 0.38);
  s.effects.push({ kind: 'breach', x: zombie.x, y: lineY, life: 0.38, total: 0.38 });
  const applied = hurtPlayer(s, requested, events, {
    ignoreInvulnerability: true,
    grantInvulnerability: false,
    source: 'breach',
    x: zombie.x,
    y: lineY - 15,
  });
  s.passDamageTaken = Math.min(passDamageLimit, s.passDamageTaken + applied);
}

function addParticle(s, particle) {
  s.particles.push(particle);
  if (s.particles.length > 140) s.particles.splice(0, s.particles.length - 140);
}

function spawnSmoke(s, x, y, count, radius, palette = ['#504f49', '#666157', '#797264']) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 35;
    addParticle(s, {
      kind: 'smoke', x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 12 - Math.random() * 12,
      life: 0.55 + Math.random() * 0.28, total: 0.83,
      size: radius * (0.22 + Math.random() * 0.24), growth: 11 + Math.random() * 13,
      color: palette[i % palette.length],
    });
  }
}

function spawnDebris(s, x, y, count, palette = ['#55564f', '#79776c', '#9a8464']) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 115;
    addParticle(s, {
      kind: 'debris', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 16,
      life: 0.28 + Math.random() * 0.22, total: 0.5, size: 1.6 + Math.random() * 2.1,
      rotation: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 12,
      color: palette[i % palette.length],
    });
  }
}

function spawnExplosionParticles(s, x, y, radius) {
  spawnSmoke(s, x, y, 13, Math.min(54, radius * 0.48));
  spawnDebris(s, x, y, 9, ['#4d514d', '#79776b', '#ad7444']);
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 90;
    addParticle(s, {
      kind: 'ember', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 24,
      life: 0.16 + Math.random() * 0.13, total: 0.29, size: 1 + Math.random() * 1.4,
      color: i % 2 ? '#c66b39' : '#d9a05b',
    });
  }
}

function spawnBarrelExplosionParticles(s, x, y, radius) {
  spawnSmoke(s, x, y, 9, Math.min(62, radius * 0.5), ['#504a41', '#756254', '#9b5f37']);
  spawnDebris(s, x, y, 15, ['#353a38', '#705042', '#a17648', '#b58d55']);
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 78 + Math.random() * 150;
    addParticle(s, {
      kind: 'ember', x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 28,
      life: 0.24 + Math.random() * 0.22, total: 0.46,
      size: 1.8 + Math.random() * 2.4,
      color: ['#ffd17b', '#f39b4f', '#d85732'][i % 3],
    });
  }
}

function barrelBreakEffect(s, barrel) {
  const color = BARREL_CONFIG[barrel.kind]?.color || '#f18a3f';
  const explosive = barrel.kind === 'explosive';
  s.effects.push({ kind: 'barrelBreak', x: barrel.x, y: barrel.y, color, explosive, life: explosive ? 0.55 : 0.36, total: explosive ? 0.55 : 0.36 });
  if (explosive) {
    s.hitShake = Math.max(s.hitShake || 0, 0.22);
    spawnDebris(s, barrel.x, barrel.y - 4, 11, ['#353a38', '#705042', '#a17648', '#b58d55']);
  } else {
    spawnSmoke(s, barrel.x, barrel.y - 4, 5, 23, ['#625e52', '#797468', '#82725b']);
    spawnDebris(s, barrel.x, barrel.y - 4, 7);
  }
}

function summonEffect(s, x, y) {
  s.effects.push({ kind: 'summon', x, y, color: '#918b78', life: 0.32, total: 0.32 });
  spawnSmoke(s, x, y, 4, 16, ['#777468', '#8b8575']);
}

function rewardBarrel(s, barrel, events) {
  s.powerFlash = 1.15;
  barrelBreakEffect(s, barrel);
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
  } else if (barrel.kind === 'twin') {
    s.weapon = 'twin';
    s.weaponLevel.twin = Math.min(5, (s.weaponLevel.twin || 0) + 1);
    events.push({
      type: 'reward',
      label: s.weaponLevel.twin === 1 ? '쌍열 기관총 · 이중 사격' : '쌍열 기관총 강화 Lv.' + s.weaponLevel.twin,
    });
  } else if (barrel.kind === 'upgrade') {
    const key = s.weapon;
    s.weaponLevel[key] = Math.min(5, (s.weaponLevel[key] || 1) + 1);
    s.damageMultiplier = Math.min(2, s.damageMultiplier + 0.25);
    events.push({
      type: 'reward',
      label: '공격력 +25% · 무기 Lv.' + s.weaponLevel[key],
    });
  } else if (barrel.kind === 'companion') {
    const active = s.companions.filter(companion => companion.life > 0);
    if (active.length < SUPPORT_CONFIG.companionMaxCount) {
      const occupiedSlots = new Set(active.map(companion => companion.slot));
      const slot = Array.from({ length: SUPPORT_CONFIG.companionMaxCount }, (_, index) => index)
        .find(index => !occupiedSlots.has(index)) ?? active.length % SUPPORT_CONFIG.companionMaxCount;
      const side = -1;
      const offsetX = -companionOffset(slot);
      s.companions.push({
        id: s.nextCompanionId++, side, slot, permanent: true,
        x: s.x + offsetX, y: s.y + 10 + slot * 8,
        life: Infinity, maxLife: Infinity,
        fireTimer: 0.16, appear: 0.4, exit: 0, recoil: 0, muzzleFlash: 0, phase: Math.random() * 6,
      });
      summonEffect(s, s.x + offsetX, s.y + 4);
      events.push({ type: 'reward', label: '지원 사수 +1' });
    } else {
      s.companionPower = Math.min(
        SUPPORT_CONFIG.companionMaxPower,
        s.companionPower + (s.stageDefinition.companionDuplicatePower ?? SUPPORT_CONFIG.companionDuplicatePower),
      );
      const bonus = Math.round((s.stageDefinition.companionDuplicatePower ?? SUPPORT_CONFIG.companionDuplicatePower) * 100);
      events.push({ type: 'reward', label: '지원 사수 공격력 +' + bonus + '%' });
    }
  } else if (barrel.kind === 'drone') {
    if (!s.drone || s.drone.life <= 0) {
      s.drone = {
        x: s.x, y: s.y - s.h * 0.16, life: SUPPORT_CONFIG.droneDuration,
        maxLife: SUPPORT_CONFIG.droneDuration, fireTimer: 0.2, appear: 0.42, exit: 0,
        phase: Math.random() * 6, recoil: 0, muzzleFlash: 0,
      };
      summonEffect(s, s.drone.x, s.drone.y);
      events.push({ type: 'reward', label: '드론 가동' });
    } else {
      s.drone.life = Math.min(SUPPORT_CONFIG.droneMaxDuration, s.drone.life + SUPPORT_CONFIG.droneDuplicateExtension);
      s.drone.maxLife = Math.max(s.drone.maxLife, s.drone.life);
      events.push({ type: 'reward', label: '드론 지속시간 +4초' });
    }
  } else if (barrel.kind === 'rocket') {
    s.rocketAmmo = Math.min(6, s.rocketAmmo + SUPPORT_CONFIG.rocketCount);
    events.push({ type: 'reward', label: '로켓 폭격 · 3발 준비' });
  } else if (barrel.kind === 'rapidfire') {
    if (barrel.permanent) {
      s.permanentRapidFire = true;
      events.push({ type: 'reward', label: '연사 속도 +30% · 스테이지 지속' });
    } else {
      s.rapidFireTimer = Math.min(
        SUPPORT_CONFIG.rapidFireMaxDuration,
        s.rapidFireTimer + (s.rapidFireTimer > 0 ? SUPPORT_CONFIG.rapidFireDuplicateExtension : SUPPORT_CONFIG.rapidFireDuration),
      );
      events.push({ type: 'reward', label: '연사 강화 · 8초' });
    }
  } else if (barrel.kind === 'heal') {
    const restored = Math.min(SUPPORT_CONFIG.healAmount, s.maxHp - s.hp);
    s.hp = Math.min(s.maxHp, s.hp + SUPPORT_CONFIG.healAmount);
    summonEffect(s, s.x, s.y - 12);
    events.push({ type: 'reward', label: restored > 0 ? '응급 키트 · 체력 +' + restored : '응급 키트 · 체력 안정' });
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

function addHitEffect(s, x, y, radius = 12, material = 'flesh') {
  s.effects.push({ kind: 'hit', material, x, y, life: 0.24, total: 0.24, radius });
}

function killZombie(s, zombie, sourceX, events) {
  if (zombie.dead) return;
  zombie.dead = true;
  zombie.dying = 0.48;
  zombie.deathSide = Math.sign(zombie.x - sourceX) || (zombie.phase % 2 ? -1 : 1);
  s.kills++;
  s.killStreak = s.killStreakTimer > 0 ? s.killStreak + 1 : 1;
  s.killStreakTimer = 1.25;
  const reward = zombie.kind === 'tank' || zombie.kind === 'tanker' ? 30 : zombie.kind === 'runner' ? 15 : 10;
  s.score += reward;
  s.effects.push({ kind: 'kill', x: zombie.x, y: zombie.y - 24, combo: s.killStreak, amount: reward, life: 0.62, total: 0.62 });
  s.hitShake = Math.max(s.hitShake, s.killStreak >= 3 ? 0.26 : 0.15);
  events.push({ type: 'kill', combo: s.killStreak });
}

function damageZombie(s, zombie, damage, sourceX, events, quiet = false) {
  if (zombie.dead) return;
  zombie.hp -= damage;
  zombie.hitFlash = 0.2;
  zombie.recoilX = (zombie.x >= sourceX ? 1 : -1) * 26;
  zombie.recoilY = 210;
  addHitEffect(s, zombie.x, zombie.y - 19, Math.max(10, zombie.radius * 0.78), 'flesh');
  if (!quiet) events.push('hit');
  if (zombie.hp <= 0) killZombie(s, zombie, sourceX, events);
}

function addExplosion(s, x, y, radius, events) {
  const damage = s.stageDefinition.explosiveDamage ?? 65;
  const queue = [{ x, y }];
  const exploded = new Set();
  while (queue.length) {
    const point = queue.shift();
    for (const other of s.barrels) {
      if (other.kind !== 'explosive' || other.dead || exploded.has(other)) continue;
      if (Math.hypot(other.x - point.x, other.y - point.y) <= radius) {
        other.dead = true;
        exploded.add(other);
        barrelBreakEffect(s, other);
        s.barrelsBroken++;
        s.score += 20;
        queue.push(other);
      }
    }
    for (const zombie of s.zombies) {
      if (zombie.dead || Math.hypot(zombie.x - point.x, zombie.y - point.y) > radius) continue;
      damageZombie(s, zombie, damage, point.x, events, true);
    }
    if (s.boss && s.boss.hp > 0 && Math.hypot(s.boss.x - point.x, s.boss.y - point.y) < radius * 0.85) {
      s.boss.hp -= damage;
      s.boss.hitFlash = 0.16;
      if (s.boss.hp <= 0) defeatBoss(s, events, point.x);
    }
    s.effects.push({ kind: 'explosion', source: 'barrel', x: point.x, y: point.y, life: 1.45, total: 1.45, radius });
    spawnBarrelExplosionParticles(s, point.x, point.y, radius);
  }
  events.push('explosion');
}

function explosiveRadius(s, y) {
  return s.stageDefinition.explosiveRadiusMode === 'lane'
    ? roadHalfWidth(s.w, s.h, y) * 0.72
    : s.w * 0.24;
}

function defeatBoss(s, events, impactX) {
  if (!s.boss || s.bossDefeated) return;
  const boss = s.boss;
  boss.hp = 0;
  boss.deathDuration = 2.35;
  boss.deathTimer = boss.deathDuration;
  boss.deathSide = Math.sign(boss.x - impactX) || (Math.sin(boss.phase + 0.5) >= 0 ? 1 : -1);
  boss.warning = 0;
  boss.attackTimer = Infinity;
  boss.hitFlash = 0.3;
  boss.hitShake = 0.34;
  s.bossDefeated = true;
  s.score += 500;
  const entryScale = 0.28 + 0.72 * smoothstep(clamp(boss.entryProgress ?? 1, 0, 1));
  const groundY = boss.y + 38 * entryScale;
  s.effects.push({ kind: 'bossFallDust', x: boss.x, y: groundY, life: 0.9, total: 0.9, radius: s.w * 0.2 });
  s.hitShake = Math.max(s.hitShake, 0.22);
  for (const zombie of s.zombies) {
    if (zombie.dead) continue;
    zombie.dead = true;
    zombie.dying = 0.32;
  }
  for (const barrel of s.barrels) barrel.dead = true;
  for (const obstacle of s.obstacles) obstacle.dead = true;
  s.bullets.length = 0;
  s.missiles.length = 0;
  s.hazards.length = 0;
  s.rocketAmmo = 0;
  events.push('bossDown');
}

export function findAimTarget(s, fromX = s.x, fromY = s.y - 28, includeBarrels = true) {
  const side = roadHalfWidth(s.w, s.h, s.y) * 1.15;
  const playerLane = closestLane(s, s.x);
  const targets = [];
  for (const zombie of s.zombies) if (!zombie.dead) targets.push(zombie);
  if (includeBarrels) for (const barrel of s.barrels) if (!barrel.dead) targets.push(barrel);
  if (s.boss && s.boss.hp > 0) targets.push(s.boss);

  let best = null, bestScore = Infinity, bestAngle = Infinity;
  for (const target of targets) {
    const dx = target.x - fromX;
    const dy = fromY - target.y;
    if (dy < 12 || Math.abs(dx) > side) continue;
    if (target.x < 0 || target.x > s.w || target.y < 0 || target.y > s.h) continue;

    const angle = Math.atan2(dx, dy);
    const angleFromForward = Math.abs(angle);
    if (angleFromForward > AIM_ASSIST_ANGLE_RADIANS) continue;

    const distance = Math.hypot(dx, dy);
    const targetLane = Number.isInteger(target.lane) ? target.lane : closestLane(s, target.x);
    const laneChoiceWeight = includeBarrels ? roadHalfWidth(s.w, s.h, target.y) * 0.72 : 0;
    const isBarrel = includeBarrels && s.barrels.includes(target);
    const barrelChoiceWeight = isBarrel && targetLane === playerLane
      ? roadHalfWidth(s.w, s.h, target.y) * 2.1
      : 0;
    const score = distance + Math.abs(targetLane - playerLane) * laneChoiceWeight - barrelChoiceWeight;
    const isCloser = score < bestScore - AIM_ASSIST_DISTANCE_TIE_EPSILON;
    const isSimilarDistance = Math.abs(score - bestScore) <= AIM_ASSIST_DISTANCE_TIE_EPSILON;
    if (isCloser || (isSimilarDistance && angleFromForward < bestAngle)) {
      best = target;
      bestScore = score;
      bestAngle = angleFromForward;
    }
  }
  return best;
}

function shoot(s, events, owner = 'player', fromX = s.x + (s.weapon === 'twin' ? 15 : 0), fromY = s.y - 28, damageScale = 1, targetOverride = null) {
  const target = targetOverride || findAimTarget(s, fromX, fromY, owner === 'player');
  if (owner === 'player') {
    s.target = target;
    s.playerMuzzleFlash = 0.075;
    s.playerRecoil = 0.11;
  }
  const aimAngle = target ? Math.atan2(target.x - fromX, fromY - target.y) : 0;
  const smg = s.weapon === 'smg';
  const twin = owner === 'player' && s.weapon === 'twin';
  const damage = owner === 'companion'
    ? SUPPORT_CONFIG.companionDamage * s.companionPower
    : owner === 'drone'
      ? SUPPORT_CONFIG.droneDamage
      : ((smg ? 7 : twin ? 8.5 : (s.stageDefinition.playerDamage ?? 10)) + s.damageBonus * (twin ? 0.65 : 1)) * damageScale * s.damageMultiplier;
  const spreads = owner === 'player' && smg && s.weaponLevel.smg >= 3 ? [-0.075, 0, 0.075] : [0];
  const shots = twin
    ? [-1, 1].map(side => ({ angleOffset: 0, sideOffset: side * (7 + (s.weaponLevel.twin - 1) * 0.7), damageScale: 1 }))
    : spreads.map(spread => ({ angleOffset: spread, sideOffset: 0, damageScale: spread ? 0.68 : 1 }));
  for (const shot of shots) {
    const angle = aimAngle + shot.angleOffset;
    s.bullets.push({
      x: fromX + Math.cos(angle) * shot.sideOffset,
      y: fromY + Math.sin(angle) * shot.sideOffset,
      vx: Math.sin(angle) * 760, vy: -Math.cos(angle) * 760,
      damage: damage * shot.damageScale, weapon: owner === 'drone' ? 'drone' : s.weapon, owner, life: 1.25,
      rapid: owner === 'player' && (s.permanentRapidFire || s.rapidFireTimer > 0),
    });
  }
  events.push(owner === 'player' ? 'shot' : 'allyShot');
}

function damageTarget(s, target, damage, events, sourceX) {
  if (target === s.boss) {
    if (target.hp <= 0) return;
    target.hp -= damage;
      target.hitFlash = 0.12;
    target.hitShake = 0.12;
    addHitEffect(s, target.x + (Math.random() - 0.5) * 42, target.y - 24 + (Math.random() - 0.5) * 35, 20, 'armor');
    events.push('hit');
    if (target.hp <= 0) defeatBoss(s, events, sourceX);
    return;
  }
  if (target.kind === 'walker' || target.kind === 'runner' || target.kind === 'tank' || target.kind === 'tanker') {
    damageZombie(s, target, damage, sourceX, events);
    return;
  }
  target.hp = Math.max(0, target.hp - damage);
  target.hitFlash = 0.12;
  target.hitShake = 0.13;
  addHitEffect(s, target.x, target.y - 12, 13, 'metal');
  events.push('hit');
  if (target.hp > 0) return;
  if (target.kind === 'explosive') {
    target.dead = true;
    barrelBreakEffect(s, target);
    s.barrelsBroken++;
    s.score += 20;
    addExplosion(s, target.x, target.y, explosiveRadius(s, target.y), events);
  } else {
    target.dead = true;
    rewardBarrel(s, target, events);
  }
}

function findDroneTarget(s, fromX, fromY) {
  const playerLane = closestLane(s, s.x);
  const maxRange = s.h * SUPPORT_CONFIG.droneRangeRatio;
  const candidates = s.zombies.filter(zombie => {
    if (zombie.dead) return false;
    const dx = zombie.x - fromX, dy = fromY - zombie.y;
    return dy > 12 && Math.hypot(dx, dy) <= maxRange
      && Math.abs(dx) <= roadHalfWidth(s.w, s.h, zombie.y) * 1.15;
  });
  const otherLane = candidates.filter(zombie => zombie.lane !== playerLane);
  const pool = otherLane.length ? otherLane : candidates;
  if (pool.length) return pool.reduce((nearest, current) => (
    Math.hypot(current.x - fromX, current.y - fromY) < Math.hypot(nearest.x - fromX, nearest.y - fromY)
      ? current : nearest
  ));
  if (s.boss && s.boss.hp > 0
    && fromY - s.boss.y > 12
    && Math.hypot(s.boss.x - fromX, s.boss.y - fromY) <= maxRange) return s.boss;
  return null;
}

function updateCompanions(s, dt, events) {
  const halfRoad = roadHalfWidth(s.w, s.h, s.y) * 0.95;
  const roadLeft = s.w * 0.5 - halfRoad;
  const roadRight = s.w * 0.5 + halfRoad;
  for (const companion of s.companions) {
    companion.phase += dt * 12;
    companion.appear = Math.max(0, companion.appear - dt);
    companion.muzzleFlash = Math.max(0, companion.muzzleFlash - dt);
    companion.recoil *= Math.exp(-dt * 12);
    if (companion.life > 0) {
      if (!companion.permanent) companion.life = Math.max(0, companion.life - dt);
      const targetX = clamp(s.x - companionOffset(companion.slot), roadLeft, s.x - 16);
      companion.x += (targetX - companion.x) * Math.min(1, dt * 7);
      companion.side = -1;
      companion.y = s.y + 13 + companion.slot * 8 + Math.sin(companion.phase) * 1.2;
      if (companion.life <= 0) {
        companion.exit = 0.42;
        continue;
      }
      companion.fireTimer -= dt;
      if (companion.fireTimer <= 0) {
        const muzzleSide = companion.side < 0 ? 1 : -1;
        shoot(s, events, 'companion', companion.x + muzzleSide * 14, companion.y - 58, 1);
        companion.fireTimer = SUPPORT_CONFIG.companionFireInterval;
        companion.recoil = 1;
        companion.muzzleFlash = 0.085;
      }
    } else {
      companion.exit -= dt;
    }
  }
  s.companions = s.companions.filter(companion => companion.life > 0 || companion.exit > 0);
}

function updateDrone(s, dt, events) {
  const drone = s.drone;
  if (!drone) return;
  drone.phase += dt;
  drone.appear = Math.max(0, drone.appear - dt);
  drone.muzzleFlash = Math.max(0, drone.muzzleFlash - dt);
  drone.recoil *= Math.exp(-dt * 11);
  if (drone.life > 0) {
    drone.life = Math.max(0, drone.life - dt);
    const targetX = s.x + Math.sin(drone.phase * 0.62) * 9;
    const targetY = s.y - s.h * 0.16 + Math.sin(drone.phase * 2.2) * 3;
    drone.x += (targetX - drone.x) * Math.min(1, dt * 7);
    drone.y += (targetY - drone.y) * Math.min(1, dt * 7);
    if (drone.life <= 0) {
      drone.exit = 0.4;
      return;
    }
    drone.fireTimer -= dt;
    if (drone.fireTimer <= 0) {
      const target = findDroneTarget(s, drone.x, drone.y + 18);
      if (target) {
        shoot(s, events, 'drone', drone.x, drone.y + 18, 1, target);
        drone.recoil = 1;
        drone.muzzleFlash = 0.095;
      }
      drone.fireTimer = SUPPORT_CONFIG.droneFireInterval;
    }
  } else {
    drone.exit -= dt;
    drone.y -= dt * 26;
    if (drone.exit <= 0) s.drone = null;
  }
}

function chooseRocketPoint(s) {
  const zombies = s.zombies.filter(zombie => !zombie.dead);
  if (zombies.length) {
    let best = null;
    for (const center of zombies) {
      const radius = Math.max(48, roadHalfWidth(s.w, s.h, center.y) * 0.45);
      const cluster = zombies.filter(zombie => Math.hypot(zombie.x - center.x, zombie.y - center.y) <= radius);
      const score = cluster.length * 100 - Math.abs(center.y - s.h * 0.45) * 0.025;
      if (!best || score > best.score) {
        best = {
          score,
          x: cluster.reduce((sum, zombie) => sum + zombie.x, 0) / cluster.length,
          y: cluster.reduce((sum, zombie) => sum + zombie.y, 0) / cluster.length,
        };
      }
    }
    return best;
  }
  if (s.boss && s.boss.hp > 0) return { x: s.boss.x, y: s.boss.y + 34 };
  return { x: laneX(s.w, s.h, s.h * 0.4, 1), y: s.h * 0.4 };
}

function detonateRocket(s, missile, events) {
  for (const zombie of s.zombies) {
    if (zombie.dead || Math.hypot(zombie.x - missile.targetX, zombie.y - missile.targetY) > missile.radius) continue;
    damageZombie(s, zombie, SUPPORT_CONFIG.rocketDamage, missile.targetX, events, true);
  }
  if (s.boss && s.boss.hp > 0 && Math.hypot(s.boss.x - missile.targetX, s.boss.y - missile.targetY) <= missile.radius + 44) {
    s.boss.hp -= SUPPORT_CONFIG.rocketDamage;
    s.boss.hitFlash = 0.2;
    if (s.boss.hp <= 0) defeatBoss(s, events, missile.targetX);
  }
  s.effects.push({
    kind: 'explosion', x: missile.targetX, y: missile.targetY,
    life: 0.72, total: 0.72, radius: missile.radius, source: 'rocket',
  });
  spawnExplosionParticles(s, missile.targetX, missile.targetY, missile.radius);
  events.push('rocketBlast');
}

function updateRocketSupport(s, dt, events) {
  s.rocketTimer -= dt;
  if (s.rocketAmmo > 0) {
    if (s.rocketTimer <= 0) {
      const point = chooseRocketPoint(s);
      const radius = Math.max(48, roadHalfWidth(s.w, s.h, point.y) * 0.45);
      const offset = s.rocketAmmo % 3 === 2 ? -24 : s.rocketAmmo % 3 === 1 ? 23 : 0;
      const startX = clamp(point.x + offset, 18, s.w - 18);
      s.effects.push({ kind: 'rocketWarning', x: point.x, y: point.y, radius, life: SUPPORT_CONFIG.rocketFlightTime, total: SUPPORT_CONFIG.rocketFlightTime });
      s.missiles.push({
        x: startX, y: -42, startX, targetX: point.x, targetY: point.y,
        elapsed: 0, travelTime: SUPPORT_CONFIG.rocketFlightTime,
        trailTimer: 0, radius,
      });
      s.rocketAmmo--;
      s.rocketTimer = SUPPORT_CONFIG.rocketInterval;
    }
  }
  for (const missile of s.missiles) {
    missile.elapsed += dt;
    const progress = clamp(missile.elapsed / missile.travelTime, 0, 1);
    missile.x = missile.startX + (missile.targetX - missile.startX) * progress;
    missile.y = -42 + (missile.targetY + 42) * progress;
    missile.trailTimer -= dt;
    if (missile.trailTimer <= 0 && progress < 1 && s.particles.length < 140) {
      s.particles.push({
        kind: 'smoke', x: missile.x + (Math.random() - 0.5) * 5, y: missile.y - 8,
        vx: (Math.random() - 0.5) * 18, vy: -26 - Math.random() * 18,
        life: 0.3, total: 0.3, size: 5 + Math.random() * 4, color: '#bbc1b1',
      });
      missile.trailTimer = 0.065;
    }
    if (progress >= 1) {
      missile.dead = true;
      detonateRocket(s, missile, events);
    }
  }
  s.missiles = s.missiles.filter(missile => !missile.dead);
}

function updateParticles(s, dt) {
  for (const particle of s.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    if (particle.kind === 'smoke') {
      particle.vx *= Math.exp(-dt * 1.1);
      particle.vy += -4 * dt;
      particle.size += (particle.growth || 0) * dt;
    } else {
      particle.vy += particle.kind === 'ember' ? 42 * dt : 145 * dt;
    }
    particle.rotation = (particle.rotation || 0) + (particle.spin || 0) * dt;
    particle.life -= dt;
  }
  s.particles = s.particles.filter(particle => particle.life > 0);
}

function updateBoss(s, dt, events) {
  const config = s.stageDefinition.boss;
  if (s.t >= config.warningAt && !s.bossWarningShown) {
    s.bossWarningShown = true;
    s.bossAlertTimer = 2.2;
    events.push('bossIncoming');
  }
  s.bossAlertTimer = Math.max(0, s.bossAlertTimer - dt);
  if (s.t >= config.startAt && !s.bossStarted) {
    s.bossStarted = true;
    const entryDuration = config.entryDuration;
    const entryStartY = s.h * config.startY;
    const entryEndY = s.h * config.endY;
    s.boss = {
      kind: config.kind,
      x: s.w * 0.5, y: entryStartY, hp: config.hp, maxHp: config.hp,
      entryDuration, entryTimer: entryDuration, entryProgress: 0,
      entryStartY, entryEndY,
      phase: 0, attackTimer: config.initialAttackDelay, warning: 0, warningTotal: 1.25, attackLane: 1,
      attackOriginX: s.w * 0.5, attackImpactX: s.w * 0.5, attackDirection: 0, attackRecover: 0,
      walkPhase: 0, moveSpeed: 0,
      hitFlash: 0, hitShake: 0, stomp: 0, addTimer: config.addInterval,
      comboActive: false, comboStep: 0, nextAttackLane: null,
    };
    events.push('bossStart');
  }
  if (!s.boss) return;
  const boss = s.boss;
  if (boss.deathTimer != null) {
    boss.deathTimer = Math.max(0, boss.deathTimer - dt);
    boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    boss.hitShake = Math.max(0, (boss.hitShake || 0) - dt);
    if (boss.deathTimer <= 0) {
      s.boss = null;
      s.finished = 'win';
      events.push('win');
    }
    return;
  }
  if (boss.entryTimer > 0) {
    const previousX = boss.x;
    boss.entryTimer = Math.max(0, boss.entryTimer - dt);
    const entryTime = 1 - boss.entryTimer / boss.entryDuration;
    boss.entryProgress = smoothstep(entryTime);
    boss.y = boss.entryStartY + (boss.entryEndY - boss.entryStartY) * boss.entryProgress;
    const halfRoad = roadHalfWidth(s.w, s.h, boss.y);
    boss.x = s.w * 0.5 + Math.sin(entryTime * Math.PI) * halfRoad * (config.pattern === 'double-slam' ? 0.025 : 0.045);
    boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    boss.hitShake = Math.max(0, (boss.hitShake || 0) - dt);
    boss.moveSpeed = dt > 0 ? (boss.x - previousX) / dt : 0;
    boss.walkPhase += dt * 8.5;
    return;
  }
  boss.entryProgress = 1;
  config.update(s, boss, dt, events, { laneX, roadHalfWidth, closestLane, hurtPlayer, spawnZombie });
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
  s.t += dt;
  s.distance = Math.floor(s.t * 10);
  s.roadOffset = (s.roadOffset + dt * 0.42) % 1;
  s.y = s.h * PLAYER_BASE_Y_RATIO;
  s.powerFlash = Math.max(0, s.powerFlash - dt);
  s.defenseFlash = Math.max(0, s.defenseFlash - dt);
  s.hitShake = Math.max(0, s.hitShake - dt);
  s.playerMuzzleFlash = Math.max(0, s.playerMuzzleFlash - dt);
  s.playerRecoil = Math.max(0, s.playerRecoil - dt);
  s.killStreakTimer = Math.max(0, s.killStreakTimer - dt);
  if (s.killStreakTimer <= 0) s.killStreak = 0;
  s.rapidFireTimer = Math.max(0, s.rapidFireTimer - dt);
  if (targetX != null) {
    const reach = roadHalfWidth(s.w, s.h, s.y) * 0.88;
    s.targetX = clamp(targetX, s.w * 0.5 - reach, s.w * 0.5 + reach);
  }
  const previousX = s.x;
  const supportSlots = new Set(s.companions.filter(companion => companion.life > 0).map(companion => companion.slot));
  const movementReach = roadHalfWidth(s.w, s.h, s.y) * 0.95;
  const leftReserve = supportSlots.size ? Math.max(...Array.from(supportSlots, companionOffset)) : 0;
  const rightReserve = 0;
  const minX = s.w * 0.5 - movementReach + leftReserve;
  const maxX = s.w * 0.5 + movementReach - rightReserve;
  s.targetX = clamp(s.targetX, minX, maxX);
  s.x += (s.targetX - s.x) * Math.min(1, dt * 12);
  const lateralSpeed = Math.abs(s.x - previousX) / Math.max(dt, 0.001);
  const moveTarget = clamp(lateralSpeed / 240, 0, 1);
  s.playerMoveAmount += (moveTarget - s.playerMoveAmount) * Math.min(1, dt * 9);
  if (Math.abs(s.x - previousX) > 0.5) {
    s.hasPlayerMoved = true;
    s.moveTutorialVisible = false;
    s.moveTutorialTimer = 0;
    s.showAimGuide = false;
  }
  if (!s.moveTutorialShown && !s.hasPlayerMoved && s.t >= MOVE_TUTORIAL_DELAY) {
    s.moveTutorialShown = true;
    s.moveTutorialVisible = true;
    s.moveTutorialTimer = MOVE_TUTORIAL_DURATION;
    s.showAimGuide = true;
  } else if (s.moveTutorialVisible) {
    s.moveTutorialTimer = Math.max(0, s.moveTutorialTimer - dt);
    if (s.moveTutorialTimer <= 0) {
      s.moveTutorialVisible = false;
      s.showAimGuide = false;
    }
  }
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.flash = Math.max(0, s.flash - dt);

  for (const action of collectStageActions(s)) {
    if (action.type === 'zombie') spawnZombie(s, action.kind, action.lane);
    else if (action.type === 'offer') spawnBarrelOffer(s, action.rewards);
    else if (action.type === 'barrel') {
      spawnRewardBarrel(s, action.lane, action.kind, { hp: action.hp, permanent: action.permanent });
    } else if (action.type === 'explosive') spawnExplosiveBarrel(s, action.lane);
    else if (action.type === 'obstacle') spawnObstacle(s, action.lane);
  }
  updateBoss(s, dt, events);
  if (s.finished) { s.events = events; return events; }

  for (const zombie of s.zombies) {
    if (zombie.dead) { zombie.dying -= dt; continue; }
    zombie.hitFlash = Math.max(0, zombie.hitFlash - dt);
    zombie.recoilX *= Math.exp(-dt * 8);
    zombie.recoilY *= Math.exp(-dt * 8);
    zombie.y += zombie.speed * dt - zombie.recoilY * dt;
    zombie.x = laneX(s.w, s.h, zombie.y, zombie.lane) + Math.sin(s.t * 2.1 + zombie.phase) * 3 + zombie.recoilX;
    const collided = zombie.y >= s.y - 24 && Math.abs(zombie.x - s.x) < zombie.radius + 20;
    if (collided) {
      resolveZombieContact(s, zombie, 'collision', events);
      if (s.finished) break;
      continue;
    }
    if (zombie.y >= s.h * DEFENSE_LINE_Y_RATIO) {
      resolveZombieContact(s, zombie, 'breach', events);
      if (s.finished) break;
    }
  }
  if (s.finished) { s.events = events; return events; }

  for (const barrel of s.barrels) {
    barrel.y += s.h * (s.stageDefinition.barrelSpeed ?? 0.19) * dt;
    barrel.x = laneX(s.w, s.h, barrel.y, barrel.lane);
    barrel.hitFlash = Math.max(0, barrel.hitFlash - dt);
    barrel.hitShake = Math.max(0, (barrel.hitShake || 0) - dt);
    if (barrel.y >= s.y - 28) barrel.dead = true;
  }
  updateObstacle(s, dt, events);
  if (s.finished) { s.events = events; return events; }

  s.fireTimer -= dt;
  if (s.fireTimer <= 0) {
    shoot(s, events);
    const baseInterval = s.weapon === 'smg'
      ? Math.max(0.075, 0.12 - (s.weaponLevel.smg || 1) * 0.008)
      : s.weapon === 'twin'
        ? Math.max(0.14, 0.21 - ((s.weaponLevel.twin || 1) - 1) * 0.012)
        : 0.25;
    s.fireTimer = baseInterval * (s.permanentRapidFire || s.rapidFireTimer > 0 ? SUPPORT_CONFIG.rapidFireMultiplier : 1);
  }
  updateCompanions(s, dt, events);
  updateDrone(s, dt, events);
  updateRocketSupport(s, dt, events);
  updateParticles(s, dt);

  for (const bullet of s.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) { bullet.dead = true; continue; }
    let hit = false;
    if (bullet.owner === 'player') {
      for (const barrel of s.barrels) {
        if (barrel.dead) continue;
        if (Math.hypot(bullet.x - barrel.x, bullet.y - barrel.y) > barrel.radius + 5) continue;
        damageTarget(s, barrel, bullet.damage, events, bullet.x);
        bullet.dead = true; hit = true; break;
      }
    }
    if (hit) continue;
    for (const zombie of s.zombies) {
      if (zombie.dead) continue;
      if (Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y) > zombie.radius + 5) continue;
      damageTarget(s, zombie, bullet.damage, events, bullet.x);
      bullet.dead = true; hit = true; break;
    }
    if (hit) continue;
    const bossEntryScale = s.boss ? 0.28 + 0.72 * smoothstep(clamp(s.boss.entryProgress ?? 1, 0, 1)) : 1;
    if (s.boss && s.boss.hp > 0 && Math.hypot(bullet.x - s.boss.x, bullet.y - s.boss.y) < 58 * bossEntryScale) {
      damageTarget(s, s.boss, bullet.damage, events, bullet.x);
      bullet.dead = true;
    }
  }

  for (const hazard of s.hazards) {
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;
    if (Math.hypot(hazard.x - s.x, hazard.y - (s.y - 10)) < hazard.radius + 22) {
      hurtPlayer(s, hazard.damage, events, { source: 'hazard', x: hazard.x, y: hazard.y });
      hazard.dead = true;
    }
  }
  if (s.finished) { s.events = events; return events; }
  for (const effect of s.effects) effect.life -= dt;
  s.zombies = s.zombies.filter(zombie => !zombie.dead || zombie.dying > 0);
  s.barrels = s.barrels.filter(barrel => !barrel.dead);
  s.obstacles = s.obstacles.filter(obstacle => !obstacle.dead);
  s.bullets = s.bullets.filter(bullet => !bullet.dead && bullet.y > -20 && bullet.y < s.h + 20);
  s.hazards = s.hazards.filter(hazard => !hazard.dead && hazard.y < s.h + 30 && hazard.x > -30 && hazard.x < s.w + 30);
  if (s.target && (s.target.dead || s.target.hp <= 0)) s.target = null;
  s.effects = s.effects.filter(effect => effect.life > 0);

  s.score = Math.floor(s.score);
  s.events = events;
  return events;
}

