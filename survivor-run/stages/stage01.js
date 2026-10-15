const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const repeated = (kind, count) => Array.from({ length: count }, () => kind);

export function updateStage01Boss(s, boss, dt, events, api) {
  const previousX = boss.x;
  boss.phase += dt;
  boss.y = s.h * 0.44 + Math.sin(boss.phase * 1.45) * s.h * 0.014;
  const halfRoad = api.roadHalfWidth(s.w, s.h, boss.y);
  const idleX = s.w * 0.5
    + Math.sin(boss.phase * 0.68) * halfRoad * 0.82
    + Math.sin(boss.phase * 0.39 + 1.4) * halfRoad * 0.08;
  boss.x = idleX;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  boss.hitShake = Math.max(0, (boss.hitShake || 0) - dt);
  boss.stomp = Math.max(0, (boss.stomp || 0) - dt);
  boss.attackRecover = Math.max(0, (boss.attackRecover || 0) - dt);
  boss.gunMuzzleFlash = Math.max(0, (boss.gunMuzzleFlash || 0) - dt);
  boss.addTimer -= dt;
  if (boss.addTimer <= 0) {
    api.spawnZombie(s, 'walker', 0);
    api.spawnZombie(s, 'walker', 2);
    boss.addTimer = 5.2;
  }
  if (boss.gunWarning > 0) {
    boss.gunWarning = Math.max(0, boss.gunWarning - dt);
    if (boss.gunWarning === 0) {
      boss.gunBurst = 3;
      boss.gunBurstTimer = 0;
    }
  } else if (boss.gunBurst > 0) {
    boss.gunBurstTimer -= dt;
    if (boss.gunBurstTimer <= 0) {
      const size = clamp(s.w * 0.44, 118, 164);
      const side = Math.sign(boss.gunAimX - boss.x) || 1;
      const startX = boss.x + side * size * 0.13;
      const startY = boss.y + 16;
      const dx = boss.gunAimX - startX;
      const dy = boss.gunAimY - startY;
      const shotIndex = 3 - boss.gunBurst;
      const spread = [-0.035, 0, 0.035][shotIndex];
      const angle = Math.atan2(dy, dx) + spread;
      const muzzleX = startX + Math.cos(angle) * size * 0.24;
      const muzzleY = startY + Math.sin(angle) * size * 0.24;
      const speed = s.h * 1.05;
      s.bullets.push({
        owner: 'boss', x: muzzleX, y: muzzleY,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage: 10, radius: 5, life: 1.45, weapon: 'boss-rifle',
      });
      boss.gunMuzzleFlash = 0.12;
      boss.gunBurst--;
      boss.gunBurstTimer = 0.16;
      events.push('bossShot');
      if (boss.gunBurst === 0) {
        boss.nextAttackMode = 'slam';
        boss.attackRecover = 0.42;
        boss.attackTimer = 2.5;
      }
    }
  } else if (boss.warning > 0) {
    boss.warning -= dt;
    const windup = 1 - clamp(boss.warning / boss.warningTotal, 0, 1);
    const targetX = api.laneX(s.w, s.h, boss.y, boss.attackLane);
    const approach = smoothstep(windup / 0.72);
    const lunge = smoothstep((windup - 0.68) / 0.32);
    boss.x = boss.attackOriginX + (targetX - boss.attackOriginX) * approach;
    boss.x += (targetX - boss.x) * lunge * 0.16;
    boss.x = clamp(boss.x, s.w * 0.14, s.w * 0.86);
    if (boss.warning <= 0) {
      const x = api.laneX(s.w, s.h, s.h * 0.75, boss.attackLane);
      boss.x = targetX;
      boss.attackImpactX = boss.x;
      boss.attackRecover = 0.58;
      s.effects.push({
        kind: 'slam', x, y: s.h * 0.75,
        radius: api.roadHalfWidth(s.w, s.h, s.h * 0.75) * 0.2,
        lane: boss.attackLane, life: 0.62, total: 0.62,
      });
      boss.stomp = 0.42;
      s.hitShake = Math.max(s.hitShake, 0.23);
      if (api.closestLane(s, s.x) === boss.attackLane) api.hurtPlayer(s, 16, events, { source: 'boss' });
      boss.attackTimer = 3.05;
      boss.nextAttackMode = 'gun';
      events.push('bossSlam');
    }
  } else if (boss.attackRecover > 0) {
    const recovery = 1 - clamp(boss.attackRecover / 0.58, 0, 1);
    boss.x = boss.attackImpactX + (idleX - boss.attackImpactX) * smoothstep(recovery);
  } else {
    boss.gunAimX = s.x;
    boss.gunAimY = s.y - 10;
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      if (boss.nextAttackMode === 'gun') {
        boss.vulnerable = true;
        boss.gunAimX = s.x;
        boss.gunAimY = s.y - 10;
        boss.attackDirection = Math.sign(boss.gunAimX - boss.x) || 1;
        boss.gunWarning = 0.82;
        boss.gunWarningTotal = boss.gunWarning;
        events.push('bossGunWarn');
      } else {
        boss.vulnerable = true;
        boss.attackLane = api.closestLane(s, s.x);
        boss.attackOriginX = boss.x;
        boss.attackDirection = Math.sign(api.laneX(s.w, s.h, boss.y, boss.attackLane) - boss.x);
        boss.warning = 1.25;
        boss.warningTotal = boss.warning;
        events.push('bossWarn');
      }
    }
  }
  const lateralDistance = Math.abs(boss.x - previousX);
  boss.moveSpeed = dt > 0 ? (boss.x - previousX) / dt : 0;
  boss.walkPhase += lateralDistance / Math.max(1, s.w * 0.09) * Math.PI;
}

export const STAGE_01 = Object.freeze({
  id: 'stage01',
  number: '1-1',
  name: '폐쇄 고속도로',
  background: 'highway',
  intro: '폐허가 된 고속도로에서 최종 보스를 돌파하세요.',
  clearMessage: '최종 보스를 격파하고 1-1을 돌파했습니다.',
  maxActiveZombies: 40,
  maxPassDamagePerSecond: 8,
  damageTakenMultiplier: 0.8,
  showMoveTutorial: true,
  explosiveDamage: 65,
  explosiveRadiusMode: 'screen',
  companionDuplicatePower: 0.25,
  playerDamage: 12,
  boss: Object.freeze({
    label: '대형 변이체',
    warningAt: 62,
    startAt: 64,
    hp: 350,
    kind: 'brute',
    pattern: 'stage01',
    entryDuration: 2.2,
    startY: 0.12,
    endY: 0.44,
    initialAttackDelay: 1.65,
    addInterval: 4.2,
    update: updateStage01Boss,
  }),
  waves: [
    { start: 0.6, count: 6, interval: 0.55, pattern: repeated('walker', 6), lanes: [1, 0, 2, 1, 2, 0] },
    { start: 4.2, count: 7, interval: 0.44, pattern: repeated('walker', 7), lanes: [0, 2, 1, 0, 2, 1, 0] },
    { start: 8.4, count: 10, interval: 0.46, pattern: [...repeated('walker', 8), ...repeated('runner', 2)], lanes: [1, 0, 2, 0, 1, 2, 1, 0, 2, 1] },
    { start: 14, count: 13, interval: 0.48, pattern: [...repeated('walker', 10), ...repeated('runner', 3)], lanes: [1, 0, 2, 1, 0, 2, 1, 1, 0, 2, 0, 2, 1] },
    { start: 21, count: 15, interval: 0.44, pattern: [...repeated('walker', 11), ...repeated('runner', 4)], lanes: [0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 2, 1] },
    { start: 29, count: 18, interval: 0.42, pattern: [...repeated('walker', 14), ...repeated('runner', 4)], lanes: [1, 0, 2, 1, 2, 0, 1, 0, 2, 1, 0, 2, 0, 1, 2, 1, 0, 2] },
    { start: 37, count: 12, interval: 0.4, pattern: [...repeated('walker', 9), ...repeated('runner', 3)], lanes: [1, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 0] },
    { start: 45, count: 12, interval: 0.42, pattern: [...repeated('walker', 9), ...repeated('runner', 3)], lanes: [0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 2, 1] },
    { start: 53, count: 14, interval: 0.4, pattern: [...repeated('walker', 11), ...repeated('runner', 3)], lanes: [1, 0, 2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 0, 1] },
  ],
  events: [
    { at: 8, type: 'offer', rewards: [
      { lane: 0, kind: 'companion', hp: 40 },
      { lane: 2, kind: 'upgrade', hp: 45 },
    ] },
    { at: 34.5, type: 'explosive', lane: 0 },
    { at: 40, type: 'offer', rewards: [
      { lane: 0, kind: 'twin', hp: 58 },
      { lane: 2, kind: 'rocket', hp: 100 },
    ] },
    { at: 48.5, type: 'explosive', lane: 2 },
    { at: 54, type: 'obstacle', lane: 1 },
  ],
});
