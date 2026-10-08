// Sound effects, synthesised with WebAudio (no audio files). Muting is remembered on this phone.

let ac = null, muted = false;
try { muted = localStorage.getItem('brawl-mute') === '1'; } catch { /* storage blocked: sound stays on */ }

export const isMuted = () => muted;
export function setMuted(v) { muted = v; try { localStorage.setItem('brawl-mute', v ? '1' : '0'); } catch { /* ignore */ } }

// Browsers only allow audio after a tap; call this from a click handler.
export function unlock() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}

function tone(f0, f1, dur, type = 'square', vol = 0.06, delay = 0) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.08, freq = 1200, delay = 0) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay, n = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(ac.destination); src.start(t);
}

// v: 0..1 loudness, used to make far-away fights quieter.
export const sfx = {
  shot(kind, v = 1) {
    if (kind === 'burst') noise(0.06, 0.07 * v, 2400);
    else if (kind === 'arrow') tone(900, 300, 0.12, 'triangle', 0.05 * v);
    else if (kind === 'lob') tone(300, 600, 0.18, 'sine', 0.06 * v);
  },
  hit(v = 1) { tone(220, 110, 0.07, 'square', 0.045 * v); },
  hurt() { tone(160, 70, 0.14, 'sawtooth', 0.06); },
  splash(v = 1) { noise(0.25, 0.1 * v, 700); },
  kill(v = 1) { tone(520, 1040, 0.12, 'square', 0.05 * v); tone(780, 1560, 0.14, 'square', 0.04 * v, 0.08); },
  super() { tone(300, 1200, 0.3, 'sawtooth', 0.06); noise(0.3, 0.06, 3000, 0.05); },
  cube() { tone(660, 990, 0.08, 'triangle', 0.06); tone(990, 1320, 0.1, 'triangle', 0.05, 0.07); },
  box(v = 1) { noise(0.2, 0.09 * v, 900); tone(200, 90, 0.2, 'triangle', 0.05 * v); },
  click() { tone(600, 600, 0.05, 'square', 0.03); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'square', 0.05, i * 0.12)); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.25, 'triangle', 0.06, i * 0.18)); },
};
