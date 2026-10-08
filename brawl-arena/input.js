// Two floating thumbsticks on the play area plus keyboard/mouse.
//   left half  → move stick, appears where the thumb lands
//   right half → attack stick: a quick tap fires at the nearest enemy (auto aim),
//                drag out and let go to fire that way, drag back to the middle to cancel
// Move/up are tracked on window so a thumb sliding off the canvas never leaves a stick stuck.

const RADIUS = 52;            // px the knob can travel
const DEAD = 0.12;            // move stick dead zone
const AIM_MIN = 0.3;          // drag beyond 30% of the radius = manual aim
const TAP_MS = 260;

export function createInput(el) {
  const st = {
    move: null, // { id, ox, oy, x, y }  (x, y in -1..1)
    aim: null,  // { id, ox, oy, x, y, t0 }
    keys: new Set(),
    queued: null, // 'auto' | angle, consumed by take()
    radius: RADIUS,
  };

  const rel = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }; };
  function upd(s, p) {
    let dx = p.x - s.ox, dy = p.y - s.oy; const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
    s.x = dx / RADIUS; s.y = dy / RADIUS;
  }

  el.addEventListener('pointerdown', e => {
    if (!st.enabled || e.target.closest('button')) return; // the pause button keeps its own click
    e.preventDefault();
    const p = rel(e);
    if (p.x < p.w / 2) {
      if (st.move) return;
      st.move = { id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0 };
    } else {
      if (st.aim) return;
      st.aim = { id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0, t0: performance.now() };
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
      if (len >= AIM_MIN) st.queued = Math.atan2(a.y, a.x);
      else if (performance.now() - a.t0 < TAP_MS) st.queued = 'auto';
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
    if (e.key === ' ') { st.queued = 'auto'; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { const k = KEYS[e.key.toLowerCase()]; if (k) st.keys.delete(k); });
  window.addEventListener('blur', () => { st.keys.clear(); st.move = null; st.aim = null; });

  return {
    state: st,
    set enabled(v) { st.enabled = v; if (!v) { st.move = st.aim = null; st.keys.clear(); st.queued = null; } },
    // Movement vector, length 0..1.
    moveVec() {
      let x = 0, y = 0;
      if (st.move) { const l = Math.hypot(st.move.x, st.move.y); if (l > DEAD) { x = st.move.x; y = st.move.y; } }
      if (st.keys.has('l')) x -= 1; if (st.keys.has('r')) x += 1; if (st.keys.has('u')) y -= 1; if (st.keys.has('d')) y += 1;
      return { x, y };
    },
    // Angle being aimed right now (for the aim line), or null.
    aiming() { const a = st.aim; return a && Math.hypot(a.x, a.y) >= AIM_MIN ? Math.atan2(a.y, a.x) : null; },
    take() { const q = st.queued; st.queued = null; return q; },
  };
}
