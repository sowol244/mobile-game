// Small synthesized sound set (no audio files). The AudioContext is created on the first user gesture.
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const note = semis => 261.63 * 2 ** (semis / 12); // C4 + semitones
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic, rising pitch = rising combo

  return {
    unlock: ensure,
    get muted() { return muted; },
    setMuted(v) { muted = !!v; },
    pick() { tone(note(12), 0.06, { type: 'triangle', vol: 0.03 }); },
    place() { tone(note(0), 0.09, { type: 'triangle', vol: 0.07, slide: 0.7 }); },
    invalid() { tone(note(-5), 0.12, { type: 'sawtooth', vol: 0.03, slide: 0.8 }); },
    clear(lines, combo) {
      const start = Math.min(Math.max(combo, 1) - 1, 5), n = lines + 2;
      for (let i = 0; i < n; i++) {
        const f = note(SCALE[start + i]);
        tone(f, 0.16, { type: 'square', vol: 0.035, delay: i * 0.055 });
        tone(f * 2, 0.12, { type: 'triangle', vol: 0.03, delay: i * 0.055 });
      }
    },
    allClear() { SCALE.slice(0, 9).forEach((s, i) => tone(note(s + 12), 0.2, { type: 'triangle', vol: 0.05, delay: i * 0.06 })); },
    over() { [7, 4, 0, -5].forEach((s, i) => tone(note(s), 0.3, { type: 'sawtooth', vol: 0.04, delay: i * 0.16, slide: 0.9 })); },
  };
}
