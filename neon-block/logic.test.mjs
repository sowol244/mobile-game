// Run with: node logic.test.mjs
import assert from 'node:assert/strict';
import {
  SIZE, SHAPES, emptyBoard, canPlace, place, findFullLines, clearLines, lineScore,
  newState, applyMove, isGameOver, anyFits, fitsAnywhere, generateTray, traySolvable, cloneBoard,
} from './logic.js';

const shape = rows => SHAPES.find(s => s.h === rows.length && s.w === rows[0].length && s.cells.length === rows.join('').replace(/\./g, '').length
  && s.cells.every(([r, c]) => rows[r][c] === '#'));
const DOT = shape(['#']), SQ2 = shape(['##', '##']);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

test('every shape is a non-empty, in-bounds pattern', () => {
  assert.ok(SHAPES.length > 30);
  for (const s of SHAPES) {
    assert.ok(s.cells.length >= 1);
    for (const [r, c] of s.cells) assert.ok(r < s.h && c < s.w);
  }
});

test('canPlace rejects out of bounds and occupied cells', () => {
  const b = emptyBoard();
  assert.ok(canPlace(b, SQ2, 0, 0));
  assert.ok(canPlace(b, SQ2, 6, 6));
  assert.ok(!canPlace(b, SQ2, 7, 7));
  assert.ok(!canPlace(b, SQ2, -1, 0));
  b[3][3] = 1;
  assert.ok(!canPlace(b, SQ2, 2, 2));
  assert.ok(canPlace(b, SQ2, 4, 4));
});

test('full row and full column clear', () => {
  const b = emptyBoard();
  for (let c = 0; c < SIZE; c++) b[2][c] = 3;
  let r = clearLines(b);
  assert.deepEqual(r.rows, [2]); assert.equal(r.count, 1); assert.equal(r.cells.length, 8);
  assert.ok(b.every(row => row.every(v => v === 0)));
  for (let k = 0; k < SIZE; k++) b[k][5] = 2;
  r = clearLines(b);
  assert.deepEqual(r.cols, [5]); assert.equal(r.cells.length, 8);
});

test('row and column crossing clear together and share one cell', () => {
  const b = emptyBoard();
  for (let k = 0; k < SIZE; k++) { b[1][k] = 1; b[k][4] = 1; }
  const r = clearLines(b);
  assert.equal(r.count, 2); assert.equal(r.cells.length, 15);
  assert.ok(b.every(row => row.every(v => v === 0)));
});

test('line score table', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(lineScore), [0, 10, 30, 60, 100]);
});

test('applyMove scores cells + line bonus x combo, and combo resets after 3 misses', () => {
  const s = newState();
  for (let c = 0; c < 7; c++) s.board[0][c] = 1;
  s.board[5][5] = 1; // keep the board from being empty afterwards
  let res = applyMove(s, DOT, 0, 7, 2);
  assert.equal(res.gained, 1 + 10); assert.equal(s.combo, 1); assert.ok(!res.allClear);
  for (let c = 0; c < 7; c++) s.board[1][c] = 1;
  res = applyMove(s, DOT, 1, 7, 2);
  assert.equal(res.gained, 1 + 10 * 2); assert.equal(s.combo, 2);
  applyMove(s, DOT, 3, 0, 1); applyMove(s, DOT, 3, 1, 1);
  assert.equal(s.combo, 2);
  applyMove(s, DOT, 3, 2, 1);
  assert.equal(s.combo, 0);
});

test('clearing the whole board gives the all-clear bonus', () => {
  const s = newState();
  for (let c = 0; c < 7; c++) s.board[4][c] = 1;
  const res = applyMove(s, DOT, 4, 7, 1);
  assert.ok(res.allClear); assert.equal(res.gained, 1 + 10 + 300); assert.equal(s.score, 311);
});

test('game over only when no remaining piece fits', () => {
  const b = emptyBoard();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) b[r][c] = 1;
  const tray = [{ shape: DOT, color: 1 }, null, null];
  assert.ok(isGameOver(b, tray));
  b[7][7] = 0;
  assert.ok(!isGameOver(b, tray));
  assert.ok(isGameOver(b, [{ shape: SQ2, color: 1 }, null, null]));
  assert.ok(isGameOver(b, [null, null, null]));
});

test('traySolvable: easy and impossible cases', () => {
  assert.ok(traySolvable(emptyBoard(), [DOT, DOT, DOT]));
  const b = emptyBoard();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!(r === 7 && c === 7)) b[r][c] = 1;
  assert.ok(!traySolvable(b, [SQ2]));
  assert.ok(!traySolvable(b, [SQ2, SQ2, SQ2]));
  // dot, dot, then the square works: each dot completes a row, leaving two empty rows side by side
  assert.ok(traySolvable(b, [DOT, SQ2, DOT]));
  assert.ok(traySolvable(b, [DOT]));
  // placing the dot completes row 7 and column 7, which frees room for the next dots
  assert.ok(traySolvable(b, [DOT, DOT, DOT]));
});

test('generateTray always offers a placeable piece when one exists (300 random boards)', () => {
  const rng = mulberry32(12345);
  let crowded = 0;
  for (let i = 0; i < 300; i++) {
    const b = emptyBoard();
    const fill = 0.25 + rng() * 0.6;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (rng() < fill) b[r][c] = 1 + Math.floor(rng() * 7);
    clearLines(b);
    const possible = SHAPES.some(s => fitsAnywhere(b, s));
    const tray = generateTray(b, rng);
    assert.equal(tray.length, 3);
    if (possible) assert.ok(anyFits(b, tray), 'board ' + i + ' got an unplayable tray');
    if (possible && cloneBoard(b).flat().filter(Boolean).length > 32) crowded++;
  }
  assert.ok(crowded > 20);
});

test('on crowded boards the tray is usually fully placeable', () => {
  const rng = mulberry32(777);
  let ok = 0, total = 0;
  for (let i = 0; i < 80; i++) {
    const b = emptyBoard();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (rng() < 0.55) b[r][c] = 1;
    clearLines(b);
    if (!SHAPES.some(s => fitsAnywhere(b, s))) continue;
    total++;
    if (traySolvable(b, generateTray(b, rng).map(t => t.shape))) ok++;
  }
  assert.ok(ok / total > 0.8, `only ${ok}/${total} solvable`);
});

console.log(`\n${n} tests passed`);
