// Scripted players: each stage's solution is a generator of per-step inputs (see solutions.js).
// Used by game.test.mjs (proves every stage is solvable with the intended steps) and by the
// title-screen demo / window.__lux.autoplay in the browser.

import { STEP } from './config.js';
import { clamp } from './game.js';

const DEG = Math.PI / 180;
export const onGround = s => s.p.onGround;

// blink: play like a phone player — switch the torch on once, then hold 깜빡 (dark) instead of switching it off.
export function makeBot(s, { blink = false } = {}) {
  const b = {
    s, aim: null, tgt: null, // degrees, held while set
    blink, dark: false,
    // Rooms are scripted in local x (0 at the room's entry side), so a room can be laid out facing either way.
    fr: { x0: 0, w: 0, dir: 1 },
    at(x0, w, dir) { b.fr = { x0, w, dir }; },
    X: lx => (b.fr.dir > 0 ? b.fr.x0 + lx : b.fr.x0 + b.fr.w - lx),
    lx: gx => (b.fr.dir > 0 ? gx - b.fr.x0 : b.fr.x0 + b.fr.w - gx),
    lcx: () => b.lx(s.p.x + s.p.w / 2),
    cx: () => s.p.x + s.p.w / 2,
    feet: () => s.p.y + s.p.h,
    inp(extra = {}) {
      const e = { ...extra };
      if (b.blink && 'lightSet' in e) {
        if (e.lightSet === false) { b.dark = true; delete e.lightSet; }
        else if (e.lightSet === true) { b.dark = false; if (s.fl.on) delete e.lightSet; }
      }
      if (b.tgt) b.aim = Math.atan2(b.tgt.y - (s.p.y + 0.35), b.tgt.x - b.cx()) / DEG;
      return { ...(b.aim == null ? {} : { aim: b.aim * DEG }), ...(b.blink ? { dark: b.dark } : {}), ...e };
    },
    *wait(t) { for (let k = 0; k < Math.round(t / STEP); k++) yield b.inp(); },
    // walk to x (player centre); slows down near the target
    *go(lx, tol = 0.1, maxT = 12) {
      const x = b.X(lx);
      for (let k = 0; k < maxT / STEP; k++) {
        const d = x - b.cx();
        if (Math.abs(d) < tol && Math.abs(s.p.vx) < 0.8) return;
        yield b.inp({ mx: clamp(d * 2.2, -1, 1) });
      }
      throw new Error(`go(${lx}) timed out at x=${b.cx().toFixed(2)}`);
    },
    // hold a direction until pred() holds
    *run(mx, pred, maxT = 10, extra = {}) {
      for (let k = 0; k < maxT / STEP; k++) { if (pred(s)) return; yield b.inp({ mx: mx * b.fr.dir, ...extra }); }
      throw new Error('run() timed out');
    },
    // jump (full height) steering toward x in the air; ends on landing. hold=false → short hop.
    *jump(lx, { hold = true, airMx = null, after = null } = {}) {
      const x = b.X(lx);
      if (airMx != null) airMx *= b.fr.dir;
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
    // aim in local degrees: 0 = forward (the room's direction), 90 = down, -90 = up
    aimAt(deg) { b.tgt = null; b.aim = b.fr.dir > 0 ? deg : 180 - deg; },
    // keep the torch pointed at a spot (local x, global y) while moving
    aimTo(lx, y) { b.tgt = { x: b.X(lx), y }; },
    *light(on, deg) { if (deg != null) b.aimAt(deg); yield b.inp({ lightSet: on }); },
    *until(pred, extra = {}, maxT = 10) {
      for (let k = 0; k < maxT / STEP; k++) { if (pred(s)) return; yield b.inp(extra); }
      throw new Error('until() timed out');
    },
  };
  return b;
}

// Drive a solution: returns a function giving the next input each step (or {} when done).
export function driver(s, solution, opts) {
  const b = makeBot(s, opts);
  const it = solution(b);
  let done = false;
  return () => {
    if (done) return {};
    const r = it.next();
    if (r.done) { done = true; return {}; }
    return r.value || {};
  };
}
