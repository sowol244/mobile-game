// Scripted players: each stage's solution is a generator of per-step inputs (see solutions.js).
// Used by game.test.mjs (proves every stage is solvable with the intended steps) and by the
// title-screen demo / window.__lux.autoplay in the browser.

import { STEP } from './config.js';
import { clamp } from './game.js';

const DEG = Math.PI / 180;
export const onGround = s => s.p.onGround;

export function makeBot(s) {
  const b = {
    s, aim: null, // degrees, held while set
    cx: () => s.p.x + s.p.w / 2,
    feet: () => s.p.y + s.p.h,
    inp(extra = {}) { return { ...(b.aim == null ? {} : { aim: b.aim * DEG }), ...extra }; },
    *wait(t) { for (let k = 0; k < Math.round(t / STEP); k++) yield b.inp(); },
    // walk to x (player centre); slows down near the target
    *go(x, tol = 0.1, maxT = 12) {
      for (let k = 0; k < maxT / STEP; k++) {
        const d = x - b.cx();
        if (Math.abs(d) < tol && Math.abs(s.p.vx) < 0.8) return;
        yield b.inp({ mx: clamp(d * 2.2, -1, 1) });
      }
      throw new Error(`go(${x}) timed out at x=${b.cx().toFixed(2)}`);
    },
    // hold a direction until pred() holds
    *run(mx, pred, maxT = 10, extra = {}) {
      for (let k = 0; k < maxT / STEP; k++) { if (pred(s)) return; yield b.inp({ mx, ...extra }); }
      throw new Error('run() timed out');
    },
    // jump (full height) steering toward x in the air; ends on landing. hold=false → short hop.
    *jump(x, { hold = true, airMx = null, after = null } = {}) {
      for (let k = 0; k < 1 / STEP && !s.p.onGround; k++) yield b.inp(); // land first
      yield b.inp({ jumpPress: true, jump: true, mx: airMx ?? Math.sign(x - b.cx()) });
      let left = false;
      for (let k = 0; k < 6 / STEP; k++) {
        if (!s.p.onGround) left = true;
        if (left && s.p.onGround) return;
        if (s.p.dead) throw new Error('died while jumping');
        if (s.cleared) return;
        const extra = (after && after(s)) || {};
        const d = x - b.cx();
        yield b.inp({ jump: hold, mx: airMx ?? clamp(d * 3, -1, 1), ...extra });
      }
      throw new Error('jump never landed');
    },
    *light(on, deg) { if (deg != null) b.aim = deg; yield b.inp({ lightSet: on }); },
    *until(pred, extra = {}, maxT = 10) {
      for (let k = 0; k < maxT / STEP; k++) { if (pred(s)) return; yield b.inp(extra); }
      throw new Error('until() timed out');
    },
  };
  return b;
}

// Drive a solution: returns a function giving the next input each step (or {} when done).
export function driver(s, solution) {
  const b = makeBot(s);
  const it = solution(b);
  let done = false;
  return () => {
    if (done) return {};
    const r = it.next();
    if (r.done) { done = true; return {}; }
    return r.value || {};
  };
}
