// Run with: node retro-blocks/logic.test.mjs
import assert from 'node:assert/strict';
import {
  W, H, PIECES, SHAPES, cellsOf, collides, rotated, fullRows, removeRows, dropY, gravityFrames, lineScore,
  levelFor, firstLevelUp, rollPiece, createGame, step, forceNext, emptyBoard, makeGarbage, mulberry32, areFrames,
  GARBAGE_HEIGHTS, B_GOAL, linesLeft, CLEAR_FRAMES, DAS_DELAY, DAS_REPEAT, qualifies, insertScore, stackHeight,
} from './logic.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const T = 0, J = 1, Z = 2, O = 3, S = 4, L = 5, I = 6;
const norm = cells => cells.map(c => c.join(',')).sort().join(' ');
const run = (g, frames, inp = {}) => { for (let i = 0; i < frames; i++) step(g, inp); return g; };
const runUntil = (g, pred, inp = {}, max = 5000) => { for (let i = 0; i < max && !pred(g); i++) step(g, inp); assert.ok(pred(g), 'condition not reached'); return g; };
// a game whose first piece is already falling (skip the 96-frame first delay)
const game = (opts = {}) => { const g = createGame({ seed: 1, ...opts }); g.fall = 0; return g; };
const fillRow = (b, y, hole = -1) => { for (let x = 0; x < W; x++) b[y * W + x] = x === hole ? 0 : 1; };

test('7 pieces, NES state counts (O 1, I/S/Z 2, T/J/L 4)', () => {
  assert.deepEqual(PIECES, ['T', 'J', 'Z', 'O', 'S', 'L', 'I']);
  assert.deepEqual(SHAPES.map(s => s.length), [4, 4, 2, 1, 2, 4, 2]);
  for (const s of SHAPES) for (const st of s) assert.equal(st.length, 4);
});

test('spawn positions match the NES (pivot column 5, row 0)', () => {
  assert.equal(norm(cellsOf(I, 0, 5, 0)), norm([[3, 0], [4, 0], [5, 0], [6, 0]]));
  assert.equal(norm(cellsOf(T, 0, 5, 0)), norm([[4, 0], [5, 0], [6, 0], [5, 1]]));
  assert.equal(norm(cellsOf(O, 0, 5, 0)), norm([[4, 0], [5, 0], [4, 1], [5, 1]]));
});

test('NES rotation: T/J/L turn about the centre, clockwise then back', () => {
  const b = emptyBoard(), p = { t: T, r: 0, x: 5, y: 5 };
  const cw = rotated(b, p, 1);
  assert.equal(cw.r, 1);
  assert.equal(norm(cellsOf(T, 1, 5, 5)), norm([[5, 4], [4, 5], [5, 5], [5, 6]])); // stem points left
  assert.equal(rotated(b, cw, -1).r, 0);
  assert.equal(rotated(b, p, -1).r, 3);
  // J spawn → clockwise gives the NES "J left" state
  assert.equal(norm(cellsOf(J, 1, 5, 5)), norm([[5, 4], [5, 5], [4, 6], [5, 6]]));
});

test('I, S, Z toggle between two states; O never turns', () => {
  const b = emptyBoard();
  for (const t of [I, S, Z]) {
    const p = { t, r: 0, x: 5, y: 5 };
    const a = rotated(b, p, 1), c = rotated(b, p, -1);
    assert.equal(a.r, 1); assert.equal(c.r, 1);
    assert.equal(rotated(b, a, 1).r, 0);
  }
  assert.equal(norm(cellsOf(I, 1, 5, 5)), norm([[5, 3], [5, 4], [5, 5], [5, 6]]));
  assert.equal(rotated(b, { t: O, r: 0, x: 5, y: 5 }, 1), null);
});

test('no wall kicks: a blocked rotation simply fails', () => {
  const b = emptyBoard();
  // vertical I against the left wall cannot turn flat (would need x = -1)
  assert.equal(rotated(b, { t: I, r: 1, x: 0, y: 5 }, 1), null);
  // vertical I one column in can turn
  assert.ok(rotated(b, { t: I, r: 1, x: 2, y: 5 }, 1));
  // blocked by a stack cell
  b[4 * W + 5] = 1; // the cell above the T's centre
  assert.equal(rotated(b, { t: T, r: 0, x: 5, y: 5 }, -1), null);
  assert.equal(rotated(b, { t: T, r: 0, x: 5, y: 5 }, 1), null);
});

test('collision: walls, floor, stack; above the top is open', () => {
  const b = emptyBoard();
  assert.ok(collides(b, I, 0, 1, 5));       // x -1
  assert.ok(collides(b, I, 0, 9, 5));       // x 10
  assert.ok(collides(b, O, 0, 5, 19));      // y 20
  assert.ok(!collides(b, I, 1, 5, 0));      // vertical I pokes above the top
  b[19 * W + 5] = 1;
  assert.ok(collides(b, O, 0, 5, 18));
  assert.equal(dropY(b, { t: O, r: 0, x: 5, y: 0 }), 17);
});

test('line clears 1–4 rows: rows removed, stack shifts down', () => {
  for (let k = 1; k <= 4; k++) {
    const b = emptyBoard();
    for (let i = 0; i < k; i++) fillRow(b, H - 1 - i);
    b[(H - 1 - k) * W + 3] = 7; // a cell above the full rows
    const rows = fullRows(b);
    assert.equal(rows.length, k);
    const after = removeRows(b, rows);
    assert.equal(after.length, W * H);
    assert.equal(after[(H - 1) * W + 3], 7);
    assert.equal(after.filter(Boolean).length, 1);
  }
});

test('scoring per level: 40/100/300/1200 × (level+1)', () => {
  assert.deepEqual([1, 2, 3, 4].map(k => lineScore(k, 0)), [40, 100, 300, 1200]);
  assert.deepEqual([1, 2, 3, 4].map(k => lineScore(k, 9)), [400, 1000, 3000, 12000]);
  assert.equal(lineScore(4, 18), 22800);
});

test('gravity table (frames per row) follows the NES', () => {
  assert.deepEqual([...Array(30).keys()].map(gravityFrames),
    [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
  assert.equal(gravityFrames(40), 1);
});

test('level transitions: NES first-level-up rule, then every 10 lines', () => {
  assert.equal(firstLevelUp(0), 10);
  assert.equal(firstLevelUp(5), 60);
  assert.equal(firstLevelUp(9), 100);
  assert.equal(firstLevelUp(12), 100);
  assert.equal(firstLevelUp(18), 130);
  assert.equal(levelFor(0, 9), 0); assert.equal(levelFor(0, 10), 1); assert.equal(levelFor(0, 35), 3);
  assert.equal(levelFor(5, 59), 5); assert.equal(levelFor(5, 60), 6); assert.equal(levelFor(5, 70), 7);
  assert.equal(levelFor(18, 129), 18); assert.equal(levelFor(18, 130), 19);
});

test('randomizer: reroll once on a repeat or on 7, never twice', () => {
  const seq = vals => { let i = 0; return () => vals[i++]; };
  assert.equal(rollPiece(2, seq([3 / 8 + 0.01])), 3);               // no repeat: keep
  assert.equal(rollPiece(3, seq([3 / 8 + 0.01, 5 / 7 + 0.01])), 5);  // repeat → reroll 0..6
  assert.equal(rollPiece(3, seq([3 / 8 + 0.01, 3 / 7 + 0.01])), 3);  // reroll may repeat again: kept
  assert.equal(rollPiece(1, seq([7 / 8 + 0.01, 0.0])), 0);           // 7 → reroll
  // statistically repeats are rarer than 1/7
  const r = mulberry32(42); let prev = 7, rep = 0, N = 70000;
  const counts = new Array(7).fill(0);
  for (let i = 0; i < N; i++) { const t = rollPiece(prev, r); assert.ok(t >= 0 && t < 7); counts[t]++; if (t === prev) rep++; prev = t; }
  assert.ok(rep / N < 0.06 && rep / N > 0.02, 'repeat rate ' + rep / N);
  for (const c of counts) assert.ok(c > N / 7 * 0.85 && c < N / 7 * 1.15);
});

test('first piece waits 96 frames, then falls at level speed', () => {
  const g = createGame({ seed: 3, start: 0 });
  const y0 = g.piece.y;
  run(g, 96 + 47);
  assert.equal(g.piece.y, y0);
  run(g, 1);
  assert.equal(g.piece.y, y0 + 1);
  run(g, 48);
  assert.equal(g.piece.y, y0 + 2);
});

test('DAS: move on press, 16-frame delay, then every 6 frames', () => {
  const g = game({ sequence: [O, O, O] });
  const x0 = g.piece.x;
  step(g, { left: true });
  assert.equal(g.piece.x, x0 - 1);
  run(g, DAS_DELAY - 1, { left: true });
  assert.equal(g.piece.x, x0 - 1);
  step(g, { left: true });
  assert.equal(g.piece.x, x0 - 2);
  run(g, DAS_REPEAT - 1, { left: true });
  assert.equal(g.piece.x, x0 - 2);
  step(g, { left: true });
  assert.equal(g.piece.x, x0 - 3);
});

test('soft drop: 1 row per 2 frames, 1 point per row, locks without delay', () => {
  const g = game({ sequence: [O, T, T], start: 0 });
  runUntil(g, g => g.phase !== 'play', { down: true });
  assert.equal(g.score, 18); // O pivot from row 0 to row 18
  assert.equal(g.board[19 * W + 4], O + 1);
});

test('held ▼ does not carry over to the next piece until pressed again', () => {
  const g = game({ sequence: [O, O, O] });
  runUntil(g, g => g.phase === 'are', { down: true });
  runUntil(g, g => g.phase === 'play', { down: true });
  const y = g.piece.y;
  run(g, 10, { down: true });
  assert.equal(g.piece.y, y);
  step(g, {}); run(g, 4, { down: true });
  assert.ok(g.piece.y >= y + 2);
});

test('full game flow: a 4-line clear scores 1200×(level+1) and plays the wipe', () => {
  const g = game({ start: 3, sequence: [I, T, T, T] });
  for (let y = H - 4; y < H; y++) fillRow(g.board, y, 9);
  step(g, { cw: 1 });                                // vertical I
  for (let i = 0; i < 6; i++) { step(g, { right: true }); step(g, {}); }
  assert.equal(g.piece.x, 9);
  runUntil(g, g => g.phase === 'clear', { down: true });
  const soft = g.score;
  assert.deepEqual(g.clearing, [16, 17, 18, 19]);
  run(g, CLEAR_FRAMES);
  assert.equal(g.lines, 4);
  assert.equal(g.score, soft + 1200 * 4);
  assert.equal(g.board.filter(Boolean).length, 0);
  assert.equal(g.tetrises, 1);
});

test('level ups during play raise the speed', () => {
  const g = game({ start: 0, sequence: [I, I, I, I, I, I] });
  g.lines = 8;
  for (let y = H - 2; y < H; y++) fillRow(g.board, y, 9);
  step(g, { cw: 1 });
  for (let i = 0; i < 6; i++) { step(g, { right: true }); step(g, {}); }
  const ev = [];
  for (let i = 0; i < 3000 && g.lines < 10; i++) { step(g, { down: true }); ev.push(...g.events.splice(0)); }
  assert.equal(g.lines, 10);
  assert.equal(g.level, 1);
  assert.ok(ev.some(e => e.type === 'level' && e.level === 1));
});

test('B-TYPE: garbage heights, 25-line goal ends the game as won', () => {
  const r = mulberry32(9);
  for (let h = 0; h <= 5; h++) {
    const b = makeGarbage(h, r);
    assert.equal(stackHeight(b) <= GARBAGE_HEIGHTS[h], true);
    for (let y = H - GARBAGE_HEIGHTS[h]; y < H; y++) {
      const filled = b.slice(y * W, y * W + W).filter(Boolean).length;
      assert.ok(filled < W);
    }
    assert.equal(fullRows(b).length, 0);
  }
  const g = game({ mode: 'B', height: 0, start: 5, sequence: [I, I, I] });
  assert.equal(linesLeft(g), B_GOAL);
  g.lines = 21;
  for (let y = H - 4; y < H; y++) fillRow(g.board, y, 9);
  step(g, { cw: 1 });
  for (let i = 0; i < 6; i++) { step(g, { right: true }); step(g, {}); }
  runUntil(g, g => g.phase === 'won', { down: true });
  assert.equal(linesLeft(g), 0);
  assert.equal(g.level, 5); // B-TYPE keeps its level
});

test('game over when a new piece cannot spawn', () => {
  const g = game({ sequence: [O, T, T] });
  for (let y = 2; y < H; y++) fillRow(g.board, y, y % 2 ? 0 : 1);
  runUntil(g, g => g.phase === 'over', { down: true }, 400);
  assert.ok(g.events.some(e => e.type === 'over'));
  run(g, 30);
  assert.equal(g.phase, 'over');
});

test('hard drop only when enabled', () => {
  const g = game({ sequence: [O, T, T] });
  step(g, { hard: 1 });
  assert.equal(g.phase, 'play');
  const h = game({ sequence: [O, T, T], hardDrop: true });
  step(h, { hard: 1 });
  assert.notEqual(h.phase, 'play');
  assert.equal(h.board[19 * W + 4], O + 1);
});

test('entry delay (ARE) 10–18 frames by lock height', () => {
  assert.equal(areFrames(19), 10);
  assert.equal(areFrames(18), 10);
  assert.equal(areFrames(17), 12);
  assert.equal(areFrames(2), 18);
});

test('ranking helpers: top-10 qualification and insertion', () => {
  const top = Array.from({ length: 10 }, (_, i) => ({ score: 1000 - i * 50, t: i }));
  assert.equal(qualifies(top, 500), false);
  assert.equal(qualifies(top, 600), true);
  assert.equal(qualifies([], 0), false);
  const e = { score: 777, t: 99 };
  const { list, rank } = insertScore(top, e);
  assert.equal(list.length, 10); assert.equal(rank, 6);
});

test('statistics count every spawned piece', () => {
  const g = game({ sequence: [T, J, Z, O, S, L, I], hardDrop: true });
  for (let i = 0; i < 400 && g.stats.reduce((a, b) => a + b) < 7; i++) step(g, { hard: 1 });
  assert.deepEqual(g.stats, [1, 1, 1, 1, 1, 1, 1]);
  forceNext(g, I); assert.equal(g.next, I);
});

console.log(`\n${n} tests passed`);
