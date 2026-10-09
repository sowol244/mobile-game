// Thumbsticks on the play area plus keyboard/mouse.
//   left half  → move stick, appears where the thumb lands
//   right half → attack stick: a quick tap fires at the nearest enemy (auto aim),
//                drag out and let go to fire that way, drag back to the middle to cancel
//   ★ button   → super stick, same tap/drag rules (only when the gauge is full)
// Resting spots for all three are drawn faintly (see render.js) so new players know where to put their thumbs.
// Move/up are tracked on window so a thumb sliding off the canvas never leaves a stick stuck.

const RADIUS = 52;            // px the knob can travel
const DEAD = 0.12;            // move stick dead zone
const AIM_MIN = 0.3;          // drag beyond 30% of the radius = manual aim
const TAP_MS = 260;

// Where the sticks rest, from the play-area size. Shared with the renderer.
export function stickLayout(w, h) {
  const base = Math.max(70, Math.min(110, h * 0.14));
  return {
    move: { x: Math.max(70, w * 0.2), y: h - base },
    attack: { x: Math.min(w - 70, w * 0.8), y: h - base },
    super: { x: Math.min(w - 70, w * 0.8) - 6, y: h - base - 104, r: 30 }, // just above the attack spot
    radius: RADIUS,
  };
}

export function createInput(el) {
  const st = {
    move: null,  // { id, ox, oy, x, y }  (x, y in -1..1)
    aim: null,   // { id, ox, oy, x, y, t0, type: 'fire' | 'super' }
    keys: new Set(),
    queued: null, // { type, auto } or { type, a, f }, consumed by take()
    radius: RADIUS,
    superReady: false, // set by the game each frame
    enabled: false,
  };

  const rel = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
  function upd(s, p) {
    let dx = p.x - s.ox, dy = p.y - s.oy; const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
    s.x = dx / RADIUS; s.y = dy / RADIUS;
  }

  el.addEventListener('pointerdown', e => {
    if (!st.enabled || e.target.closest('button')) return; // the pause button keeps its own click
    e.preventDefault();
    const p = rel(e), L = stickLayout(p.w, p.h);
    if (p.x < p.w / 2) {
      if (st.move) return;
      st.move = { id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0 };
    } else {
      if (st.aim) return;
      const onSuper = st.superReady && Math.hypot(p.x - L.super.x, p.y - L.super.y) < L.super.r + 16;
      // The stick centres where the thumb lands, so a tap anywhere on ★ is a tap (auto aim), never a drag.
      st.aim = { id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0, t0: performance.now(), type: onSuper ? 'super' : 'fire' };
    }
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* window listeners cover it */ }
  });
  window.addEventListener('pointermove', e => {
    if (st.move && e.pointerId === st.move.id) upd(st.move, rel(e));
    if (st.aim && e.pointerId === st.aim.id) upd(st.aim, rel(e));
  });
  const end = e => {
    if (st.move && e.pointerId === st.move.id) st.move = null;
    if (st.aim && e.pointerId === st.aim.id) {
      const a = st.aim, len = Math.hypot(a.x, a.y);
      if (len >= AIM_MIN) st.queued = { type: a.type, a: Math.atan2(a.y, a.x), f: Math.min(1, len) };
      else if (performance.now() - a.t0 < TAP_MS) st.queued = { type: a.type, auto: true };
      st.aim = null;
    }
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', e => { if (st.aim && e.pointerId === st.aim.id) st.aim = null; if (st.move && e.pointerId === st.move.id) st.move = null; });
  el.addEventListener('contextmenu', e => e.preventDefault());

  const KEYS = { w: 'u', arrowup: 'u', s: 'd', arrowdown: 'd', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  window.addEventListener('keydown', e => {
    if (!st.enabled) return;
    const k = KEYS[e.key.toLowerCase()];
    if (k) { st.keys.add(k); e.preventDefault(); }
    if (e.key === ' ') { st.queued = { type: 'fire', auto: true }; e.preventDefault(); }
    if (e.key.toLowerCase() === 'e') { st.queued = { type: 'super', auto: true }; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { const k = KEYS[e.key.toLowerCase()]; if (k) st.keys.delete(k); });
  window.addEventListener('blur', () => { st.keys.clear(); st.move = null; st.aim = null; });

  return {
    state: st,
    set enabled(v) { st.enabled = v; if (!v) { st.move = st.aim = null; st.keys.clear(); st.queued = null; } },
    get enabled() { return st.enabled; },
    // Movement vector, length 0..1.
    moveVec() {
      let x = 0, y = 0;
      if (st.move) { const l = Math.hypot(st.move.x, st.move.y); if (l > DEAD) { x = st.move.x; y = st.move.y; } }
      if (st.keys.has('l')) x -= 1; if (st.keys.has('r')) x += 1; if (st.keys.has('u')) y -= 1; if (st.keys.has('d')) y += 1;
      return { x, y };
    },
    // What is being aimed right now (for the aim guide), or null: { type, a, f }.
    aiming() { const a = st.aim; return a && Math.hypot(a.x, a.y) >= AIM_MIN ? { type: a.type, a: Math.atan2(a.y, a.x), f: Math.min(1, Math.hypot(a.x, a.y)) } : null; },
    take() { const q = st.queued; st.queued = null; return q; },
  };
}
