// BETA tests. Run with: node one-move/beta.test.mjs   (the normal game's tests are logic.test.mjs)
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import './beta-rules.js';
import { parseStage, applyMove, solve, isWin, legalMoves, starsFor, starCut, tokenOf, ext } from './logic.js';
import { BETA_STAGES, BETA_CHAPTERS } from './beta-stages.js';
import { check, derive, sameHex, ITER, SALT_HEX, HASH_HEX } from './beta-gate.js';

let n = 0;
const test = (name, fn) => {
  const t = Date.now();
  const r = fn();
  const done = () => { n++; console.log(`ok  ${name}  (${Date.now() - t}ms)`); };
  return r && r.then ? r.then(done) : done();
};
const U = 0, R = 1, D = 2, L = 3;
const CH = { chain: true };
const S = (rows, opts = CH, extra = {}) => parseStage({ rows, target: 64, limit: 99, opts, ...extra });
const row = (s, r = 0) => Array.from(s.codes.slice(r * s.n, r * s.n + s.n), tokenOf).join(' ');
const mv = (s, r, c, d) => applyMove(s, r * s.n + c, d);

/* ---------- chain merge ---------- */
test('the hooks are installed by importing beta-rules.js', () => {
  assert.equal(typeof ext.chain, 'function'); assert.equal(typeof ext.win, 'function');
});

test('chain: the merged tile absorbs an equal neighbour for free', () => {
  const s = S(['2 2 4 .', '. . . .', '. . . .', '. . . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(row(r.state), '. 8 . .');
  assert.equal(r.state.moves, 1, 'the chain costs no move');
  assert.equal(r.ev.chain.length, 1);
  assert.equal(r.ev.chain[0].cell, 2); assert.equal(r.ev.chain[0].exp, 3);
  assert.equal(r.ev.chain[0].id, s.ids[2], 'the absorbed tile id is reported');
  assert.equal(r.state.ids[2], 0); assert.equal(r.state.ids[1], s.ids[1], 'the tile that was merged into survives');
});

test('chain: it keeps going while the new value has an equal neighbour', () => {
  const s = S(['2 2 4 .', '. 8 . .', '. . . .', '. . . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(row(r.state), '. 16 . .'); assert.equal(row(r.state, 1), '. . . .');
  assert.deepEqual(r.ev.chain.map(c => c.exp), [3, 4]);
  assert.deepEqual(r.ev.chain.map(c => c.cell), [2, 5]);
  const t = S(['2 2 4 .', '. . 8 .', '. . . .', '. . . .']);
  assert.equal(row(mv(t, 0, 0, R).state, 0), '. 8 . .', 'only neighbours of the merged tile count (8 is diagonal)');
});

test('chain: without the flag the same move does not chain (normal rules untouched)', () => {
  const s = S(['2 2 4 .', '. . . .', '. . . .', '. . . .'], null);
  const r = mv(s, 0, 0, R);
  assert.equal(row(r.state), '. 4 4 .'); assert.equal(r.ev.chain, undefined);
  assert.equal(parseStage({ rows: ['2 .', '. .'], target: 4, limit: 3 }).opts, null);
});

test('chain: neighbours are checked up, right, down, left; one at a time', () => {
  const s = S(['. 4 .', '2 2 4', '. . .']);
  const r = mv(s, 1, 0, R);
  assert.equal(row(r.state, 0), '. . .'); assert.equal(row(r.state, 1), '. 8 4', 'the upper 4 went first, 8 no longer matches the right 4');
  assert.equal(r.ev.chain.length, 1); assert.equal(r.ev.chain[0].cell, 1);
});

test('chain: pinned neighbours are not absorbed, but a pinned tile absorbs', () => {
  const a = mv(S(['2 2 4p .', '. . . .', '. . . .', '. . . .']), 0, 0, R);
  assert.equal(row(a.state), '. 4 4p .'); assert.equal(a.ev.chain, undefined);
  const b = mv(S(['2 2p 4 .', '. . . .', '. . . .', '. . . .']), 0, 0, R);
  assert.equal(row(b.state), '. 8p . .', 'the merged tile stays pinned and absorbs the 4');
  const c = mv(S(['2 2 4o .', '. . . .', '. . . .', '. . . .']), 0, 0, R);
  assert.equal(row(c.state), '. 8 . .', 'a once-tile can be absorbed');
});

test('chain: gates open at every step of the chain', () => {
  const s = S(['2 2 4 g8', '. . . .', '. . . .', '. . . .']);
  const r = mv(s, 0, 0, R);
  assert.equal(row(r.state), '. 8 . .', 'the g8 gate vanished');
  assert.deepEqual(r.ev.chain[0].opened, [3]); assert.deepEqual(r.ev.removed, [s.ids[3]]);
  assert.ok(r.ev.opened.includes(3));
});

test('chain: only a merge starts one, not a plain move next to an equal tile', () => {
  const r = mv(S(['2 . 2 .', '. . . .', '. . . .', '. . . .']), 0, 0, R);
  assert.equal(row(r.state), '. 2 2 .'); assert.equal(r.ev.chain, undefined);
});

test('chain: the marked tile never merges', () => {
  const r = mv(S(['2 2 k .', '. . . .', '. . . .', '. . . .']), 0, 0, R);
  assert.equal(row(r.state), '. 4 k .');
  assert.equal(tokenOf(r.state.codes[2]), 'k');
});

/* ---------- goals ---------- */
const G = (rows, goal) => S(rows, { chain: true, goal });

test('goal one: exactly one number tile left (walls and gates do not count)', () => {
  const g = { kind: 'one' };
  assert.ok(!isWin(G(['2 4 .', '. . .', '. . .'], g)));
  assert.ok(isWin(G(['. 4 #', '. . g8', '. . .'], g)));
  assert.ok(!isWin(G(['. 4p .', '. 2 .', '. . .'], g)), 'a pinned tile counts too');
  assert.ok(mv(G(['2 2 . .', '. . . .', '. . . .', '. . . .'], g), 0, 0, R).ev.win);
  const c = mv(G(['2 2 4 .', '. . . .', '. . . .', '. . . .'], g), 0, 0, R);
  assert.ok(c.ev.win && c.ev.chain.length === 1, 'the chain finishes the job in one move');
});

test('goal exit: the marked tile on the exit cell', () => {
  const g = { kind: 'exit', cell: [1, 2] };
  const s = G(['. . .', 'k . .', '. . .'], g);
  assert.ok(!isWin(s));
  const a = mv(s, 1, 0, R); assert.ok(!a.ev.win);
  assert.ok(mv(a.state, 1, 1, R).ev.win);
  assert.ok(!isWin(G(['. . .', '. . 2', '. . k'], g)), 'a number tile on the exit does not count');
  assert.ok(isWin(G(['. . .', '. . k', '. . 2'], g)));
});

test('goal count: N tiles of value X at the same time (pinned ones count)', () => {
  const g = { kind: 'count', value: 4, n: 3 };
  assert.ok(!isWin(G(['4 . 4', '. 8 .', '. . .'], g)));
  assert.ok(isWin(G(['4 . 4', '. 8 .', '4 . .'], g)));
  assert.ok(isWin(G(['4p . 4', '. 8 .', '4o . .'], g)));
  assert.ok(isWin(G(['4 . 4', '. 4 .', '4 . .'], g)), 'more than N is fine');
  const s = G(['4 4 . .', '. . . 8', '. . . .', '8 . . .'], { kind: 'count', value: 8, n: 3 });
  assert.ok(!isWin(s));
  assert.ok(mv(s, 0, 0, R).ev.win, 'merging 4+4 makes the third 8');
});

test('goal line: every number tile in the marked row or column', () => {
  const row0 = { kind: 'line', axis: 'row', index: 0 }, col2 = { kind: 'line', axis: 'col', index: 2 };
  assert.ok(isWin(G(['2 4 8', '. . .', '. . .'], row0)));
  assert.ok(!isWin(G(['2 4 .', '. . 8', '. . .'], row0)));
  assert.ok(isWin(G(['. . 2', '# . 4', '. g8 8'], col2)), 'walls and gates are ignored');
  assert.ok(!isWin(G(['. 2 .', '. . .', '. . .'], col2)));
  const s = G(['2 . .', '. 4 .', '. . .'], row0);
  assert.ok(mv(s, 1, 1, U).ev.win);
});

test('goal check only applies with opts.goal; otherwise the normal target rule is used', () => {
  const s = S(['8 8 .', '. . .', '. . .'], CH, { target: 16 });
  assert.ok(!isWin(s)); assert.ok(mv(s, 0, 0, R).ev.win);
});

/* ---------- beta stages ---------- */
test('stage list shape: 24 stages, 4 chapters, one goal kind each, intro on the first of each chapter', () => {
  assert.equal(BETA_STAGES.length, 24); assert.equal(BETA_CHAPTERS.length, 4);
  assert.equal(new Set(BETA_STAGES.map(s => s.id)).size, 24);
  const kinds = ['one', 'exit', 'count', 'line'];
  for (const ch of BETA_CHAPTERS) {
    const list = BETA_STAGES.filter(s => s.ch === ch.id);
    assert.equal(list.length, 6, `chapter ${ch.id}`);
    assert.ok(list.every(s => s.opts.goal.kind === kinds[ch.id - 1]));
    assert.deepEqual(list.map(s => !!s.intro), [true, false, false, false, false, false]);
    assert.ok(ch.name && ch.title && ch.intro.length === 2);
  }
  assert.ok(BETA_STAGES.every(s => s.opts.chain === true), 'chain merging is on everywhere');
  assert.ok(BETA_STAGES.every(s => s.id.startsWith('B')), 'beta ids never clash with normal ones');
});

let usedChain = {};
for (const def of BETA_STAGES) {
  test(`beta stage ${def.id}: optimal ${def.opt} / limit ${def.limit}`, () => {
    const s = parseStage(def);
    assert.ok(!isWin(s), 'not already solved');
    const r = solve(s, { maxDepth: def.limit });
    assert.ok(r && !r.aborted, 'solvable within its move limit');
    assert.equal(r.depth, def.opt, 'stored optimum matches the solver');
    assert.ok(def.limit >= def.opt && def.limit - def.opt <= 5);
    assert.ok(r.states < 500000, 'small enough for the in-page hint');
    assert.equal(def.sol.length, def.opt);
    let cur = s, chains = 0;
    for (const [i, d] of def.sol) { const m = applyMove(cur, i, d); assert.ok(m, 'stored line is legal'); if (m.ev.chain) chains++; cur = m.state; }
    assert.ok(isWin(cur), 'the stored line wins in opt moves');
    (usedChain[def.ch] = usedChain[def.ch] || []).push(chains > 0);
    assert.ok(legalMoves(s).length > 0);
    const c = starCut(def.opt, def.limit);
    assert.equal(starsFor(def.opt, def.opt, def.limit), 3); assert.ok(starsFor(def.limit, def.opt, def.limit) >= 1); assert.equal(starsFor(def.limit + 1, def.opt, def.limit), 0);
    assert.equal(starsFor(def.opt, def.opt, def.limit, true), 2); assert.ok(c.three <= def.limit || def.limit === def.opt);
    const g = def.opts.goal, cells = def.rows.join(' ').split(' ');
    if (g.kind === 'exit') {
      assert.equal(cells.filter(t => t === 'k').length, 1, 'exactly one marked tile');
      assert.equal(cells[g.cell[0] * s.n + g.cell[1]], '.', 'the exit starts empty');
    } else assert.ok(!cells.includes('k'));
  });
}
test('the chain rule is used on the optimal line (every stage in chapters 1-2, a few in 3-4)', () => {
  assert.ok(usedChain[1].every(Boolean) && usedChain[2].every(Boolean));
  assert.ok(usedChain[3].filter(Boolean).length >= 2 && usedChain[4].filter(Boolean).length >= 2);
});

/* ---------- password gate (a throwaway code; the real one is never in the repo) ---------- */
const PIN = '2580', SALT = '00112233445566778899aabbccddeeff', FAST = 1000;
await test('gate: derive matches node pbkdf2 and the right code is accepted, wrong ones rejected', async () => {
  const hash = await derive(PIN, SALT, FAST);
  assert.equal(hash, pbkdf2Sync(PIN, Buffer.from(SALT, 'hex'), FAST, 32, 'sha256').toString('hex'));
  assert.equal(await check(PIN, SALT, hash, FAST), 'ok');
  for (const bad of ['2581', '0000', '2580 ', '25800', '258', '', 'abcd', '２５８０']) assert.equal(await check(bad, SALT, hash, FAST), 'bad', JSON.stringify(bad));
  assert.notEqual(await derive(PIN, '00112233445566778899aabbccddee00', FAST), hash, 'the salt matters');
});
await test('gate: unsupported when crypto.subtle is missing', async () => {
  assert.equal(await check(PIN, SALT, 'x', FAST, null), 'unsupported');
  assert.equal(await check(PIN, SALT, 'x', FAST, {}), 'unsupported');
});
test('gate: constant-time compare', () => {
  assert.ok(sameHex('abcd', 'abcd')); assert.ok(!sameHex('abcd', 'abce')); assert.ok(!sameHex('abcd', 'abc')); assert.ok(!sameHex('', 'a'));
});
test('gate: stored constants are a salted PBKDF2 hash with 100k+ iterations (no plain code stored)', () => {
  assert.ok(ITER >= 100000); assert.match(SALT_HEX, /^[0-9a-f]{32}$/); assert.match(HASH_HEX, /^[0-9a-f]{64}$/);
});

console.log(`\n${n} beta tests passed`);
