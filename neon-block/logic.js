// Pure game rules for 네온 블록. No DOM access here so it can be tested in Node.
export const SIZE = 8;

const parse = rows => {
  if (rows.some(s => s.length !== rows[0].length)) throw new Error('uneven shape rows: ' + rows);
  const cells = [];
  rows.forEach((s, r) => [...s].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return { cells, h: rows.length, w: rows[0].length };
};

// [spawn weight, rows]. Pieces cannot be rotated, so every orientation is its own entry.
const DEFS = [
  [6, ['#']],
  [5, ['##']], [5, ['#', '#']],
  [5, ['###']], [5, ['#', '#', '#']],
  [3, ['####']], [3, ['#', '#', '#', '#']],
  [1.5, ['#####']], [1.5, ['#', '#', '#', '#', '#']],
  [6, ['##', '##']],
  [2, ['###', '###', '###']],
  [3, ['###', '###']], [3, ['##', '##', '##']],
  [3, ['#.', '##']], [3, ['##', '#.']], [3, ['##', '.#']], [3, ['.#', '##']],
  [1.5, ['#..', '#..', '###']], [1.5, ['###', '#..', '#..']], [1.5, ['###', '..#', '..#']], [1.5, ['..#', '..#', '###']],
  [2, ['#.', '#.', '##']], [2, ['.#', '.#', '##']], [2, ['##', '#.', '#.']], [2, ['##', '.#', '.#']],
  [2, ['###', '#..']], [2, ['###', '..#']], [2, ['#..', '###']], [2, ['..#', '###']],
  [2, ['###', '.#.']], [2, ['.#.', '###']], [2, ['#.', '##', '#.']], [2, ['.#', '##', '.#']],
  [2, ['.##', '##.']], [2, ['##.', '.##']], [2, ['#.', '##', '.#']], [2, ['.#', '##', '#.']],
];
export const SHAPES = DEFS.map(([weight, rows], id) => ({ id, weight, ...parse(rows) }));
export const COLOR_COUNT = 7;

export const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
export const cloneBoard = b => b.map(row => row.slice());
export const isEmpty = b => b.every(row => row.every(v => !v));
export const fillRatio = b => b.reduce((n, row) => n + row.filter(Boolean).length, 0) / (SIZE * SIZE);

export function canPlace(board, shape, r0, c0) {
  for (const [dr, dc] of shape.cells) {
    const r = r0 + dr, c = c0 + dc;
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE || board[r][c]) return false;
  }
  return true;
}

export function place(board, shape, r0, c0, color) {
  for (const [dr, dc] of shape.cells) board[r0 + dr][c0 + dc] = color;
}

export function findFullLines(board) {
  const rows = [], cols = [];
  for (let r = 0; r < SIZE; r++) if (board[r].every(Boolean)) rows.push(r);
  for (let c = 0; c < SIZE; c++) if (board.every(row => row[c])) cols.push(c);
  return { rows, cols };
}

// Clears every full row and column at once. A cell shared by a row and a column is counted once.
export function clearLines(board) {
  const { rows, cols } = findFullLines(board);
  const seen = new Set(), cells = [];
  const add = (r, c) => {
    const k = r * SIZE + c;
    if (!seen.has(k)) { seen.add(k); cells.push({ r, c, color: board[r][c] }); }
  };
  for (const r of rows) for (let c = 0; c < SIZE; c++) add(r, c);
  for (const c of cols) for (let r = 0; r < SIZE; r++) add(r, c);
  for (const { r, c } of cells) board[r][c] = 0;
  return { rows, cols, cells, count: rows.length + cols.length };
}

// Lines that would clear if the shape were dropped here (used for the preview highlight).
export function linesIfPlaced(board, shape, r0, c0) {
  const b = cloneBoard(board);
  place(b, shape, r0, c0, 1);
  return findFullLines(b);
}

export const lineScore = n => (n <= 0 ? 0 : 10 * n * (n + 1) / 2); // 1:10  2:30  3:60  4:100 ...

export const newState = () => ({ board: emptyBoard(), score: 0, combo: 0, sinceClear: 0 });

// Combo: each placement that clears a line raises it by one. It resets after 3 placements in a row with no clear.
export function applyMove(state, shape, r0, c0, color) {
  place(state.board, shape, r0, c0, color);
  const cleared = clearLines(state.board);
  let gained = shape.cells.length, allClear = false;
  if (cleared.count > 0) {
    state.combo += 1; state.sinceClear = 0;
    gained += lineScore(cleared.count) * state.combo;
    if (isEmpty(state.board)) { allClear = true; gained += 300; }
  } else {
    state.sinceClear += 1;
    if (state.sinceClear >= 3) state.combo = 0;
  }
  state.score += gained;
  return { gained, cleared, combo: state.combo, allClear };
}

export function fitsAnywhere(board, shape) {
  for (let r = 0; r <= SIZE - shape.h; r++)
    for (let c = 0; c <= SIZE - shape.w; c++)
      if (canPlace(board, shape, r, c)) return true;
  return false;
}

export const anyFits = (board, items) => items.some(it => it && fitsAnywhere(board, it.shape));
export const isGameOver = (board, tray) => !anyFits(board, tray);

// Can all pieces be placed one after another (in any order)? Gives up and says "yes" after `budget` nodes.
export function traySolvable(board, shapes, budget = { n: 20000 }) {
  if (!shapes.length) return true;
  if (budget.n-- <= 0) return true;
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i], rest = shapes.filter((_, j) => j !== i);
    for (let r = 0; r <= SIZE - shape.h; r++)
      for (let c = 0; c <= SIZE - shape.w; c++) {
        if (!canPlace(board, shape, r, c)) continue;
        const b = cloneBoard(board);
        place(b, shape, r, c, 1); clearLines(b);
        if (traySolvable(b, rest, budget)) return true;
      }
  }
  return false;
}

function pickShape(rng, ratio, pool = SHAPES) {
  const w = pool.map(s => {
    const n = s.cells.length;
    let f = 1;
    if (ratio > 0.5) f = n >= 6 ? 0.3 : n >= 5 ? 0.6 : n <= 3 ? 1.5 : 1;
    else if (ratio < 0.2 && n <= 2) f = 0.6;
    return s.weight * f;
  });
  let x = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// Three new pieces. Never random-only: at least one piece always fits, and on a crowded board
// we look for a set that can be fully placed so a loss is never the generator's fault.
export function generateTray(board, rng = Math.random) {
  const ratio = fillRatio(board);
  const mk = pool => ({ shape: pickShape(rng, ratio, pool), color: 1 + Math.floor(rng() * COLOR_COUNT) });
  const attempts = ratio > 0.4 ? 16 : 4;
  let fallback = null;
  for (let i = 0; i < attempts; i++) {
    const tray = [mk(), mk(), mk()];
    if (!anyFits(board, tray)) continue;
    fallback = fallback || tray;
    if (ratio <= 0.4 || traySolvable(board, tray.map(t => t.shape))) return tray;
  }
  if (fallback) return fallback;
  const fits = SHAPES.filter(s => fitsAnywhere(board, s));
  return fits.length ? [mk(fits), mk(fits), mk(fits)] : [mk(), mk(), mk()];
}
