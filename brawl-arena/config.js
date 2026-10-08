// Every balance number lives here. Distances are in tiles, times in seconds.

export const BRAWLERS = {
  gyo: {
    name: '교행이',
    hp: 4200,
    speed: 3.3,
    radius: 0.38,
    ammo: 3,
    reload: 1.4, // seconds to refill one ammo slot
    fireCd: 0.4, // minimum gap between two shots
    attack: { bullets: 4, gap: 0.075, speed: 13, range: 6.8, damage: 350, spread: 0.06, radius: 0.12 },
  },
};

export const TEAM_MODE = {
  killsToWin: 10,
  time: 180,
  suddenDeathMax: 60, // a draw if nobody scores within this after the clock runs out
  respawn: 3,
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
