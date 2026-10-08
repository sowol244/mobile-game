// Sounds and music, synthesised with WebAudio (no audio files). Muting is remembered on this device.
// Music: a slow pad in the dark; when lights are on, a plucked arpeggio and soft ticks join in.

let ac = null, muted = false, master = null, musicBus = null, padBus = null, lightBus = null;
try { muted = localStorage.getItem('lux-mute') === '1'; } catch { /* storage blocked: sound stays on */ }

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('lux-mute', v ? '1' : '0'); } catch { /* ignore */ }
  if (master && ac) master.gain.setTargetAtTime(v ? 0 : 1, ac.currentTime, 0.05);
}

// Browsers only allow audio after a tap; call this from an input handler.
export function unlock() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(musicBus);
      padBus = ac.createGain(); padBus.gain.value = 1; padBus.connect(lp);
      lightBus = ac.createGain(); lightBus.gain.value = 0; lightBus.connect(musicBus);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}

function tone(f0, f1, dur, type = 'square', vol = 0.06, delay = 0, out = null) {
  if (!ac || (muted && !out)) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out || master); o.start(t); o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise(dur, vol = 0.08, freq = 1200, delay = 0, type = 'lowpass', out = null) {
  if (!ac || (muted && !out)) return;
  if (!noiseBuf) { const n = ac.sampleRate; noiseBuf = ac.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
  const t = ac.currentTime + delay, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out || master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

let lastTick = 0;
export const sfx = {
  click() { tone(700, 700, 0.05, 'square', 0.03); },
  torchOn() { noise(0.025, 0.12, 3500, 0, 'highpass'); tone(1900, 1500, 0.035, 'square', 0.03, 0.01); tone(220, 180, 0.06, 'triangle', 0.04); },
  torchOff() { noise(0.02, 0.08, 2200, 0, 'highpass'); tone(900, 700, 0.03, 'square', 0.02, 0.005); },
  lever() { noise(0.09, 0.14, 500); tone(150, 90, 0.14, 'square', 0.05); tone(1300, 1300, 0.03, 'square', 0.025, 0.08); },
  lens() { tone(1568, 1568, 0.25, 'sine', 0.05); tone(2349, 2349, 0.3, 'sine', 0.03, 0.06); },
  jump() { tone(320, 560, 0.1, 'triangle', 0.045); },
  land() { noise(0.07, 0.06, 380); },
  die() { tone(420, 55, 0.5, 'sawtooth', 0.05); noise(0.35, 0.08, 900); },
  shard() { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, f, 0.35, 'sine', 0.05, i * 0.07)); },
  check() { tone(523, 523, 0.2, 'triangle', 0.05); tone(784, 784, 0.3, 'triangle', 0.045, 0.1); },
  reveal() { for (let i = 0; i < 6; i++) tone(1200 + i * 220, 1300 + i * 240, 0.25, 'sine', 0.025, i * 0.05); },
  wake() { noise(0.6, 0.12, 180); tone(70, 50, 0.6, 'sawtooth', 0.035); },
  freeze() { noise(0.15, 0.05, 1500, 0, 'highpass'); },
  solid() { const t = performance.now(); if (t - lastTick < 70) return; lastTick = t; tone(1500, 1700, 0.04, 'sine', 0.018); },
  thud() { noise(0.18, 0.12, 300); tone(90, 60, 0.15, 'triangle', 0.05); },
  respawn() { tone(392, 784, 0.25, 'sine', 0.04); },
  clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.4, 'triangle', 0.05, i * 0.1)); },
  star(i) { tone(880 + i * 220, 880 + i * 220, 0.22, 'triangle', 0.05); },
};

// ---------- music ----------
// A minor, four chords. 0.3 s per step, 8 steps per chord.
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const PENTA = [69, 72, 74, 76, 79, 81, 84];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const STEP_S = 0.3;
let timer = null, nextT = 0, stepN = 0, lightOn = false;

function pad(chord, t) {
  for (const m of [chord[0] - 12, ...chord]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = hz(m); o.detune.value = (Math.random() - 0.5) * 8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 1.0); g.gain.setValueAtTime(0.03, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g).connect(padBus); o.start(t); o.stop(t + 3.5);
  }
}
function bell(m, t, vol = 0.022) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.value = hz(m);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  o.connect(g).connect(padBus); o.start(t); o.stop(t + 2.3);
}
function pluck(m, t, vol = 0.03) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = hz(m);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(lightBus); o.start(t); o.stop(t + 0.3);
}
function tick(t) {
  if (!noiseBuf) return;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(f).connect(g).connect(lightBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.05);
}

function schedule() {
  if (!ac) return;
  while (nextT < ac.currentTime + 0.35) {
    const ci = Math.floor(stepN / 8) % CHORDS.length, chord = CHORDS[ci], k = stepN % 8;
    if (k === 0) pad(chord, nextT);
    if (k % 4 === 2 && Math.random() < 0.6) bell(PENTA[Math.floor(Math.random() * PENTA.length)], nextT);
    const arp = [chord[0], chord[1], chord[2], chord[0] + 12, chord[2], chord[1], chord[0] + 12, chord[2] + 12];
    pluck(arp[k] + 12, nextT);
    if (k % 2 === 1) tick(nextT);
    nextT += STEP_S; stepN++;
  }
}

export function music(on) {
  if (!ac) return;
  if (on && !timer) {
    if (!noiseBuf) noise(0.01, 0.0001);
    nextT = ac.currentTime + 0.1; stepN = 0;
    timer = setInterval(schedule, 90);
    musicBus.gain.setTargetAtTime(0.9, ac.currentTime, 0.6);
  } else if (!on && timer) {
    musicBus.gain.setTargetAtTime(0, ac.currentTime, 0.3);
    clearInterval(timer); timer = null; // notes already scheduled fade out with the bus
  }
}

// Lights on → the plucked layer fades in; lights off → back to the calm pad.
export function musicLight(on) {
  if (!ac || on === lightOn) return;
  lightOn = on;
  lightBus.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, on ? 0.12 : 0.5);
  padBus.gain.setTargetAtTime(on ? 0.65 : 1, ac.currentTime, 0.4);
}
