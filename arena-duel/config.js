// Match balance. Distances use map tiles and times use seconds.

export const FIGHTERS = {
  gyo: {
    name: '교행이', role: '연발 사수', blurb: '빠르게 여러 발을 쏴요.',
    hp: 5200, speed: 3.3, radius: 0.38,
    ammo: 3, reload: 1.4, fireCd: 0.4, prefer: 0.6,
    attack: { type: 'burst', bullets: 4, gap: 0.075, speed: 13, range: 6.8, damage: 380, spread: 0.06, radius: 0.12 },
    specialCharge: 4200,
    special: { type: 'storm', name: '총알 폭풍', dash: 2.6, dashTime: 0.28, bullets: 16, damage: 330, range: 4.5, speed: 12, radius: 0.13 },
  },
  jjam: {
    name: '짬뽕이', role: '범위 공격', blurb: '벽을 넘는 공격으로 주변을 맞혀요.',
    hp: 3900, speed: 3.0, radius: 0.38,
    ammo: 3, reload: 1.8, fireCd: 0.55, prefer: 0.75,
    attack: { type: 'lob', range: 6.5, flight: 0.6, blast: 1.2, damage: 820 },
    specialCharge: 4200,
    special: { type: 'firebomb', name: '불맛 폭탄', range: 7, flight: 0.75, blast: 1.7, damage: 1300, burn: { time: 3, radius: 1.6, dps: 520 } },
  },
  sowol: {
    name: '소월이', role: '정밀 사수', blurb: '멀리 있는 상대를 정확히 노려요.',
    hp: 3400, speed: 3.15, radius: 0.38,
    ammo: 3, reload: 2.1, fireCd: 0.5, prefer: 0.78,
    attack: { type: 'arrow', speed: 18, range: 9.2, damage: 980, radius: 0.15 },
    specialCharge: 4200,
    special: { type: 'pierce', name: '관통 화살', speed: 22, range: 11.5, damage: 1900, radius: 0.32 },
  },
};

export const KINDS = Object.keys(FIGHTERS);

export const BUSH = { seeDist: 2.2, reveal: 1.0 };

export const MODE_RULES = {
  duel: { scoreToWin: 3, time: 120, respawn: 3, spawnShield: 1 },
  boss: { time: 180, respawn: 4, spawnShield: 1, teamLives: 3 },
};

export const BOSS = { hpMultiplier: 10, damageMultiplier: 1.25, radiusMultiplier: 1.45 };

export const LEVELS = { at: [0, 30, 80, 150, 250], bonus: 0.05 };
export const levelFor = reputation => LEVELS.at.filter(value => reputation >= value).length;
export const STAGES = { count: 5, botHp: [1, 1.12, 1.25, 1.4, 1.55] };
export const HEAL = { delay: 3, rate: 0.13 };
export const REPUTATION = { win: 8, lose: -3, bossWin: 12, bossLose: -2 };

export const BOT_LEVELS = [
  { reaction: 0.55, aimError: 0.2, lead: 0.3 },
  { reaction: 0.42, aimError: 0.14, lead: 0.55 },
  { reaction: 0.32, aimError: 0.09, lead: 0.75 },
  { reaction: 0.24, aimError: 0.06, lead: 0.9 },
];
export const botLevelFor = reputation => (reputation >= 150 ? 3 : reputation >= 70 ? 2 : reputation >= 20 ? 1 : 0);
