let audio = null;
let noiseBuffer = null;
let muted = false;
try { muted = localStorage.getItem('survivor-run-mute') === '1'; } catch { /* 저장할 수 없어도 플레이할 수 있어요. */ }

export const isMuted = () => muted;
export function setMuted(value) {
  muted = !!value;
  try { localStorage.setItem('survivor-run-mute', muted ? '1' : '0'); } catch { /* 설정 저장은 선택 사항이에요. */ }
}

export function unlock() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (!noiseBuffer) {
      noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.6), audio.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}

function tone(from, to, duration, type, volume) {
  if (muted || !audio) return;
  const at = audio.currentTime;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + duration);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(at); osc.stop(at + duration + 0.02);
}

function noiseBurst(type, frequency, duration, volume) {
  if (muted || !audio || !noiseBuffer) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = noiseBuffer;
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, at);
  filter.Q.setValueAtTime(0.72, at);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(at);
  source.stop(at + duration);
}

export const sfx = {
  shot() {
    noiseBurst('highpass', 1550, 0.026, 0.018);
    tone(126, 44, 0.105, 'triangle', 0.042);
  },
  allyShot() {
    noiseBurst('highpass', 1250, 0.021, 0.007);
    tone(118, 52, 0.075, 'triangle', 0.015);
  },
  bossShot() {
    noiseBurst('highpass', 980, 0.035, 0.014);
    tone(102, 47, 0.105, 'triangle', 0.027);
  },
  hit() {
    noiseBurst('bandpass', 720, 0.04, 0.018);
    tone(142, 48, 0.09, 'triangle', 0.032);
  },
  kill(combo = 1) {
    tone(125, 42, 0.12, 'triangle', 0.05);
    if (combo >= 2) tone(520 + Math.min(combo, 5) * 90, 980, 0.095, 'triangle', 0.035);
  },
  pick() { tone(620, 1040, 0.14, 'triangle', 0.05); },
  hurt() { tone(165, 62, 0.22, 'sawtooth', 0.065); },
  explosion() {
    noiseBurst('lowpass', 520, 0.48, 0.07);
    tone(76, 30, 0.46, 'triangle', 0.082);
  },
  bossSlam() {
    noiseBurst('lowpass', 330, 0.25, 0.055);
    tone(68, 28, 0.36, 'triangle', 0.066);
  },
  upgrade() { [740, 990].forEach((f, i) => setTimeout(() => tone(f, f * 1.15, 0.11, 'triangle', 0.035), i * 70)); },
  boss() { tone(115, 58, 0.52, 'sawtooth', 0.075); },
  win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, f, 0.2, 'triangle', 0.05), i * 115)); },
  lose() { tone(280, 75, 0.55, 'triangle', 0.065); },
};

