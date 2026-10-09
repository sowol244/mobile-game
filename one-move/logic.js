// Move On pure rules. No DOM here, so node tests and the in-page hint share the same code.
//
// A board is a flat Uint8Array of cell codes (row-major, n×n):
//   0          empty
//   1          wall (never moves, blocks)
//   2 + e      gate that opens (vanishes) when a merge makes the value 2^e
//   16 + e     number tile 2^e (moves freely)
//   32 + e     pinned number tile: never moves, but a same number may merge INTO it (result stays pinned)
//   48 + e     "once" tile: may move one time; after that move it becomes pinned
//
// Core rule: one input moves ONE tile exactly ONE cell. Into an empty cell it just moves; into the same number it merges
// (the result sits in the target cell and keeps the target's kind); anything else (wall, gate, other number, edge) is
// blocked and costs nothing. Each successful move costs 1.

export const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // up, right, down, left
export const EMPTY = 0, WALL = 1, NUM = 16, PIN = 32, ONCE = 48;
export const isGate = c => c >= 2 && c < 16;
export const isNum = c => c >= 16;
export const expOf = c => (isGate(c) ? c - 2 : c & 15);
export const valueOf = c => 2 ** expOf(c);
export const kindOf = c => (c === EMPTY ? 'empty' : c === WALL ? 'wall' : isGate(c) ? 'gate' : c < PIN ? 'num' : c < ONCE ? 'pin' : 'once');
export const movable = c => isNum(c) && (c < PIN || c >= ONCE);
const log2 = v => Math.round(Math.log2(v));

/* ---------- stage parsing ---------- */
// Tokens: "." empty, "#" wall, "g8" gate opened by an 8, "4" tile, "4p" pinned 4, "4o" once-tile 4.
export function parseToken(t) {
  if (t === '.') return EMPTY;
  if (t === '#') return WALL;
  const m = /^(g?)(\d+)([po]?)$/.exec(t);
  if (!m) throw new Error('bad token ' + t);
  const e = log2(+m[2]);
  if (2 ** e !== +m[2] || e < 1 || e > 13) throw new Error('bad value ' + t);
  if (m[1]) return 2 + e;
  return (m[3] === 'p' ? PIN : m[3] === 'o' ? ONCE : NUM) + e;
}
export function tokenOf(c) {
  if (c === EMPTY) return '.';
  if (c === WALL) return '#';
  if (isGate(c)) return 'g' + valueOf(c);
  return valueOf(c) + (c >= ONCE ? 'o' : c >= PIN ? 'p' : '');
}
let nextId = 1;
// def: { rows: ['2 4 . 2', ...], target: 16, limit: 12, goal: [r, c] | undefined }
export function parseStage(def) {
  const grid = def.rows.map(r => r.trim().split(/\s+/));
  const n = grid.length;
  if (!grid.every(r => r.length === n)) throw new Error('board must be square');
  const codes = new Uint8Array(n * n), ids = new Int32Array(n * n);
  grid.forEach((row, r) => row.forEach((t, c) => { codes[r * n + c] = parseToken(t); if (codes[r * n + c]) ids[r * n + c] = nextId++; }));
  return {
    n, codes, ids, target: log2(def.target), goal: def.goal ? def.goal[0] * n + def.goal[1] : -1,
    limit: def.limit, moves: 0,
  };
}
export const cloneState = s => ({ ...s, codes: s.codes.slice(), ids: s.ids.slice() });
export const boardRows = s => Array.from({ length: s.n }, (_, r) => Array.from(s.codes.slice(r * s.n, r * s.n + s.n), tokenOf).join(' '));

/* ---------- moving ---------- */
// Returns null when blocked, otherwise { to, merged, exp, opened: [gate indices], locked } and writes the new board to out.
export function moveCodes(codes, n, i, d, out) {
  const c = codes[i];
  if (!movable(c)) return null;
  const r = (i / n) | 0, col = i % n, r2 = r + DIRS[d][0], c2 = col + DIRS[d][1];
  if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) return null;
  const j = r2 * n + c2, t = codes[j];
  let merged = false, e = c & 15, locked = false;
  const opened = [];
  if (t === EMPTY) {
    out.set(codes);
    out[i] = EMPTY;
    if (c >= ONCE) { out[j] = PIN + e; locked = true; } else out[j] = c;
  } else if (isNum(t) && (t & 15) === e) {
    out.set(codes);
    out[i] = EMPTY;
    e += 1; merged = true;
    out[j] = (t & ~15) + e; // the merged tile keeps the target cell's kind (normal / pinned / once)
    for (let k = 0; k < out.length; k++) if (isGate(out[k]) && out[k] - 2 === e) { out[k] = EMPTY; opened.push(k); }
  } else return null;
  return { to: j, merged, exp: e, opened, locked };
}
// Why a move is blocked (for the shake + coach text): 'fixed' | 'edge' | 'wall' | 'gate' | 'diff' | null (= allowed)
export function blockReason(s, i, d) {
  const c = s.codes[i];
  if (!movable(c)) return 'fixed';
  const n = s.n, r2 = ((i / n) | 0) + DIRS[d][0], c2 = (i % n) + DIRS[d][1];
  if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) return 'edge';
  const t = s.codes[r2 * n + c2];
  if (t === EMPTY) return null;
  if (t === WALL) return 'wall';
  if (isGate(t)) return 'gate';
  return (t & 15) === (c & 15) ? null : 'diff';
}
// Pure: returns { state, ev } or null when blocked. ev.from/to are cell indices; ev.id is the moving tile, ev.into the
// tile it merged into (that tile id survives).
export function applyMove(s, i, d) {
  const out = new Uint8Array(s.codes.length);
  const r = moveCodes(s.codes, s.n, i, d, out);
  if (!r) return null;
  const ids = s.ids.slice(), id = ids[i], into = r.merged ? ids[r.to] : 0;
  ids[i] = 0;
  if (!r.merged) ids[r.to] = id;
  const removed = r.opened.map(k => ids[k]);
  for (const k of r.opened) ids[k] = 0;
  const state = { ...s, codes: out, ids, moves: s.moves + 1 };
  return { state, ev: { from: i, to: r.to, dir: d, id, into, merged: r.merged, value: 2 ** r.exp, opened: r.opened, removed, locked: r.locked, win: isWin(state) } };
}
export function isWinCodes(codes, target, goal) {
  if (goal >= 0) return isNum(codes[goal]) && (codes[goal] & 15) === target;
  for (let k = 0; k < codes.length; k++) if (isNum(codes[k]) && (codes[k] & 15) === target) return true;
  return false;
}
export const isWin = s => isWinCodes(s.codes, s.target, s.goal);
export const isOut = s => !isWin(s) && s.moves >= s.limit;
export function legalMoves(s) {
  const res = [], out = new Uint8Array(s.codes.length);
  for (let i = 0; i < s.codes.length; i++) if (movable(s.codes[i])) for (let d = 0; d < 4; d++) if (moveCodes(s.codes, s.n, i, d, out)) res.push([i, d]);
  return res;
}

/* ---------- solver (BFS over single-tile moves = optimal move count) ---------- */
// A state can never win if the numbers below the target cannot add up to it (values only ever combine by doubling).
function dead(codes, target, goal) {
  let sum = 0;
  const T = 2 ** target;
  for (let k = 0; k < codes.length; k++) { const c = codes[k]; if (isNum(c) && (c & 15) < target) sum += 2 ** (c & 15); }
  if (sum < T) return true;
  if (goal >= 0) { const g = codes[goal]; if (g === WALL || (isNum(g) && g >= PIN && g < ONCE && (g & 15) > target)) return true; }
  return false;
}
// Returns { depth, path: [[i, d], ...], states } | { aborted: true, states } | null (no solution within maxDepth).
export function solve(s, { maxDepth = 60, maxStates = 3e6 } = {}) {
  const { n, target, goal } = s, len = n * n;
  if (isWinCodes(s.codes, target, goal)) return { depth: 0, path: [], states: 1 };
  const key = c => String.fromCharCode.apply(null, c);
  const parent = new Map([[key(s.codes), null]]);
  let frontier = [s.codes];
  const out = new Uint8Array(len);
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next = [];
    for (const codes of frontier) {
      if (dead(codes, target, goal)) continue;
      const pk = key(codes);
      for (let i = 0; i < len; i++) {
        if (!movable(codes[i])) continue;
        for (let d = 0; d < 4; d++) {
          if (!moveCodes(codes, n, i, d, out)) continue;
          const k = key(out);
          if (parent.has(k)) continue;
          parent.set(k, [pk, i, d]);
          if (isWinCodes(out, target, goal)) {
            const path = [];
            for (let cur = k; parent.get(cur); cur = parent.get(cur)[0]) { const p = parent.get(cur); path.push([p[1], p[2]]); }
            return { depth, path: path.reverse(), states: parent.size };
          }
          next.push(out.slice());
        }
      }
      if (parent.size > maxStates) return { aborted: true, states: parent.size };
    }
    frontier = next;
  }
  return null;
}

/* ---------- stars ---------- */
// 3★ at most one move over the optimum, 2★ within ~60% of the slack, 1★ any clear. A hint caps the result at 2★.
export function starCut(opt, limit) { return { three: opt + 1, two: Math.max(opt + 2, opt + Math.ceil((limit - opt) * 0.6)) }; }
export function starsFor(moves, opt, limit, hinted = false) {
  if (moves > limit) return 0;
  const { three, two } = starCut(opt, limit);
  const s = moves <= three ? 3 : moves <= two ? 2 : 1;
  return hinted ? Math.min(2, s) : s;
}

/* ---------- daily puzzle (seeded, solver-verified) ---------- */
export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const dayNumber = date => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
// Deterministic for a given day. Built backwards from the finished target (un-moves and un-merges), so it is always
// solvable; decoy tiles are sprinkled in and the BFS solver then measures the true optimum (kept when it is 7+ moves).
export function dailyStage(day) {
  const rnd = mulberry32(day * 7919 + 13);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const n = 4, N = 16;
  for (let attempt = 0; attempt < 60; attempt++) {
    const target = rnd() < 0.55 ? 16 : 32, cells = Array(N).fill(0); // value per cell, -1 = wall
    const adj = k => [[-1, 0], [0, 1], [1, 0], [0, -1]].map(([dr, dc]) => [((k / n) | 0) + dr, (k % n) + dc])
      .filter(([r, c]) => r >= 0 && r < n && c >= 0 && c < n).map(([r, c]) => r * n + c);
    cells[Math.floor(rnd() * N)] = target;
    const walls = Math.floor(rnd() * 3);
    for (let w = 0; w < walls; w++) { const k = Math.floor(rnd() * N); if (!cells[k]) cells[k] = -1; }
    const steps = 11 + Math.floor(rnd() * 4), maxTiles = target === 16 ? 5 : 6;
    for (let s = 0; s < steps; s++) {
      const tiles = cells.map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0);
      const k = pick(tiles), free = adj(k).filter(j => cells[j] === 0);
      if (!free.length) continue;
      const j = pick(free);
      if (cells[k] > 2 && tiles.length < maxTiles && rnd() < 0.55) { cells[k] /= 2; cells[j] = cells[k]; } // un-merge
      else { cells[j] = cells[k]; cells[k] = 0; } // un-move
    }
    const decoys = 1 + Math.floor(rnd() * 2);
    for (let d = 0; d < decoys; d++) { const k = Math.floor(rnd() * N); if (!cells[k]) cells[k] = pick([2, 4, 8]); }
    const rows = Array.from({ length: n }, (_, r) => cells.slice(r * n, r * n + n).map(v => (v < 0 ? '#' : v ? String(v) : '.')).join(' '));
    const st = parseStage({ rows, target, limit: 99 });
    if (isWin(st)) continue;
    const sol = solve(st, { maxDepth: 16, maxStates: 60000 });
    if (!sol || sol.aborted || sol.depth < 7) continue;
    return { id: 'daily-' + day, name: '오늘의 퍼즐', rows, target, limit: sol.depth + 3, opt: sol.depth };
  }
  return null;
}
