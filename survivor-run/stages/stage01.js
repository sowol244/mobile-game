const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

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
  boss.addTimer -= dt;
  if (boss.addTimer <= 0) {
    api.spawnZombie(s, 'walker', 0);
    api.spawnZombie(s, 'walker', 2);
    boss.addTimer = 5.2;
  }
  if (boss.warning > 0) {
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
      events.push('bossSlam');
    }
  } else if (boss.attackRecover > 0) {
    const recovery = 1 - clamp(boss.attackRecover / 0.58, 0, 1);
    boss.x = boss.attackImpactX + (idleX - boss.attackImpactX) * smoothstep(recovery);
  } else {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackLane = api.closestLane(s, s.x);
      boss.attackOriginX = boss.x;
      boss.attackDirection = Math.sign(api.laneX(s.w, s.h, boss.y, boss.attackLane) - boss.x);
      boss.warning = 1.25;
      boss.warningTotal = boss.warning;
      events.push('bossWarn');
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
  showMoveTutorial: true,
  explosiveDamage: 65,
  explosiveRadiusMode: 'screen',
  companionDuplicatePower: 0.25,
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
    { start: 0.6, count: 5, interval: 1.45, pattern: ['walker'], lanes: [1, 0, 1, 2, 0] },
    { start: 8.35, count: 6, interval: 1.32, pattern: ['walker'], lanes: [0, 2, 0, 2, 1, 1] },
    { start: 16.25, count: 9, interval: 1.18, pattern: ['walker'], lanes: [1, 0, 2, 1, 0, 2, 1, 0, 2] },
    { start: 28.2, count: 14, interval: 0.86, pattern: ['walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'walker', 'runner', 'runner'], lanes: [0, 2, 1, 0, 0, 0, 2, 2, 1, 1, 1, 2, 0, 2] },
    { start: 40.25, count: 15, interval: 0.78, pattern: ['walker'], lanes: [0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 2, 1] },
    { start: 55, count: 10, interval: 0.65, pattern: ['walker', 'walker', 'walker', 'walker', 'runner'], lanes: [1, 0, 2, 1, 0, 2, 1, 0, 2, 1] },
  ],
  events: [
    { at: 8, type: 'barrel', lane: 1, kind: 'rapidfire', hp: 35, permanent: true },
    { at: 16, type: 'offer', rewards: [
      { lane: 0, kind: 'companion', hp: 40 },
      { lane: 2, kind: 'upgrade', hp: 45 },
    ] },
    { at: 41.5, type: 'explosive', lane: 0 },
    { at: 45, type: 'offer', rewards: [
      { lane: 0, kind: 'companion', hp: 40 },
      { lane: 2, kind: 'rocket', hp: 100 },
    ] },
    { at: 50, type: 'explosive', lane: 2 },
    { at: 52, type: 'obstacle', lane: 1 },
  ],
});
