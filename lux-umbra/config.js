// 룩스 앤 움브라 — tunable numbers. All distances are in tiles, times in seconds.

export const STEP = 1 / 120;          // fixed physics step

export const PHYS = {
  grav: 40,          // tiles/s²
  jumpV: 14,         // ≈ 2.4 tiles high
  cutV: -10,         // releasing jump early caps the rise speed (mild, so a quick tap still jumps well)
  maxFall: 20,
  run: 6,
  accGround: 70,
  accAir: 45,
  push: 2.6,         // walking speed while pushing a crate
  coyote: 0.11,
  buffer: 0.15,
  pw: 0.6, ph: 0.9,  // player box
  cw: 0.96,          // crate width (height is a full tile so its top lines up with the floor grid)
  sw: 0.8, sh: 1.5,  // statue box
  statueSpeed: 1.9,
  statueSight: 11,
};

export const LIGHT = {
  flashRange: 7.5,
  flashHalf: 0.33,   // half-angle of the hand torch cone (rad)
  halo: 1.45,        // radius lit around the player while the torch is on
  defaultAim: 0.18,  // slightly downward when facing right
};

// Bitmask colours: white, red, blue.
export const COL = { w: 1, r: 2, b: 4 };

export const DEATH_TIME = 0.7;
