// Synthesized sounds (no audio files). The AudioContext is created on the first user gesture.
export function createSound() {
  let ctx = null, muted = false, noiseBuf = null, master = null;
  const ensure = () => {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createDynamicsCompressor();
        master.threshold.value = -14; master.ratio.value = 6;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  };
  const noise = c => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  function env(c, t, vol, attack, dur) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.05, delay = 0, slide = 0, attack = 0.005 } = {}) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    o.connect(env(c, t, vol, attack, dur)); o.start(t); o.stop(t + dur + 0.03);
  }
  // Filtered noise burst; f0 → f1 sweeps the filter.
  function hiss(dur, { vol = 0.1, delay = 0, type = 'bandpass', f0 = 1000, f1 = 0, q = 1, attack = 0.005 } = {}) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter();
    s.buffer = noise(c); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f); f.connect(env(c, t, vol, attack, dur));
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.03);
  }
  const note = semis => 261.63 * 2 ** (semis / 12);
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  return {
    unlock: ensure,
    get muted() { return muted; },
    setMuted(v) { muted = !!v; },
    click() { tone(note(12), 0.05, { type: 'triangle', vol: 0.04 }); },
    // Gravity change: a deep space-warp whoosh — swept noise plus a falling sub tone.
    whoosh(fast = false) {
      const d = fast ? 0.22 : 0.42;
      hiss(d, { vol: 0.16, f0: 180, f1: 2600, q: 2.5, attack: d * 0.55 });
      hiss(d * 0.8, { vol: 0.06, type: 'highpass', f0: 3000, f1: 7000, attack: d * 0.5 });
      tone(120, d + 0.1, { type: 'sine', vol: 0.12, slide: 0.35, attack: 0.03 });
      tone(240, d, { type: 'triangle', vol: 0.03, slide: 0.5, attack: 0.05 });
    },
    // Blocks hitting the wall: heavy plastic/glass marble thud (body + glassy click). n = blocks landing now.
    thud(n = 1, speed = 1) {
      const v = Math.min(1, 0.45 + n * 0.08) * Math.min(1, 0.5 + speed * 0.5);
      tone(95 + Math.random() * 25, 0.16, { type: 'sine', vol: 0.16 * v, slide: 0.55 });
      hiss(0.05, { vol: 0.07 * v, type: 'bandpass', f0: 2200 + Math.random() * 1400, q: 6 });
      tone(1900 + Math.random() * 900, 0.06, { type: 'sine', vol: 0.025 * v, slide: 0.8 });
    },
    bump() { tone(70, 0.12, { type: 'sine', vol: 0.09, slide: 0.7 }); hiss(0.05, { vol: 0.03, f0: 500, q: 2 }); },
    locked() { tone(160, 0.05, { type: 'square', vol: 0.015 }); },
    // Explosion: crunchy noise burst + a pentatonic chime that climbs with the chain.
    boom(chain = 1, size = 4) {
      const v = Math.min(1.4, 0.7 + size * 0.05);
      hiss(0.35, { vol: 0.14 * v, type: 'lowpass', f0: 3200, f1: 140, q: 0.8 });
      hiss(0.12, { vol: 0.06, type: 'highpass', f0: 4000, q: 0.7 });
      tone(60, 0.25, { type: 'sine', vol: 0.12, slide: 0.5 });
      const s = Math.min(chain - 1, 7);
      for (let i = 0; i < 3; i++) {
        const f = note(PENTA[s + i] + 12);
        tone(f, 0.2, { type: 'triangle', vol: 0.045, delay: 0.03 + i * 0.05 });
        tone(f * 2, 0.12, { type: 'sine', vol: 0.02, delay: 0.03 + i * 0.05 });
      }
    },
    laser() { tone(1800, 0.28, { type: 'sawtooth', vol: 0.035, slide: 0.15 }); hiss(0.25, { vol: 0.05, type: 'bandpass', f0: 5000, f1: 800, q: 4 }); },
    ice() { hiss(0.09, { vol: 0.08, type: 'highpass', f0: 5000, q: 1 }); tone(3200, 0.05, { type: 'square', vol: 0.015, delay: 0.02 }); },
    hole() { tone(500, 0.5, { type: 'sine', vol: 0.08, slide: 0.15 }); tone(760, 0.45, { type: 'triangle', vol: 0.03, slide: 0.2, delay: 0.05 }); hiss(0.5, { vol: 0.05, f0: 2400, f1: 200, q: 5, attack: 0.2 }); },
    spawn() { tone(note(19), 0.07, { type: 'triangle', vol: 0.02 }); },
    warn() { tone(note(-2), 0.1, { type: 'square', vol: 0.02 }); tone(note(-2), 0.1, { type: 'square', vol: 0.02, delay: 0.14 }); },
    item() { [0, 7, 12].forEach((s, i) => tone(note(s + 12), 0.12, { type: 'triangle', vol: 0.04, delay: i * 0.05 })); },
    fever() {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(s + 7), 0.16, { type: 'square', vol: 0.03, delay: i * 0.05 }));
      hiss(0.6, { vol: 0.1, f0: 200, f1: 6000, q: 2, attack: 0.4 });
    },
    rescue() { [0, 4, 7, 12, 16].forEach((s, i) => tone(note(s + 12), 0.22, { type: 'triangle', vol: 0.05, delay: i * 0.07 })); },
    clear() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(s + 7), 0.22, { type: 'triangle', vol: 0.05, delay: i * 0.075 })); },
    star(i) { tone(note(PENTA[4 + i * 2] + 12), 0.25, { type: 'triangle', vol: 0.06 }); tone(note(PENTA[4 + i * 2] + 24), 0.2, { type: 'sine', vol: 0.025 }); },
    fail() { [7, 4, 0, -5].forEach((s, i) => tone(note(s), 0.3, { type: 'sawtooth', vol: 0.035, delay: i * 0.15, slide: 0.9 })); },
    over() { hiss(0.9, { vol: 0.14, type: 'lowpass', f0: 2000, f1: 60 }); [7, 3, 0, -5, -12].forEach((s, i) => tone(note(s), 0.35, { type: 'sawtooth', vol: 0.035, delay: i * 0.16, slide: 0.85 })); },
  };
}
