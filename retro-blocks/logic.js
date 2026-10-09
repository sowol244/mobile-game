// Pure rules for 레트로 블록 (NES-style falling blocks). No DOM; runs in node for tests.
// The game advances in fixed 60 fps frames: step(game, input) is one frame, like the NES.

export const W = 10, H = 20;
export const PIECES = ['T', 'J', 'Z', 'O', 'S', 'L', 'I']; // NES piece order
// Block look per piece (NES tiles): 0 = white centre with colour-1 rim (T O I), 1 = solid colour 1 (J S), 2 = solid colour 2 (Z L).
export const STYLE = [0, 1, 2, 0, 1, 2, 0];

// NES orientation tables: cells [dx, dy] around the pivot, y down. Index 0 is the spawn state, order is clockwise.
const rotCW = cells => cells.map(([x, y]) => [-y, x]);
const four = spawn => { const a = [spawn]; for (let i = 1; i < 4; i++) a.push(rotCW(a[i - 1])); return a; };
export const SHAPES = [
  four([[-1, 0], [0, 0], [1, 0], [0, 1]]),                                  // T (flat side up, stem down)
  four([[-1, 0], [0, 0], [1, 0], [1, 1]]),                                  // J
  [[[-1, 0], [0, 0], [0, 1], [1, 1]], [[1, -1], [0, 0], [1, 0], [0, 1]]],   // Z: two states
  [[[-1, 0], [0, 0], [-1, 1], [0, 1]]],                                     // O: never rotates
  [[[0, 0], [1, 0], [-1, 1], [0, 1]], [[0, -1], [0, 0], [1, 0], [1, 1]]],   // S: two states
  four([[-1, 0], [0, 0], [1, 0], [-1, 1]]),                                 // L
  [[[-2, 0], [-1, 0], [0, 0], [1, 0]], [[0, -2], [0, -1], [0, 0], [0, 1]]], // I: two states
];
export const SPAWN_X = 5, SPAWN_Y = 0;

// Frames per row at 60 fps (NES NTSC gravity table).
const G = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6];
export function gravityFrames(level) {
  if (level < 10) return G[Math.max(0, level)];
  if (level <= 12) return 5;
  if (level <= 15) return 4;
  if (level <= 18) return 3;
  if (level <= 28) return 2;
  return 1;
}

export const LINE_SCORE = [0, 40, 100, 300, 1200];
export const lineScore = (n, level) => LINE_SCORE[n] * (level + 1);

// NES level transition: the first level-up needs min(10·start+10, max(100, 10·start−50)) lines, then every 10 lines.
export const firstLevelUp = start => Math.min(start * 10 + 10, Math.max(100, start * 10 - 50));
export function levelFor(start, lines) {
  const f = firstLevelUp(start);
  return lines < f ? start : start + 1 + Math.floor((lines - f) / 10);
}

// NES randomizer: roll 0..7; if it is 7 ("no piece") or repeats the previous piece, reroll once over 0..6 and keep that.
export function rollPiece(prev, rand) {
  let r = Math.floor(rand() * 8);
  if (r === 7 || r === prev) r = Math.floor(rand() * 7);
  return r;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// DAS (delayed auto shift): first move on press, repeat after 16 frames, then every 6 frames.
export const DAS_DELAY = 16, DAS_REPEAT = 6;
export const SOFT_FRAMES = 2;      // soft drop: one row every 2 frames
export const CLEAR_FRAMES = 20;    // 5 wipe steps × 4 frames, columns cleared from the centre outward
export const FIRST_DELAY = 96;     // the very first piece hangs for 96 frames, like the NES
export const B_GOAL = 25;
export const GARBAGE_HEIGHTS = [0, 3, 5, 8, 10, 12]; // B-TYPE height 0..5 → rows of garbage

export const emptyBoard = () => new Array(W * H).fill(0);
export const cellsOf = (t, r, x, y) => SHAPES[t][r % SHAPES[t].length].map(([dx, dy]) => [x + dx, y + dy]);

// Walls and floor block; above the top (y < 0) is open, so pieces may poke out of the well.
export function collides(board, t, r, x, y) {
  for (const [cx, cy] of cellsOf(t, r, x, y)) {
    if (cx < 0 || cx >= W || cy >= H) return true;
    if (cy >= 0 && board[cy * W + cx]) return true;
  }
  return false;
}

// NES rotation: no wall kicks — the turn just fails if the new state overlaps.
export function rotated(board, p, dir) {
  const n = SHAPES[p.t].length;
  if (n === 1) return null;
  const r = (p.r + (dir > 0 ? 1 : n - 1)) % n;
  return collides(board, p.t, r, p.x, p.y) ? null : { ...p, r };
}

export function fullRows(board) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    let full = true;
    for (let x = 0; x < W; x++) if (!board[y * W + x]) { full = false; break; }
    if (full) rows.push(y);
  }
  return rows;
}

export function removeRows(board, rows) {
  const keep = [];
  for (let y = 0; y < H; y++) if (!rows.includes(y)) keep.push(board.slice(y * W, y * W + W));
  const out = new Array(rows.length * W).fill(0);
  for (const r of keep) out.push(...r);
  return out;
}

export function dropY(board, p) {
  let y = p.y;
  while (!collides(board, p.t, p.r, p.x, y + 1)) y++;
  return y;
}

// Entry delay (ARE) after a lock: 10 frames near the floor, +2 for every 4 rows higher, at most 18.
export function areFrames(lockY) {
  const fromBottom = Math.max(0, H - 1 - lockY);
  return Math.min(18, 10 + 2 * Math.floor((fromBottom + 2) / 4));
}

// B-TYPE garbage: bottom rows with random blocks; every row keeps at least one hole and never fills up.
export function makeGarbage(height, rand) {
  const b = emptyBoard(), rows = GARBAGE_HEIGHTS[height] || 0;
  for (let y = H - rows; y < H; y++) {
    for (let x = 0; x < W; x++) if (rand() < 0.55) b[y * W + x] = 1 + Math.floor(rand() * 7);
    const hole = Math.floor(rand() * W);
    b[y * W + hole] = 0;
  }
  return b;
}

export function createGame({ mode = 'A', start = 0, height = 0, seed = Date.now(), hardDrop = false, sequence = null } = {}) {
  const rand = mulberry32(seed);
  const g = {
    mode, start, level: start, lines: 0, score: 0, height,
    board: mode === 'B' ? makeGarbage(height, rand) : emptyBoard(),
    rand, sequence: sequence ? [...sequence] : null, hardDrop,
    piece: null, next: 0, prevRoll: 7,
    phase: 'are', timer: 0, frame: 0, are: 0,
    fall: 0, soft: 0, softRows: 0, softBlocked: false, downHeld: false,
    dasDir: 0, das: 0, first: true,
    clearing: [], stats: new Array(7).fill(0), events: [], lastClear: 0, fours: 0,
  };
  g.next = pickNext(g);
  spawn(g);
  return g;
}

function pickNext(g) {
  if (g.sequence && g.sequence.length) { const t = g.sequence.shift(); g.prevRoll = t; return t; }
  const t = rollPiece(g.prevRoll, g.rand);
  g.prevRoll = t;
  return t;
}

export function forceNext(g, t) { g.next = t; }

function spawn(g) {
  const p = { t: g.next, r: 0, x: SPAWN_X, y: SPAWN_Y };
  g.next = pickNext(g);
  g.stats[p.t]++;
  g.piece = p;
  g.phase = 'play';
  g.fall = g.first ? -FIRST_DELAY : 0;
  g.first = false;
  g.soft = 0; g.softRows = 0;
  g.softBlocked = g.downHeld; // like the NES, a held ▼ must be pressed again for the new piece
  g.events.push({ type: 'spawn', t: p.t });
  if (collides(g.board, p.t, p.r, p.x, p.y)) gameOver(g);
}

function gameOver(g) {
  g.phase = 'over'; g.timer = 0;
  g.events.push({ type: 'over' });
}

function move(g, dx) {
  const p = g.piece;
  if (collides(g.board, p.t, p.r, p.x + dx, p.y)) return false;
  p.x += dx;
  g.events.push({ type: 'move' });
  return true;
}

function lock(g) {
  const p = g.piece;
  let above = false;
  for (const [x, y] of cellsOf(p.t, p.r, p.x, p.y)) {
    if (y < 0) { above = true; continue; }
    g.board[y * W + x] = p.t + 1;
  }
  g.score += g.softRows; // soft drop points: 1 per row dropped while holding ▼
  g.piece = null;
  g.are = areFrames(p.y);
  g.events.push({ type: 'lock', y: p.y, soft: g.softRows });
  g.softRows = 0;
  if (above) { gameOver(g); return; }
  const rows = fullRows(g.board);
  if (rows.length) {
    g.phase = 'clear'; g.timer = 0; g.clearing = rows;
    g.events.push({ type: 'clear', n: rows.length, rows });
  } else {
    g.phase = 'are'; g.timer = g.are;
  }
}

function finishClear(g) {
  const n = g.clearing.length;
  const before = g.level;
  g.score += lineScore(n, g.level);
  g.board = removeRows(g.board, g.clearing);
  g.clearing = [];
  g.lines += n;
  g.lastClear = n;
  if (n === 4) g.fours++;
  if (g.mode === 'A') {
    g.level = levelFor(g.start, g.lines);
    if (g.level !== before) g.events.push({ type: 'level', level: g.level });
  }
  g.events.push({ type: 'cleared', n });
  if (g.mode === 'B' && g.lines >= B_GOAL) { g.phase = 'won'; g.timer = 0; g.events.push({ type: 'won' }); return; }
  g.phase = 'are'; g.timer = g.are;
}

export const linesLeft = g => Math.max(0, B_GOAL - g.lines);

// input: { left, right, down (held), cw, ccw, hard (press counts), nudge (signed cell moves from swipes) }
export function step(g, inp = {}) {
  g.frame++;
  const down = !!inp.down;
  if (!down) g.softBlocked = false;
  g.downHeld = down;
  switch (g.phase) {
    case 'are':
      if (--g.timer <= 0) spawn(g);
      break;
    case 'clear':
      if (++g.timer >= CLEAR_FRAMES) finishClear(g);
      break;
    case 'over':
    case 'won':
      g.timer++;
      break;
    case 'play': play(g, inp, down); break;
  }
  return g;
}

function play(g, inp, down) {
  const p = g.piece;
  // 1. shift (DAS)
  const dir = inp.left && !inp.right ? -1 : inp.right && !inp.left ? 1 : 0;
  if (dir !== g.dasDir) {
    g.dasDir = dir; g.das = 0;
    if (dir && !move(g, dir)) g.das = DAS_DELAY; // pushing against a wall keeps DAS charged
  } else if (dir) {
    if (++g.das >= DAS_DELAY) {
      if (move(g, dir)) g.das = DAS_DELAY - DAS_REPEAT;
      else g.das = DAS_DELAY;
    }
  }
  let nudge = inp.nudge | 0;
  while (nudge) { const s = Math.sign(nudge); move(g, s); nudge -= s; }
  // 2. rotate
  for (let i = 0; i < (inp.cw | 0); i++) turn(g, 1);
  for (let i = 0; i < (inp.ccw | 0); i++) turn(g, -1);
  // 3. hard drop (option only)
  if (g.hardDrop && inp.hard) {
    const y = dropY(g.board, p);
    g.softRows += y - p.y; p.y = y;
    g.events.push({ type: 'hard' });
    lock(g); return;
  }
  // 4. fall: gravity, or soft drop every 2 frames while ▼ is held
  const soft = down && !g.softBlocked;
  if (!soft) g.softRows = 0;
  let drop = false, bySoft = false;
  if (soft && ++g.soft >= SOFT_FRAMES) { g.soft = 0; drop = true; bySoft = true; }
  if (++g.fall >= gravityFrames(g.level)) drop = true;
  if (!drop) return;
  g.fall = 0;
  if (collides(g.board, p.t, p.r, p.x, p.y + 1)) { lock(g); return; } // NES: no lock delay
  p.y++;
  if (bySoft) g.softRows++;
}

function turn(g, dir) {
  const r = rotated(g.board, g.piece, dir);
  if (!r) return false;
  g.piece.r = r.r;
  g.events.push({ type: 'rotate', dir });
  return true;
}

// Height of the stack in rows (for faster music when it gets dangerous).
export function stackHeight(board) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (board[y * W + x]) return H - y;
  return 0;
}

export function qualifies(top, score, size = 10) {
  if (score <= 0) return false;
  return top.length < size || score > top[top.length - 1].score;
}

export function insertScore(top, entry, size = 10) {
  const list = [...top, entry].sort((a, b) => b.score - a.score || a.t - b.t).slice(0, size);
  return { list, rank: list.indexOf(entry) + 1 };
}
