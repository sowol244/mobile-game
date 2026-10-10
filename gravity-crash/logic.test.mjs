// Run with: node gravity-crash/logic.test.mjs
import assert from 'node:assert/strict';
import {
  N, DIRS, parseBoard, toRows, settle, findGroups, explode, activateHoles, resolve, stageState, goalMet, solve, cloneState,
  starsFor, rng, planWave, spawnWave, blockedLines, crashStart, entryCell, nextCombo, FEVER_COMBO, colorBomb, commonColor,
  shuffleColors, fillCount, deadClear, crashLevel, spawnInterval, boardKey, mk, createAids, UNDO_LIMIT, HINT_LIMIT, migrateSave,
  fullLines, LINE_BONUS, BLOCK_LEVELS, typesAtLevel, randomBlock, waveSize, hasBoom, unjam, darkMove, needsShake, STUCK_LIMIT, STUCK_FILL,
  DAILY_TILTS, DAILY_FREE, dailyLevel, moveScore, createDaily, dailyTilt, cloneBoard,
} from './logic.js';
import { STAGES, CHAPTERS } from './stages.js';
import { STEPS } from './tutorial.js';
import { INFO, ORDER, typesOn } from './guide.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const E = '. . . . . . . . .';
const pad = rows => [...Array(N - rows.length).fill(E), ...rows];
const S = (rows, extra = {}) => ({ board: parseBoard(rows), gravity: 'down', ...extra });

test('parse / print round trip', () => {
  const rows = pad(['c p g y # * o . .', 'c^ p> gv y< . . . . .']);
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

test('blocks stack on each other and ice / black hole fall too', () => {
  const b = parseBoard(['c . . . . . . . .', '* . . . . . . . .', 'o . . . . . . . .', 'p . . . . . . . .', E, E, E, E, E]);
  settle(b, 'down');
  assert.deepEqual(toRows(b).slice(5).map(r => r[0]), ['c', '*', 'o', 'p']);
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

test('arrow laser clears its line, stops at walls, chains other arrows', () => {
  let b = parseBoard(pad(['c c c c> p g # y p']));
  let ex = explode(b, findGroups(b));
  assert.equal(toRows(b).at(-1), '. . . . . . # y p');
  assert.equal(ex.lasers[0].len, 2);
  b = parseBoard(pad(['. . . . p^ . . . .', 'c c c c> g * o y .']));
  ex = explode(b, findGroups(b)); // the laser takes ice and black holes too; p^ sits on another row, so it stays
  assert.equal(toRows(b).at(-1), '. . . . . . . . .');
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
    assert.equal(settle(t.board, 'down').moves.length, 0, `${tag} has floating blocks`);
    assert.equal(findGroups(t.board).length, 0, `${tag} starts with a match`);
    assert.equal(activateHoles(cloneState(s).board), null, `${tag} starts with an active black hole`);
    assert.ok(!goalMet(s), `${tag} is already solved`);
    assert.equal(def.goal, 'clear', `${tag}: only the "clear every block" goal exists`);
    assert.ok(!('exit' in def) && !def.rows.join(' ').includes('K'), `${tag} still has a core or an exit`);
    assert.equal(def.limit, def.par + 2, `${tag}: limit must be par + 2`);
    // lower bound: an exhaustive BFS (huge state cap, so null really means "impossible") finds nothing shorter
    assert.strictEqual(solve(stageState(def), 'clear', def.par - 1, 5e6), null, `${tag} is solvable in fewer than par=${def.par}`);
    // upper bound: the stored solution (or a fresh BFS one) has exactly par moves and really reaches the goal
    const sol = def.sol ? [...def.sol].map(c => D[c]) : solve(stageState(def), 'clear', def.par);
    assert.ok(sol && sol.length === def.par, `${tag} has no ${def.par}-move solution`);
    const r = stageState(def);
    for (const d of sol) assert.ok(resolve(r, d), `${tag}: move ${d} did nothing`);
    assert.ok(goalMet(r), `${tag}: solution does not reach the goal`);
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
  const types = new Set(STAGES.flatMap(s => s.rows.join(' ').split(/\s+/).map(t => (t.length === 2 ? 'arrow' : t))));
  for (const k of ['#', '*', 'o', 'arrow']) assert.ok(types.has(k), 'block type ' + k + ' is used');
  assert.ok(!types.has('K'), 'no core anywhere');
});

test('every tutorial step is solvable within its limit', () => {
  for (const s of STEPS) {
    assert.equal(s.goal, 'clear'); assert.ok(!s.rows.join(' ').includes('K'));
    const st = { board: parseBoard(s.rows), gravity: 'down' };
    assert.equal(findGroups(st.board).length, 0);
    const sol = solve(st, 'clear', s.limit);
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
  assert.ok(spawnInterval(1) > spawnInterval(6) && spawnInterval(50) === 0.7, 'the ramp ends at a 0.7 s floor');
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

test('every block type has a guide card and first appears in a gentle teaching stage (par ≤ 3)', () => {
  const first = {};
  STAGES.forEach((def, i) => { for (const t of typesOn(stageState(def).board)) if (!(t in first)) first[t] = i; });
  for (const t of ORDER) {
    assert.ok(INFO[t] && INFO[t].name && INFO[t].lines.length === 2, 'guide entry for ' + t);
    assert.ok(t in first, 'type ' + t + ' appears in some stage');
    assert.ok(STAGES[first[t]].par <= 3, `${INFO[t].name} first appears in stage ${first[t] + 1} with par ${STAGES[first[t]].par}`);
  }
});

test('the core block is gone from the rules: "K" is not a block any more', () => {
  assert.throws(() => parseBoard(pad(['. . . . K . . . .'])));
  assert.equal(goalMet(S(pad(['. . . . * o # . .']))), true, 'only colored blocks have to go');
});

test('puzzle aids: undo once and hint twice per stage, refilled on (re)start', () => {
  assert.equal(UNDO_LIMIT, 1); assert.equal(HINT_LIMIT, 2);
  const a = createAids();
  assert.ok(a.use('undo')); assert.ok(!a.use('undo')); assert.equal(a.undo, 0);
  assert.ok(a.use('hint')); assert.ok(a.use('hint')); assert.ok(!a.use('hint')); assert.equal(a.hint, 0);
  a.reset();
  assert.deepEqual([a.undo, a.hint], [1, 2]);
});

test('old saves are cleaned: core removed from seen blocks, stars sanitized and capped to the stage count', () => {
  const m = migrateSave({ stars: [3, 2, null, 7, -1, 1.5, 1, 2], seen: ['n', 'k', 'w', 'k', 'x'] }, 6);
  assert.deepEqual(m.stars, [3, 2, 0, 0, 0, 0]);
  assert.deepEqual(m.seen, ['n', 'w']);
  assert.deepEqual(migrateSave({ stars: 'junk', seen: null }, 100), { stars: [], seen: [] });
});

/* ---------- endless / daily rework ---------- */
const alt = (len, a = 'c', b = 'p') => Array.from({ length: len }, (_, i) => (i % 2 ? b : a)).join(' ');
const LN = { lines: true };

test('line crash: a full row pops under vertical gravity (with a bonus), a full column under horizontal gravity', () => {
  const st = S(pad([alt(9)]));
  const res = resolve(st, 'down', { ...LN, force: true });
  assert.equal(res.chain, 1); assert.equal(res.cleared, 9);
  assert.equal(res.gained, 9 * 10 + LINE_BONUS);
  assert.deepEqual(res.steps.find(x => x.type === 'boom').lines, [{ axis: 'row', k: 8 }]);
  assert.equal(fillCount(st.board), 0);
  const col = S(Array.from({ length: 9 }, (_, i) => (i % 2 ? 'p' : 'c') + ' . . . . . . . .'), { gravity: 'left' });
  const r2 = resolve(col, 'left', { ...LN, force: true });
  assert.deepEqual(r2.steps.find(x => x.type === 'boom').lines, [{ axis: 'col', k: 0 }]);
  assert.equal(fillCount(col.board), 0);
});

test('line crash: two rows at once pay the bonus twice; puzzle rules (no lines option) are untouched', () => {
  const two = S(pad([alt(9, 'p', 'c'), alt(9)]));
  const r = resolve(two, 'down', { ...LN, force: true });
  assert.equal(r.cleared, 18); assert.equal(r.gained, 18 * 10 + 2 * LINE_BONUS);
  const puzzle = S(pad([alt(9)]));
  const rp = resolve(puzzle, 'down', { force: true });
  assert.equal(rp.chain, 0); assert.equal(fillCount(puzzle.board), 9, 'without the lines option nothing pops');
});

test('line crash: only lines ACROSS gravity pop, so the overflow line can still be lost - and one tilt escapes it', () => {
  const rows = Array.from({ length: 9 }, (_, i) => `. . . . ${i % 2 ? 'p' : 'c'} . . . .`);
  const st = S(rows);
  assert.deepEqual(blockedLines(st.board, 'down', [{ k: 4 }]), [4], 'the full column blocks its entry cell');
  assert.equal(fullLines(st.board, 'down').length, 0, 'a column along gravity does not pop');
  assert.ok(resolve(st, 'down', { ...LN, force: true }).chain === 0 && fillCount(st.board) === 9);
  const escape = resolve(st, 'left', LN);
  assert.ok(escape && escape.chain === 1 && fillCount(st.board) === 0, 'tilting sideways turns it into a full line that pops');
});

test('line crash: walls never complete a line, a popped arrow still fires, and a pop can start a chain', () => {
  const w = S(pad(['c p c p # p c p c']));
  assert.equal(fullLines(w.board, 'down').length, 0);
  const arrow = S(pad(['g', 'y', 'c^ p c p c p c p c'].map(r => (r.length === 1 ? r + ' . . . . . . . .' : r))));
  const ra = resolve(arrow, 'down', { ...LN, force: true });
  assert.ok(ra.steps.find(x => x.type === 'boom').lasers.length >= 1);
  assert.equal(fillCount(arrow.board), 0, 'the laser took the blocks above it');
  // pop → the pink block above falls onto three pinks → 4 pinks → second round
  const chain = S(pad(['. . . . . . . . p', '. . . . . . . . p', 'c p c p c p c p g']));
  chain.board[8][8] = mk('n', 1); chain.board[8][7] = mk('n', 1); chain.board[8][6] = mk('n', 1);
  const rc = resolve(chain, 'down', { ...LN, force: true });
  assert.ok(rc.chain >= 1);
});

test('block ladder: a new type joins about every 3 levels and nothing shows up before its level', () => {
  const order = Object.entries(BLOCK_LEVELS).sort((a, b) => a[1] - b[1]);
  assert.deepEqual(order.map(x => x[0]), ['n', 'a', 'i', 'h']);
  for (let i = 1; i < order.length; i++) { const gap = order[i][1] - order[i - 1][1]; assert.ok(gap >= 2 && gap <= 3, `gap ${gap}`); }
  assert.deepEqual(typesAtLevel(1), ['n']); assert.deepEqual(typesAtLevel(3), ['n', 'a']); assert.deepEqual(typesAtLevel(12), ['n', 'a', 'i', 'h']);
  const R = rng(5);
  for (let lv = 1; lv <= 12; lv++) {
    const seen = new Set(), allowed = typesAtLevel(lv);
    for (let i = 0; i < 3000; i++) seen.add(randomBlock(R, lv).t);
    for (const t of seen) assert.ok(allowed.includes(t), `level ${lv} produced ${t}`);
    for (const t of allowed) assert.ok(seen.has(t), `level ${lv} never produced ${t}`);
  }
  for (const lv of [1, 4, 9]) for (let i = 0; i < 40; i++) assert.ok(waveSize(lv, R) >= 1 && waveSize(lv, R) <= 6);
});

test('stuck guard: a crowded board with nothing to pop is shaken up after 3 dark moves and ends calm', () => {
  const rows = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (r >= 5 && c < 8 ? 'cpgy'[(r + 2 * c) % 4] : '.')).join(' '));
  const st = S(rows);
  assert.ok(fillCount(st.board) >= STUCK_FILL); assert.equal(findGroups(st.board).length, 0);
  assert.ok(!hasBoom(st, LN), 'the board really has no exploding tilt');
  let dark = 0;
  for (let i = 0; i < STUCK_LIMIT; i++) { assert.ok(!needsShake(dark, st, LN)); dark = darkMove(dark, st, LN); }
  assert.equal(dark, STUCK_LIMIT); assert.ok(needsShake(dark, st, LN));
  const res = unjam(st, rng(3), LN);
  assert.ok(res && res.chain >= 1 && res.steps[0].type === 'shuffle');
  assert.ok(!needsShake(dark, st, LN), 'after the shake the board is no longer stuck');
  assert.equal(darkMove(5, S(pad(['c p c p . . . . .'])), LN), 0, 'a nearly empty board never counts as stuck');
  assert.equal(unjam(S(pad(['c p . . . . . . .'])), rng(1), LN), null, 'too few blocks: nothing to do');
});

// A bot that plays the endless rules in simulated time (acts every `turn` seconds, `eps` random tilts).
function playCrash(seed, eps, turn, cap = 300) {
  const R = rng(seed), Ri = rng(seed ^ 0x5bd1e995), P = rng(seed * 7 + 3), st = crashStart(R, 3);
  let wave = planWave(R, 1), t = 0, next = spawnInterval(1) + 1.2, moveT = turn, dark = 0, streak = 0, maxStreak = 0, over = false;
  const out = { lineClears: 0, perpFull: 0, helps: 0 };
  const count = r => { for (const x of r.steps) if (x.lines && x.lines.length) out.lineClears += x.lines.length; };
  const shake = () => { if (needsShake(dark, st, LN)) { const h = unjam(st, Ri, LN); if (h) { out.helps++; count(h); } } };
  while (t < cap) {
    t += 0.1;
    if (t >= moveT) {
      moveT += turn;
      const cand = DIRS.filter(d => d !== st.gravity), boom = hasBoom(st, LN);
      if (fillCount(st.board) >= STUCK_FILL && !boom) maxStreak = Math.max(maxStreak, ++streak); else streak = 0;
      if (fullLines(st.board, st.gravity).length) out.perpFull++;
      let pick = cand[P.int(3)];
      if (P() >= eps) { let best = -1; for (const d of cand) { const r = resolve(cloneState(st), d, LN); if (r && r.cleared > best) { best = r.cleared; pick = d; } } }
      dark = darkMove(dark, st, LN);
      const r = resolve(st, pick, LN); if (r) count(r);
      shake();
    }
    if (t >= next) {
      const r = spawnWave(st, wave, LN);
      if (r.overflow) { over = true; break; }
      count(r); wave = planWave(R, 1 + Math.floor(t / 20)); next = t + spawnInterval(1 + Math.floor(t / 20));
      shake();
    }
  }
  return { ...out, maxStreak, over, time: t };
}

test('endless bot games: lines pop, no board is ever locked by a full line, the stuck guard keeps streaks at 3 or less', () => {
  let lineClears = 0, perp = 0, worst = 0, ends = 0;
  for (let seed = 1; seed <= 24; seed++) for (const [eps, turn] of [[0.2, 1], [0.6, 2]]) {
    const g = playCrash(seed, eps, turn, 240);
    lineClears += g.lineClears; perp += g.perpFull; worst = Math.max(worst, g.maxStreak); ends += g.over ? 1 : 0;
  }
  assert.ok(lineClears > 100, 'lines get cleared all the time');
  assert.equal(perp, 0, 'a full line across gravity never survives a move');
  assert.ok(worst <= STUCK_LIMIT, `a streak of ${worst} dark moves`);
  assert.ok(ends >= 30, 'the ramp still ends games (not endless for a fast bot)');
});

const sigOf = w => JSON.stringify(w.map(x => [x.k, x.b.t, x.b.c, x.b.d]));
function playDaily(seed, eps, P) {
  const g = createDaily(seed), waves = {};
  let counted = 0, calls = 0;
  while (!g.over && calls++ < 800) {
    const cand = DIRS.filter(d => d !== g.state.gravity);
    let pick = cand[P.int(3)];
    if (P() >= eps) { let best = -1; for (const d of cand) { const r = resolve(cloneState(g.state), d, LN); if (r && r.cleared > best) { best = r.cleared; pick = d; } } }
    const w = g.wave, n0 = g.n, r = dailyTilt(g, pick);
    if (r && !r.free) counted++;
    if (g.n > n0) waves[n0] = sigOf(w);
  }
  return { g, counted, waves };
}

test(`daily: ${DAILY_TILTS} tilts, dead tilts are free, the game ends at zero and then nothing moves`, () => {
  assert.equal(DAILY_TILTS, 30);
  for (let seed = 1; seed <= 60; seed++) for (const eps of [0.2, 1]) {
    const { g, counted } = playDaily(seed, eps, rng(seed + 11));
    assert.ok(g.over, `seed ${seed}: never ended`);
    assert.equal(g.left, 0); assert.equal(counted, DAILY_TILTS, `seed ${seed}: ${counted} counted tilts`);
    assert.equal(g.used, DAILY_TILTS);
    assert.equal(dailyTilt(g, DIRS.find(d => d !== g.state.gravity)), null, 'no tilt after the end');
  }
  const g = createDaily(7);
  const dead = g.state.gravity; // tilting the way gravity already points moves nothing
  assert.equal(dailyTilt(g, dead), null); assert.equal(g.left, DAILY_TILTS);
});

test('daily: everyone gets the same waves, whatever they do, and the block types follow the wave number', () => {
  const a = playDaily(20261010, 0.2, rng(1)), b = playDaily(20261010, 1, rng(2)), c = playDaily(20261010, 0.5, rng(3));
  const shared = Math.min(...[a, b, c].map(x => Object.keys(x.waves).length));
  assert.ok(shared >= 10);
  for (let i = 0; i < shared; i++) assert.ok(a.waves[i] === b.waves[i] && b.waves[i] === c.waves[i], `wave ${i} differs between players`);
  assert.notEqual(playDaily(20261011, 0.2, rng(1)).waves[0], a.waves[0], 'a different day has different waves');
  assert.equal(dailyLevel(0), 1); assert.equal(dailyLevel(29), 10);
  assert.ok(typesAtLevel(dailyLevel(29)).length === 4, 'all four block types show up within one daily');
  const early = createDaily(3);
  assert.ok(early.wave.every(w => w.b.t === 'n'), 'the first wave is plain colors');
});

test('daily: a combo of 5 gives 3 free tilts (no wave, double points); an empty board never stalls; blocks over a taken entry cell are dropped', () => {
  const g = createDaily(9);
  g.state.board = parseBoard(pad(['p . y . . . . . g', 'c c c . . . . . c'])); g.state.gravity = 'down';
  g.combo = 4;
  const r = dailyTilt(g, 'right');
  assert.ok(r && r.tilt.chain === 1 && !r.spawn, 'no wave while the free tilts start');
  assert.equal(g.free, DAILY_FREE); assert.equal(g.left, DAILY_TILTS - 1);
  for (const d of ['left', 'up', 'down']) { const x = dailyTilt(g, d); assert.ok(x && x.free && !x.spawn); }
  assert.equal(g.free, 0); assert.equal(g.left, DAILY_TILTS - 1, 'free tilts cost nothing'); assert.equal(g.combo, 0);
  assert.ok(dailyTilt(g, g.state.gravity === 'right' ? 'left' : 'right') && g.left === DAILY_TILTS - 2, 'the next one costs again');
  // clearing everything brings the next wave at once
  const e = createDaily(10);
  e.state.board = parseBoard(pad(['c c c . . . . . c'])); e.state.gravity = 'down';
  const x = dailyTilt(e, 'right');
  assert.ok(x.spawn && fillCount(e.state.board) > 0, 'a wave lands on the emptied board');
  // a full line along gravity: blocks over taken entry cells are dropped instead of ending the game
  const f = createDaily(11);
  f.state.board = parseBoard(Array.from({ length: 9 }, (_, i) => `. . . . ${i % 2 ? 'p' : 'c'} . . . .`)); f.state.gravity = 'down';
  f.wave = [{ k: 4, b: mk('n', 2) }, { k: 1, b: mk('n', 3) }];
  const sp = spawnWave(f.state, f.wave, { ...LN, skipBlocked: true });
  assert.ok(!sp.overflow && fillCount(f.state.board) === 10, 'only the unblocked block came in');
});

// Oracle bot: looks `depth` tilts ahead using the exact upcoming waves (what a player plans with the preview).
function oracleBest(g, W, depth) {
  if (depth === 0 || g.over) return g.score;
  let b = g.score;
  for (const d of DIRS) {
    if (d === g.state.gravity) continue;
    const c = { ...g, state: cloneState(g.state), Rs: rng(1), wave: W[g.n] };
    if (!dailyTilt(c, d)) continue;
    c.wave = W[c.n]; b = Math.max(b, oracleBest(c, W, depth - 1));
  }
  return b;
}
function playOracle(seed, depth) {
  const g = createDaily(seed), Rs = rng(seed), W = []; crashStart(Rs, 3);
  for (let i = 0; i < 40; i++) W.push(planWave(Rs, dailyLevel(i)));
  const P = rng(seed + 3);
  for (let calls = 0; !g.over && calls < 600; calls++) {
    const cand = DIRS.filter(d => d !== g.state.gravity); let pick = cand[P.int(3)], best = -1;
    if (depth) for (const d of cand) {
      const c = { ...g, state: cloneState(g.state), Rs: rng(1), wave: g.wave };
      if (!dailyTilt(c, d)) continue;
      c.wave = W[c.n]; const v = oracleBest(c, W, depth - 1); if (v > best) { best = v; pick = d; }
    }
    dailyTilt(g, pick);
  }
  return g.score;
}

test('daily scoring: combos multiply points, endless scoring is unchanged, and planning ahead pays', () => {
  const res = { gained: 400, chain: 2 };
  assert.equal(moveScore(res, 1, true), 400); assert.equal(moveScore(res, 5, true), 800); assert.ok(moveScore(res, 9, true) > moveScore(res, 5, true));
  assert.equal(moveScore(res, 3), 400 + 3 * 20, 'endless: points + 20 per combo step');
  assert.equal(moveScore({ gained: 0, chain: 0 }, 5, true), 0);
  let rnd = 0, plan = 0;
  for (let seed = 1; seed <= 12; seed++) { rnd += playOracle(seed, 0); plan += playOracle(seed, 3); }
  assert.ok(plan > rnd * 1.3, `looking 3 tilts ahead (${Math.round(plan / 12)}) should clearly beat random play (${Math.round(rnd / 12)})`);
});

console.log(`\n${n} tests passed`);
