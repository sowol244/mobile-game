// Chapter 4. Map legend in ../levels.js. `solve` is the scripted solution the tests play.
import { onGround } from '../bot.js';

export default [
  {
    name: '등불', par: 20,
    signs: ['등불 빛도 블록을 바꿔요'],
    lamps: { 1: { kind: 'beam', dir: 20, spread: 12, range: 30, g: 'a' } },
    levers: ['a'],
    rows: [
      '##############################',
      '##############################',
      '#............................#',
      '#............................#',
      '#1...........................#',
      '#...........o................#',
      '#............................#',
      '#P?.................=......D.#',
      '########LLLLLLLLLLLL##SSSS####',
      '########^^^^^^^^^^^^##^^^^####',
      '##############################',
    ],
    solve: function* (b) {
      yield* b.go(12.5);
      yield* b.jump(12.5);                // shard
      yield* b.run(1, s => s.cleared);    // lever: lamp off, the shadow floor holds
    },
  },
  {
    name: '상자', par: 25,
    signs: ['상자는 밀 수 있어요'],
    rows: [
      '######################',
      '######################',
      '#....................#',
      '#....................#',
      '#........o.........D.#',
      '#.............########',
      '#.............########',
      '#P?..K........########',
      '######################',
    ],
    solve: function* (b) {
      yield* b.run(1, s => s.crates[0].x >= 8.95);
      yield* b.wait(0.1);
      yield* b.jump(9.5);
      yield* b.jump(9.5);                 // shard from the crate
      yield* b.go(7.6);
      yield* b.until(onGround);
      yield* b.run(1, s => s.crates[0].x >= 12.98 || s.p.x > 13, 6);
      yield* b.wait(0.1);
      yield* b.jump(13.5);
      yield* b.jump(15.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 다리', par: 25,
    signs: ['상자 그림자도 그림자예요'],
    lamps: { 1: { kind: 'beam', dir: 0, spread: 20, range: 34 } },
    rows: [
      '##################################',
      '##################################',
      '#................................#',
      '#................................#',
      '#................................#',
      '#.o..............................#',
      '#.##........############.........#',
      '#...........SSSSSSSSSSSS.........#',
      '#1.P.K..?...SSSSSSSSSSSS.....D...#',
      '############............##########',
      '############............##########',
      '############^^^^^^^^^^^^##########',
      '##################################',
    ],
    solve: function* (b) {
      yield* b.go(4.3);
      yield* b.jump(5.5);                 // onto the crate
      yield* b.jump(2.8);                 // shelf: shard
      yield* b.go(1.5);                   // drop back down
      yield* b.until(onGround);
      yield* b.run(1, s => s.crates[0].x >= 10.9, 10); // push it to the very edge: thin shadow
      yield* b.wait(0.1);
      yield* b.jump(11.5);
      yield* b.go(25);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 우산', par: 25,
    signs: ['상자를 등불 바로 밑에 두면 그림자가 커져요'],
    lamps: { 1: { kind: 'beam', dir: 90, spread: 25, range: 14 } },
    zones: [{ x: 4, y: 1, w: 15, h: 3 }],
    rows: [
      '########################',
      '#..........1...........#',
      '#....P?K...............#',
      '#....LLLLLLLLLLLLL.....#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..................o...#',
      '#.................###..#',
      '#....................D.#',
      '#########SSSSS##########',
      '#########^^^^^##########',
      '########################',
    ],
    solve: function* (b) {
      yield* b.run(1, s => s.crates[0].x >= 10.95, 8);
      yield* b.wait(0.1);
      yield* b.go(3.5);                   // off the ledge, down to the floor
      yield* b.until(onGround);
      yield* b.go(17.4);                  // over the shadowed pit
      yield* b.jump(19.4);                // shard shelf
      yield* b.go(21.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '두 등불', par: 25,
    lamps: { 1: { kind: 'beam', dir: 15, spread: 20, range: 40 }, 2: { kind: 'beam', dir: 165, spread: 20, range: 40, g: 'b' } },
    levers: ['b'],
    rows: [
      '############################',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#......=.......o...........#',
      '#.....##...................#',
      '#1........................2#',
      '#.PK...................D...#',
      '##########SSSSSSSS##########',
      '##########^^^^^^^^##########',
      '############################',
    ],
    solve: function* (b) {
      yield* b.run(1, s => s.crates[0].x >= 4.98, 4);
      yield* b.wait(0.1);
      yield* b.jump(5.5);                 // crate as a step
      yield* b.jump(7.4);                 // shelf: lever, right lamp off
      yield* b.go(3.6);
      yield* b.until(onGround);
      yield* b.run(1, s => s.crates[0].x >= 8.98, 6); // crate to the edge: shadow over the bridge
      yield* b.wait(0.1);
      yield* b.jump(9.5);
      yield* b.go(15.5);
      yield* b.jump(15.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '움직이는 등불', par: 30,
    signs: ['움직이는 등불을 잘 보세요'],
    lamps: { 1: { kind: 'beam', dir: 90, spread: 20, range: 12, move: [19, 0], period: 8 } },
    rows: [
      '##############################',
      '#....1.......................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#..................o.........#',
      '#............................#',
      '#P?........................D.#',
      '#####SSSSSSSS###SSSSSSSS######',
      '#####^^^^^^^^###^^^^^^^^######',
      '##############################',
    ],
    solve: function* (b) {
      const lamp = s => s.lamps[0].x;
      yield* b.until(s => lamp(s) > 17);  // the light is over the far half
      yield* b.go(14.5);
      yield* b.until(s => s.t > 5 && lamp(s) < 10); // now it is over the near half
      yield* b.go(19);
      yield* b.jump(19.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 비탈', par: 40,
    signs: ['상자가 등불에 가까울수록 그림자가 커져요'],
    lamps: { 1: { kind: 'beam', dir: -30, spread: 30, range: 40, g: 'a', on: false } },
    levers: ['a'],
    rows: [
      '##############################',
      '#.....................##.....#',
      '#.....................##.....#',
      '#.......SSSSSSSSSSSSSSSSSS.D.#',
      '#.......SSSSSSSSSSSSSSSSSS####',
      '#.......SSSSSSSSSSSSSSSSSS####',
      '#.......SSSSSSSSSSSSSSSSSS####',
      '#.......SSSSSSSSSSSSSSSSSS####',
      '#.......SSSSSSSSSoSSSSSSSS####',
      '#.......SSSSSSSSSSSSSSSSSS####',
      '#.......SSSSSSSSSSSSSSSSSS####',
      '#1=P?K.#SSSSSSSSSSSSSSSSSS####',
      '#############^^^^^^^^^^^^^####',
      '##############################',
    ],
    solve: function* (b) {
      yield* b.go(2.5);                   // lamp on
      yield* b.go(3.8);
      yield* b.jump(6.4);                 // hop over the crate
      yield* b.jump(8.5);
      yield* b.go(10.3);
      yield* b.jump(12);
      yield* b.go(17.5);
      yield* b.jump(17.5);                // shard while the slope is low
      yield* b.go(12);
      yield* b.go(6.4);
      yield* b.run(-1, s => s.crates[0].x <= 3.05, 6); // crate close to the lamp: steep shadow
      yield* b.wait(0.1);
      yield* b.go(5.5);
      yield* b.jump(7.5);
      yield* b.jump(9);
      for (const x of [12, 15, 18, 21, 24]) { yield* b.go(x - 0.45); yield* b.jump(x + 0.6); } // up the shadow stairs
      yield* b.go(27.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '오르내리는 등불', par: 30,
    signs: ['빛줄기가 지나간 다음에 오르세요'],
    lamps: { 1: { kind: 'beam', dir: 0, spread: 5, range: 30, move: [0, 10], period: 7 } },
    rows: [
      '########################',
      '#1.....................#',
      '#...................D..#',
      '#..........o.....#######',
      '#.............SS.#######',
      '#................#######',
      '#.........###....#######',
      '#................#######',
      '#......SS........#######',
      '#................#######',
      '#...SS...........#######',
      '#P?..............#######',
      '###^^^^^^^^^^^^^^#######',
      '########################',
    ],
    solve: function* (b) {
      const ly = s => s.lamps[0].y;
      yield* b.until(s => ly(s) > 10.4);  // the beam is at the bottom
      yield* b.go(3.0);
      yield* b.jump(4.8);
      yield* b.jump(7.7);
      yield* b.jump(11);                  // rock: safe
      yield* b.jump(11.5);                // shard
      yield* b.until(s => s.t > 8.6 && ly(s) > 7.5); // beam back below us
      yield* b.go(12.4);
      yield* b.jump(14.7);
      yield* b.jump(18);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '구름 그림자', par: 20,
    signs: ['안개 구름의 그림자를 밟아요'],
    lamps: { 1: { kind: 'radial', range: 20 } },
    fog: [{ x: 9, y: 6, w: 2, h: 1 }, { x: 12, y: 6, w: 2, h: 1 }, { x: 15, y: 6, w: 1, h: 1 }, { x: 17, y: 6, w: 2, h: 1 }, { x: 20, y: 6, w: 2, h: 1 }],
    rows: [
      '################################',
      '#..............1...............#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............o...............#',
      '#P?..........................D.#',
      '####SSSSSSSSSSSSSSSSSSSSSSSS####',
      '####^^^^^^^^^^^^^^^^^^^^^^^^####',
      '################################',
    ],
    solve: function* (b) {
      yield* b.go(5.4);
      yield* b.jump(10.6);
      yield* b.go(11.6);
      yield* b.jump(15.5);
      yield* b.jump(15.5);                // shard on the one-tile island
      yield* b.jump(19.6);
      yield* b.go(20.6);
      yield* b.jump(25.6);
      yield* b.go(26.6);
      yield* b.jump(29.4);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '등불 시험', par: 45,
    lamps: { 1: { kind: 'beam', dir: 15, spread: 20, range: 15 }, 2: { kind: 'beam', dir: 90, spread: 20, range: 12, move: [17, 0], period: 8 } },
    rows: [
      '############################################',
      '#....................2.....................#',
      '#..........................................#',
      '#..........................................#',
      '#.............................o............#',
      '#..........................................#',
      '#1.........................................#',
      '#.PK.....................................D.#',
      '##########SSSSSSSS###SSSSSSSS###SSSSSSSS####',
      '##########^^^^^^^^###^^^^^^^^###^^^^^^^^####',
      '############################################',
    ],
    solve: function* (b) {
      const ph = s => (s.t / 8) % 1, lx = s => s.lamps.find(L => L.id === '2').x;
      yield* b.run(1, s => s.crates[0].x >= 8.98, 8);
      yield* b.wait(0.1);
      yield* b.jump(9.5);
      yield* b.go(19);
      yield* b.until(s => lx(s) > 31 && ph(s) < 0.5);   // moving light over the far half
      yield* b.go(30.5);
      yield* b.jump(30.5);                // shard
      yield* b.until(s => lx(s) < 25.5);  // now over the near half
      yield* b.run(1, s => s.cleared);
    },
  },
];
