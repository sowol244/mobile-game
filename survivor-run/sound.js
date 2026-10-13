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
  shot() { tone(470, 190, 0.055, 'square', 0.012); },
  allyShot() { tone(620, 330, 0.045, 'triangle', 0.006); },
  hit() { tone(220, 120, 0.06, 'triangle', 0.024); },
  pick() { tone(620, 1040, 0.14, 'triangle', 0.05); },
  hurt() { tone(165, 62, 0.22, 'sawtooth', 0.065); },
  explosion() { tone(105, 36, 0.42, 'sawtooth', 0.075); },
  upgrade() { [740, 990].forEach((f, i) => setTimeout(() => tone(f, f * 1.15, 0.11, 'triangle', 0.035), i * 70)); },
  boss() { tone(115, 58, 0.52, 'sawtooth', 0.075); },
  win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, f, 0.2, 'triangle', 0.05), i * 115)); },
  lose() { tone(280, 75, 0.55, 'triangle', 0.065); },
};

