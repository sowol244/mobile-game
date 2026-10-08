// Rule checks for 대난투 아레나. Run: node brawl-arena/game.test.mjs
import assert from 'node:assert/strict';
import { MAPS, parseMap, stageMap } from './maps.js';
import { createMatch, step, hurt, lineOfSight, tileAt, blocksWalk, visibleTo, teamRoster, inPoison, BLUE, RED } from './game.js';
import { makeBrain, botControl } from './bot.js';
import { TEAM_MODE, BRAWLERS, SURVIVAL } from './config.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const idle = m => m.brawlers.map(() => ({ mx: 0, my: 0, fire: null }));
// Everyone on 교행이 unless a test says otherwise, so numbers are predictable.
const allGyo = () => teamRoster({ botsOnly: true }).map(r => ({ ...r, kind: 'gyo' }));
const gyoMatch = (extra = {}) => createMatch({ mapDef: MAPS.team, roster: allGyo(), ...extra });

test('team map is rectangular, 180° symmetric, 3 spawns per team', () => {
  const map = parseMap(MAPS.team.rows);
  assert.equal(map.spawns[0].length, 3); assert.equal(map.spawns[1].length, 3);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++)
    assert.equal(tileAt(map, x, y), tileAt(map, map.w - 1 - x, map.h - 1 - y), `tile ${x},${y}`);
});

test('every open tile is reachable from the blue spawn', () => {
  const map = parseMap(MAPS.team.rows), seen = new Set(), s = map.spawns[0][0], q = [[Math.floor(s.x), Math.floor(s.y)]];
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

test('walking into a wall stops the brawler', () => {
  const m = gyoMatch();
  const b = m.brawlers[0]; b.x = 1.5; b.y = 1.5; // then push left into the map edge
  const c = idle(m); c[0] = { mx: -1, my: 0, fire: null };
  for (let i = 0; i < 120; i++) step(m, 1 / 60, c);
  assert.ok(b.x >= b.r - 1e-9, `x=${b.x}`);
});

test('a shot spends one ammo and fires a 4-bullet burst; ammo refills', () => {
  const m = gyoMatch();
  const b = m.brawlers[0], c = idle(m);
  c[0] = { mx: 0, my: 0, fire: { a: -Math.PI / 2 } };
  step(m, 1 / 60, c);
  assert.equal(b.ammo, 2);
  let shots = 0; c[0] = { mx: 0, my: 0, fire: null };
  for (let i = 0; i < 30; i++) { step(m, 1 / 60, c); shots += m.events.filter(e => e.type === 'shot' && e.id === 0).length; m.events.length = 0; }
  assert.equal(shots + 1 >= BRAWLERS.gyo.attack.bullets, true);
  for (let i = 0; i < 120; i++) step(m, 1 / 60, c);
  assert.equal(b.ammo, 3);
});

test('a kill scores for the killer team and the victim respawns', () => {
  const m = gyoMatch();
  const red = m.brawlers.find(b => b.team === RED), blue = m.brawlers.find(b => b.team === BLUE);
  hurt(m, red, red.hp, blue);
  assert.equal(red.alive, false); assert.deepEqual(m.score, [1, 0]); assert.equal(blue.kills, 1);
  for (let i = 0; i < Math.ceil(TEAM_MODE.respawn * 60) + 2; i++) step(m, 1 / 60, idle(m));
  assert.equal(red.alive, true); assert.equal(red.hp, red.maxHp); assert.ok(red.shieldT > 0);
});

test('spawn shield blocks damage from bullets', () => {
  const m = gyoMatch();
  const red = m.brawlers.find(b => b.team === RED); red.shieldT = 5;
  m.bullets.push({ x: red.x - 0.6, y: red.y, vx: 13, vy: 0, left: 5, dmg: 350, r: 0.12, team: BLUE, owner: 0 });
  step(m, 1 / 60, idle(m)); step(m, 1 / 60, idle(m));
  assert.equal(red.hp, red.maxHp);
});

test('10 kills wins; tie at time-out goes to sudden death', () => {
  const m = gyoMatch();
  const blue = m.brawlers[0];
  for (let i = 0; i < TEAM_MODE.killsToWin; i++) { const red = m.brawlers.find(b => b.team === RED && b.alive); hurt(m, red, 1e9, blue); for (let k = 0; k < 200; k++) step(m, 1 / 60, idle(m)); }
  assert.equal(m.phase, 'over'); assert.equal(m.winner, BLUE);

  const t = gyoMatch();
  t.t = TEAM_MODE.time - 0.01; step(t, 1 / 60, idle(t));
  assert.equal(t.phase, 'sudden');
  const red = t.brawlers.find(b => b.team === RED); hurt(t, t.brawlers[0], 1e9, red);
  assert.equal(t.winner, RED);
});

test('health regenerates after 3 calm seconds', () => {
  const m = gyoMatch();
  const b = m.brawlers[0]; b.hp = 1000; b.calm = 0;
  for (let i = 0; i < 60 * 2; i++) step(m, 1 / 60, idle(m));
  assert.equal(b.hp, 1000);
  for (let i = 0; i < 60 * 2; i++) step(m, 1 / 60, idle(m));
  assert.ok(b.hp > 1000);
});

test('bots-only matches always finish, sides stay balanced', () => {
  const wins = [0, 0, 0]; let longest = 0;
  for (let s = 1; s <= 60; s++) {
    const m = createMatch({ mapDef: MAPS.team, seed: s, botsOnly: true });
    const brains = m.brawlers.map(() => makeBrain(1));
    while (m.phase !== 'over' && m.t < 300) { step(m, 1 / 60, m.brawlers.map((b, i) => (b.alive ? botControl(m, b, brains[i], 1 / 60) : null))); m.events.length = 0; }
    assert.equal(m.phase, 'over', `seed ${s} did not finish`);
    wins[m.winner === BLUE ? 0 : m.winner === RED ? 1 : 2]++; longest = Math.max(longest, m.t);
  }
  assert.ok(wins[0] >= 18 && wins[1] >= 18, `wins ${wins}`);
  console.log('   blue/red/draw', wins.join('/'), 'longest', longest.toFixed(0) + 's');
});

test('bushes hide enemies unless someone is close or they just attacked', () => {
  const m = gyoMatch();
  const red = m.brawlers.find(b => b.team === RED), blue = m.brawlers.find(b => b.team === BLUE);
  // Park the red brawler in the middle bush, everyone else far away.
  let bx = -1, by = -1;
  for (let y = 0; y < m.map.h && bx < 0; y++) for (let x = 0; x < m.map.w; x++) if (m.map.tiles[y * m.map.w + x] === '*') { bx = x; by = y; break; }
  red.x = bx + 0.5; red.y = by + 0.5; red.revealT = 0;
  for (const b of m.brawlers) if (b !== red) { b.x = 9.5; b.y = b.team === BLUE ? 27.5 : 1.5; }
  assert.equal(visibleTo(m, BLUE, red), false);
  red.revealT = 0.5; assert.equal(visibleTo(m, BLUE, red), true);
  red.revealT = 0; blue.x = red.x + 1; blue.y = red.y; assert.equal(visibleTo(m, BLUE, red), true);
});

test('normal hits charge the super; a lobbed bowl flies over a wall and splashes', () => {
  const m = createMatch({ mapDef: MAPS.team, roster: allGyo().map((r, i) => (i === 0 ? { ...r, kind: 'jjam' } : r)) });
  const j = m.brawlers[0], red = m.brawlers.find(b => b.team === RED);
  red.shieldT = 0; j.charge = 0;
  // Put a wall between them: the row-5 wall block (x 7..11) on the red side.
  j.x = 9.5; j.y = 6.5; red.x = 9.5; red.y = 3.5;
  const c = idle(m); c[0] = { mx: 0, my: 0, fire: { a: -Math.PI / 2, d: 3 } };
  const hp = red.hp;
  for (let i = 0; i < 60; i++) { step(m, 1 / 60, c); c[0] = { mx: 0, my: 0, fire: null }; }
  assert.ok(red.hp < hp, 'bowl should land on the far side of the wall');
  assert.ok(j.charge > 0 && j.charge < 1);
});

test('piercing arrow goes through walls and several enemies', () => {
  const m = createMatch({ mapDef: MAPS.team, roster: allGyo().map((r, i) => (i === 0 ? { ...r, kind: 'sowol' } : r)) });
  const s = m.brawlers[0], reds = m.brawlers.filter(b => b.team === RED);
  s.x = 9.5; s.y = 7.5; s.charge = 1;
  reds[0].x = 9.5; reds[0].y = 3.5; reds[1].x = 9.5; reds[1].y = 2.5;
  for (const r of reds) r.shieldT = 0;
  const before = reds.map(r => r.hp);
  const c = idle(m); c[0] = { mx: 0, my: 0, fire: null, sup: { a: -Math.PI / 2 } };
  for (let i = 0; i < 40; i++) { step(m, 1 / 60, c); c[0] = idle(m)[0]; }
  assert.ok(reds[0].hp < before[0] && reds[1].hp < before[1]);
  assert.equal(s.charge, 0);
});

test('stages 2-5 have their own playable maps and themes', () => {
  for (const mode of ['team', 'survival']) {
    const seen = new Set();
    for (let st = 1; st <= 5; st++) {
      const d = stageMap(mode, st), m = parseMap(d.rows);
      assert.equal(d.theme, st - 1);
      seen.add(d.rows.join(''));
      if (mode === 'team') { assert.equal(m.spawns[0].length, 3); assert.equal(m.spawns[1].length, 3); }
      else { assert.equal(m.starts.length, 6); assert.equal(m.tiles.filter(t => t === 'X').length, 10); }
    }
    assert.equal(seen.size, 5, `${mode}: every stage has a different layout`);
  }
});

const survMatch = (extra = {}) => createMatch({ mapDef: MAPS.survival, mode: 'survival', botsOnly: true, ...extra });

test('survival map: 6 start spots, 10 power boxes, every open tile reachable', () => {
  const m = survMatch();
  assert.equal(m.map.starts.length, 6); assert.equal(m.boxHp.size, 10);
  const s = m.map.starts[0], seen = new Set([`${Math.floor(s.x)},${Math.floor(s.y)}`]), q = [[Math.floor(s.x), Math.floor(s.y)]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && !blocksWalk(tileAt(m.map, x + dx, y + dy))) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  assert.equal(seen.size, m.map.tiles.filter(t => !blocksWalk(t)).length);
});

test('breaking a power box drops a cube; picking it up makes you stronger', () => {
  const m = survMatch();
  const [i] = m.boxHp.keys(), bx = i % m.map.w, by = Math.floor(i / m.map.w);
  const b = m.brawlers[0];
  // Boxes take damage from bullets and splashes; drive it with one huge bullet.
  m.bullets.push({ x: bx - 0.7, y: by + 0.5, vx: 13, vy: 0, left: 3, dmg: 1e6, r: 0.12, team: b.team, owner: b.id });
  for (let k = 0; k < 6; k++) step(m, 1 / 60, idle(m));
  assert.equal(m.boxHp.has(i), false); assert.equal(tileAt(m.map, bx, by), '.');
  assert.equal(m.items.length, 1);
  const hp0 = b.maxHp, p0 = b.power;
  b.x = m.items[0].x; b.y = m.items[0].y; step(m, 1 / 60, idle(m));
  assert.equal(b.cubes, 1); assert.ok(b.maxHp > hp0 && b.power > p0); assert.equal(m.items.length, 0);
});

test('poison closes in after the start time and hurts whoever is outside', () => {
  const m = survMatch();
  const b = m.brawlers[0]; b.x = 1.5; b.y = 1.5; b.shieldT = 0;
  assert.equal(inPoison(m, 1.5, 1.5), false);
  m.t = SURVIVAL.poisonStart + SURVIVAL.poisonStep * 3;
  assert.equal(inPoison(m, 1.5, 1.5), true); assert.equal(inPoison(m, 12.5, 12.5), false);
  const hp = b.hp; for (let k = 0; k < 40; k++) step(m, 1 / 60, idle(m));
  assert.ok(b.hp < hp);
});

test('survival: no respawn, places count down, last one standing is 1st', () => {
  const m = survMatch();
  const [a, ...rest] = m.brawlers;
  rest.forEach((o, k) => hurt(m, o, 1e9, a));
  assert.deepEqual(rest.map(o => o.place), [6, 5, 4, 3, 2]);
  assert.equal(m.phase, 'over'); assert.equal(a.place, 1);
  for (let k = 0; k < 600; k++) step(m, 1 / 60, idle(m));
  assert.ok(rest.every(o => !o.alive));
});

test('bots-only survival games always finish', () => {
  for (let s = 1; s <= 15; s++) {
    const m = survMatch({ seed: s });
    const brains = m.brawlers.map(() => makeBrain(1));
    while (m.phase !== 'over' && m.t < 400) { step(m, 1 / 60, m.brawlers.map((b, i) => (b.alive ? botControl(m, b, brains[i], 1 / 60) : null))); m.events.length = 0; }
    assert.equal(m.phase, 'over', `seed ${s}`);
  }
});

console.log(`${n} tests passed`);
