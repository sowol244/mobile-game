// Chapter 7. Map legend in ../levels.js. `solve` is the scripted solution the tests play.
import { onGround } from '../bot.js';

export default [
  {
    name: '잠든 석상', par: 20,
    signs: ['굳은 석상은 밟을 수 있어요', '앞을 비추면 석상이 깨어나요'],
    rows: [
      '##################################',
      '##################################',
      '#................................#',
      '#................................#',
      '#................................#',
      '#......o.........................#',
      '#.....###........................#',
      '#................................#',
      '#P?.M.......?..............M...D.#',
      '##############LLLLLLLLLL##########',
      '##############..........##########',
      '##############^^^^^^^^^^##########',
      '##################################',
    ],
    solve: function* (b) {
      yield* b.go(3.2);
      yield* b.jump(4.5);                 // stand on the sleeping statue
      yield* b.jump(7.4);                 // shard ledge
      yield* b.go(10);
      yield* b.until(onGround);
      yield* b.go(13.4);
      yield* b.light(true, 90);           // aim at your feet: the statue ahead stays asleep
      yield* b.go(24.8);
      yield* b.light(false);
      yield* b.go(25.4);
      yield* b.jump(29.5);                // over the statue
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '깨어 있는 석상', par: 20,
    signs: ['레버로 불을 꺼 석상을 멈추세요'],
    zones: [{ x: 1, y: 1, w: 28, h: 8, g: 'a', on: true }],
    levers: ['a'],
    rows: [
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#................o...........#',
      '#............................#',
      '#P?..=.....M..............D..#',
      '#############SSSSSSSS#########',
      '#############^^^^^^^^#########',
    ],
    solve: function* (b) {
      yield* b.go(5.5);                   // lights out: the statue freezes, the shadow bridge forms
      yield* b.go(9.6);
      yield* b.jump(12.8);                // over the statue
      yield* b.go(17.5);
      yield* b.jump(17.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 속 석상', par: 20,
    signs: ['그림자 속에선 석상이 굳어요'],
    lamps: { 1: { kind: 'beam', dir: -2, spread: 6, range: 30 } },
    rows: [
      '##########################',
      '#........................#',
      '#........................#',
      '#........................#',
      '#........................#',
      '#..........o.............#',
      '#........................#',
      '#PK1..?.........M......D.#',
      '##########^^##############',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.run(1, s => s.crates[0].x >= 5.5, 5);  // the crate's shadow falls on the statue
      yield* b.until(s => !s.statues[0].awake);
      yield* b.go(9.6);
      yield* b.jump(12.6);                // shard over the gap
      yield* b.go(14.6);
      yield* b.jump(18.4);                // over the frozen statue
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '떨어뜨리기', par: 15,
    signs: ['석상 발밑을 비춰 보세요'],
    rows: [
      '######################',
      '#......##########....#',
      '#......##########....#',
      '#......##########....#',
      '#......##########....#',
      '#......##########....#',
      '#.............o......#',
      '#P?........M.......D.#',
      '#######SSSSSSSSSS#####',
      '#######..........#####',
      '#######^^^^^^^^^^#####',
    ],
    solve: function* (b) {
      yield* b.go(5.6);
      yield* b.light(true, 10);           // the statue wakes, its floor melts away
      yield* b.until(s => s.statues[0].y > 8.5);
      yield* b.light(false);
      yield* b.go(14.5);
      yield* b.jump(14.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '안개 속 석상', par: 20,
    signs: ['안개 속 석상은 깨어나지 않아요'],
    zones: [{ x: 1, y: 1, w: 24, h: 8, color: 'r' }],
    fog: [{ x: 13, y: 4, w: 4, h: 4 }],
    rows: [
      '##########################',
      '#........................#',
      '#........................#',
      '#........................#',
      '#.....................D..#',
      '#.......o........#########',
      '#................#########',
      '#P?...........M..#########',
      '#####RRRRRRRR#############',
      '#####^^^^^^^^#############',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.go(8.5);
      yield* b.jump(8.5);                 // shard
      yield* b.go(12.8);
      yield* b.jump(14.5);                // onto the sleeping statue
      yield* b.jump(17.6);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '석상 디딤돌', par: 35,
    signs: ['빛을 끄면 석상이 굳어요', '석상을 불러와 밟고 올라가세요'],
    rows: [
      '###############################',
      '#.............................#',
      '#.............................#',
      '#.............................#',
      '#...................o.........#',
      '#......................########',
      '#.............................#',
      '#........................M..D.#',
      '#...............###LLLL########',
      '#...............###....########',
      '#.P?....M.....?.###....########',
      '###################^^^^########',
      '###############################',
    ],
    solve: function* (b) {
      yield* b.go(6.4);
      yield* b.jump(10.5);                // over the sleeping statue
      yield* b.go(15.3);
      yield* b.light(true, 180);          // wake it and call it over
      yield* b.until(s => s.statues[1].x + s.statues[1].w / 2 >= 13.1, {}, 8);
      yield* b.light(false);              // freeze it at the wall
      yield* b.wait(0.1);
      yield* b.jump(13.4);
      yield* b.go(13.3);
      yield* b.jump(16.8);                // statue → ledge
      yield* b.go(18.6);
      yield* b.light(true, 0);            // wake the guard; it walks onto the light bridge
      yield* b.until(s => s.statues[0].x + s.statues[0].w / 2 < 21.4, {}, 8);
      yield* b.light(false);              // bridge gone, guard falls
      yield* b.until(s => s.statues[0].y > 9.6, {}, 3);
      yield* b.light(true, 80);
      yield* b.go(20.5);
      yield* b.jump(20.5);                // shard
      yield* b.go(26);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '두 석상', par: 20,
    rows: [
      '##############################',
      '#........#####################',
      '#........#####################',
      '#........#####################',
      '#........#####################',
      '#.....o......................#',
      '#...............M.........D..#',
      '#........####SSSSSSSS#########',
      '#........####........#########',
      '#P....M..####........#########',
      '#############^^^^^^^^#########',
      '##############################',
    ],
    solve: function* (b) {
      yield* b.go(4.6);
      yield* b.jump(6.5);                 // onto statue A
      yield* b.jump(6.5);                 // shard
      yield* b.jump(9.8);                 // up to the corridor
      yield* b.go(12.4);
      yield* b.light(true, 10);           // statue B wakes and drops; A stays asleep behind you
      yield* b.until(s => s.statues[1].y > 7.5);
      yield* b.light(false);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '시계와 석상', par: 20,
    zones: [{ x: 1, y: 1, w: 30, h: 8, g: 'a', on: true }],
    levers: [{ g: 'a', t: 4 }],
    rows: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#...........o..................#',
      '#..............................#',
      '#P.=..................M......D.#',
      '######SSSSSSSSSSSS##############',
      '######^^^^^^^^^^^^##############',
    ],
    solve: function* (b) {
      yield* b.run(1, s => s.p.x > 10.6);
      yield* b.jump(13.5, { airMx: 1 });  // shard
      yield* b.run(1, s => s.p.x > 19.4);
      yield* b.jump(25, { airMx: 1 });    // over the frozen statue before the light comes back
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '석상 데려가기', par: 35,
    signs: ['석상을 비추며 데려가세요'],
    rows: [
      '##############################',
      '#............................#',
      '#..........................o.#',
      '#............................#',
      '#..........................D.#',
      '#........................#####',
      '#........................#####',
      '#.M.P?...................#####',
      '#######LLLLLLLLLLLLLL#########',
      '#######^^^^^^^^^^^^^^#########',
      '##############################',
    ],
    solve: function* (b) {
      const sx = s => s.statues[0].x + s.statues[0].w / 2;
      yield* b.light(true, 165);          // look back at the statue: it follows over your light
      for (let k = 0; k < 2400 && sx(b.s) < 21.8; k++) {
        const d = sx(b.s) + 3 - b.cx();
        yield b.inp({ mx: Math.max(-1, Math.min(1, d * 2)) });
      }
      yield* b.go(24.5);
      yield* b.until(s => sx(s) > 22.7);
      yield* b.light(false);              // freeze it right below the ledge
      yield* b.wait(0.1);
      yield* b.jump(23.3);
      yield* b.go(23.4);
      yield* b.jump(26.2);
      yield* b.go(26.8);
      yield* b.jump(27.4);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '석상 시험', par: 25,
    zones: [{ x: 1, y: 1, w: 12, h: 9, g: 'a', on: true }],
    levers: ['a'],
    rows: [
      '########################################',
      '#............############..............#',
      '#............############..............#',
      '#............############..............#',
      '#............############........o.....#',
      '#............############..............#',
      '#............############...........D..#',
      '#............############...############',
      '#...........................############',
      '#P..=.....M........M.......M############',
      '################SSSSSSSS################',
      '################^^^^^^^^################',
    ],
    solve: function* (b) {
      yield* b.go(4.5);                   // lights out
      yield* b.go(8.6);
      yield* b.jump(11.8);                // over the first statue
      yield* b.go(15.5);
      yield* b.light(true, 10);           // drop the second
      yield* b.until(s => s.statues[1].y > 10.5);
      yield* b.light(false);
      yield* b.go(25.6);
      yield* b.jump(27.4);                // onto the third
      yield* b.jump(29.4);
      yield* b.go(33.5);
      yield* b.jump(33.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
];
