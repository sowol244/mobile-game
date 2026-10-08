// Rule checks and stage solvability for 룩스 앤 움브라. Run: node lux-umbra/game.test.mjs
import assert from 'node:assert/strict';
import { LEVELS, CHAPTERS } from './levels.js';
import { SOLUTIONS } from './solutions.js';
import { createGame, step, isSolid, tileLight, starsFor, castRay } from './game.js';
import { driver } from './bot.js';
import { STEP, COL } from './config.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const run = (s, inp, sec) => { for (let k = 0; k < Math.round(sec / STEP); k++) step(s, typeof inp === 'function' ? inp(s) : inp, STEP); };
const at = (s, x, y) => s.tiles[y * s.w + x];
// tiny custom level helper: rows + extra fields
const mk = (rows, extra = {}) => createGame({ id: 't', rows, ...extra });

// ---------- data ----------
test('12 stages in 4 chapters, ids unique', () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(CHAPTERS.length, 4);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, 12);
  for (let c = 0; c < 4; c++) assert.equal(LEVELS.filter(l => l.ch === c).length, 3);
});

test('every stage is rectangular, has one start, a door, a shard and only known tiles', () => {
  for (const L of LEVELS) {
    const w = L.rows[0].length;
    L.rows.forEach((r, y) => assert.equal(r.length, w, `${L.id} row ${y}`));
    const all = L.rows.join('');
    assert.equal(all.split('P').length - 1, 1, `${L.id} start`);
    assert.ok(/[DH]/.test(all), `${L.id} door`);
    assert.equal(all.split('o').length - 1, 1, `${L.id} shard`);
    assert.match(all, /^[#.LSRBrb^vDH=%?CPKMo1-9]+$/, `${L.id} tiles`);
    assert.equal(all.split('?').length - 1, (L.signs || []).length, `${L.id} signs`);
    assert.equal(all.split('=').length - 1, (L.levers || []).length, `${L.id} levers`);
    assert.equal(all.split('%').length - 1, (L.lenses || []).length, `${L.id} lenses`);
    for (const d of all.match(/[1-9]/g) || []) assert.ok(L.lamps && L.lamps[d], `${L.id} lamp ${d}`);
    assert.ok(L.par > 0 && L.name && SOLUTIONS[L.id], `${L.id} par/name/solution`);
    // closed on the sides and top so nobody walks off the map
    assert.ok(L.rows.every(r => r[0] === '#'), `${L.id} left wall`);
    assert.ok(/^#+$/.test(L.rows[0]), `${L.id} ceiling`);
  }
});

// ---------- light rules ----------
test('light blocks are solid only while lit; shadow blocks the other way round', () => {
  const s = mk(['#######', '#.....#', '#P.L.S#', '#######']);
  assert.equal(isSolid(s, 3, 2), false); // dark: light block is a ghost
  assert.equal(isSolid(s, 5, 2), true);  // dark: shadow block is a wall
  run(s, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(s, 3, 2), true);
  assert.equal(isSolid(s, 5, 2), false);
  run(s, { lightSet: false }, 0.05);
  assert.equal(isSolid(s, 3, 2), false);
  assert.equal(isSolid(s, 5, 2), true);
});

test('the torch cone only reaches where it is aimed (and the halo around you)', () => {
  const s = mk(['############', '#..........#', '#..........#', '#P......L..#', '#..........#', '#..........#', '#......L...#', '############']);
  run(s, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(s, 8, 3), true, 'straight ahead');
  assert.equal(isSolid(s, 7, 6), false, 'below the cone');
  run(s, { aim: Math.atan2(3, 6) }, 0.05);
  assert.equal(isSolid(s, 7, 6), true, 'aimed down at it');
});

test('rock and crates stop light; a crate casts a shadow', () => {
  const s = mk(['##########', '#.......P#', '#1.K..SS.#', '##########'], { lamps: { 1: { kind: 'beam', dir: 0, spread: 10, range: 12 } } });
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 6, 2), true, 'in the crate shadow the shadow block stands');
  s.crates[0].y = 1; // lift the crate out of the beam row
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 6, 2), false);
});

test('coloured blocks need their colour; glass tints light', () => {
  const s = mk(['###########', '#.........#', '#1.r.R.B..#', '#P........#', '###########'], { lamps: { 1: { kind: 'beam', dir: 0, spread: 8, range: 12 } } });
  run(s, {}, 0.02);
  assert.equal(tileLight(s, 5, 2), COL.r);
  assert.equal(isSolid(s, 5, 2), true, 'red block lit red');
  assert.equal(isSolid(s, 7, 2), false, 'blue block ignores red');
  const t = mk(['###########', '#1.r.b.R..#', '#P........#', '###########'], { lamps: { 1: { kind: 'beam', dir: 0, spread: 8, range: 12 } } });
  run(t, {}, 0.02);
  assert.equal(tileLight(t, 7, 1), 0, 'red then blue glass: nothing gets through');
  const segs = castRay(t, 1.5, 1.5, 0, 8, COL.w);
  assert.deepEqual(segs.map(g => g.col), [COL.w, COL.r]);
});

test('a lens stand recolours the torch', () => {
  const s = mk(['#########', '#.......#', '#P%..R..#', '#########'], { lenses: ['r'] });
  run(s, { mx: 1 }, 0.25);
  assert.equal(s.fl.col, COL.r);
  run(s, { lightSet: true, aim: 0, mx: 0 }, 0.05);
  assert.equal(isSolid(s, 5, 2), true);
});

test('a block never materialises inside a body; it waits until the body leaves', () => {
  const s = mk(['#######', '#.....#', '#..P..#', '#.LLL.#', '#.....#', '#######']);
  s.p.y = 3.0; // standing inside the light blocks
  run(s, { lightSet: true, aim: Math.PI / 2 }, 0.02);
  assert.equal(isSolid(s, 3, 3), false);
  assert.equal(isSolid(s, 2, 3), true, "the neighbour materialises");
});

test('levers toggle room lights; zones light without shadows', () => {
  const s = mk(['##########', '#........#', '#P=..L...#', '##########'], { zones: [{ x: 1, y: 1, w: 8, h: 2, g: 'a', on: false }], levers: ['a'] });
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 5, 2), false);
  run(s, { mx: 1 }, 0.2);
  assert.equal(s.groups.a, true);
  assert.equal(isSolid(s, 5, 2), true);
});

test('hidden doors are rock until light touches them, then they open', () => {
  const s = mk(['#######', '#.....#', '#P...H#', '#######']);
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 5, 2), true);
  run(s, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(s, 5, 2), false);
  run(s, { mx: 1 }, 2);
  assert.equal(s.cleared, true);
});

test('statues: frozen in the dark (and solid to stand on), awake in light, deadly when awake', () => {
  const s = mk(['############', '#..........#', '#..........#', '#P.....M...#', '############']);
  run(s, {}, 0.05);
  assert.equal(s.statues[0].awake, false);
  const x0 = s.statues[0].x;
  run(s, { lightSet: true, aim: 0 }, 0.6);
  assert.equal(s.statues[0].awake, true);
  assert.ok(s.statues[0].x < x0 - 0.5, 'walks toward the player');
  run(s, {}, 4);
  assert.ok(s.deaths >= 1, 'touching an awake statue kills');
  // frozen statue as a platform
  const t = mk(['########', '#......#', '#......#', '#.P.M..#', '########']);
  run(t, { mx: 1, jump: true, jumpPress: true }, 0.02);
  run(t, { mx: 1, jump: true }, 0.25);
  run(t, { mx: 0.3 }, 0.6);
  assert.ok(t.p.onGround && t.p.y + t.p.h < 3.6, 'standing on the statue head');
});

test('spikes kill; respawn goes back to the last checkpoint with the world as it was', () => {
  const s = mk(['##########', '#........#', '#P.C..K..#', '####^^####', '##########']);
  run(s, { mx: 1 }, 0.5);
  assert.ok(s.checks[0].on);
  const cx = s.crates[0].x;
  run(s, { mx: 1 }, 1.5);
  assert.ok(s.deaths >= 1);
  run(s, {}, 1);
  assert.equal(s.p.dead, 0);
  assert.ok(Math.abs(s.p.x + s.p.w / 2 - 3.5) < 0.05, 'back at the checkpoint');
  assert.equal(s.crates[0].x, cx);
});

test('a crate pushed onto spikes comes back to where it started', () => {
  const s = mk(['##########', '#........#', '#.PK.....#', '####.#####', '####^#####', '##########']);
  const hx = s.crates[0].x;
  run(s, { mx: 1 }, 0.6);
  run(s, {}, 1);
  assert.ok(Math.abs(s.crates[0].x - hx) < 1e-9 && s.crates[0].y === 2);
});

test('stars: clear, shard, par time', () => {
  const s = createGame(LEVELS[0]);
  s.t = 10; s.shard.got = true;
  assert.deepEqual(starsFor(s), [true, true, true]);
  s.t = 999; s.shard.got = false;
  assert.deepEqual(starsFor(s), [true, false, false]);
});

test('1-1 cannot be crossed without the torch', () => {
  const s = createGame(LEVELS[0]);
  run(s, { mx: 1 }, 2.5);
  assert.ok(s.deaths >= 1);
});

test('2-2 cannot be crossed while the crate stays near the lamp', () => {
  const s = createGame(LEVELS[4]);
  // hop over the crate and try to walk across without pushing it
  const next = driver(s, function* (b) { yield* b.go(4.3); yield* b.jump(5.5); yield* b.go(7); for (let i = 0; i < 6; i++) yield* b.jump(14); });
  try { for (let k = 0; k < 8 / STEP && !s.cleared; k++) step(s, next(), STEP); } catch { /* bot gives up */ }
  assert.equal(s.cleared, false);
});

// ---------- every stage is solvable ----------
for (const L of LEVELS) {
  test(`stage ${L.id} ${L.name}: scripted solution clears it, no deaths, shard taken`, () => {
    const s = createGame(L);
    const next = driver(s, SOLUTIONS[L.id]);
    for (let k = 0; k < 120 / STEP && !s.cleared; k++) step(s, next(), STEP);
    assert.equal(s.cleared, true, `${L.id} not cleared`);
    assert.equal(s.deaths, 0, `${L.id} deaths`);
    assert.equal(s.shard.got, true, `${L.id} shard`);
    assert.ok(s.t <= L.par, `${L.id} bot time ${s.t.toFixed(1)} > par ${L.par}`);
  });
}

console.log(`\n${n} tests passed`);
