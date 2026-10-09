// 8-bit sounds synthesized with WebAudio (pulse, triangle and noise channels, like the NES APU). No audio files.
// The music is an original folk-dance tune in D minor written for this game.

const midi = m => 440 * 2 ** ((m - 69) / 12);

// Melody as [midi, eighths]; 0 = rest. 16 bars: A section (dance) + B section (song).
const MEL = [
  [74, 1], [74, 1], [69, 1], [69, 1], [77, 2], [76, 1], [74, 1],
  [72, 1], [72, 1], [67, 1], [67, 1], [76, 2], [74, 1], [72, 1],
  [70, 1], [70, 1], [74, 1], [77, 1], [81, 2], [79, 1], [77, 1],
  [76, 1], [77, 1], [79, 1], [76, 1], [74, 4],
  [81, 1], [81, 1], [79, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1],
  [77, 1], [77, 1], [76, 1], [74, 1], [76, 2], [69, 2],
  [70, 1], [74, 1], [72, 1], [70, 1], [69, 1], [72, 1], [70, 1], [67, 1],
  [69, 1], [73, 1], [76, 1], [79, 1], [74, 4],
  [77, 2], [81, 2], [79, 3], [77, 1],
  [76, 2], [79, 2], [77, 3], [76, 1],
  [74, 2], [77, 2], [76, 1], [74, 1], [72, 1], [70, 1],
  [69, 6], [73, 1], [76, 1],
  [77, 2], [81, 2], [86, 3], [84, 1],
  [82, 2], [81, 2], [79, 3], [77, 1],
  [76, 1], [77, 1], [79, 1], [81, 1], [79, 1], [77, 1], [76, 1], [73, 1],
  [74, 6], [0, 2],
];
// One bass root per bar (oom-pah on the triangle channel).
const BASS = [50, 48, 46, 45, 41, 50, 43, 45, 41, 48, 46, 45, 46, 43, 45, 50];

export function createSound() {
  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, pulse = {};
  let muted = false, musicOn = true, playing = false, danger = false;
  let timer = null, nextTime = 0, melIdx = 0, melLeft = 0, eighth = 0;

  const ensure = () => {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
        musBus = ctx.createGain(); musBus.gain.value = 0.55; musBus.connect(master);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  };
  const wave = duty => {
    if (pulse[duty]) return pulse[duty];
    const N = 40, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) { re[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n); im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n); }
    return (pulse[duty] = ctx.createPeriodicWave(re, im));
  };
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  // A note on a channel: kind 'p12'/'p25'/'p50' (pulse duty), 'tri' or 'noise'.
  function note(kind, freq, dur, { vol = 0.1, t = 0, slide = 0, bus = sfxBus, decay = true, cutoff = 0 } = {}) {
    if (!ctx || muted) return;
    const start = Math.max(ctx.currentTime, t || ctx.currentTime), gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, start);
    if (decay) gn.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    else { gn.gain.setValueAtTime(vol, start + dur * 0.85); gn.gain.linearRampToValueAtTime(0, start + dur); }
    gn.connect(bus);
    let src;
    if (kind === 'noise') {
      src = ctx.createBufferSource(); src.buffer = noise(); src.playbackRate.value = freq;
      if (cutoff) { const f = ctx.createBiquadFilter(); f.type = cutoff > 0 ? 'highpass' : 'lowpass'; f.frequency.value = Math.abs(cutoff); src.connect(f); f.connect(gn); }
      else src.connect(gn);
    } else {
      src = ctx.createOscillator();
      if (kind === 'tri') src.type = 'triangle'; else src.setPeriodicWave(wave(kind === 'p12' ? 0.125 : kind === 'p25' ? 0.25 : 0.5));
      src.frequency.setValueAtTime(freq, start);
      if (slide) src.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), start + dur);
      src.connect(gn);
    }
    src.start(start, kind === 'noise' ? Math.random() * 0.5 : 0); src.stop(start + dur + 0.02);
  }
  const fx = (fn) => { if (!ctx || muted) return; fn(ctx.currentTime); };

  /* ---------- music ---------- */
  function schedule() {
    if (!ctx || !playing) return;
    const ahead = ctx.currentTime + 0.18;
    while (nextTime < ahead) {
      const len = (60 / (danger ? 186 : 148)) / 2; // seconds per eighth
      if (!muted && musicOn) {
        if (melLeft <= 0) {
          const [m, d] = MEL[melIdx];
          if (m) note('p25', midi(m), d * len * 0.92, { vol: 0.09, t: nextTime, bus: musBus, decay: false });
          if (m && d >= 2) note('p12', midi(m) * 1.003, d * len * 0.85, { vol: 0.03, t: nextTime + len * 0.25, bus: musBus }); // echo
          melLeft = d; melIdx = (melIdx + 1) % MEL.length;
        }
        const bar = Math.floor(eighth / 8) % BASS.length, pos = eighth % 8, root = BASS[bar];
        const bn = [root, root + 7, root + 12, root + 7][pos % 4];
        note('tri', midi(bn), len * 0.8, { vol: 0.22, t: nextTime, bus: musBus, decay: false });
        if (pos % 4 === 0) note('noise', 0.35, 0.09, { vol: 0.16, t: nextTime, bus: musBus, cutoff: -900 });
        else if (pos % 2 === 1) note('noise', 1, 0.035, { vol: 0.05, t: nextTime, bus: musBus, cutoff: 6000 });
        else note('noise', 0.8, 0.07, { vol: 0.08, t: nextTime, bus: musBus, cutoff: 2500 });
      } else if (melLeft <= 0) { melLeft = MEL[melIdx][1]; melIdx = (melIdx + 1) % MEL.length; }
      melLeft--; eighth++;
      nextTime += len;
    }
  }

  return {
    unlock: ensure,
    get muted() { return muted; },
    setMuted(v) { muted = !!v; },
    get musicOn() { return musicOn; },
    setMusic(v) { musicOn = !!v; },
    setDanger(v) { danger = !!v; },
    get danger() { return danger; },
    musicStart(reset = true) {
      if (!ensure()) return;
      if (reset) { melIdx = 0; melLeft = 0; eighth = 0; }
      playing = true; nextTime = ctx.currentTime + 0.05;
      clearInterval(timer); timer = setInterval(schedule, 40); schedule();
    },
    musicStop() { playing = false; clearInterval(timer); timer = null; },
    get musicPlaying() { return playing; },

    click() { fx(t => note('p50', 1320, 0.05, { vol: 0.05 })); },
    move() { fx(t => note('p50', 220, 0.035, { vol: 0.05, slide: 0.9 })); },
    rotate() { fx(t => { note('p25', 660, 0.04, { vol: 0.05 }); note('p25', 880, 0.05, { vol: 0.04, t: t + 0.035 }); }); },
    lock() { fx(t => { note('noise', 0.25, 0.1, { vol: 0.22, cutoff: -1200 }); note('tri', 110, 0.08, { vol: 0.2, slide: 0.5 }); }); },
    clear(n) {
      fx(t => {
        note('noise', 0.6, 0.35, { vol: 0.2, cutoff: -3500 });
        [0, 1, 2].forEach(i => note('p50', midi(84 - i * 3), 0.07, { vol: 0.05, t: t + i * 0.06 }));
        if (n > 1) note('p25', midi(88), 0.2, { vol: 0.04, t: t + 0.2, slide: 0.5 });
      });
    },
    tetris() {
      fx(t => {
        note('noise', 0.5, 0.5, { vol: 0.25, cutoff: -4000 });
        [69, 73, 76, 81, 85, 88, 93].forEach((m, i) => { note('p25', midi(m), 0.09, { vol: 0.06, t: t + i * 0.045 }); note('p12', midi(m + 12), 0.06, { vol: 0.03, t: t + i * 0.045 + 0.02 }); });
      });
    },
    level() { fx(t => [76, 79, 83, 88, 91, 95].forEach((m, i) => note('p50', midi(m), 0.07, { vol: 0.05, t: t + i * 0.05 }))); },
    pause() { fx(t => { note('p50', midi(88), 0.06, { vol: 0.05 }); note('p50', midi(83), 0.08, { vol: 0.05, t: t + 0.07 }); }); },
    over() {
      fx(t => {
        note('noise', 0.2, 1.4, { vol: 0.25, cutoff: -1500 });
        [74, 70, 67, 62, 58].forEach((m, i) => note('p50', midi(m), 0.22, { vol: 0.06, t: t + 0.15 + i * 0.16, slide: 0.94 }));
      });
    },
    win() { fx(t => [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => { note('p25', midi(m), 0.16, { vol: 0.06, t: t + i * 0.09 }); note('tri', midi(m - 12), 0.16, { vol: 0.15, t: t + i * 0.09 }); })); },
    curtain() { fx(t => note('noise', 0.9, 0.05, { vol: 0.08, cutoff: 1500 })); },
  };
}
