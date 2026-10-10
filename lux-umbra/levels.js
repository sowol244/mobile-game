// 룩스 앤 움브라 — the stages. One string per row, one character per tile:
//   #  rock (solid, stops light)          .  air
//   L  빛 블록: solid while lit             S  그림자 블록: solid while dark
//   R  붉은 블록: solid in red light        B  푸른 블록: solid in blue light
//   r  붉은 유리 / b 푸른 유리: solid, light passing through takes its colour
//   ^  spikes (v hangs from the ceiling)  D  goal door   H  door hidden in the wall until light touches it
//   =  lever (toggles the groups in `levers`)        — `levers`, `lenses` and `signs` are listed in reading order
//   %  lens stand (sets the torch colour from `lenses`)
//   ?  sign (text from `signs`)            C  checkpoint
//   P  player   K  crate   M  stone statue   o  light shard (★)
//   /  \  mirror (fixed)      {  }  mirror that turns when touched     f  fog: walkable, stops light
//   1-9 fixed lamp, settings in `lamps` (kind 'radial' | 'beam', dir° 0=right 90=down, spread°, range, color, g=group)
// `zones` are room lights: a rectangle lit evenly while its group is on.

import c1 from './levels/c1.js';
import c2 from './levels/c2.js';
import c3 from './levels/c3.js';
import c4 from './levels/c4.js';
import c5 from './levels/c5.js';
import c6 from './levels/c6.js';
import c7 from './levels/c7.js';
import c8 from './levels/c8.js';

// Each chapter's first stage introduces one new thing (with signs); the other nine are puzzles that use it
// together with everything before it.
export const CHAPTERS = [
  { name: '손전등', sub: '빛 블록 · 숨은 문' },
  { name: '그림자와 깜빡', sub: '그림자 블록' },
  { name: '레버', sub: '방의 불 · 시계 레버' },
  { name: '등불과 상자', sub: '그림자 만들기' },
  { name: '색 빛', sub: '빨강 · 파랑 · 렌즈' },
  { name: '유리와 거울', sub: '빛 꺾기' },
  { name: '석상', sub: '빛의 대가' },
  { name: '안개', sub: '마지막 장' },
];

// Bump when the stages are rebuilt: saves from another stage set are wiped (stars, best times, unlocks, ranking),
// settings such as 'lux-mute' are kept. Returns true when there was an old record to wipe.
export const LEVELS_VERSION = 3;
export function resetOldSave(store) {
  if (store.getItem('lux-levels') === String(LEVELS_VERSION)) return false;
  const had = store.getItem('lux-progress') !== null || store.getItem('lux-top') !== null;
  store.removeItem('lux-progress'); store.removeItem('lux-top');
  store.setItem('lux-levels', String(LEVELS_VERSION));
  return had;
}

// Stage ids come from the order: chapter-number.
export const LEVELS = [c1, c2, c3, c4, c5, c6, c7, c8].flatMap((list, ch) => list.map((L, k) => ({ ...L, ch, id: `${ch + 1}-${k + 1}` })));
