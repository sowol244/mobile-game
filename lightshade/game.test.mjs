// Rule checks and stage solvability for Lightshade. Run: node lightshade/game.test.mjs
import assert from 'node:assert/strict';
import { LEVELS, CHAPTERS } from './levels.js';
import { SOLUTIONS, MAIN_SOLUTIONS } from './solutions.js';
import { createGame, step, isSolid, tileLight, lightSources, starsFor, castRay } from './game.js';
import { driver } from './bot.js';
import { buildCode, encodeProgress, decodeProgress, importProgress, ADMIN_ALL, ADMIN_RESET, countStars, countCleared, isAdminCode } from './save-code.js';
import { STEP, COL } from './config.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const run = (s, inp, sec) => { for (let k = 0; k < Math.round(sec / STEP); k++) step(s, typeof inp === 'function' ? inp(s) : inp, STEP); };
const at = (s, x, y) => s.tiles[y * s.w + x];
// tiny custom level helper: rows + extra fields
const mk = (rows, extra = {}) => createGame({ id: 't', rows, ...extra });

// ---------- data ----------
const byName = name => LEVELS.find(L => L.name === name);

test('80 stages in 8 chapters of 10, ids and names unique', () => {
  assert.equal(CHAPTERS.length, 8);
  assert.equal(LEVELS.length, 80);
  for (let c = 0; c < 8; c++) assert.equal(LEVELS.filter(l => l.ch === c).length, 10, `chapter ${c + 1}`);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, LEVELS.length);
  assert.equal(new Set(LEVELS.map(l => l.name)).size, LEVELS.length);
});

test('only each chapter\'s first stage teaches (has signs); stages 2-10 have none', () => {
  for (const L of LEVELS) {
    const first = L.id.endsWith('-1');
    const signs = (L.signs || []).length + (L.rows.join('').split('?').length - 1);
    if (first) assert.ok(signs > 0, `${L.id} should teach`);
    else assert.equal(signs, 0, `${L.id} has a sign`);
  }
});

test('every stage is rectangular, has one start, a door, three shards and only known tiles', () => {
  for (const L of LEVELS) {
    const w = L.rows[0].length;
    L.rows.forEach((r, y) => assert.equal(r.length, w, `${L.id} row ${y}`));
    const all = L.rows.join('');
    assert.equal(all.split('P').length - 1, 1, `${L.id} start`);
    assert.ok(/[DH]/.test(all), `${L.id} door`);
    assert.equal(all.split('o').length - 1, 3, `${L.id} shards`);
    assert.match(all, /^[#.LSRBrb^vDH=%?CPKMo1-9f/\\{}xGW]+$/, `${L.id} tiles`);
    assert.equal(all.split('?').length - 1, (L.signs || []).length, `${L.id} signs`);
    assert.equal(all.split('=').length - 1, (L.levers || []).length, `${L.id} levers`);
    assert.equal(typeof L.solve, 'function', `${L.id} solve`);
    assert.equal(all.split('%').length - 1, (L.lenses || []).length, `${L.id} lenses`);
    for (const d of all.match(/[1-9]/g) || []) assert.ok(L.lamps && L.lamps[d], `${L.id} lamp ${d}`);
    assert.ok(L.name && MAIN_SOLUTIONS[L.id] && SOLUTIONS[L.id], `${L.id} name/solutions`);
    // closed on the sides and top so nobody walks off the map
    assert.ok(L.rows.every(r => r[0] === '#'), `${L.id} left wall`);
    assert.ok(/^#+$/.test(L.rows[0]), `${L.id} ceiling`);
  }
});

test('3-5 room-light fixtures sit above the shadow platforms they control', () => {
  const level = LEVELS.find(L => L.id === '3-5');
  const s = createGame(level);
  const platformZones = s.zones.filter(z => z.x === 45 && z.w === 3 && z.h === 1);
  assert.equal(platformZones.length, 3);
  for (const z of platformZones) {
    assert.equal(level.rows[z.y].slice(z.x, z.x + z.w), 'SSS');
    assert.ok(z.fixtureY + 0.96 < z.y, `fixture at ${z.fixtureY} overlaps platform at ${z.y}`);
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

test('lamp-marked color blocks cannot be bypassed with a matching torch', () => {
  const s = mk(['########', '#......#', '#P...R.#', '########'], {
    lampOnly: [[5, 2]], zones: [{ x: 5, y: 2, w: 1, h: 1, color: 'r', g: 'a', on: false }],
  });
  s.fl.col = COL.r;
  run(s, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(s, 5, 2), false, 'red torch does not replace the lever light');
  s.groups.a = true;
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 5, 2), true, 'the switched red zone activates it');
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

test('mirrors turn light 90°; a touched turning mirror flips', () => {
  // red lamp shines down onto a mirror in the floor; '/' sends it left, '\' right
  const s = mk(['############', '#...1......#', '#..........#', '#P.........#', '#RRR{RRR...#', '############'], { lamps: { 1: { kind: 'beam', dir: 90, spread: 5, range: 6, color: 'r' } }, mirrorOnly: [[2, 4]] });
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 2, 4), true, 'left side lit');
  assert.equal(isSolid(s, 6, 4), false, 'right side dark');
  run(s, { mx: 1 }, 1.2); // walk onto the mirror
  assert.equal(s.mirrors[0].state, 1);
  assert.equal(isSolid(s, 6, 4), true, 'now the right side is lit');
});

test('mirror-marked blocks ignore even a matching direct torch', () => {
  const s = mk(['########', '#......#', '#P.R...#', '########'], { mirrorOnly: [[3, 2]] });
  s.fl.col = COL.r;
  run(s, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(s, 3, 2), false);
});

test('fog stops every light except your own halo', () => {
  const s = mk(['##########', '#........#', '#P..S..L.#', '##########'], { zones: [{ x: 1, y: 1, w: 8, h: 2 }], fog: [{ x: 4, y: 2, w: 1, h: 1 }] });
  run(s, {}, 0.02);
  assert.equal(isSolid(s, 4, 2), true, 'shadow block in fog stays solid in a lit room');
  assert.equal(isSolid(s, 7, 2), true);
});

test('fog blocks beams entering and leaving it', () => {
  const entering = mk(['#########', '#P....L.#', '#########'], { fog: [{ x: 3, y: 1, w: 1, h: 1 }] });
  run(entering, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(entering, 6, 1), false, 'torch outside cannot light beyond fog');
  const leaving = mk(['#########', '#P...L..#', '#########'], { fog: [{ x: 1, y: 1, w: 4, h: 1 }] });
  run(leaving, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(leaving, 5, 1), false, 'torch inside fog cannot project beyond it');
});

test('the torch halo can reveal nearby fog platforms but never wakes fog statues', () => {
  const platform = mk(['########', '#.PL...#', '#......#', '########'], { fog: [{ x: 1, y: 0, w: 4, h: 3 }] });
  run(platform, { lightSet: true }, 0.05);
  assert.equal(isSolid(platform, 3, 1), true, 'the local halo reaches a nearby light platform');
  const statue = mk(['########', '#.PM...#', '#......#', '########'], { fog: [{ x: 2, y: 0, w: 4, h: 3 }] });
  run(statue, { lightSet: true }, 0.05);
  assert.equal(statue.statues[0].awake, false, 'the local halo does not wake a statue inside fog');
});

test('same-direction mirror rays keep their individual reflection ranges', () => {
  const s = mk(['########', '#..1...#', '#..P...#', '#......#', '#../...#', '#......#', '########'], {
    lamps: { 1: { kind: 'beam', dir: 90, spread: 5, range: 8, reflect: 5 } },
  });
  s.fl.on = true; s.fl.aim = Math.PI / 2;
  const ranges = lightSources(s).filter(src => src.mirror && src.x === 3.5 && src.y === 4.5).map(src => src.range);
  assert.ok(ranges.includes(5), 'the lamp keeps its configured reflection range');
  assert.ok(ranges.includes(16), 'the torch keeps its default reflection range');
});

test('a clock lever switches back by itself', () => {
  const s = mk(['##########', '#........#', '#P=..S...#', '##########'], { zones: [{ x: 1, y: 1, w: 8, h: 2, g: 'a', on: true }], levers: [{ g: 'a', t: 1 }] });
  run(s, { mx: 1 }, 0.3);
  assert.equal(s.groups.a, false);
  run(s, {}, 1.2);
  assert.equal(s.groups.a, true);
});

test('lamps on rails move with the clock', () => {
  const s = mk(['##########', '#1.......#', '#P.......#', '##########'], { lamps: { 1: { kind: 'radial', range: 3, move: [6, 0], period: 2 } } });
  const x0 = s.lamps[0].x;
  run(s, {}, 1);
  assert.ok(Math.abs(s.lamps[0].x - (x0 + 6)) < 0.05);
});

test('stars are the light shards taken, one to three', () => {
  const s = createGame(LEVELS[0]);
  assert.equal(s.shards.length, 3);
  assert.deepEqual(starsFor(s), [false, false, false]);
  s.shards[0].got = true; s.shards[2].got = true;
  assert.deepEqual(starsFor(s), [true, false, true]);
  s.shards.forEach(q => { q.got = true; });
  assert.deepEqual(starsFor(s), [true, true, true]);
});

test('chapter 3 and 5 shard routes are spaced across their distinct challenges', () => {
  const shardXs = id => LEVELS.find(L => L.id === id).rows.flatMap(r => [...r].flatMap((c, x) => c === 'o' ? [x] : [])).sort((a, b) => a - b);
  const chapter3 = shardXs('3-2'), chapter5 = shardXs('5-8');
  assert.ok(chapter3[1] - chapter3[0] >= 18 && chapter3[2] - chapter3[1] >= 8);
  assert.ok(chapter5[1] - chapter5[0] >= 40 && chapter5[2] - chapter5[1] >= 40);
});

test('pilot shard routes vary their height across hub, loop and maze stages', () => {
  const spread = id => {
    const ys = LEVELS.find(L => L.id === id).rows.flatMap((r, y) => [...r].flatMap(c => c === 'o' ? [y] : []));
    return Math.max(...ys) - Math.min(...ys);
  };
  for (const id of ['1-6', '2-7', '2-8', '3-4', '5-9', '6-3', '7-8', '8-1']) {
    assert.ok(spread(id) >= 3, `${id} shard heights should give the optional route a distinct shape`);
  }
});

test('a light bridge over spikes cannot be crossed without the torch', () => {
  const rows = ['###########', '#.........#', '#P........#', '##LLLLLL###', '##^^^^^^###', '###########'];
  const dark = mk(rows);
  run(dark, { mx: 1 }, 2.5);
  assert.ok(dark.deaths >= 1);
  const lit = mk(rows);
  run(lit, { lightSet: true, aim: 0.5, mx: 1 }, 2.5);
  assert.equal(lit.deaths, 0);
  assert.ok(lit.p.x > 8);
});

test('상자 그림자: near the lamp the crate shadow is a wall, at the edge a thin bridge', () => {
  const s = createGame(byName('상자 그림자'));
  const F = s.h - 4, crate = s.crates.find(c => c.hy === F - 1), x = crate.hx - 4; // room starts at the lamp
  run(s, {}, 0.02);
  assert.equal(isSolid(s, x + 18, F - 2), true, 'tall shadow blocks the corridor');
  crate.x = x + 10.02;
  run(s, {}, 0.02);
  assert.equal(isSolid(s, x + 18, F - 2), false);
  assert.equal(isSolid(s, x + 18, F - 1), true, 'thin shadow bridge');
});

// ---------- every stage is solvable: the main path takes one shard, the full route all three ----------
const play = (L, sol, opts) => {
  const s = createGame(L), next = driver(s, sol, opts);
  for (let k = 0; k < 120 / STEP && !s.cleared; k++) step(s, next(), STEP);
  return s;
};
for (const L of LEVELS) {
  test(`stage ${L.id} ${L.name}: main path clears with one shard, the full route with all three, no deaths`, () => {
    const m = play(L, MAIN_SOLUTIONS[L.id]), f = play(L, SOLUTIONS[L.id]);
    assert.ok(m.cleared && m.deaths === 0, `${L.id} main path cleared=${m.cleared} deaths=${m.deaths}`);
    assert.equal(starsFor(m).filter(Boolean).length, 1, `${L.id} main path shards`);
    assert.ok(f.cleared && f.deaths === 0, `${L.id} full route cleared=${f.cleared} deaths=${f.deaths}`);
    assert.deepEqual(starsFor(f), [true, true, true], `${L.id} full route shards`);
  });
}

// Same solutions, played the phone way: the torch is switched on once and every "off" is the held 깜빡 button.
test('all stages also clear using only the hold-to-darken 깜빡 control, main path and full route', () => {
  for (const L of LEVELS) for (const [sol, want] of [[MAIN_SOLUTIONS[L.id], 1], [SOLUTIONS[L.id], 3]]) {
    const s = play(L, sol, { blink: true });
    assert.ok(s.cleared && s.deaths === 0 && starsFor(s).filter(Boolean).length === want, `${L.id} with 깜빡 (${want} shards): cleared=${s.cleared} deaths=${s.deaths}`);
  }
});

test('false rock is walked through and stops light; a hidden light block is solid only while lit', () => {
  const s = mk(['#######', '#P....#', '#..x..#', '#######']);
  assert.equal(isSolid(s, 3, 2), false);
  assert.equal(castRay(s, 1.5, 2.5, 0, 6).length > 0 && castRay(s, 1.5, 2.5, 0, 6).at(-1).d1 < 2, true, 'false rock stops the beam like rock');
  const g = mk(['#######', '#P....#', '#.....#', '#..G..#', '#######']);
  assert.equal(g.secret[3 * 7 + 3], 1);
  assert.equal(isSolid(g, 3, 3), false);
  run(g, { lightSet: true, aim: Math.PI / 4 }, 0.1);
  assert.equal(isSolid(g, 3, 3), true);
});

test('shards 2 and 3 are behind the gimmicks: the main path never takes them and every stage has two hidden rooms', () => {
  const kinds = new Set();
  for (const L of LEVELS) {
    const gm = L.rooms.filter(r => r[0].startsWith('gm_'));
    assert.equal(gm.length, 2, `${L.id} hidden rooms`);
    gm.forEach(r => kinds.add(r[0]));
    const got = play(L, MAIN_SOLUTIONS[L.id]).shards.filter(q => q.got).length;
    assert.equal(got, 1, `${L.id} main path took ${got} shards`);
  }
  assert.ok(kinds.size >= 8, `${kinds.size} gimmick kinds`);
});

// ---------- hidden-route hazards and entrances ----------
const hidden = L => L.rooms.filter(r => r[0].startsWith('gm_'));
test('about half of the hidden rooms are guarded by spikes, a pit or a saw — shard 3 nearly always', () => {
  let rooms = 0, guarded = 0, second = 0, secondGuarded = 0;
  for (const L of LEVELS) hidden(L).forEach((r, i) => { rooms++; if (r[6]) guarded++; if (i === 1) { second++; if (r[6]) secondGuarded++; } });
  assert.ok(guarded >= rooms / 2, `${guarded} of ${rooms} hidden rooms are guarded`);
  assert.ok(secondGuarded >= second * 0.8 - 8, `${secondGuarded} of ${second} second hidden rooms are guarded`);
  assert.deepEqual([...new Set(LEVELS.flatMap(hidden).map(r => r[6]).filter(Boolean))].sort(), ['pit', 'saw', 'spikes']);
});

test('the fake-floor entrances (false-rock gap, hollow bump) open at most one stage in four', () => {
  const n = LEVELS.filter(L => hidden(L).some(r => r[0] === 'gm_fakefloor' || r[0] === 'gm_hollowbump')).length;
  assert.ok(n <= LEVELS.length / 4, `${n} stages use a fake-floor entrance`);
});

test('no stage hides both its shards behind the same kind of entrance', () => {
  for (const L of LEVELS) { const h = hidden(L); assert.equal(new Set(h.map(r => r[0])).size, h.length, `${L.id} ${h.map(r => r[0])}`); }
});

test('a saw slides on its rail and kills on touch; spikes kill too', () => {
  const s = mk(['#######', '#P....#', '#..W..#', '#######'], { saws: [{ move: [0, -1], period: 4 }] });
  assert.equal(s.saws.length, 1);
  run(s, {}, 0.5);
  assert.equal(s.deaths, 0);
  run(s, { mx: 1 }, 1);
  assert.ok(s.deaths >= 1, 'walking into the saw kills');
  const sp = mk(['#####', '#P.^#', '#####']);
  run(sp, { mx: 1 }, 1);
  assert.ok(sp.deaths >= 1);
});

// ---------- levers, crates and timers cannot be skipped ----------
const playFor = (L, sol, tweak, opts) => {
  const s = createGame(L); if (tweak) tweak(s);
  const next = driver(s, sol, opts), touched = new Set();
  try {
    for (let k = 0; k < 90 / STEP && !s.cleared; k++) {
      step(s, next(), STEP);
      for (const e of s.events) if (e.type === 'lever') touched.add(`${e.x},${e.y}`);
      s.events.length = 0;
      if (tweak && tweak.after) tweak.after(s);
    }
  } catch { /* the scripted route fell apart: it did not get through */ }
  return { s, touched, ok: s.cleared && s.deaths === 0 };
};
const withLevers = LEVELS.filter(L => L.levers && L.levers.length);
test('without any lever the main path cannot clear a stage', () => {
  for (const L of withLevers) assert.equal(playFor(L, MAIN_SOLUTIONS[L.id], s => { s.levers = []; }).ok, false, `${L.id} clears with no levers`);
});
test('every lever the main path touches is needed: take any one away and the stage cannot be cleared', () => {
  for (const L of withLevers) {
    const base = playFor(L, MAIN_SOLUTIONS[L.id]);
    assert.ok(base.ok, `${L.id} base`);
    for (const key of base.touched) {
      const r = playFor(L, MAIN_SOLUTIONS[L.id], s => { s.levers = s.levers.filter(l => `${l.x},${l.y}` !== key); });
      assert.equal(r.ok, false, `${L.id}: lever ${key} is not needed`);
    }
  }
});
test('clock levers are tight: shorten every timer by 0.35 s and neither route gets through', () => {
  const timed = LEVELS.filter(L => (L.levers || []).some(l => l.t));
  assert.ok(timed.length >= 8, `${timed.length} stages with clock levers`);
  for (const L of timed) for (const sol of [MAIN_SOLUTIONS[L.id], SOLUTIONS[L.id]]) {
    const r = playFor(L, sol, s => { for (const l of s.levers) if (l.time) l.time -= 0.35; });
    assert.equal(r.ok, false, `${L.id} still clears with the timers cut`);
  }
});
test('crates held in place (never pushed) the main path cannot clear the crate stages', () => {
  const crated = LEVELS.filter(L => L.rows.join('').includes('K'));
  assert.ok(crated.length >= 8, `${crated.length} crate stages`);
  for (const L of crated) {
    const tweak = () => {}; tweak.after = s => { for (const c of s.crates) { c.x = c.hx + (1 - c.w) / 2; c.y = c.hy; c.vx = c.vy = 0; } };
    assert.equal(playFor(L, MAIN_SOLUTIONS[L.id], tweak).ok, false, `${L.id} clears without moving a crate`);
  }
});

// ---------- 기록 코드 ----------
let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const randEntries = n => Array.from({ length: n }, () => (rnd() < 0.6 ? { s: [rnd() < 0.5, rnd() < 0.5, rnd() < 0.5] } : null));
const compact = c => c.replace(/-/g, '');
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

test('save code: random progress states survive a round trip, and a state always gives the same code', () => {
  for (let k = 0; k < 300; k++) {
    const e = randEntries(1 + Math.floor(rnd() * 80)), code = encodeProgress(e), r = decodeProgress(code, 80);
    assert.ok(r.ok, code);
    assert.deepEqual(r.entries, e);
    assert.equal(encodeProgress(e), code);
  }
  const code = encodeProgress(randEntries(80));
  assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-)+[0-9A-HJKMNP-TV-Z]{1,4}$/);
  assert.ok(compact(code).length >= 70 && compact(code).length <= 78, `${compact(code).length} characters`);
});

test('save code: changing any single character is rejected', () => {
  for (let k = 0; k < 4; k++) {
    const code = compact(encodeProgress(randEntries(80)));
    for (let i = 0; i < code.length; i++) for (const ch of ALPHA) {
      if (ch === code[i]) continue;
      assert.equal(decodeProgress(code.slice(0, i) + ch + code.slice(i + 1), 80).ok, false, `position ${i} -> ${ch}`);
    }
  }
});

test('save code: lowercase, confusable letters, hyphens and spaces all read the same', () => {
  const e = randEntries(80), code = encodeProgress(e), ref = decodeProgress(code, 80);
  const messy = code.toLowerCase().replace(/1/g, 'l').replace(/0/g, 'o').replace(/-/g, ' \n');
  assert.deepEqual(decodeProgress(messy, 80), ref);
  assert.deepEqual(decodeProgress(code.replace(/1/g, 'I').replace(/-/g, '--'), 80), ref);
  assert.equal(decodeProgress('', 80).ok, false);
  assert.equal(decodeProgress('hello world!', 80).error, 'format');
});

test('save code: different states share no prefix', () => {
  const heads = new Set();
  for (let k = 0; k < 200; k++) heads.add(encodeProgress(randEntries(80)).slice(0, 9));
  assert.equal(heads.size, 200);
  assert.notEqual(encodeProgress(Array(80).fill(null)).slice(0, 4), encodeProgress([{ s: [true, false, false] }, ...Array(79).fill(null)]).slice(0, 4));
});

test('save code: a code with fewer stages loads with the rest unset; one with more stages is rejected; a wrong marker too', () => {
  const small = randEntries(50), r = decodeProgress(encodeProgress(small), 80);
  assert.ok(r.ok); assert.equal(r.entries.length, 50);
  const ids = LEVELS.map(L => L.id), p = importProgress(r.entries, ids, {});
  assert.equal(Object.keys(p).length, countCleared(small));
  assert.ok(ids.slice(50).every(id => !p[id]));
  assert.deepEqual(decodeProgress(encodeProgress(randEntries(81)), 80), { ok: false, error: 'more' });
  assert.deepEqual(decodeProgress(buildCode(randEntries(80), 0x42), 80), { ok: false, error: 'marker' });
});

test('save code: the two admin codes decode to every stage with all shards, and to a blank record', () => {
  const all = decodeProgress(ADMIN_ALL, 80), none = decodeProgress(ADMIN_RESET, 80);
  assert.ok(all.ok && none.ok);
  assert.equal(all.entries.length, 80); assert.ok(all.entries.every(e => e && e.s.every(Boolean)));
  assert.equal(none.entries.length, 80); assert.ok(none.entries.every(e => e === null));
  assert.equal(ADMIN_ALL, encodeProgress(all.entries)); assert.equal(ADMIN_RESET, encodeProgress(none.entries));
  assert.ok(isAdminCode(ADMIN_ALL.toLowerCase().replace(/-/g, ' ')) && isAdminCode(ADMIN_RESET) && !isAdminCode(encodeProgress(randEntries(80))));
  assert.equal(countStars(all.entries), 240);
});

test('importing a code replaces the whole record: stages the code leaves out lock again, stars follow the code, best times stay only where cleared', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const old = { a: { s: [true, true, true], best: 12.5 }, b: { s: [true, false, false], best: 20 }, c: { s: [false, false, false], best: 30 } };
  const code = [{ s: [true, false, false] }, null, { s: [false, true, true] }, { s: [true, true, true] }];
  const p = importProgress(code, ids, old);
  assert.deepEqual(p, { a: { s: [true, false, false], best: 12.5 }, c: { s: [false, true, true], best: 30 }, d: { s: [true, true, true], best: 99 } });
  assert.equal(p.b, undefined);
});

test('landing assist: a block that appears just after you sank past its top still catches you', () => {
  const s = mk(['#######', '#.....#', '#..P..#', '#.....#', '#.LLL.#', '#.....#', '#^^^^^#', '#######']);
  // fall in the dark, switch the light on a moment after the feet passed the block top
  run(s, {}, 0.01);
  while (s.p.y + s.p.h < 4.12) step(s, {}, STEP);
  run(s, { lightSet: true, aim: Math.PI / 2 }, 0.3);
  assert.ok(s.p.onGround && Math.abs(s.p.y + s.p.h - 4) < 1e-6 && s.deaths === 0);
});

test('blink: holding 깜빡 darkens a lit torch, letting go lights it again', () => {
  const s = mk(['#######', '#.....#', '#P..S.#', '#######']);
  run(s, { lightSet: true, aim: 0 }, 0.05);
  assert.equal(isSolid(s, 4, 2), false);
  run(s, { dark: true }, 0.05);
  assert.equal(isSolid(s, 4, 2), true);
  run(s, { dark: false }, 0.05);
  assert.equal(isSolid(s, 4, 2), false);
});

// ---------- variety ----------
const SHAPES = ['journey', 'climb', 'descent', 'zigzag', 'hub', 'loop', 'compact'];
test('every stage has a shape tag, and no two stages in a row share one', () => {
  LEVELS.forEach((L, i) => {
    assert.ok(SHAPES.includes(L.shape), `${L.id} shape ${L.shape}`);
    if (i && LEVELS[i - 1].ch === L.ch) assert.notEqual(L.shape, LEVELS[i - 1].shape, `${LEVELS[i - 1].id} and ${L.id} are both ${L.shape}`);
  });
});

// A room's fingerprint is its tile pattern inside its box, mirrored to face right; lamp ids, the shard, the start,
// checkpoints and signs don't count. The same template may appear at most 3 times in the whole game.
const MIRROR = { '/': '\\', '\\': '/', '{': '}', '}': '{' };
const roomPrint = (L, [, x, y, w, h, dir]) => L.rows.slice(y, y + h).map(r => {
  const s = r.slice(x, x + w).replace(/[0-9]/g, '1').replace(/[oPC?]/g, '.');
  return dir < 0 ? [...s].reverse().map(c => MIRROR[c] || c).join('') : s;
}).join('\n');
test('no room template is used more than 3 times', () => {
  const uses = new Map();
  for (const L of LEVELS) for (const box of L.rooms) {
    const k = roomPrint(L, box); uses.set(k, [...(uses.get(k) || []), `${L.id}:${box[0]}`]);
  }
  for (const list of uses.values()) assert.ok(list.length <= 3, `template used ${list.length} times: ${list.join(' ')}`);
});

test('stage revisions default to one and stay positive', () => {
  for (const L of LEVELS) {
    assert.ok(Number.isSafeInteger(L.revision) && L.revision > 0, `${L.id} revision ${L.revision}`);
  }
});

console.log(`\n${n} tests passed`);
