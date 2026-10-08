// Every balance number lives here. Distances are in tiles, times in seconds.

export const BRAWLERS = {
  gyo: {
    name: '교행이', role: '총잡이', blurb: '소총 4연발. 가까이서도 멀리서도 무난해요.',
    hp: 5200, speed: 3.3, radius: 0.38,
    ammo: 3, reload: 1.4, // seconds to refill one ammo slot
    fireCd: 0.4,          // minimum gap between two shots
    prefer: 0.6,          // bots like to fight at this fraction of their range
    attack: { type: 'burst', bullets: 4, gap: 0.075, speed: 13, range: 6.8, damage: 380, spread: 0.06, radius: 0.12 },
    superCharge: 4200,    // damage dealt with normal attacks to fill the ★ gauge
    super: { type: 'storm', name: '총알 폭풍', dash: 2.6, dashTime: 0.28, bullets: 16, damage: 330, range: 4.5, speed: 12, radius: 0.13 },
  },
  jjam: {
    name: '짬뽕이', role: '투척형', blurb: '벽 너머로 짬뽕 그릇을 던져 범위 피해를 줘요.',
    hp: 3900, speed: 3.0, radius: 0.38,
    ammo: 3, reload: 1.8, fireCd: 0.55, prefer: 0.75,
    attack: { type: 'lob', range: 6.5, flight: 0.6, blast: 1.2, damage: 820 },
    superCharge: 4200,
    super: { type: 'firebomb', name: '불맛 폭탄', range: 7, flight: 0.75, blast: 1.7, damage: 1300, burn: { time: 3, radius: 1.6, dps: 520 } },
  },
  sowol: {
    name: '소월이', role: '저격형', blurb: '멀리서 화살 한 방! 필살기는 벽도 뚫어요.',
    hp: 3400, speed: 3.15, radius: 0.38,
    ammo: 3, reload: 2.1, fireCd: 0.5, prefer: 0.78,
    attack: { type: 'arrow', speed: 18, range: 9.2, damage: 980, radius: 0.15 },
    superCharge: 4200,
    super: { type: 'pierce', name: '관통 화살', speed: 22, range: 11.5, damage: 1900, radius: 0.32 },
  },
};
export const KINDS = Object.keys(BRAWLERS);

// Bushes hide a brawler from the other team unless an enemy is this close, or it just attacked / got hit.
export const BUSH = { seeDist: 2.2, reveal: 1.0 };

export const TEAM_MODE = {
  killsToWin: 10,
  time: 180,
  suddenDeathMax: 60, // a draw if nobody scores within this after the clock runs out
  respawn: 4,
  spawnShield: 1.5,
};

export const HEAL = { delay: 3, rate: 0.13 }; // after 3 s without attacking or being hit, +13% max HP per second

export const TROPHY = { win: 8, draw: 0, lose: -3, mvp: 2 };

// Bot skill: index by difficulty level 0..3 (chosen from the player's trophies).
export const BOT_LEVELS = [
  { reaction: 0.55, aimError: 0.2, lead: 0.3 },
  { reaction: 0.42, aimError: 0.14, lead: 0.55 },
  { reaction: 0.32, aimError: 0.09, lead: 0.75 },
  { reaction: 0.24, aimError: 0.06, lead: 0.9 },
];
export const botLevelFor = trophies => (trophies >= 150 ? 3 : trophies >= 70 ? 2 : trophies >= 20 ? 1 : 0);
