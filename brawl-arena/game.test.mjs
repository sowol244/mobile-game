// Rule checks for 대난투 아레나. Run: node brawl-arena/game.test.mjs
import assert from 'node:assert/strict';
import { MAPS, parseMap } from './maps.js';
import { createMatch, step, hurt, lineOfSight, tileAt, blocksWalk, BLUE, RED } from './game.js';
import { makeBrain, botControl } from './bot.js';
import { TEAM_MODE, BRAWLERS } from './config.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const idle = m => m.brawlers.map(() => ({ mx: 0, my: 0, fire: null }));

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
  const m = createMatch({ mapDef: MAPS.team, botsOnly: true });
  const b = m.brawlers[0]; b.x = 1.5; b.y = 1.5; // then push left into the map edge
  const c = idle(m); c[0] = { mx: -1, my: 0, fire: null };
  for (let i = 0; i < 120; i++) step(m, 1 / 60, c);
  assert.ok(b.x >= b.r - 1e-9, `x=${b.x}`);
});

test('a shot spends one ammo and fires a 4-bullet burst; ammo refills', () => {
  const m = createMatch({ mapDef: MAPS.team, botsOnly: true });
  const b = m.brawlers[0], c = idle(m);
  c[0] = { mx: 0, my: 0, fire: -Math.PI / 2 };
  step(m, 1 / 60, c);
  assert.equal(b.ammo, 2);
  let shots = 0; c[0] = { mx: 0, my: 0, fire: null };
  for (let i = 0; i < 30; i++) { step(m, 1 / 60, c); shots += m.events.filter(e => e.type === 'shot' && e.id === 0).length; m.events.length = 0; }
  assert.equal(shots + 1 >= BRAWLERS.gyo.attack.bullets, true);
  for (let i = 0; i < 120; i++) step(m, 1 / 60, c);
  assert.equal(b.ammo, 3);
});

test('a kill scores for the killer team and the victim respawns after 3 s', () => {
  const m = createMatch({ mapDef: MAPS.team, botsOnly: true });
  const red = m.brawlers.find(b => b.team === RED), blue = m.brawlers.find(b => b.team === BLUE);
  hurt(m, red, red.hp, blue);
  assert.equal(red.alive, false); assert.deepEqual(m.score, [1, 0]); assert.equal(blue.kills, 1);
  for (let i = 0; i < Math.ceil(TEAM_MODE.respawn * 60) + 1; i++) step(m, 1 / 60, idle(m));
  assert.equal(red.alive, true); assert.equal(red.hp, red.maxHp); assert.ok(red.shieldT > 0);
});

test('spawn shield blocks damage from bullets', () => {
  const m = createMatch({ mapDef: MAPS.team, botsOnly: true });
  const red = m.brawlers.find(b => b.team === RED); red.shieldT = 5;
  m.bullets.push({ x: red.x - 0.6, y: red.y, vx: 13, vy: 0, left: 5, dmg: 350, r: 0.12, team: BLUE, owner: 0 });
  step(m, 1 / 60, idle(m)); step(m, 1 / 60, idle(m));
  assert.equal(red.hp, red.maxHp);
});

test('10 kills wins; tie at time-out goes to sudden death', () => {
  const m = createMatch({ mapDef: MAPS.team, botsOnly: true });
  const blue = m.brawlers[0];
  for (let i = 0; i < TEAM_MODE.killsToWin; i++) { const red = m.brawlers.find(b => b.team === RED && b.alive); hurt(m, red, 1e9, blue); for (let k = 0; k < 200; k++) step(m, 1 / 60, idle(m)); }
  assert.equal(m.phase, 'over'); assert.equal(m.winner, BLUE);

  const t = createMatch({ mapDef: MAPS.team, botsOnly: true });
  t.t = TEAM_MODE.time - 0.01; step(t, 1 / 60, idle(t));
  assert.equal(t.phase, 'sudden');
  const red = t.brawlers.find(b => b.team === RED); hurt(t, t.brawlers[0], 1e9, red);
  assert.equal(t.winner, RED);
});

test('health regenerates after 3 calm seconds', () => {
  const m = createMatch({ mapDef: MAPS.team, botsOnly: true });
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

console.log(`${n} tests passed`);
