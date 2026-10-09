// Run with: node sudoku/logic.test.mjs
import assert from 'node:assert/strict';
import {
  countSolutions, solveGrid, grade, parseGrid, findHint, newGame, place, toggleNote, hasNote, erase, undo, useHint,
  starsFor, digitCount, candidatesAt, completedUnitsAt, fmtTime, PEERS, MAX_HINTS, ROW, COL, BOX,
} from './logic.js';
import { STAGES, TIERS } from './stages.js';
import { TUT, TUT_PUZZLE, TUT_SOLUTION, tutorialSteps } from './tutorial.js';

let n = 0;
const test = (name, fn) => { const t = Date.now(); fn(); n++; console.log(`ok  ${name}  (${Date.now() - t}ms)`); };
const S1 = STAGES[0];

test('100 stages, five tiers covering 1-100', () => {
  assert.equal(STAGES.length, 100);
  assert.deepEqual(TIERS.map(t => [t.from, t.to]), [[1, 20], [21, 45], [46, 70], [71, 90], [91, 100]]);
  STAGES.forEach((s, i) => assert.equal(s.tier, TIERS.findIndex(t => i + 1 >= t.from && i + 1 <= t.to)));
});

test('every puzzle matches its solution, which is a valid sudoku', () => {
  for (const [k, s] of STAGES.entries()) {
    assert.match(s.p, /^[0-9]{81}$/); assert.match(s.s, /^[1-9]{81}$/);
    for (let i = 0; i < 81; i++) if (s.p[i] !== '0') assert.equal(s.p[i], s.s[i], `stage ${k + 1} cell ${i}`);
    const g = parseGrid(s.s);
    for (let i = 0; i < 81; i++) for (const p of PEERS[i]) assert.notEqual(g[i], g[p], `stage ${k + 1}`);
    assert.equal(s.givens, parseGrid(s.p).filter(v => v).length);
  }
});

test('every puzzle has exactly one solution (counted up to 2)', () => {
  for (const [k, s] of STAGES.entries()) {
    assert.equal(countSolutions(s.p, 2), 1, `stage ${k + 1}`);
    assert.equal(solveGrid(s.p).join(''), s.s);
  }
});

test('grader solves every puzzle with logic and reproduces the stored level/score', () => {
  for (const [k, s] of STAGES.entries()) {
    const g = grade(s.p);
    assert.ok(g.solved, `stage ${k + 1}`);
    assert.equal(g.grid.join(''), s.s);
    assert.equal(g.level, s.level, `stage ${k + 1} level`);
    assert.equal(g.score, s.score, `stage ${k + 1} score`);
  }
});

test('difficulty never goes down: level non-decreasing, tiers use the planned techniques', () => {
  for (let i = 1; i < 100; i++) assert.ok(STAGES[i].level >= STAGES[i - 1].level, `stage ${i + 1}`);
  const allowed = [[1], [1, 2], [2, 3], [3, 4], [5]];
  const tierOf = t => STAGES.filter(s => s.tier === t);
  for (let t = 0; t < 5; t++) for (const s of tierOf(t)) assert.ok(allowed[t].includes(s.level));
  for (let t = 1; t < 5; t++) assert.ok(Math.min(...tierOf(t).map(s => s.level)) >= Math.max(...tierOf(t - 1).map(s => s.level)) - 1);
  for (let t = 1; t < 5; t++) {
    const avg = arr => arr.reduce((a, s) => a + s.score, 0) / arr.length;
    assert.ok(avg(tierOf(t)) > avg(tierOf(t - 1)), 'average score rises by tier');
    assert.ok(Math.max(...tierOf(t).map(s => s.givens)) <= Math.max(...tierOf(t - 1).map(s => s.givens)));
  }
  assert.ok(tierOf(0).every(s => s.givens >= 37));
  assert.ok(tierOf(4).every(s => s.givens <= 27));
  // within a tier: by level, then by score
  for (let i = 1; i < 100; i++) if (STAGES[i].tier === STAGES[i - 1].tier && STAGES[i].level === STAGES[i - 1].level)
    assert.ok(STAGES[i].score >= STAGES[i - 1].score, `score order at ${i + 1}`);
});

test('grader recognises techniques on known puzzles', () => {
  const g = grade(STAGES[99].p);
  assert.equal(g.level, 5);
  assert.ok(g.counts.xWing || g.counts.xyWing || g.counts.swordfish);
  assert.equal(grade(STAGES[0].p).level, 1);
  // an empty grid has many solutions; a broken one has none
  assert.equal(countSolutions('0'.repeat(81), 2), 2);
  assert.equal(countSolutions('11' + '0'.repeat(79), 2), 0);
});

test('placing a correct digit removes that note from the row, column and box only', () => {
  const g = newGame(S1.p, S1.s);
  const i = g.vals.findIndex(v => !v), d = g.sol[i];
  const peers = PEERS[i].filter(p => !g.vals[p]);
  const other = g.vals.findIndex((v, j) => !v && j !== i && ROW(j) !== ROW(i) && COL(j) !== COL(i) && BOX(j) !== BOX(i));
  for (const p of [...peers, other]) assert.ok(toggleNote(g, p, d));
  assert.ok(toggleNote(g, i, d === 1 ? 2 : 1));
  const r = place(g, i, d);
  assert.ok(r.changed && !r.wrong);
  for (const p of peers) assert.ok(!hasNote(g, p, d), 'peer note removed');
  assert.ok(hasNote(g, other, d), 'non-peer note kept');
  assert.equal(g.notes[i], 0, 'own notes cleared');
  assert.deepEqual(r.removed.sort((a, b) => a - b), peers.sort((a, b) => a - b));
});

test('wrong digits count as mistakes; the third one fails the stage', () => {
  const g = newGame(S1.p, S1.s);
  const empt = g.vals.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  const wrongOf = i => (g.sol[i] % 9) + 1;
  let r = place(g, empt[0], wrongOf(empt[0]));
  assert.ok(r.wrong); assert.equal(g.mistakes, 1); assert.ok(!g.failed);
  assert.equal(place(g, empt[0], wrongOf(empt[0])).changed, false, 'same digit again is ignored');
  r = place(g, empt[0], g.sol[empt[0]]);
  assert.ok(!r.wrong, 'a wrong digit can be overwritten');
  assert.equal(place(g, empt[0], wrongOf(empt[0])).changed, false, 'a correct digit is locked');
  place(g, empt[1], wrongOf(empt[1])); place(g, empt[2], wrongOf(empt[2]));
  assert.equal(g.mistakes, 3); assert.ok(g.failed);
  assert.equal(place(g, empt[3], g.sol[empt[3]]).changed, false, 'no input after failing');
});

test('givens cannot be changed; erase clears player digits and notes', () => {
  const g = newGame(S1.p, S1.s);
  const gi = g.given.indexOf(true);
  assert.equal(place(g, gi, 5).changed, false); assert.equal(erase(g, gi), false); assert.equal(toggleNote(g, gi, 3), false);
  const i = g.vals.findIndex(v => !v);
  toggleNote(g, i, 4); assert.ok(erase(g, i)); assert.equal(g.notes[i], 0);
  place(g, i, (g.sol[i] % 9) + 1); assert.ok(erase(g, i)); assert.equal(g.vals[i], 0);
  assert.equal(erase(g, i), false, 'nothing to erase');
});

test('undo restores digits and notes but never the mistake count', () => {
  const g = newGame(S1.p, S1.s);
  const i = g.vals.findIndex(v => !v);
  toggleNote(g, i, 3); toggleNote(g, i, 7);
  place(g, i, (g.sol[i] % 9) + 1);
  assert.ok(undo(g)); assert.equal(g.vals[i], 0); assert.ok(hasNote(g, i, 3) && hasNote(g, i, 7));
  assert.equal(g.mistakes, 1);
  assert.ok(undo(g)); assert.ok(undo(g)); assert.equal(g.notes[i], 0);
  assert.equal(undo(g), false);
});

test('hint fills a logical cell with a reason, limited to 3, and survives undo', () => {
  const g = newGame(S1.p, S1.s);
  const sel = g.vals.findIndex(v => !v);
  const h = useHint(g, sel);
  assert.ok(h && g.vals[h.idx] === g.sol[h.idx]);
  assert.match(h.reason, /뿐이에요|정답/);
  place(g, g.vals.findIndex(v => !v), 0); // ignored
  const j = g.vals.findIndex(v => !v); place(g, j, g.sol[j]);
  undo(g); assert.equal(g.vals[h.idx], g.sol[h.idx], 'hinted cell stays');
  useHint(g); useHint(g);
  assert.equal(g.hints, MAX_HINTS); assert.equal(useHint(g), null);
  // naked single wording
  const hs = findHint(parseGrid(S1.s).map((v, k) => (k === 40 ? 0 : v)), parseGrid(S1.s), 40);
  assert.equal(hs.idx, 40); assert.ok(hs.reason.includes(`${S1.s[40]}`));
  // a wrong entry under the cursor is fixed first
  const g2 = newGame(S1.p, S1.s); const k = g2.vals.findIndex(v => !v); place(g2, k, (g2.sol[k] % 9) + 1);
  const h2 = useHint(g2, k); assert.equal(h2.idx, k); assert.equal(g2.vals[k], g2.sol[k]);
});

test('hints alone can finish every tier (logic always finds a next cell)', () => {
  for (const s of [STAGES[0], STAGES[30], STAGES[60], STAGES[85], STAGES[99]]) {
    const vals = parseGrid(s.p), sol = parseGrid(s.s);
    let guard = 0;
    while (vals.some(v => !v) && guard++ < 81) { const h = findHint(vals, sol); assert.notEqual(h.tech, 'answer'); vals[h.idx] = h.digit; }
    assert.equal(vals.join(''), s.s);
  }
});

test('solving stage 1 completes units, digits and wins', () => {
  const g = newGame(S1.p, S1.s);
  let units = 0, last;
  for (let i = 0; i < 81; i++) if (!g.vals[i]) { last = place(g, i, g.sol[i]); units += last.units.length; }
  assert.ok(last.won && g.won); assert.ok(units >= 1);
  for (let d = 1; d <= 9; d++) assert.equal(digitCount(g, d), 9);
  assert.equal(completedUnitsAt(g, 0).length, 3);
});

test('candidates ignore wrong entries', () => {
  const g = newGame(S1.p, S1.s);
  const i = g.vals.findIndex(v => !v);
  const before = candidatesAt(g, i);
  assert.ok(before.includes(g.sol[i]));
  const p = PEERS[i].find(q => !g.vals[q]);
  place(g, p, (g.sol[p] % 9) + 1);
  assert.deepEqual(candidatesAt(g, i), before);
});

test('stars: 3 clean, 2 with one mistake or hint, 1 otherwise; time format', () => {
  assert.equal(starsFor(0, 0), 3);
  assert.equal(starsFor(1, 0), 2); assert.equal(starsFor(0, 1), 2);
  assert.equal(starsFor(1, 1), 1); assert.equal(starsFor(2, 0), 1); assert.equal(starsFor(0, 3), 1);
  assert.equal(fmtTime(65), '1:05'); assert.equal(fmtTime(3725), '1:02:05');
});

test('tutorial script: every step accepts its intended action and finishes', () => {
  const sol = Array.from(TUT_SOLUTION, Number), steps = tutorialSteps(sol);
  const g = newGame(TUT_PUZZLE, TUT_SOLUTION);
  assert.equal(g.vals.filter(v => !v).length, 8);
  const ctx = { memo: false };
  const run = (k, act, apply) => {
    const st = steps[k];
    assert.equal(st.allow(act), true, `step ${k + 1} accepts`);
    apply();
    if (st.done) assert.ok(st.done(g, ctx), `step ${k + 1} done`);
  };
  assert.notEqual(steps[0].allow({ type: 'memo' }), true);
  run(1, { type: 'input', i: TUT.A, d: sol[TUT.A], memo: false }, () => place(g, TUT.A, sol[TUT.A]));
  assert.notEqual(steps[2].allow({ type: 'input', i: TUT.B, d: sol[TUT.B], memo: false }), true);
  run(2, { type: 'input', i: TUT.B, d: TUT.W, memo: false }, () => assert.ok(place(g, TUT.B, TUT.W).wrong));
  run(3, { type: 'erase', i: TUT.B }, () => erase(g, TUT.B));
  run(4, { type: 'memo' }, () => { ctx.memo = true; });
  const k = sol[TUT.D];
  run(5, { type: 'input', i: TUT.C, d: k, memo: true }, () => toggleNote(g, TUT.C, k));
  assert.notEqual(steps[6].allow({ type: 'input', i: TUT.D, d: k, memo: true }), true, 'memo must be off');
  ctx.memo = false;
  run(6, { type: 'input', i: TUT.D, d: k, memo: false }, () => place(g, TUT.D, k));
  assert.ok(!hasNote(g, TUT.C, k), 'note auto-removed in the tutorial');
  run(7, { type: 'hint', i: TUT.X }, () => assert.equal(useHint(g, TUT.X).idx, TUT.X));
  run(8, { type: 'undo' }, () => undo(g));
  assert.equal(candidatesAt(g, TUT.F).length, 1, 'F is a naked single');
  assert.notEqual(steps[9].allow({ type: 'input', i: TUT.F, d: (sol[TUT.F] % 9) + 1, memo: false }), true);
  run(9, { type: 'input', i: TUT.F, d: sol[TUT.F], memo: false }, () => place(g, TUT.F, sol[TUT.F]));
  const G = sol[TUT.H1];
  assert.ok(candidatesAt(g, TUT.H1).length > 1, 'H1 needs the row view');
  const rowBlanks = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(c => ROW(TUT.H1) * 9 + c).filter(i => !g.vals[i]);
  assert.deepEqual(rowBlanks.filter(i => candidatesAt(g, i).includes(G)), [TUT.H1], 'only one place for G in the row');
  run(10, { type: 'input', i: TUT.H1, d: G, memo: false }, () => place(g, TUT.H1, G));
  assert.equal(g.mistakes, 1); assert.ok(!g.failed);
});

console.log(`\n${n} tests passed`);
