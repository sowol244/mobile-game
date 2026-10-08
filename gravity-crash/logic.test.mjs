// Run with: node gravity-crash/logic.test.mjs
import assert from 'node:assert/strict';
import {
  N, DIRS, parseBoard, toRows, settle, findGroups, explode, activateHoles, resolve, stageState, goalMet, solve, cloneState,
  starsFor, rng, planWave, spawnWave, blockedLines, crashStart, entryCell, nextCombo, FEVER_COMBO, colorBomb, commonColor,
  shuffleColors, fillCount, deadClear, parseExit, crashLevel, spawnInterval, boardKey, mk,
} from './logic.js';
import { STAGES, CHAPTERS } from './stages.js';
import { STEPS } from './tutorial.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const E = '. . . . . . . . .';
const pad = rows => [...Array(N - rows.length).fill(E), ...rows];
const S = (rows, extra = {}) => ({ board: parseBoard(rows), gravity: 'down', exit: null, rescued: false, ...extra });

test('parse / print round trip', () => {
  const rows = pad(['c p g y # * o K .', 'c^ p> gv y< . . . . .']);
  assert.deepEqual(toRows(parseBoard(rows)), rows.map(r => r.split(/\s+/).join(' ')));
});

test('gravity slides blocks to the wall, walls stay and split lines', () => {
  const b = parseBoard(pad(['c . # . p . . . y']));
  const { moves } = settle(b, 'right');
  assert.deepEqual(toRows(b).at(-1), '. c # . . . . p y');
  assert.equal(moves.length, 2);
  assert.equal(moves.find(m => m.b.c === 1).dist, 3);
  settle(b, 'up');
  assert.equal(toRows(b)[0], '. c . . . . . p y');
  assert.equal(toRows(b).at(-1), '. . # . . . . . .'); // the wall never moved
});

test('settling twice in the same direction changes nothing', () => {
  const b = parseBoard(pad(['c . p . y', 'g g . c p'].map(r => r + ' . . . .')));
  settle(b, 'left');
  assert.equal(settle(b, 'left').moves.length, 0);
  const st = S(pad(['c . . . . . . . .']));
  assert.equal(resolve(st, 'down'), null, 'a move that moves nothing is not a move');
});

test('blocks stack on each other and ice / black hole / core fall too', () => {
  const b = parseBoard(['c . . . . . . . .', '* . . . . . . . .', 'o . . . . . . . .', 'K . . . . . . . .', E, E, E, E, E]);
  settle(b, 'down');
  assert.deepEqual(toRows(b).slice(5).map(r => r[0]), ['c', '*', 'o', 'K']);
});

test('4+ orthogonal same color match, diagonals do not count, arrows join their color', () => {
  let b = parseBoard(pad(['c . . . . . . . .', 'c c c . . . . . .']));
  assert.equal(findGroups(b).length, 1);
  b = parseBoard(pad(['. c . . . . . . .', 'c . c c . . . . .']));
  assert.equal(findGroups(b).length, 0);
  b = parseBoard(pad(['p p p> p . . . . .']));
  assert.equal(findGroups(b)[0].cells.length, 4);
  b = parseBoard(pad(['c c c * c . . . .']));
  assert.equal(findGroups(b).length, 0, 'ice breaks a line');
});

test('all groups explode at once and every round is one chain step', () => {
  // two separate groups in the same settle → one round (chain 1)
  const st = S(pad(['c c c . . . p p p', 'c . . . . . . . p']));
  const res = resolve(st, 'up', { force: true });
  assert.equal(res.chain, 1);
  assert.equal(res.cleared, 8);
  assert.equal(res.gained, 80);
});

test('chain: blocks falling after an explosion make a new match (score ×chain)', () => {
  // the 4 cyan in the bottom row go; the pink tower falls onto pink → second round
  const st = S(pad(['p . . . . . . . .', 'p . . . . . . . .', 'p . . . . . . . .', 'c c c . . . . . .', 'p c . . . . . . .']));
  // cyan: (row-1, 0..2) + (row,1) = 4 → explode; pink column drops onto bottom-left pink → 4 pink
  const res = resolve(st, 'down', { force: true });
  assert.equal(res.chain, 2);
  assert.equal(res.steps.filter(s => s.type === 'boom').length, 2);
  assert.equal(res.gained, 4 * 10 * 1 + 4 * 10 * 2);
  assert.equal(fillCount(st.board), 0);
});

test('ice breaks only when a neighbouring colored block explodes', () => {
  const st = S(pad(['* . . . . . . . *', 'c c c c . . . . .']));
  const res = resolve(st, 'down', { force: true });
  assert.equal(res.cleared, 5); // 4 cyan + the ice on top of them; the far ice survives
  assert.equal(toRows(st.board).at(-1), '. . . . . . . . *');
  const b = parseBoard(pad(['* . . . . . . . .', '. c c c c . . . .']));
  explode(b, findGroups(b));
  assert.equal(toRows(b).at(-2)[0], '*', 'diagonal ice survives');
});

test('arrow laser clears its line, stops at walls, skips the core, chains other arrows', () => {
  let b = parseBoard(pad(['c c c c> p g # y K']));
  let ex = explode(b, findGroups(b));
  assert.equal(toRows(b).at(-1), '. . . . . . # y K');
  assert.equal(ex.lasers[0].len, 2);
  b = parseBoard(pad(['. . . . p^ . . . .', 'c c c c> g K . y .']));
  ex = explode(b, findGroups(b)); // laser passes over the core; p^ sits on another row, so it stays
  assert.equal(toRows(b).at(-1), '. . . . . K . . .');
  assert.equal(toRows(b).at(-2), '. . . . p^ . . . .');
  b = parseBoard(['. . . . . . . . .', '. . . . . y . . .', E, E, E, E, E, '. . . . . . . . .', 'c c c c> . p^ . g .']);
  ex = explode(b, findGroups(b));
  assert.equal(ex.lasers.length, 2, 'the hit arrow fires too');
  assert.equal(toRows(b)[1], '. . . . . . . . .');
});

test('black hole: 3+ colored neighbours turn to the majority color, then it collapses', () => {
  const b = parseBoard(pad(['p . . . . . . . .', 'o p . . . . . . .', 'c p . . . . . . .']));
  const h = activateHoles(b);
  assert.ok(h);
  assert.equal(h.holes[0].color, 1);
  assert.deepEqual(h.conv, [{ r: 8, c: 0, from: 0, to: 1 }]);
  assert.equal(b[7][0], null);
  const b2 = parseBoard(pad(['o p . . . . . . .', 'c . . . . . . . .']));
  assert.equal(activateHoles(b2), null, 'needs 3 neighbours');
  const b3 = parseBoard(pad(['o y . . . . . . .', 'c g . . . . . . .']));
  assert.equal(activateHoles(b3).holes[0].color, 0, 'tie → lowest color index');
});

test('black hole inside resolve: convert → settle → match', () => {
  const st = S(pad(['. p . . . . . . .', '. c . . . o c c .']));
  const res = resolve(st, 'left');
  assert.ok(res.steps.some(s => s.type === 'hole'));
  assert.equal(res.chain, 1);
  assert.equal(fillCount(st.board), 0);
});

test('core passes only through its exit gate, and only with gravity pointing out', () => {
  const st = { board: parseBoard(pad(['. . . . K . . . .'])), gravity: 'down', exit: parseExit('right:8'), rescued: false };
  resolve(st, 'left');
  assert.ok(!st.rescued);
  resolve(st, 'right');
  assert.ok(st.rescued);
  assert.equal(fillCount(st.board), 0);
  const st2 = { board: parseBoard(pad(['. . . . K . . . c'])), gravity: 'down', exit: parseExit('right:8'), rescued: false };
  resolve(st2, 'right');
  assert.ok(!st2.rescued, 'a block in the gate cell keeps it shut');
});

test('stars and dead-end detection', () => {
  assert.deepEqual([3, 4, 5, 9].map(m => starsFor(m, 4)), [3, 3, 2, 1]);
  assert.equal(starsFor(3, 4, true), 2);
  assert.ok(deadClear(parseBoard(pad(['c c c . . . . . .']))));
  assert.ok(!deadClear(parseBoard(pad(['c c c o . . . . .']))));
});

test('solver finds the shortest sequence', () => {
  const st = S(pad(['c . . c . . c . c']));
  assert.equal(solve(st, 'clear', 3).length, 1);
  assert.equal(solve(S(pad(['c c c . . . . . .'])), 'clear', 4), null);
});

test(`every puzzle stage (${STAGES.length}) is stable at start, has no solution shorter than par, and a par-move solution replays to the goal`, () => {
  assert.equal(STAGES.length, 100);
  const seen = new Set(), names = new Set();
  const D = { U: 'up', R: 'right', D: 'down', L: 'left' };
  STAGES.forEach((def, i) => {
    const tag = `stage ${i + 1} (${def.name})`;
    const s = stageState(def);
    const key = boardKey(s.board); assert.ok(!seen.has(key), `${tag} duplicates another`); seen.add(key);
    assert.ok(!names.has(def.name), `${tag}: duplicate name`); names.add(def.name);
    const t = cloneState(s);
    assert.equal(settle(t.board, 'down', t.exit).moves.length, 0, `${tag} has floating blocks`);
    assert.equal(findGroups(t.board).length, 0, `${tag} starts with a match`);
    assert.equal(activateHoles(cloneState(s).board), null, `${tag} starts with an active black hole`);
    assert.ok(!goalMet(s, def.goal), `${tag} is already solved`);
    if (def.goal !== 'clear') assert.ok(def.exit && s.board.flat().some(b => b && b.t === 'k'), `${tag} needs a core and an exit`);
    assert.equal(def.limit, def.par + 2, `${tag}: limit must be par + 2`);
    // lower bound: an exhaustive BFS (huge state cap, so null really means "impossible") finds nothing shorter
    assert.strictEqual(solve(stageState(def), def.goal, def.par - 1, 5e6), null, `${tag} is solvable in fewer than par=${def.par}`);
    // upper bound: the stored solution (or a fresh BFS one) has exactly par moves and really reaches the goal
    const sol = def.sol ? [...def.sol].map(c => D[c]) : solve(stageState(def), def.goal, def.par);
    assert.ok(sol && sol.length === def.par, `${tag} has no ${def.par}-move solution`);
    const r = stageState(def);
    for (const d of sol) assert.ok(resolve(r, d), `${tag}: move ${d} did nothing`);
    assert.ok(goalMet(r, def.goal), `${tag}: solution does not reach the goal`);
  });
});

test('chapters cover 1–100 in order, ≤12 stages each, and difficulty rises chapter by chapter', () => {
  let next = 1;
  for (const c of CHAPTERS) { assert.equal(c.from, next); assert.ok(c.to >= c.from && c.to - c.from + 1 <= 12); next = c.to + 1; }
  assert.equal(next, STAGES.length + 1);
  const avg = c => STAGES.slice(c.from - 1, c.to).reduce((a, s) => a + s.par, 0) / (c.to - c.from + 1);
  for (let k = 1; k < CHAPTERS.length; k++) assert.ok(avg(CHAPTERS[k]) > avg(CHAPTERS[k - 1]), `chapter ${k + 1} easier than chapter ${k}`);
  // a smooth curve: inside a chapter par never drops by more than 1; a new chapter may restart up to 2 lower
  for (let i = 25; i < STAGES.length; i++) {
    const opens = CHAPTERS.some(c => c.from === i + 1);
    assert.ok(STAGES[i].par >= STAGES[i - 1].par - (opens ? 2 : 1), `par drops sharply at stage ${i + 1}`);
  }
  assert.ok(STAGES.at(-1).par >= 10);
  const goals = new Set(STAGES.map(s => s.goal)), types = new Set(STAGES.flatMap(s => s.rows.join(' ').split(/\s+/).map(t => t[0])));
  for (const g of ['clear', 'rescue', 'both']) assert.ok(goals.has(g));
  for (const k of ['#', '*', 'o', 'K']) assert.ok(types.has(k), 'block type ' + k + ' is used');
});

test('every tutorial step is solvable within its limit', () => {
  for (const s of STEPS) {
    const st = { board: parseBoard(s.rows), gravity: 'down', exit: parseExit(s.exit), rescued: false };
    assert.equal(findGroups(st.board).length, 0);
    const sol = solve(st, s.goal, s.limit);
    assert.ok(sol && sol.length <= s.limit, 'tutorial step unsolvable: ' + s.text);
  }
});

test('crash: waves enter at the ceiling, overflow when an entry cell is taken', () => {
  const R = rng(42);
  const st = crashStart(R, 3);
  assert.equal(findGroups(st.board, 3).length, 0, 'no ready-made matches');
  for (const d of DIRS) { // whichever way gravity turns first, no line is full yet
    const b = cloneState(st).board; settle(b, d);
    for (let k = 0; k < N; k++) assert.equal(blockedLines(b, d, [{ k }]).length, 0, 'no line starts full');
  }
  assert.ok(fillCount(st.board) >= 9 && fillCount(st.board) <= 21);
  const wave = [{ k: 4, b: mk('n', 0) }];
  const res = spawnWave(st, wave);
  assert.ok(!res.overflow);
  assert.ok(res.steps[0].moves.some(m => m.spawn && m.fr === -1), 'slides in from outside the frame');
  // fill column 4 to the top: the next wave there overflows
  for (let r = 0; r < N; r++) if (!st.board[r][4]) st.board[r][4] = mk('i');
  assert.deepEqual(blockedLines(st.board, 'down', [{ k: 4, b: mk('n', 1) }]), [4]);
  assert.ok(spawnWave(st, [{ k: 4, b: mk('n', 1) }]).overflow);
  // gravity left → ceiling is the right edge
  assert.deepEqual(entryCell('left', 2), [2, 8]);
  assert.deepEqual(entryCell('up', 3), [8, 3]);
});

test('crash: planned waves are deterministic per seed (daily challenge) and ramp up', () => {
  const a = rng(20261008), b = rng(20261008);
  const wa = planWave(a, 5).map(w => [w.k, w.b.t, w.b.c]), wb = planWave(b, 5).map(w => [w.k, w.b.t, w.b.c]);
  assert.deepEqual(wa, wb);
  assert.ok(spawnInterval(1) > spawnInterval(6) && spawnInterval(50) >= 1);
  assert.equal(crashLevel(0), 1); assert.equal(crashLevel(41), 3);
  for (let i = 0; i < 50; i++) { const w = planWave(a, 8); assert.equal(new Set(w.map(x => x.k)).size, w.length); }
});

test('fever: combo counts explosion rounds across moves; 5 → gravity free with 3-matches', () => {
  let combo = 0;
  combo = nextCombo(combo, { chain: 2 }); combo = nextCombo(combo, { chain: 1 });
  assert.equal(combo, 3);
  combo = nextCombo(combo, { chain: 2 });
  assert.ok(combo >= FEVER_COMBO);
  assert.equal(nextCombo(combo, { chain: 0 }), 0, 'a dud move resets the combo');
  const st = S(pad(['c c c . . . . . .']));
  assert.equal(resolve(st, 'up', { force: true }).chain, 0);
  const st2 = S(pad(['c c c . . . . . .']));
  const res = resolve(st2, 'up', { force: true, min: 3, mult: 2 });
  assert.equal(res.chain, 1); assert.equal(res.gained, 60);
});

test('items: color bomb removes the most common color; shuffle keeps positions', () => {
  const b = parseBoard(pad(['p . . . . . . . .', 'c c p c . . . . y']));
  assert.equal(commonColor(b), 0);
  const ex = colorBomb(b, 0);
  assert.equal(ex.cells.length, 3);
  const before = fillCount(b);
  shuffleColors(b, rng(1));
  assert.equal(fillCount(b), before);
});

test('random play never breaks invariants (block count only shrinks by explosions)', () => {
  const R = rng(7);
  for (let g = 0; g < 30; g++) {
    const st = crashStart(R, 4);
    for (let m = 0; m < 25; m++) {
      const pre = fillCount(st.board);
      const res = resolve(st, DIRS[R.int(4)]);
      if (!res) continue;
      assert.equal(fillCount(st.board), pre - res.cleared);
      assert.equal(settle(cloneState(st).board, st.gravity).moves.length, 0, 'board is at rest after a move');
      assert.equal(findGroups(st.board).length, 0, 'no match left standing');
    }
  }
});

console.log(`\n${n} tests passed`);
