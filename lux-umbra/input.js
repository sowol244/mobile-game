// Controls.
//   Touch: ◀ ▶ on the left; on the right 손전등, 점프, and 깜빡 (above 점프: the light is off only while it is held).
//          손전등: a quick tap switches the torch on/off; press and drag aims it (and switches it on).
//          The aim stays where you left it and flips with you when you turn around.
//   Keyboard: ←→ / A D move, Space / ↑ / W jump, F / J torch, hold Shift / C = 깜빡, Q / E turn the aim, R checkpoint, Esc pause.
//   Mouse: the torch points at the cursor while the mouse is over the game; click toggles the torch.

const DRAG_MIN = 12;   // px before a press on the torch button counts as aiming
const TAP_MS = 280;

export function createInput({ stage, left, right, jump, blink, torch, knob }) {
  const st = {
    enabled: false,
    l: false, r: false, jumpHeld: false,
    keys: new Set(),
    q: { jumpPress: false, toggle: false, lightSet: undefined },
    stickAim: null,       // angle while dragging the torch button
    mouseAim: null,       // world-space point to aim at (resolved by main)
    mouseOn: false,
    lastAimShown: 0,
    onPause: null, onRetry: null,
  };

  const flag = (el, on) => el && el.classList.toggle('on', on);

  function hold(el, key) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
      st[key] = true; flag(el, true);
      if (key === 'jumpHeld') st.q.jumpPress = true;
    });
    const up = () => { st[key] = false; flag(el, false); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, up));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  hold(left, 'l'); hold(right, 'r');

  // Right thumb: 점프 and 깜빡 share one zone, so a thumb can press 점프 and slide up onto 깜빡
  // (the jump keeps its full height) or press 깜빡 directly. 깜빡 = light off only while held.
  const thumbs = new Map(); // pointerId → { zone: 'jump' | 'blink' | null, jump: held since it touched 점프 }
  const zoneAt = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && (el === blink || blink.contains(el))) return 'blink';
    if (el && (el === jump || jump.contains(el))) return 'jump';
    return null;
  };
  const syncThumbs = () => {
    let dark = false, held = false, onJump = false;
    for (const t of thumbs.values()) { if (t.zone === 'blink') dark = true; if (t.jump) held = true; if (t.zone === 'jump') onJump = true; }
    st.thumbDark = dark; st.jumpHeld = held;
    flag(blink, dark); flag(jump, onJump);
  };
  const enter = (t, zone) => {
    if (zone === 'jump' && t.zone !== 'jump' && !t.jump) { st.q.jumpPress = true; t.jump = true; }
    t.zone = zone; syncThumbs();
  };
  for (const el of [jump, blink]) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
      const t = { zone: null, jump: false }; thumbs.set(e.pointerId, t);
      enter(t, el === jump ? 'jump' : 'blink');
    });
    el.addEventListener('pointermove', e => { const t = thumbs.get(e.pointerId); if (t) { const z = zoneAt(e); if (z && z !== t.zone) enter(t, z); } });
    const up = e => { if (thumbs.delete(e.pointerId)) syncThumbs(); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, up));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  // torch button: tap = toggle, drag = aim
  let tp = null;
  torch.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { torch.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const r = torch.getBoundingClientRect();
    tp = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x0: e.clientX, y0: e.clientY, t0: performance.now(), drag: false };
    flag(torch, true); st.mouseOn = false;
  });
  torch.addEventListener('pointermove', e => {
    if (!tp || e.pointerId !== tp.id) return;
    const dx = e.clientX - tp.x0, dy = e.clientY - tp.y0;
    if (!tp.drag && Math.hypot(dx, dy) > DRAG_MIN) { tp.drag = true; st.q.lightSet = true; }
    if (tp.drag) {
      // aim from the button centre, so a short drag in any direction works
      const ax = e.clientX - tp.cx, ay = e.clientY - tp.cy;
      if (Math.hypot(ax, ay) > 6) st.stickAim = Math.atan2(ay, ax);
      if (knob) knob.style.transform = `rotate(${st.stickAim}rad)`;
    }
  });
  const tEnd = e => {
    if (!tp || (e && e.pointerId !== tp.id)) return;
    if (!tp.drag && performance.now() - tp.t0 < TAP_MS * 2) st.q.toggle = true;
    tp = null; st.stickAim = null; flag(torch, false);
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => torch.addEventListener(n, tEnd));
  torch.addEventListener('contextmenu', e => e.preventDefault());

  // keyboard
  const KEYS = {
    ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r',
    ' ': 'jump', ArrowUp: 'jump', w: 'jump', W: 'jump', z: 'jump', Z: 'jump',
    f: 'torch', F: 'torch', j: 'torch', J: 'torch', x: 'torch', X: 'torch',
    q: 'aimUp', Q: 'aimUp', e: 'aimDown', E: 'aimDown', ArrowDown: 'aimDown', s: 'aimDown', S: 'aimDown',
    Shift: 'dark', c: 'dark', C: 'dark',
  };
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (st.enabled && st.onPause) st.onPause(); return; }
    if ((e.key === 'r' || e.key === 'R') && st.enabled && st.onRetry) { st.onRetry(); return; }
    const k = KEYS[e.key];
    if (!k || !st.enabled) return;
    e.preventDefault();
    if (e.repeat) return;
    st.keys.add(k);
    if (k === 'jump') st.q.jumpPress = true;
    if (k === 'torch') st.q.toggle = true;
    if (k === 'aimUp' || k === 'aimDown') st.mouseOn = false;
  });
  window.addEventListener('keyup', e => { const k = KEYS[e.key]; if (k) st.keys.delete(k); });
  window.addEventListener('blur', () => { st.keys.clear(); thumbs.clear(); st.l = st.r = st.jumpHeld = st.thumbDark = false; [left, right, jump, blink].forEach(el => flag(el, false)); });

  // mouse aim (only real mice, never touch)
  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    st.mouseAim = { x: e.clientX - r.left, y: e.clientY - r.top }; st.mouseOn = true;
  });
  stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') st.mouseOn = false; });
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || !st.enabled || e.button !== 0) return;
    if (e.target.closest('button, a, #overlay')) return;
    st.q.toggle = true;
  });

  // One input record for the next physics step(s). aimAt(px,py) → angle, given by main (needs the camera).
  st.read = aimFromScreen => {
    const k = st.keys;
    const mx = (st.r || k.has('r') ? 1 : 0) - (st.l || k.has('l') ? 1 : 0);
    const inp = {
      mx, jump: st.jumpHeld || k.has('jump'),
      jumpPress: st.q.jumpPress, toggle: st.q.toggle, lightSet: st.q.lightSet, dark: st.thumbDark || k.has('dark'),
      aimRot: (k.has('aimDown') ? 1 : 0) - (k.has('aimUp') ? 1 : 0),
    };
    if (st.stickAim != null) inp.aim = st.stickAim;
    else if (st.mouseOn && st.mouseAim && aimFromScreen) inp.aim = aimFromScreen(st.mouseAim.x, st.mouseAim.y);
    return inp;
  };
  st.consume = () => { st.q.jumpPress = false; st.q.toggle = false; st.q.lightSet = undefined; };
  st.reset = () => { st.consume(); st.keys.clear(); thumbs.clear(); st.l = st.r = st.jumpHeld = st.thumbDark = false; st.stickAim = null; tp = null; [left, right, jump, blink, torch].forEach(el => flag(el, false)); };
  return st;
}
