// Run with: node one-move/logic.test.mjs   (proves every stage solvable within its limit; takes ~1 minute)
import assert from 'node:assert/strict';
import {
  parseStage, parseToken, tokenOf, applyMove, blockReason, isWin, legalMoves, solve, starsFor, starCut, dailyStage, boardRows,
  kindOf, valueOf, PIN, ONCE, NUM,
} from './logic.js';
import { STAGES, CHAPTERS } from './stages.js';
import { LESSONS, INTROS } from './tutorial.js';

let n = 0;
const test = (name, fn) => { const t = Date.now(); fn(); n++; console.log(`ok  ${name}  (${Date.now() - t}ms)`); };
const U = 0, R = 1, D = 2, L = 3;
const S = (rows, target = 64, extra = {}) => parseStage({ rows, target, limit: 99, ...extra });
const at = (s, r, c) => tokenOf(s.codes[r * s.n + c]);
const mv = (s, r, c, d) => applyMove(s, r * s.n + c, d);

test('tokens round-trip', () => {
  for (const t of ['.', '#', 'g8', '2', '1024', '4p', '16o', 'g128']) assert.equal(tokenOf(parseToken(t)), t);
  assert.throws(() => parseToken('3'));
  assert.throws(() => parseToken('x'));
});

test('moving into an empty cell moves the tile one cell and costs one move', () => {
  const s = S(['2 . .', '. . .', '. . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(at(r.state, 0, 0), '.'); assert.equal(at(r.state, 0, 1), '2'); assert.equal(at(r.state, 0, 2), '.');
  assert.equal(r.state.moves, 1); assert.equal(r.ev.merged, false);
  assert.equal(s.moves, 0, 'applyMove is pure');
});

test('same number merges into the target cell (result sits there)', () => {
  const s = S(['4 4 .', '. . .', '. . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(at(r.state, 0, 0), '.'); assert.equal(at(r.state, 0, 1), '8');
  assert.ok(r.ev.merged); assert.equal(r.ev.value, 8);
  assert.equal(r.ev.into, s.ids[1], 'the target tile id survives');
  assert.equal(r.state.ids[1], s.ids[1]);
});

test('only ONE tile moves ONE cell: a chain of equal tiles does not cascade', () => {
  const s = S(['2 2 2 2', '. . . .', '. . . .', '. . . .']);
  const r = mv(s, 0, 0, R);
  assert.deepEqual(boardRows(r.state)[0], '. 4 2 2');
});

test('blocked moves (edge, different number, wall, gate, fixed) cost nothing', () => {
  const s = S(['2 4 #', 'g8 2 .', '4p 2o .']);
  assert.equal(blockReason(s, 0, U), 'edge'); assert.equal(mv(s, 0, 0, U), null);
  assert.equal(blockReason(s, 0, R), 'diff'); assert.equal(mv(s, 0, 0, R), null);
  assert.equal(blockReason(s, 1, R), 'wall');
  assert.equal(blockReason(s, 4, L), 'gate');
  assert.equal(blockReason(s, 6, R), 'fixed', 'pinned tiles never move');
  assert.equal(blockReason(s, 3, R), 'fixed', 'gates never move');
  assert.equal(blockReason(s, 2, D), 'fixed', 'walls never move');
  assert.equal(blockReason(s, 7, U), null, 'once tile 2 may merge into the 2 above');
});

test('pinned tile accepts a merge and stays pinned', () => {
  const s = S(['4 4p', '. .']);
  const r = mv(s, 0, 0, R);
  assert.equal(at(r.state, 0, 1), '8p');
  assert.equal(kindOf(r.state.codes[1]), 'pin');
});

test('once tile: moves one time, then becomes fixed', () => {
  const s = S(['2o . .', '. . .', '. . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(at(r.state, 0, 1), '2p'); assert.ok(r.ev.locked);
  assert.equal(blockReason(r.state, 1, R), 'fixed');
  // a once tile merging away is consumed; a merge INTO a once tile keeps it movable once
  const s2 = S(['2o 2 4o', '. . 4', '. . .']);
  const a = mv(s2, 0, 0, R); assert.equal(at(a.state, 0, 1), '4');
  const b = mv(s2, 1, 2, U); assert.equal(at(b.state, 0, 2), '8o');
});

test('gate opens only when its exact number is made', () => {
  const s = S(['2 2 g8', '. 4 .', '. . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(at(r.state, 0, 2), 'g8', 'a 4 does not open an 8-gate');
  const r2 = mv(r.state, 1, 1, U); // 4 + 4 = 8
  assert.equal(at(r2.state, 0, 1), '8');
  assert.equal(at(r2.state, 0, 2), '.', 'gate vanished');
  assert.deepEqual(r2.ev.opened, [2]);
});

test('win: target anywhere, or exactly on the goal cell', () => {
  const s = S(['8 8', '. .'], 16);
  assert.ok(!isWin(s)); assert.ok(mv(s, 0, 0, R).ev.win);
  const g = S(['8 8', '. .'], 16, { goal: [0, 0] });
  assert.ok(!mv(g, 0, 0, R).ev.win, 'made 16 on the wrong cell');
  assert.ok(mv(g, 0, 1, L).ev.win);
});

test('stars: 3★ within optimum+1, hint caps at 2★, over the limit = 0', () => {
  assert.equal(starsFor(7, 7, 12), 3); assert.equal(starsFor(8, 7, 12), 3);
  assert.equal(starsFor(9, 7, 12), 2); assert.equal(starsFor(10, 7, 12), 2);
  assert.equal(starsFor(11, 7, 12), 1); assert.equal(starsFor(12, 7, 12), 1); assert.equal(starsFor(13, 7, 12), 0);
  assert.equal(starsFor(7, 7, 12, true), 2);
  assert.equal(starsFor(5, 5, 5), 3);
  assert.deepEqual(starCut(7, 12), { three: 8, two: 10 });
});

test("solver: the designer's example (target 16) takes exactly 7 moves", () => {
  const s = parseStage({ rows: ['2 4 . 2', '. 2 . .', '4 . 2 .', '. . 4 .'], target: 16, limit: 12 });
  const r = solve(s);
  assert.equal(r.depth, 7);
  let cur = s;
  for (const [i, d] of r.path) cur = applyMove(cur, i, d).state;
  assert.ok(isWin(cur));
  assert.equal(solve(s, { maxDepth: 6 }), null, 'no 6-move solution exists');
});

test('stage list shape', () => {
  assert.ok(STAGES.length >= 40, 'at least 40 stages');
  assert.equal(new Set(STAGES.map(s => s.id)).size, STAGES.length);
  assert.equal(CHAPTERS.length, 4);
  for (const ch of CHAPTERS) assert.ok(STAGES.filter(s => s.ch === ch.id).length >= 10, `chapter ${ch.id} has 10+ stages`);
  assert.ok(STAGES.some(s => s.rows.join('/') === '2 4 . 2/. 2 . ./4 . 2 ./. . 4 .'), "designer's example is included");
  for (const id of Object.keys(INTROS)) assert.ok(STAGES.some(s => s.id === id), 'intro for ' + id);
});

const relax = {
  walls: d => ({ ...d, rows: d.rows.map(r => r.replace(/(^|\s)#(?=\s|$)/g, '$1.')) }),
  goal: d => ({ ...d, goal: null }),
  pins: d => ({ ...d, rows: d.rows.map(r => r.replace(/(\d)p/g, '$1')) }),
  onces: d => ({ ...d, rows: d.rows.map(r => r.replace(/(\d)o/g, '$1')) }),
  gates: d => ({ ...d, rows: d.rows.map(r => r.replace(/g\d+/g, '#')) }),
};
let totalStates = 0, maxStates = 0;
for (const def of STAGES) {
  test(`stage ${def.id}: optimal ${def.opt} / limit ${def.limit}`, () => {
    const s = parseStage(def);
    assert.ok(!isWin(s), 'not already solved');
    const r = solve(s, { maxDepth: def.limit });
    assert.ok(r && !r.aborted, 'solvable within its move limit');
    assert.equal(r.depth, def.opt, 'stored optimum matches the solver');
    assert.ok(r.states < 400000, 'small enough for the in-page hint');
    totalStates += r.states; maxStates = Math.max(maxStates, r.states);
    let cur = s;
    for (const [i, d] of r.path) cur = applyMove(cur, i, d).state;
    assert.ok(isWin(cur));
    // difficulty curve: early stages are relaxed, later ones are real puzzles with tight limits
    if (def.ch === 1) assert.ok(def.limit >= 10 && def.limit <= 20, 'chapter 1 limits are 10–20 moves');
    else assert.ok(def.opt >= 5, 'not trivially short');
    if (def.ch >= 3) assert.ok(def.limit - def.opt <= 3, 'tight limit');
    if (def.ch === 4) assert.ok(def.limit - def.opt <= 2 && def.opt >= 6, 'late stages are tight and long');
    const text = def.rows.join(' ');
    if (def.ch === 1) assert.ok(!/[#gpo]/.test(text) && !def.goal, 'chapter 1 has no special tiles');
    if (def.ch === 4) assert.ok(/g\d/.test(text), 'chapter 4 uses gates');
    // each declared mechanic really matters for this puzzle
    for (const m of def.need || []) {
      if (m === 'gates') { const o = solve(parseStage(relax.gates(def)), { maxDepth: def.limit }); assert.ok(!o, 'cannot win without opening a gate'); }
      else { const o = solve(parseStage(relax[m](def)), { maxDepth: def.opt - 1 }); assert.ok(o && !o.aborted, `removing ${m} makes it easier`); }
    }
  });
}

test('tutorial lessons are legal and end in a win', () => {
  for (const L of LESSONS) {
    let s = parseStage(L.def);
    for (const st of L.steps) {
      const [r, c, d] = st.move;
      const res = applyMove(s, r * s.n + c, d);
      assert.ok(res, 'step move is legal: ' + st.text);
      s = res.state;
    }
    assert.ok(isWin(s));
  }
});

test('daily puzzle: deterministic, solver-verified, 7+ moves', () => {
  for (let day = 20730; day < 20745; day++) {
    const a = dailyStage(day), b = dailyStage(day);
    assert.ok(a, 'generated for day ' + day);
    assert.deepEqual(a, b);
    const r = solve(parseStage(a), { maxDepth: a.limit });
    assert.equal(r.depth, a.opt); assert.ok(a.opt >= 7 && a.limit === a.opt + 3);
  }
});

console.log(`\n${n} tests passed · ${STAGES.length} stages · solver states total ${totalStates}, max ${maxStates}`);
