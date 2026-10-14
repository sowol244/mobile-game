let audio = null;
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

export const sfx = {
  shot() {
    tone(145, 48, 0.09, 'triangle', 0.045);
    tone(540, 185, 0.045, 'square', 0.012);
  },
  allyShot() { tone(410, 160, 0.052, 'triangle', 0.009); },
  hit() {
    tone(185, 58, 0.085, 'triangle', 0.038);
    tone(880, 320, 0.032, 'square', 0.01);
  },
  kill(combo = 1) {
    tone(125, 42, 0.12, 'triangle', 0.05);
    if (combo >= 2) tone(520 + Math.min(combo, 5) * 90, 980, 0.095, 'triangle', 0.035);
  },
  pick() { tone(620, 1040, 0.14, 'triangle', 0.05); },
  hurt() { tone(165, 62, 0.22, 'sawtooth', 0.065); },
  explosion() { tone(105, 36, 0.42, 'sawtooth', 0.075); },
  bossSlam() {
    tone(82, 34, 0.28, 'sawtooth', 0.052);
    tone(145, 48, 0.13, 'triangle', 0.032);
  },
  upgrade() { [740, 990].forEach((f, i) => setTimeout(() => tone(f, f * 1.15, 0.11, 'triangle', 0.035), i * 70)); },
  boss() { tone(115, 58, 0.52, 'sawtooth', 0.075); },
  win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, f, 0.2, 'triangle', 0.05), i * 115)); },
  lose() { tone(280, 75, 0.55, 'triangle', 0.065); },
};

