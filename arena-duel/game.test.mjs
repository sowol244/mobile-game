// Rule checks for Arena Duel. Run: node arena-duel/game.test.mjs
import assert from 'node:assert/strict';
import { MAPS, parseMap, stageMap } from './maps.js';
import { createMatch, step, hurt, lineOfSight, tileAt, blocksWalk, visibleTo, duelRoster, BLUE, RED } from './game.js';
import { makeBrain, botControl } from './bot.js';
import { MODE_RULES, FIGHTERS } from './config.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const idle = m => m.fighters.map(() => ({ mx: 0, my: 0, fire: null }));
// Everyone on 교행이 unless a test says otherwise, so numbers are predictable.
const allGyo = () => duelRoster({ botsOnly: true }).map(r => ({ ...r, kind: 'gyo' }));
const gyoMatch = (extra = {}) => createMatch({ mapDef: MAPS.duel, roster: allGyo(), ...extra });

test('duel map is rectangular, 180° symmetric, 3 spawns per team', () => {
  const map = parseMap(MAPS.duel.rows);
  assert.equal(map.spawns[0].length, 3); assert.equal(map.spawns[1].length, 3);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++)
    assert.equal(tileAt(map, x, y), tileAt(map, map.w - 1 - x, map.h - 1 - y), `tile ${x},${y}`);
});

test('every open tile is reachable from the blue spawn', () => {
  const map = parseMap(MAPS.duel.rows), seen = new Set(), s = map.spawns[0][0], q = [[Math.floor(s.x), Math.floor(s.y)]];
  seen.add(q[0].join());
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && !blocksWalk(tileAt(map, x + dx, y + dy))) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  const open = map.tiles.filter(t => !blocksWalk(t)).length;
  assert.equal(seen.size, open);
});

test('walls block sight, water does not', () => {
  const map = parseMap(['.....', '..#..', '.....', '..~..', '.....'].map((r, i) => (i === 0 ? 'B...R' : r)));
  assert.equal(lineOfSight(map, 0.5, 1.5, 4.5, 1.5), false);
  assert.equal(lineOfSight(map, 0.5, 3.5, 4.5, 3.5), true);
});

test('walking into a wall stops the fighter', () => {
  const m = gyoMatch();
  const b = m.fighters[0]; b.x = 1.5; b.y = 1.5; // then push left into the map edge
  const c = idle(m); c[0] = { mx: -1, my: 0, fire: null };
  for (let i = 0; i < 120; i++) step(m, 1 / 60, c);
  assert.ok(b.x >= b.r - 1e-9, `x=${b.x}`);
});

test('a shot spends one ammo and fires a 4-bullet burst; ammo refills', () => {
  const m = gyoMatch();
  const b = m.fighters[0], c = idle(m);
  c[0] = { mx: 0, my: 0, fire: { a: -Math.PI / 2 } };
  step(m, 1 / 60, c);
  assert.equal(b.ammo, 2);
  let shots = 0; c[0] = { mx: 0, my: 0, fire: null };
  for (let i = 0; i < 30; i++) { step(m, 1 / 60, c); shots += m.events.filter(e => e.type === 'shot' && e.id === 0).length; m.events.length = 0; }
  assert.equal(shots + 1 >= FIGHTERS.gyo.attack.bullets, true);
  for (let i = 0; i < 120; i++) step(m, 1 / 60, c);
  assert.equal(b.ammo, 3);
});

test('a knockout scores for the winner and the opponent respawns', () => {
  const m = gyoMatch();
  const red = m.fighters.find(b => b.team === RED), blue = m.fighters.find(b => b.team === BLUE);
  hurt(m, red, red.hp, blue);
  assert.equal(red.alive, false); assert.deepEqual(m.score, [1, 0]); assert.equal(blue.kills, 1);
  for (let i = 0; i < Math.ceil(MODE_RULES.duel.respawn * 60) + 2; i++) step(m, 1 / 60, idle(m));
  assert.equal(red.alive, true); assert.equal(red.hp, red.maxHp); assert.ok(red.shieldT > 0);
});

test('spawn shield blocks damage from bullets', () => {
  const m = gyoMatch();
  const red = m.fighters.find(b => b.team === RED); red.shieldT = 5;
  m.bullets.push({ x: red.x - 0.6, y: red.y, vx: 13, vy: 0, left: 5, dmg: 350, r: 0.12, team: BLUE, owner: 0 });
  step(m, 1 / 60, idle(m)); step(m, 1 / 60, idle(m));
  assert.equal(red.hp, red.maxHp);
});

test('three knockouts win; a tied clock ends in a draw', () => {
  const m = gyoMatch();
  const blue = m.fighters[0];
  for (let i = 0; i < m.scoreToWin; i++) { const red = m.fighters.find(b => b.team === RED && b.alive); hurt(m, red, 1e9, blue); for (let k = 0; k < 200; k++) step(m, 1 / 60, idle(m)); }
  assert.equal(m.phase, 'over'); assert.equal(m.winner, BLUE);

  const t = gyoMatch();
  t.t = t.timeLimit - 0.01; step(t, 1 / 60, idle(t));
  assert.equal(t.phase, 'over'); assert.equal(t.winner, 'draw');

});

test('health regenerates after 3 calm seconds', () => {
  const m = gyoMatch();
  const b = m.fighters[0]; b.hp = 1000; b.calm = 0;
  for (let i = 0; i < 60 * 2; i++) step(m, 1 / 60, idle(m));
  assert.equal(b.hp, 1000);
  for (let i = 0; i < 60 * 2; i++) step(m, 1 / 60, idle(m));
  assert.ok(b.hp > 1000);
});

test('bots-only matches always finish, sides stay balanced', () => {
  const wins = [0, 0, 0]; let longest = 0;
  for (let s = 1; s <= 60; s++) {
    const m = createMatch({ mapDef: MAPS.duel, seed: s, botsOnly: true });
    const brains = m.fighters.map(() => makeBrain(1));
    while (m.phase !== 'over' && m.t < 300) { step(m, 1 / 60, m.fighters.map((b, i) => (b.alive ? botControl(m, b, brains[i], 1 / 60) : null))); m.events.length = 0; }
    assert.equal(m.phase, 'over', `seed ${s} did not finish`);
    wins[m.winner === BLUE ? 0 : m.winner === RED ? 1 : 2]++; longest = Math.max(longest, m.t);
  }
  assert.ok(wins[0] >= 18 && wins[1] >= 18, `wins ${wins}`);
  console.log('   blue/red/draw', wins.join('/'), 'longest', longest.toFixed(0) + 's');
});

test('bushes hide enemies unless someone is close or they just attacked', () => {
  const m = gyoMatch();
  const red = m.fighters.find(b => b.team === RED), blue = m.fighters.find(b => b.team === BLUE);
  // Park the red fighter in the middle bush, everyone else far away.
  let bx = -1, by = -1;
  for (let y = 0; y < m.map.h && bx < 0; y++) for (let x = 0; x < m.map.w; x++) if (m.map.tiles[y * m.map.w + x] === '*') { bx = x; by = y; break; }
  red.x = bx + 0.5; red.y = by + 0.5; red.revealT = 0;
  for (const b of m.fighters) if (b !== red) { b.x = 9.5; b.y = b.team === BLUE ? 27.5 : 1.5; }
  assert.equal(visibleTo(m, BLUE, red), false);
  red.revealT = 0.5; assert.equal(visibleTo(m, BLUE, red), true);
  red.revealT = 0; blue.x = red.x + 1; blue.y = red.y; assert.equal(visibleTo(m, BLUE, red), true);
});

test('hits charge special skills; a lobbed attack crosses a wall and splashes', () => {
  const m = createMatch({ mapDef: MAPS.duel, roster: allGyo().map((r, i) => (i === 0 ? { ...r, kind: 'jjam' } : r)) });
  const j = m.fighters[0], red = m.fighters.find(b => b.team === RED);
  red.shieldT = 0; j.charge = 0;
  // Put a wall between them: the row-5 wall block (x 7..11) on the red side.
  j.x = 9.5; j.y = 6.5; red.x = 9.5; red.y = 3.5;
  const c = idle(m); c[0] = { mx: 0, my: 0, fire: { a: -Math.PI / 2, d: 3 } };
  const hp = red.hp;
  for (let i = 0; i < 60; i++) { step(m, 1 / 60, c); c[0] = { mx: 0, my: 0, fire: null }; }
  assert.ok(red.hp < hp, 'bowl should land on the far side of the wall');
  assert.ok(j.charge > 0 && j.charge < 1);
});

test('piercing arrow goes through walls to hit its target', () => {
  const m = createMatch({ mapDef: MAPS.duel, roster: allGyo().map((r, i) => (i === 0 ? { ...r, kind: 'sowol' } : r)) });
  const s = m.fighters[0], reds = m.fighters.filter(b => b.team === RED);
  s.x = 9.5; s.y = 7.5; s.charge = 1;
  reds[0].x = 9.5; reds[0].y = 3.5;
  for (const r of reds) r.shieldT = 0;
  const before = reds.map(r => r.hp);
  const c = idle(m); c[0] = { mx: 0, my: 0, fire: null, special: { a: -Math.PI / 2 } };
  for (let i = 0; i < 40; i++) { step(m, 1 / 60, c); c[0] = idle(m)[0]; }
  assert.ok(reds[0].hp < before[0]);
  assert.equal(s.charge, 0);
});

test('stages 2-5 have their own playable maps and themes', () => {
  for (const mode of ['duel', 'boss']) {
    const seen = new Set();
    for (let st = 1; st <= 5; st++) {
      const d = stageMap(mode, st), m = parseMap(d.rows);
      assert.equal(d.theme, st - 1);
      seen.add(d.rows.join(''));
      assert.equal(m.spawns[0].length, 3); assert.equal(m.spawns[1].length, 3);
    }
    assert.equal(seen.size, 5, `${mode}: every stage has a different layout`);
  }
});

console.log(`${n} tests passed`);
