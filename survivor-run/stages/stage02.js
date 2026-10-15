const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function alternateLane(lane, playerX, width) {
  if (lane === 0) return 2;
  if (lane === 2) return 0;
  return playerX < width * 0.5 ? 2 : 0;
}

export function updateStage02Boss(s, boss, dt, events, api) {
  const previousX = boss.x;
  boss.phase += dt;
  boss.y = s.h * 0.36 + Math.sin(boss.phase * 0.9) * s.h * 0.008;
  const halfRoad = api.roadHalfWidth(s.w, s.h, boss.y);
  const idleX = s.w * 0.5
    + Math.sin(boss.phase * 0.34) * halfRoad * 0.5
    + Math.sin(boss.phase * 0.2 + 1.2) * halfRoad * 0.06;
  boss.x = idleX;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  boss.hitShake = Math.max(0, (boss.hitShake || 0) - dt);
  boss.stomp = Math.max(0, (boss.stomp || 0) - dt);
  boss.attackRecover = Math.max(0, (boss.attackRecover || 0) - dt);
  boss.addTimer -= dt;
  if (boss.addTimer <= 0) {
    api.spawnZombie(s, 'walker', 0);
    api.spawnZombie(s, 'walker', 2);
    boss.addTimer = 8;
  }

  if (boss.warning > 0) {
    boss.warning = Math.max(0, boss.warning - dt);
    const windup = 1 - clamp(boss.warning / boss.warningTotal, 0, 1);
    const targetX = api.laneX(s.w, s.h, boss.y, boss.attackLane);
    const approach = smoothstep(windup / 0.72);
    boss.x = boss.attackOriginX + (targetX - boss.attackOriginX) * approach;
    boss.x = clamp(boss.x, s.w * 0.14, s.w * 0.86);
    if (boss.warning <= 0) {
      const impactX = api.laneX(s.w, s.h, s.h * 0.74, boss.attackLane);
      boss.x = targetX;
      boss.attackImpactX = boss.x;
      boss.attackRecover = 0.58;
      s.effects.push({
        kind: 'slam', x: impactX, y: s.h * 0.74,
        radius: api.roadHalfWidth(s.w, s.h, s.h * 0.74) * 0.2,
        lane: boss.attackLane, life: 0.62, total: 0.62,
      });
      boss.stomp = 0.42;
      s.hitShake = Math.max(s.hitShake, 0.24);
      if (api.closestLane(s, s.x) === boss.attackLane) api.hurtPlayer(s, 15, events, { source: 'boss' });
      if (boss.comboActive && boss.comboStep === 0) {
        boss.comboStep = 1;
        boss.nextAttackLane = alternateLane(boss.attackLane, s.x, s.w);
        boss.attackTimer = 0.42;
      } else {
        boss.comboActive = false;
        boss.comboStep = 0;
        boss.attackTimer = 2.25;
      }
      events.push('bossSlam');
    }
  } else if (boss.attackRecover > 0) {
    const recovery = 1 - clamp(boss.attackRecover / 0.58, 0, 1);
    boss.x = boss.attackImpactX + (idleX - boss.attackImpactX) * smoothstep(recovery);
  } else {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      if (boss.comboStep === 1) {
        boss.attackLane = boss.nextAttackLane;
      } else {
        boss.attackLane = api.closestLane(s, s.x);
        boss.comboActive = boss.hp <= boss.maxHp * 0.5;
        boss.comboStep = 0;
      }
      boss.attackOriginX = boss.x;
      boss.attackDirection = Math.sign(api.laneX(s.w, s.h, boss.y, boss.attackLane) - boss.x);
      boss.warning = boss.comboStep === 1 ? 1.05 : 1.2;
      boss.warningTotal = boss.warning;
      events.push('bossWarn');
    }
  }

  const lateralDistance = Math.abs(boss.x - previousX);
  boss.moveSpeed = dt > 0 ? (boss.x - previousX) / dt : 0;
  boss.walkPhase += lateralDistance / Math.max(1, s.w * 0.09) * Math.PI;
}

const repeated = (kind, count) => Array.from({ length: count }, () => kind);

export const STAGE_02 = Object.freeze({
  id: 'stage02',
  number: '2-1',
  name: '붕괴된 톨게이트',
  background: 'tollgate',
  intro: '붕괴된 톨게이트를 돌파하세요.',
  clearMessage: '철갑 파쇄자를 격파하고 2-1을 돌파했습니다.',
  maxActiveZombies: 22,
  showMoveTutorial: false,
  barrelSpeed: 0.16,
  explosiveDamage: 70,
  explosiveRadiusMode: 'lane',
  companionDuplicatePower: 0.2,
  boss: Object.freeze({
    label: '철갑 파쇄자',
    warningAt: 90,
    startAt: 92,
    hp: 850,
    kind: 'shield-breaker',
    pattern: 'double-slam',
    entryDuration: 2.2,
    startY: 0.1,
    endY: 0.36,
    initialAttackDelay: 1.4,
    addInterval: 8,
    update: updateStage02Boss,
  }),
  waves: [
    { start: 0.65, count: 12, interval: 0.64, pattern: [...repeated('walker', 9), ...repeated('runner', 3)], lanes: [1, 0, 2, 1, 0, 2, 1, 2, 0, 2, 0, 1] },
    { start: 8.5, count: 12, interval: 1, pattern: ['walker', 'walker', 'runner', 'walker', 'walker', 'walker', 'runner', 'walker', 'runner', 'walker', 'walker', 'runner'], lanes: [1, 0, 2, 1, 2, 0, 2, 1, 0, 1, 2, 0] },
    { start: 20, count: 22, interval: 0.68, pattern: [...repeated('walker', 15), ...repeated('runner', 6), 'tank'], lanes: [1, 1, 0, 2, 1, 0, 2, 1, 1, 0, 2, 1, 2, 0, 0, 2, 1, 2, 1, 0, 2, 1] },
    { start: 35, count: 12, interval: 0.66, pattern: ['walker', 'runner', 'walker', 'walker', 'runner', 'walker', 'walker', 'runner', 'walker', 'walker', 'runner', 'walker'], lanes: [0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 0, 1] },
    { start: 46, count: 20, interval: 0.68, pattern: [...repeated('walker', 15), ...repeated('runner', 5)], lanes: [1, 0, 2, 1, 0, 2, 1, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 2, 0, 1] },
    { start: 62, count: 32, interval: 0.45, pattern: [...repeated('walker', 22), ...repeated('runner', 8), 'tank', 'tank'], lanes: [1, 1, 1, 0, 2, 1, 0, 2, 1, 1, 2, 0, 1, 0, 2, 1, 2, 1, 0, 2, 0, 2, 1, 2, 1, 0, 0, 2, 1, 1, 0, 2] },
    { start: 78, count: 24, interval: 0.48, pattern: [...repeated('walker', 22), 'tank', 'tank'], lanes: [1, 0, 2, 1, 1, 2, 0, 1, 2, 1, 0, 2, 1, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2] },
  ],
  events: [
    { at: 8, type: 'offer', rewards: [
      { lane: 0, kind: 'companion', hp: 45 },
      { lane: 2, kind: 'upgrade', hp: 50 },
    ] },
    { at: 35, type: 'offer', rewards: [
      { lane: 0, kind: 'twin', hp: 58 },
      { lane: 2, kind: 'drone', hp: 65 },
    ] },
    { at: 46, type: 'offer', rewards: [
      { lane: 0, kind: 'companion', hp: 60 },
      { lane: 2, kind: 'rapidfire', hp: 60, permanent: true },
    ] },
    { at: 54, type: 'explosive', lane: 0 },
    { at: 63, type: 'explosive', lane: 2 },
    { at: 72, type: 'explosive', lane: 0 },
    { at: 78, type: 'barrel', lane: 1, kind: 'rocket', hp: 100 },
  ],
});
