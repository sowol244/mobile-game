// 그라비티 크래시 — pure rules (no DOM). Used by main.js, the tutorial, and node tests / the stage solver.
//
// Board: 9x9 array of null | block. Block = { id, t, c?, d? }
//   t: 'n' normal color block (c = 0..3)       — matches, falls
//      'a' arrow block (c = color, d = dir)    — matches with its color, fires a laser along d when it explodes
//      'w' fixed wall                          — never moves, never matches, stops lasers
//      'i' ice                                  — falls, breaks when a colored block next to it explodes (or a laser hits it)
//      'h' black hole                           — falls; once it rests with 3+ colored blocks in the 8 cells around it,
//                                                 it turns them all into their majority color and collapses (removed)
//      'k' core                                 — falls, indestructible; leaves the board through the exit gate
// Gravity is one of 'up' | 'right' | 'down' | 'left'. A gravity change slides every movable block toward that wall.

export const N = 9;
export const COLORS = 4;
export const DIRS = ['up', 'right', 'down', 'left'];
export const DV = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const MATCH_MIN = 4;

let nextId = 1;
export const mk = (t, c, d) => {
  const b = { id: nextId++, t };
  if (c !== undefined && c !== null) b.c = c;
  if (d) b.d = d;
  return b;
};
export const emptyBoard = () => Array.from({ length: N }, () => Array(N).fill(null));
export const cloneBoard = b => b.map(row => row.map(x => (x ? { ...x } : null)));
export const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
export const isColor = b => !!b && (b.t === 'n' || b.t === 'a');
export const movable = b => !!b && b.t !== 'w';

/* ---------- stage text format ----------
   9 rows of 9 whitespace-separated tokens:
   .  empty     #  wall      *  ice      o  black hole      K  core
   c p g y      normal block (cyan / pink / lime / yellow)
   c^ c> cv c<  arrow block of that color pointing up / right / down / left            */
const CK = { c: 0, p: 1, g: 2, y: 3 };
const AK = { '^': 'up', '>': 'right', v: 'down', '<': 'left' };
export const COLOR_KEYS = 'cpgy';
export function parseBoard(rows) {
  if (rows.length !== N) throw new Error('need 9 rows');
  const b = emptyBoard();
  rows.forEach((line, r) => {
    const toks = line.trim().split(/\s+/);
    if (toks.length !== N) throw new Error(`row ${r} has ${toks.length} tokens`);
    toks.forEach((tk, c) => {
      if (tk === '.') return;
      if (tk === '#') b[r][c] = mk('w');
      else if (tk === '*') b[r][c] = mk('i');
      else if (tk === 'o') b[r][c] = mk('h');
      else if (tk === 'K') b[r][c] = mk('k');
      else if (tk.length === 1 && tk in CK) b[r][c] = mk('n', CK[tk]);
      else if (tk.length === 2 && tk[0] in CK && tk[1] in AK) b[r][c] = mk('a', CK[tk[0]], AK[tk[1]]);
      else throw new Error(`bad token "${tk}" at ${r},${c}`);
    });
  });
  return b;
}
const AD = { up: '^', right: '>', down: 'v', left: '<' };
export function boardKey(b) {
  let s = '';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = b[r][c];
    s += !x ? '.' : x.t === 'n' ? COLOR_KEYS[x.c] : x.t === 'a' ? COLOR_KEYS[x.c].toUpperCase() + AD[x.d] : x.t === 'w' ? '#' : x.t === 'i' ? '*' : x.t === 'h' ? 'o' : 'K';
  }
  return s;
}
export function toRows(b) { // inverse of parseBoard (for debugging)
  return b.map(row => row.map(x => !x ? '.' : x.t === 'n' ? COLOR_KEYS[x.c] : x.t === 'a' ? COLOR_KEYS[x.c] + AD[x.d] : x.t === 'w' ? '#' : x.t === 'i' ? '*' : x.t === 'h' ? 'o' : 'K').join(' '));
}

/* ---------- gravity ---------- */
// Cells of line k, ordered from the "floor" wall (the side gravity points to) toward the ceiling.
export function lineCells(dir, k) {
  const out = [];
  for (let i = 0; i < N; i++) {
    if (dir === 'down') out.push([N - 1 - i, k]);
    else if (dir === 'up') out.push([i, k]);
    else if (dir === 'right') out.push([k, N - 1 - i]);
    else out.push([k, i]);
  }
  return out;
}
// The cell a new block enters through in crash mode: the far (ceiling) end of line k.
export const entryCell = (dir, k) => lineCells(dir, k)[N - 1];

// Slides every movable block toward `dir` until it rests on a wall, the board edge or another block.
// exit = { r, c, side }: the core block alone passes through that edge cell when gravity is `side`.
// Mutates board. Returns { moves: [{ id, b, fr, fc, tr, tc, dist, exit? }], exited }
export function settle(board, dir, exit = null) {
  const moves = [];
  let exited = false;
  for (let k = 0; k < N; k++) {
    const cells = lineCells(dir, k);
    let slot = 0;
    const gate = !!exit && exit.side === dir && cells[0][0] === exit.r && cells[0][1] === exit.c;
    for (let i = 0; i < N; i++) {
      const [r, c] = cells[i], b = board[r][c];
      if (!b) continue;
      if (b.t === 'w') { slot = i + 1; continue; }
      if (gate && slot === 0 && b.t === 'k') { // out through the gate
        board[r][c] = null;
        const [dr, dc] = DV[dir];
        moves.push({ id: b.id, b: { ...b }, fr: r, fc: c, tr: exit.r + dr * 2, tc: exit.c + dc * 2, dist: i + 2, exit: true });
        exited = true;
        continue;
      }
      const [tr, tc] = cells[slot];
      if (tr !== r || tc !== c) {
        board[tr][tc] = b; board[r][c] = null;
        moves.push({ id: b.id, b: { ...b }, fr: r, fc: c, tr, tc, dist: i - slot });
      }
      slot++;
    }
  }
  return { moves, exited };
}

/* ---------- matching ---------- */
export function findGroups(board, min = MATCH_MIN) {
  const seen = Array.from({ length: N }, () => Array(N).fill(false)), groups = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const b = board[r][c];
    if (!isColor(b) || seen[r][c]) continue;
    const g = [], st = [[r, c]];
    seen[r][c] = true;
    while (st.length) {
      const [y, x] = st.pop(); g.push([y, x]);
      for (const d of DIRS) {
        const ny = y + DV[d][0], nx = x + DV[d][1];
        if (!inside(ny, nx) || seen[ny][nx]) continue;
        const o = board[ny][nx];
        if (isColor(o) && o.c === b.c) { seen[ny][nx] = true; st.push([ny, nx]); }
      }
    }
    if (g.length >= min) groups.push({ color: b.c, cells: g });
  }
  return groups;
}

/* ---------- black holes ---------- */
// Every black hole with 3+ colored neighbours (8 around) converts them to their majority color
// (ties: lowest color index), then collapses. All holes look at the same board, then apply in reading order.
export function activateHoles(board) {
  const acts = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!board[r][c] || board[r][c].t !== 'h') continue;
    const nb = [], cnt = [0, 0, 0, 0];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const y = r + dr, x = c + dc;
      if (inside(y, x) && isColor(board[y][x])) { nb.push([y, x]); cnt[board[y][x].c]++; }
    }
    if (nb.length < 3) continue;
    let best = 0;
    for (let k = 1; k < COLORS; k++) if (cnt[k] > cnt[best]) best = k;
    acts.push({ r, c, color: best, nb });
  }
  if (!acts.length) return null;
  const conv = [];
  for (const a of acts) {
    board[a.r][a.c] = null;
    for (const [y, x] of a.nb) {
      const b = board[y][x];
      if (b && isColor(b) && b.c !== a.color) { conv.push({ r: y, c: x, from: b.c, to: a.color }); b.c = a.color; }
    }
  }
  return { holes: acts.map(a => ({ r: a.r, c: a.c, color: a.color })), conv };
}

/* ---------- explosions ---------- */
// Removes matched groups; arrows fire lasers (stopped by walls, passing over the core, chaining other arrows);
// ice next to any destroyed colored block breaks. Mutates board.
export function explode(board, groups) {
  const kill = new Map(); // key -> { r, c, b, why }
  const key = (r, c) => r * N + c;
  for (const g of groups) for (const [r, c] of g.cells) kill.set(key(r, c), { r, c, b: { ...board[r][c] }, why: 'match' });
  const lasers = [], fired = new Set(), q = [];
  for (const v of kill.values()) if (v.b.t === 'a') q.push(v);
  while (q.length) {
    const a = q.shift();
    if (fired.has(a.b.id)) continue;
    fired.add(a.b.id);
    const [dr, dc] = DV[a.b.d];
    let y = a.r + dr, x = a.c + dc, len = 0;
    while (inside(y, x)) {
      const o = board[y][x];
      if (o && o.t === 'w') break;
      len++;
      if (o && o.t !== 'k' && !kill.has(key(y, x))) {
        const v = { r: y, c: x, b: { ...o }, why: 'laser' };
        kill.set(key(y, x), v);
        if (o.t === 'a') q.push(v);
      }
      y += dr; x += dc;
    }
    lasers.push({ r: a.r, c: a.c, d: a.b.d, len });
  }
  for (const v of [...kill.values()]) {
    if (!isColor(v.b)) continue;
    for (const d of DIRS) {
      const y = v.r + DV[d][0], x = v.c + DV[d][1];
      if (inside(y, x) && board[y][x] && board[y][x].t === 'i' && !kill.has(key(y, x))) kill.set(key(y, x), { r: y, c: x, b: { ...board[y][x] }, why: 'ice' });
    }
  }
  const cells = [...kill.values()];
  for (const v of cells) board[v.r][v.c] = null;
  return { cells, lasers };
}

/* ---------- one full gravity move ---------- */
// Settles toward `dir`, then loops: black holes → settle → matches (all at once) → explode → settle …
// Every round of explosions is one more chain step. Mutates state.board.
// Returns null when the move changes nothing (it does not count as a move), else
// { steps, chain, cleared, gained, exited } where steps (for animation) are
//   { type:'move', moves, board }  { type:'hole', holes, conv, board }  { type:'boom', chain, cells, lasers, gained, board }
// opts: { min = 4, mult = 1, force = false, scoring = true }
export function resolve(state, dir, opts = {}) {
  const min = opts.min || MATCH_MIN, mult = opts.mult || 1;
  const board = state.board, steps = [];
  const first = settle(board, dir, state.exit);
  if (!first.moves.length && !opts.force) return null;
  state.gravity = dir;
  let exited = first.exited, chain = 0, cleared = 0, gained = 0;
  if (first.moves.length) steps.push({ type: 'move', moves: first.moves, board: cloneBoard(board) });
  for (let guard = 0; guard < 100; guard++) {
    const h = activateHoles(board);
    if (h) {
      steps.push({ type: 'hole', ...h, board: cloneBoard(board) });
      const s = settle(board, dir, state.exit);
      exited = exited || s.exited;
      if (s.moves.length) steps.push({ type: 'move', moves: s.moves, board: cloneBoard(board) });
      continue;
    }
    const groups = findGroups(board, min);
    if (!groups.length) break;
    chain++;
    const ex = explode(board, groups);
    const pts = ex.cells.length * 10 * chain * mult;
    cleared += ex.cells.length; gained += pts;
    steps.push({ type: 'boom', chain, cells: ex.cells, lasers: ex.lasers, groups: groups.length, gained: pts, board: cloneBoard(board) });
    const s = settle(board, dir, state.exit);
    exited = exited || s.exited;
    if (s.moves.length) steps.push({ type: 'move', moves: s.moves, board: cloneBoard(board) });
  }
  if (exited) state.rescued = true;
  return { steps, chain, cleared, gained, exited };
}

/* ---------- puzzle stages ---------- */
export function countColor(board) {
  let n = 0;
  for (const row of board) for (const b of row) if (isColor(b)) n++;
  return n;
}
export function goalMet(state, goal) {
  const clear = countColor(state.board) === 0;
  if (goal === 'clear') return clear;
  if (goal === 'rescue') return !!state.rescued;
  return clear && !!state.rescued; // 'both'
}
export function parseExit(s) {
  if (!s) return null;
  const [side, k] = s.split(':'); const i = +k;
  return side === 'down' ? { r: N - 1, c: i, side } : side === 'up' ? { r: 0, c: i, side } : side === 'right' ? { r: i, c: N - 1, side } : { r: i, c: 0, side };
}
// A fresh playable state for a stage definition { rows, goal, exit }.
export function stageState(def) {
  return { board: parseBoard(def.rows), gravity: 'down', exit: parseExit(def.exit), rescued: false, moves: 0 };
}
export const cloneState = s => ({ ...s, board: cloneBoard(s.board) });

// Breadth-first search over gravity sequences. Returns the shortest list of directions that meets the goal
// within maxDepth moves (or null). Moves that change nothing are skipped. `limit` caps explored states.
export function solve(state0, goal, maxDepth = 8, limit = 400000) {
  if (goalMet(state0, goal)) return [];
  const seen = new Set([boardKey(state0.board) + (state0.rescued ? '!' : '')]);
  let frontier = [{ s: state0, path: [] }], explored = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const { s, path } of frontier) {
      for (const d of DIRS) {
        if (d === s.gravity) continue; // already settled that way: changes nothing
        const t = cloneState(s);
        const res = resolve(t, d, { scoring: false });
        if (!res) continue;
        if (goalMet(t, goal)) return [...path, d];
        if (goal !== 'rescue' && deadClear(t.board)) continue;
        const k = boardKey(t.board) + (t.rescued ? '!' : '');
        if (seen.has(k)) continue;
        seen.add(k);
        if (++explored > limit) return null;
        next.push({ s: t, path: [...path, d] });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}
// A color with 1..3 blocks left and nothing that could change or remove them (no arrows of any color, no holes)
// can never be cleared.
export function deadClear(board) {
  const cnt = [0, 0, 0, 0];
  let helpers = 0;
  for (const row of board) for (const b of row) {
    if (!b) continue;
    if (isColor(b)) cnt[b.c]++;
    if (b.t === 'a' || b.t === 'h') helpers++;
  }
  return !helpers && cnt.some(n => n > 0 && n < MATCH_MIN);
}
// Stars: 3 at or under par, 2 at par+1, else 1. A used hint caps it at 2.
export function starsFor(moves, par, hinted = false) {
  const s = moves <= par ? 3 : moves <= par + 1 ? 2 : 1;
  return hinted ? Math.min(2, s) : s;
}

/* ---------- crash mode ---------- */
export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = n => Math.floor(f() * n);
  return f;
}
export const dailySeed = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export const crashLevel = elapsed => 1 + Math.floor(elapsed / 20);
export const spawnInterval = level => Math.max(1.05, 3.3 - 0.2 * (level - 1));
export const waveSize = (level, R) => Math.min(4, 1 + Math.floor((level + 1) / 3) + (R() < 0.35 ? 1 : 0) - (level < 2 ? 1 : 0)) || 1;

export function randomBlock(R, level) {
  const x = R();
  if (level >= 2 && x < 0.035) return mk('h');
  if (x < 0.10) return mk('a', R.int(COLORS), DIRS[R.int(4)]);
  if (level >= 3 && x < 0.16) return mk('i');
  return mk('n', R.int(COLORS));
}
// Next wave: distinct line indices along the ceiling + the blocks that will come in there.
export function planWave(R, level) {
  const n = waveSize(level, R), ks = [];
  while (ks.length < n) { const k = R.int(N); if (!ks.includes(k)) ks.push(k); }
  return ks.map(k => ({ k, b: randomBlock(R, level) }));
}
// Lines whose entry cell is already taken: a wave there overflows the board.
export const blockedLines = (board, dir, wave) => wave.filter(w => { const [r, c] = entryCell(dir, w.k); return !!board[r][c]; }).map(w => w.k);

// Drops the wave in from the ceiling. Returns { overflow } or a resolve() result (with a leading spawn move step).
export function spawnWave(state, wave, opts = {}) {
  const dir = state.gravity;
  if (blockedLines(state.board, dir, wave).length) return { overflow: true };
  const enter = [];
  for (const w of wave) { const [r, c] = entryCell(dir, w.k); state.board[r][c] = { ...w.b }; enter.push({ id: w.b.id, r, c }); }
  const res = resolve(state, dir, { ...opts, force: true });
  // Mark the entering blocks so the renderer slides them in from outside the frame.
  const first = res.steps[0];
  const moved = new Set(first && first.type === 'move' ? first.moves.map(m => m.id) : []);
  const [dr, dc] = DV[dir];
  const spawnMoves = [];
  for (const e of enter) {
    if (moved.has(e.id)) { const m = first.moves.find(x => x.id === e.id); m.fr -= dr; m.fc -= dc; m.dist++; m.spawn = true; }
    else spawnMoves.push(e);
  }
  if (spawnMoves.length) { // landed right at the entry cell: still animate the one-cell slide in
    const bd = cloneBoard(state.board);
    const mv = spawnMoves.map(e => ({ id: e.id, b: wave.find(w => w.b.id === e.id).b, fr: e.r - dr, fc: e.c - dc, tr: e.r, tc: e.c, dist: 1, spawn: true }));
    if (first && first.type === 'move') first.moves.push(...mv); else res.steps.unshift({ type: 'move', moves: mv, board: bd });
  }
  return res;
}
// Starting crash board: a few rows at the bottom with no ready-made groups of 3.
export function crashStart(R, rows = 3) {
  const b = emptyBoard();
  for (let r = N - rows; r < N; r++) for (let c = 0; c < N; c++) {
    for (let tries = 0; tries < 20; tries++) {
      b[r][c] = mk('n', R.int(COLORS));
      if (!findGroups(b, 3).length) break;
    }
  }
  return { board: b, gravity: 'down', exit: null, rescued: false };
}
// Items. shuffle: recolor every normal block. bomb: remove every block of the most common color.
export function shuffleColors(board, R) {
  for (const row of board) for (const b of row) if (b && b.t === 'n') b.c = R.int(COLORS);
}
export function commonColor(board) {
  const cnt = [0, 0, 0, 0];
  for (const row of board) for (const b of row) if (isColor(b)) cnt[b.c]++;
  let best = 0;
  for (let k = 1; k < COLORS; k++) if (cnt[k] > cnt[best]) best = k;
  return cnt[best] ? best : -1;
}
export function colorBomb(board, color) {
  const g = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (isColor(board[r][c]) && board[r][c].c === color && board[r][c].t === 'n') g.push([r, c]);
  return g.length ? explode(board, [{ color, cells: g }]) : null;
}
// Fever: a combo of 5 explosion rounds in a row.
export const FEVER_COMBO = 5, FEVER_TIME = 5;
// Combo: explosion rounds in a row across moves; a player move with no explosion resets it.
export function nextCombo(combo, res) { return res && res.chain > 0 ? combo + res.chain : 0; }
export function fillCount(board) { let n = 0; for (const row of board) for (const b of row) if (b && b.t !== 'w') n++; return n; }
