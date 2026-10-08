// Synthesized sounds (no audio files). The AudioContext is created on the first user gesture.
export function createSound() {
  let ctx = null, muted = false;
  const ensure = () => {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  };
  function tone(freq, dur, { type = 'sine', vol = 0.05, delay = 0, slide = 0 } = {}) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const note = s => 261.63 * 2 ** (s / 12); // C4 + semitones
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];

  return {
    unlock: ensure,
    get muted() { return muted; },
    setMuted(v) { muted = !!v; },
    tap() { tone(note(24), 0.035, { type: 'triangle', vol: 0.02 }); },
    place(d) { const s = PENTA[(d - 1) % 9]; tone(note(s + 7), 0.12, { type: 'sine', vol: 0.07 }); tone(note(s + 19), 0.06, { type: 'triangle', vol: 0.02, delay: 0.01 }); },
    note() { tone(note(26), 0.05, { type: 'triangle', vol: 0.025 }); },
    erase() { tone(note(10), 0.07, { type: 'triangle', vol: 0.035, slide: 0.7 }); },
    wrong() { tone(note(-6), 0.16, { type: 'square', vol: 0.03, slide: 0.8 }); tone(note(-7), 0.14, { type: 'sine', vol: 0.05, delay: 0.05 }); },
    undo() { tone(note(9), 0.08, { type: 'triangle', vol: 0.04, slide: 0.75 }); },
    hint() { tone(note(12), 0.12, { type: 'sine', vol: 0.05 }); tone(note(19), 0.16, { type: 'sine', vol: 0.045, delay: 0.08 }); },
    unit(n = 1) { [0, 4, 7].slice(0, 2 + Math.min(1, n - 1)).forEach((s, i) => tone(note(s + 19), 0.14, { type: 'sine', vol: 0.04, delay: 0.06 + i * 0.06 })); },
    digit() { [7, 12, 16, 19].forEach((s, i) => tone(note(s + 12), 0.1, { type: 'triangle', vol: 0.03, delay: 0.05 + i * 0.045 })); },
    win() {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { tone(note(s + 12), 0.24, { type: 'triangle', vol: 0.05, delay: i * 0.08 }); tone(note(s), 0.22, { type: 'sine', vol: 0.03, delay: i * 0.08 }); });
    },
    fail() { [4, 0, -5].forEach((s, i) => tone(note(s), 0.26, { type: 'sine', vol: 0.05, delay: i * 0.14, slide: 0.93 })); },
  };
}
