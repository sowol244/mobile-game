// Pure Sudoku logic: grids, solution counting, a human-style grader, a seeded generator,
// hints and the play-state rules. No DOM here, so everything runs in node for tests.

export const ROW = i => (i / 9) | 0;
export const COL = i => i % 9;
export const BOX = i => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
const ALL = 0x1ff;
const bit = d => 1 << (d - 1);
const popc = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const digitsOf = m => { const r = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) r.push(d); return r; };
const onlyDigit = m => 32 - Math.clz32(m); // for single-bit masks

// 27 units: rows 0-8, cols 9-17, boxes 18-26
export const UNITS = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) UNITS.push(Array.from({ length: 9 }, (_, k) => (((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (b % 3) * 3 + (k % 3)));
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
  return [...s];
});
const sees = (a, b) => a !== b && (ROW(a) === ROW(b) || COL(a) === COL(b) || BOX(a) === BOX(b));

export const parseGrid = s => Array.from(s, ch => (ch >= '1' && ch <= '9' ? +ch : 0));
export const gridString = g => g.map(v => v || '.').join('').replace(/\./g, '0');

/* ---------- solution counting (bitmask backtracking, fewest-candidates first) ---------- */
export function countSolutions(grid, limit = 2) {
  const g = typeof grid === 'string' ? parseGrid(grid) : grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i]; if (!v) continue;
    const b = bit(v);
    if ((rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]) & b) return 0;
    rows[ROW(i)] |= b; cols[COL(i)] |= b; boxes[BOX(i)] |= b;
  }
  let count = 0, first = null;
  const rec = () => {
    let best = -1, bestM = 0, bestC = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ALL & ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]);
      const c = popc(m);
      if (c === 0) return;
      if (c < bestC) { bestC = c; best = i; bestM = m; if (c === 1) break; }
    }
    if (best < 0) { count++; if (!first) first = g.slice(); return; }
    const r = ROW(best), c = COL(best), b = BOX(best);
    let m = bestM;
    while (m) {
      const lb = m & -m; m ^= lb;
      g[best] = onlyDigit(lb); rows[r] |= lb; cols[c] |= lb; boxes[b] |= lb;
      rec();
      rows[r] ^= lb; cols[c] ^= lb; boxes[b] ^= lb; g[best] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  countSolutions.last = first;
  return count;
}
export function solveGrid(grid) { const n = countSolutions(grid, 1); return n ? countSolutions.last : null; }

/* ---------- human-style logic solver (grader) ---------- */
// Technique levels: 1 singles, 2 locked candidates, 3 pairs, 4 triples/quads, 5 fish / XY-wing.
export const TECH = {
  fullHouse: { level: 1, w: 1, ko: '마지막 한 칸' },
  hiddenSingle: { level: 1, w: 2, ko: '숨은 싱글' },
  nakedSingle: { level: 1, w: 3, ko: '네이키드 싱글' },
  pointing: { level: 2, w: 10, ko: '포인팅' },
  claiming: { level: 2, w: 12, ko: '클레이밍' },
  nakedPair: { level: 3, w: 20, ko: '네이키드 페어' },
  hiddenPair: { level: 3, w: 25, ko: '히든 페어' },
  nakedTriple: { level: 4, w: 40, ko: '네이키드 트리플' },
  hiddenTriple: { level: 4, w: 45, ko: '히든 트리플' },
  nakedQuad: { level: 4, w: 50, ko: '네이키드 쿼드' },
  hiddenQuad: { level: 4, w: 55, ko: '히든 쿼드' },
  xWing: { level: 5, w: 80, ko: 'X-윙' },
  xyWing: { level: 5, w: 90, ko: 'XY-윙' },
  swordfish: { level: 5, w: 100, ko: '소드피시' },
};
export const LEVEL_NAMES = ['', '싱글', '포인팅·클레이밍', '페어', '트리플', 'X-윙·XY-윙·소드피시'];

function makeState(grid) {
  const val = grid.slice(), cand = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) if (!val[i]) {
    let m = ALL; for (const p of PEERS[i]) if (val[p]) m &= ~bit(val[p]);
    cand[i] = m;
  }
  return { val, cand };
}
function placeIn(S, i, d) {
  S.val[i] = d; S.cand[i] = 0;
  const b = bit(d); for (const p of PEERS[i]) S.cand[p] &= ~b;
}
function combos(arr, k, start = 0, pre = [], out = []) {
  if (pre.length === k) { out.push(pre.slice()); return out; }
  for (let i = start; i < arr.length; i++) { pre.push(arr[i]); combos(arr, k, i + 1, pre, out); pre.pop(); }
  return out;
}

// Each finder returns null or { tech, place?: [i, d, unit?], elim?: [[i, mask]...] }
function findSingles(S) {
  for (let u = 0; u < 27; u++) {
    const empty = UNITS[u].filter(i => !S.val[i]);
    if (empty.length === 1) { const i = empty[0]; if (popc(S.cand[i]) === 1) return { tech: 'fullHouse', place: [i, onlyDigit(S.cand[i]), u] }; }
  }
  for (const u of [18, 19, 20, 21, 22, 23, 24, 25, 26, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d); let pos = -1, n = 0;
      for (const i of UNITS[u]) if (S.cand[i] & b) { n++; pos = i; }
      if (n === 1) return { tech: 'hiddenSingle', place: [pos, d, u] };
    }
  }
  for (let i = 0; i < 81; i++) if (!S.val[i] && popc(S.cand[i]) === 1) return { tech: 'nakedSingle', place: [i, onlyDigit(S.cand[i])] };
  return null;
}
function findLocked(S) {
  for (let bx = 18; bx < 27; bx++) for (let d = 1; d <= 9; d++) {
    const b = bit(d), cells = UNITS[bx].filter(i => S.cand[i] & b);
    if (cells.length < 2) continue;
    for (const [key, base] of [[ROW, 0], [COL, 9]]) {
      if (cells.every(i => key(i) === key(cells[0]))) {
        const elim = UNITS[base + key(cells[0])].filter(i => BOX(i) !== bx - 18 && (S.cand[i] & b)).map(i => [i, b]);
        if (elim.length) return { tech: 'pointing', elim };
      }
    }
  }
  for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {
    const b = bit(d), cells = UNITS[u].filter(i => S.cand[i] & b);
    if (cells.length < 2 || !cells.every(i => BOX(i) === BOX(cells[0]))) continue;
    const elim = UNITS[18 + BOX(cells[0])].filter(i => !UNITS[u].includes(i) && (S.cand[i] & b)).map(i => [i, b]);
    if (elim.length) return { tech: 'claiming', elim };
  }
  return null;
}
function findNaked(S, k, tech) {
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter(i => !S.val[i] && popc(S.cand[i]) >= 2 && popc(S.cand[i]) <= k);
    if (cells.length < k) continue;
    for (const set of combos(cells, k)) {
      let m = 0; for (const i of set) m |= S.cand[i];
      if (popc(m) !== k) continue;
      const elim = UNITS[u].filter(i => !set.includes(i) && (S.cand[i] & m)).map(i => [i, m]);
      if (elim.length) return { tech, elim };
    }
  }
  return null;
}
function findHidden(S, k, tech) {
  for (let u = 0; u < 27; u++) {
    const ds = [];
    for (let d = 1; d <= 9; d++) { const n = UNITS[u].filter(i => S.cand[i] & bit(d)).length; if (n >= 2 && n <= k) ds.push(d); }
    if (ds.length < k) continue;
    for (const set of combos(ds, k)) {
      const m = set.reduce((a, d) => a | bit(d), 0);
      const cells = UNITS[u].filter(i => S.cand[i] & m);
      if (cells.length !== k) continue;
      const elim = cells.filter(i => S.cand[i] & ~m).map(i => [i, ALL & ~m]);
      if (elim.length) return { tech, elim };
    }
  }
  return null;
}
function findFish(S, k, tech) {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (const byRow of [true, false]) {
      const lines = [];
      for (let l = 0; l < 9; l++) {
        const unit = UNITS[byRow ? l : 9 + l];
        const pos = unit.filter(i => S.cand[i] & b).map(i => (byRow ? COL(i) : ROW(i)));
        if (pos.length >= 2 && pos.length <= k) lines.push([l, pos]);
      }
      if (lines.length < k) continue;
      for (const set of combos(lines, k)) {
        const cover = new Set(); set.forEach(([, p]) => p.forEach(x => cover.add(x)));
        if (cover.size !== k) continue;
        const base = new Set(set.map(([l]) => l)), elim = [];
        for (const x of cover) for (const i of UNITS[byRow ? 9 + x : x]) {
          const line = byRow ? ROW(i) : COL(i);
          if (!base.has(line) && (S.cand[i] & b)) elim.push([i, b]);
        }
        if (elim.length) return { tech, elim };
      }
    }
  }
  return null;
}
function findXYWing(S) {
  const bi = []; for (let i = 0; i < 81; i++) if (popc(S.cand[i]) === 2) bi.push(i);
  for (const p of bi) {
    const pm = S.cand[p];
    const wings = bi.filter(q => q !== p && sees(p, q) && popc(S.cand[q] & pm) === 1);
    for (let a = 0; a < wings.length; a++) for (let c = a + 1; c < wings.length; c++) {
      const x = wings[a], y = wings[c], xm = S.cand[x], ym = S.cand[y];
      if ((xm & pm) === (ym & pm)) continue;
      const z = (xm & ~pm); if (z !== (ym & ~pm) || popc(z) !== 1) continue;
      const elim = [];
      for (let i = 0; i < 81; i++) if (i !== p && i !== x && i !== y && (S.cand[i] & z) && sees(i, x) && sees(i, y)) elim.push([i, z]);
      if (elim.length) return { tech: 'xyWing', elim };
    }
  }
  return null;
}
const FINDERS = [
  findSingles, findLocked,
  S => findNaked(S, 2, 'nakedPair'), S => findHidden(S, 2, 'hiddenPair'),
  S => findNaked(S, 3, 'nakedTriple'), S => findHidden(S, 3, 'hiddenTriple'),
  S => findNaked(S, 4, 'nakedQuad'), S => findHidden(S, 4, 'hiddenQuad'),
  S => findFish(S, 2, 'xWing'), findXYWing, S => findFish(S, 3, 'swordfish'),
];
function applyStep(S, st) {
  if (st.place) placeIn(S, st.place[0], st.place[1]);
  else for (const [i, m] of st.elim) S.cand[i] &= ~m;
}
function nextStep(S) {
  for (const f of FINDERS) { const st = f(S); if (st) return st; }
  return null;
}

// Grade a puzzle: { solved, level (max technique level), score, steps, counts }
export function grade(puzzle) {
  const S = makeState(typeof puzzle === 'string' ? parseGrid(puzzle) : puzzle);
  let level = 0, score = 0, steps = 0; const counts = {};
  for (;;) {
    if (S.val.every(v => v)) break;
    const st = nextStep(S);
    if (!st) return { solved: false, level: 6, score: score + 1000, steps, counts, grid: S.val };
    applyStep(S, st); steps++;
    const t = TECH[st.tech]; level = Math.max(level, t.level); score += t.w;
    counts[st.tech] = (counts[st.tech] || 0) + 1;
  }
  return { solved: true, level, score, steps, counts, grid: S.val };
}

/* ---------- seeded generator ---------- */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function randomSolution(r) {
  const g = new Array(81).fill(0);
  const fill = i => {
    if (i === 81) return true;
    const used = PEERS[i].reduce((m, p) => (g[p] ? m | bit(g[p]) : m), 0);
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r)) {
      if (used & bit(d)) continue;
      g[i] = d; if (fill(i + 1)) return true;
    }
    g[i] = 0; return false;
  };
  fill(0);
  return g;
}
// Remove symmetric cell pairs while the solution stays unique, down to `minGivens` (or as far as possible).
export function dig(solution, r, minGivens = 17) {
  const g = solution.slice();
  const order = shuffle(Array.from({ length: 41 }, (_, i) => i), r);
  let givens = 81;
  for (const i of order) {
    const j = 80 - i, n = i === j ? 1 : 2;
    if (givens - n < minGivens) continue;
    const a = g[i], b = g[j];
    g[i] = 0; g[j] = 0;
    if (countSolutions(g, 2) !== 1) { g[i] = a; g[j] = b; } else givens -= n;
  }
  return g;
}

/* ---------- hints (from the current board, ignoring wrong entries) ---------- */
const JONG = [0, 1, 0, 1, 0, 0, 1, 1, 1, 0]; // digit read in Korean ends in a consonant (일, 삼, 육, 칠, 팔)
const iga = d => d + (JONG[d] ? '이' : '가');
const ieyo = d => d + (JONG[d] ? '이에요' : '예요');
const UNIT_KO = u => (u < 9 ? '이 가로줄' : u < 18 ? '이 세로줄' : '이 3×3 상자');
export function findHint(board, solution, prefer = -1) {
  const grid = board.map((v, i) => (v && v === solution[i] ? v : 0));
  if (prefer >= 0 && board[prefer] && board[prefer] !== solution[prefer])
    return { idx: prefer, digit: solution[prefer], reason: `잘못 넣은 숫자예요. 이 칸은 ${ieyo(solution[prefer])}`, tech: 'fix' };
  const S = makeState(grid), used = [];
  for (let guard = 0; guard < 400; guard++) {
    // collect every placement visible right now, prefer the selected / nearest cell
    const singles = [];
    for (let i = 0; i < 81; i++) if (!S.val[i] && popc(S.cand[i]) === 1) singles.push({ idx: i, digit: onlyDigit(S.cand[i]), tech: 'nakedSingle' });
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) {
      let pos = -1, n = 0; for (const i of UNITS[u]) if (S.cand[i] & bit(d)) { n++; pos = i; }
      if (n === 1 && !singles.some(s => s.idx === pos && s.tech === 'hiddenSingle')) singles.push({ idx: pos, digit: d, tech: 'hiddenSingle', unit: u });
    }
    if (singles.length) {
      const dist = s => (prefer < 0 ? s.idx : Math.abs(ROW(s.idx) - ROW(prefer)) + Math.abs(COL(s.idx) - COL(prefer)));
      // at the same cell, the hidden single in a box reads most naturally; then naked single
      const rank = s => dist(s) * 10 + (s.tech === 'hiddenSingle' ? (s.unit >= 18 ? 0 : 1) : 2);
      singles.sort((a, b) => rank(a) - rank(b));
      const s = singles[0];
      let reason = s.tech === 'nakedSingle'
        ? `이 칸에 들어갈 수 있는 숫자는 ${s.digit}뿐이에요`
        : `${UNIT_KO(s.unit)}에서 ${iga(s.digit)} 들어갈 곳은 이 칸뿐이에요`;
      if (used.length) reason = `${[...new Set(used)].map(t => TECH[t].ko).join('·')} 기법으로 후보를 줄이면, ${reason.replace('이 칸에', '이 칸엔')}`;
      if (s.digit !== solution[s.idx]) break; // should not happen with a consistent board
      return { idx: s.idx, digit: s.digit, reason, tech: s.tech, unit: s.unit };
    }
    const st = nextStep(S);
    if (!st) break;
    applyStep(S, st); if (!st.place) used.push(st.tech);
  }
  const idx = prefer >= 0 && !grid[prefer] ? prefer : grid.findIndex(v => !v);
  if (idx < 0) return null;
  return { idx, digit: solution[idx], reason: `이 칸의 정답은 ${ieyo(solution[idx])}`, tech: 'answer' };
}

/* ---------- play state ---------- */
export const MAX_MISTAKES = 3, MAX_HINTS = 3;
export function newGame(puzzle, solution) {
  const p = parseGrid(puzzle), s = parseGrid(solution);
  return { given: p.map(v => v > 0), vals: p.slice(), sol: s, notes: new Array(81).fill(0), mistakes: 0, hints: 0, history: [], won: false, failed: false };
}
const snap = g => ({ vals: g.vals.slice(), notes: g.notes.slice() });
const pushHist = g => { g.history.push(snap(g)); if (g.history.length > 200) g.history.shift(); };
export const isCorrect = (g, i) => g.vals[i] !== 0 && g.vals[i] === g.sol[i];
export const digitCount = (g, d) => g.vals.reduce((n, v, i) => n + (v === d && g.sol[i] === d ? 1 : 0), 0);
export const candidatesAt = (g, i) => {
  let m = ALL; for (const p of PEERS[i]) if (isCorrect(g, p) || g.given[p]) m &= ~bit(g.vals[p]);
  return digitsOf(m);
};
// Units (0-26) that are completely and correctly filled and include cell i
export const completedUnitsAt = (g, i) => [ROW(i), 9 + COL(i), 18 + BOX(i)].filter(u => UNITS[u].every(j => isCorrect(g, j)));

export function place(g, i, d) {
  if (g.won || g.failed || g.given[i] || d < 1 || d > 9) return { changed: false };
  if (g.vals[i] === d) return { changed: false };
  if (isCorrect(g, i)) return { changed: false }; // a correct digit is locked in
  pushHist(g);
  g.vals[i] = d; g.notes[i] = 0;
  if (d !== g.sol[i]) {
    g.mistakes++;
    if (g.mistakes >= MAX_MISTAKES) g.failed = true;
    return { changed: true, wrong: true, failed: g.failed, removed: [] };
  }
  const removed = [];
  for (const p of PEERS[i]) if (g.notes[p] & bit(d)) { g.notes[p] &= ~bit(d); removed.push(p); }
  const units = completedUnitsAt(g, i);
  g.won = g.vals.every((v, j) => v === g.sol[j]);
  return { changed: true, wrong: false, removed, units, digitDone: digitCount(g, d) === 9, won: g.won };
}
export function toggleNote(g, i, d) {
  if (g.won || g.failed || g.given[i] || g.vals[i] || d < 1 || d > 9) return false;
  pushHist(g); g.notes[i] ^= bit(d); return true;
}
export const hasNote = (g, i, d) => !!(g.notes[i] & bit(d));
export function erase(g, i) {
  if (g.won || g.failed || g.given[i] || isCorrect(g, i)) return false;
  if (!g.vals[i] && !g.notes[i]) return false;
  pushHist(g); g.vals[i] = 0; g.notes[i] = 0; return true;
}
export function undo(g) {
  if (g.won || g.failed || !g.history.length) return false;
  const h = g.history.pop();
  // cells filled by a hint stay filled
  for (let i = 0; i < 81; i++) if (!(g.hinted && g.hinted.includes(i))) { g.vals[i] = h.vals[i]; g.notes[i] = h.notes[i]; }
  return true;
}
// Fill the next logical cell (or fix a wrong one). Returns the hint or null.
export function useHint(g, prefer = -1) {
  if (g.won || g.failed || g.hints >= MAX_HINTS) return null;
  const h = findHint(g.vals, g.sol, prefer);
  if (!h) return null;
  g.hints++;
  g.vals[h.idx] = h.digit; g.notes[h.idx] = 0;
  (g.hinted = g.hinted || []).push(h.idx);
  const removed = [];
  for (const p of PEERS[h.idx]) if (g.notes[p] & bit(h.digit)) { g.notes[p] &= ~bit(h.digit); removed.push(p); }
  g.won = g.vals.every((v, j) => v === g.sol[j]);
  return { ...h, removed, units: completedUnitsAt(g, h.idx), won: g.won };
}
// 3★ no mistakes and no hints, 2★ at most one mistake-or-hint in total, otherwise 1★
export const starsFor = (mistakes, hints) => (mistakes + hints === 0 ? 3 : mistakes + hints <= 1 ? 2 : 1);
export const fmtTime = s => { s = Math.max(0, Math.floor(s)); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

/* ---------- 오늘의 스도쿠: deterministic daily puzzles from the date ---------- */
export function hashSeed(str) {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const DAILY = {
  easy: { levels: [1, 1], givens: [36, 40] },
  hard: { levels: [3, 5], givens: [25, 28] },
};
// Put symmetric solution pairs back while the hardest technique level stays the same.
export function addBackSameLevel(puzzle, solution, minGivens, maxGivens, level, r) {
  const p = puzzle.slice();
  const count = () => p.filter(v => v).length;
  const empty = shuffle(Array.from({ length: 41 }, (_, i) => i).filter(i => !p[i]), r);
  for (const i of empty) {
    if (count() >= minGivens) break;
    const j = 80 - i, a = p[i], b = p[j];
    p[i] = solution[i]; p[j] = solution[j];
    if (count() > maxGivens || grade(p).level !== level) { p[i] = a; p[j] = b; }
  }
  return p;
}
// Same date + kind → same puzzle for everyone. Seeds are tried in order (attempt 0, 1, 2, …) until the grade fits.
export function dailyPuzzle(date, kind) {
  const spec = DAILY[kind];
  if (!spec) throw new Error('unknown daily kind ' + kind);
  const [lo, hi] = spec.givens;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const r = rng(hashSeed(`sudoku:${date}:${kind}:${attempt}`));
    const sol = randomSolution(r);
    let p;
    if (kind === 'easy') p = dig(sol, r, lo + ((r() * (hi - lo + 1)) | 0));
    else p = dig(sol, r);
    let g = grade(p);
    if (!g.solved || g.level < spec.levels[0] || g.level > spec.levels[1]) continue;
    let n = p.filter(v => v).length;
    if (n < lo) { p = addBackSameLevel(p, sol, lo, hi, g.level, r); g = grade(p); n = p.filter(v => v).length; }
    if (n < lo || n > hi || g.level < spec.levels[0] || g.level > spec.levels[1]) continue;
    return { date, kind, p: gridString(p), s: sol.join(''), level: g.level, score: g.score, givens: n, attempt };
  }
  throw new Error('no daily puzzle found');
}
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dateKey(new Date(y, m - 1, d + n)); };
// Consecutive days with at least one daily clear, ending today (or yesterday if today is not cleared yet).
export function dailyStreak(recs, today) {
  const cleared = k => recs[k] && (recs[k].easy || recs[k].hard);
  let day = cleared(today) ? today : addDays(today, -1), n = 0;
  while (cleared(day)) { n++; day = addDays(day, -1); }
  return n;
}
export function bestStreak(recs) {
  const days = Object.keys(recs).filter(k => recs[k].easy || recs[k].hard).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}
