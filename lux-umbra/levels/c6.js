// Chapter 6. Map legend in ../levels.js. `solve` is the scripted solution the tests play.
import { onGround } from '../bot.js';

export default [
  {
    name: '붉은 유리', par: 20,
    signs: ['유리를 지난 빛은 색이 바뀌어요'],
    lamps: { 1: { kind: 'beam', dir: 25, spread: 14, range: 30 } },
    rows: [
      '############################',
      '#1.........................#',
      '#...r......................#',
      '#...r......................#',
      '#..........................#',
      '#...............o..........#',
      '#..........................#',
      '#P?....................D...#',
      '#########LLLLRRRRRRRR#######',
      '#########^^^^^^^^^^^^#######',
      '############################',
    ],
    solve: function* (b) {
      yield* b.go(16.5);
      yield* b.jump(16.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '두 유리', par: 15,
    lamps: { 1: { kind: 'beam', dir: 90, spread: 40, range: 14, ox: 0.5 } },
    rows: [
      '######################',
      '#.........1..........#',
      '#....................#',
      '#...bbbbbbbrrrrrr....#',
      '#....................#',
      '#....................#',
      '#...........o........#',
      '#....................#',
      '#P.................D.#',
      '####BBBBBBBRRRRRR#####',
      '####^^^^^^^^^^^^^#####',
      '######################',
    ],
    solve: function* (b) {
      yield* b.go(12.5);
      yield* b.jump(12.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '유리 등불', par: 30,
    signs: ['창문을 상자로 가릴 수 있어요'],
    lamps: { 1: { kind: 'radial', range: 16 } },
    rows: [
      '################################',
      '#......................o...#####',
      '#..........................#####',
      '#..........................#####',
      '#.....................BB...#####',
      '#.............K....BB......#####',
      '#.........RRR###...........#####',
      '#............r1b.............D.#',
      '#.......RR...#####SSSSSSSSSS####',
      '#..............................#',
      '#....RR........................#',
      '#.P?...........................#',
      '####...........................#',
      '####^^^^^^^^^^^^^^^^^^^^^^^^^^^#',
      '################################',
    ],
    solve: function* (b) {
      yield* b.jump(5.6);
      yield* b.jump(8.6);
      yield* b.jump(11.0);
      yield* b.go(12.6);
      yield* b.jump(15.5);                // hop over the crate, don't push it yet
      yield* b.jump(19.6);
      yield* b.jump(22.6);
      yield* b.jump(23.5);                // shard
      yield* b.go(22.4);
      yield* b.jump(19.8);
      yield* b.go(19.5);
      yield* b.jump(15.4);
      yield* b.go(15.4);
      yield* b.jump(13.5);
      yield* b.run(1, s => s.crates[0].y > 6.5, 5); // crate drops in front of the blue window
      yield* b.until(s => s.crates[0].vy === 0 && s.crates[0].y > 6.9);
      yield* b.go(17.5);
      yield* b.go(27);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '거울', par: 20,
    signs: ['거울은 빛을 꺾어요'],
    lamps: { 1: { kind: 'beam', dir: 90, spread: 5, range: 10, color: 'r' } },
    rows: [
      '##########################',
      '#.....1..................#',
      '#........................#',
      '#........................#',
      '#........................#',
      '#.............o..........#',
      '#........................#',
      '#P?...................D..#',
      '######\\RRRRRRRRRRRRRR#####',
      '#######^^^^^^^^^^^^^^#####',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.go(14.5);
      yield* b.jump(14.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '거울로 문 찾기', par: 15,
    signs: ['손전등 빛도 거울에 꺾여요'],
    rows: [
      '##################',
      '##################',
      '#.../.........\\###',
      '#.......f......###',
      '#.......f......###',
      '#.......f..o...###',
      '#.......f......###',
      '#P?.....f.....H###',
      '######SSSSSSSS####',
      '######^^^^^^^^####',
      '##################',
    ],
    solve: function* (b) {
      yield* b.go(4.5);
      yield* b.light(true, -90);          // up into the mirror, around, down onto the door
      yield* b.until(s => s.reveal[7 * s.w + 14] === 1);
      yield* b.light(false);
      yield* b.go(11.5);
      yield* b.jump(11.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '돌리는 거울', par: 20,
    signs: ['거울을 밟으면 돌아가요'],
    lamps: { 1: { kind: 'beam', dir: 90, spread: 5, range: 10, color: 'r' } },
    rows: [
      '##########################',
      '#...........1............#',
      '#........................#',
      '#........................#',
      '#........................#',
      '#................o.......#',
      '#........................#',
      '#P?....................D.#',
      '###RRRRRRRRR{RRRRRRRRR####',
      '###^^^^^^^^^#^^^^^^^^^####',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.go(17.5);                  // stepping on the mirror turns the red light to the right
      yield* b.jump(17.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '거울 두 개', par: 20,
    lamps: { 1: { kind: 'beam', dir: 0, spread: 2, range: 12, color: 'r' } },
    rows: [
      '##########################',
      '#........o...............#',
      '#........................#',
      '#1........{..............#',
      '#.......LL...............#',
      '#........................#',
      '#.....LL.................#',
      '#P....................D..#',
      '##########\\RRRRRRRRRR#####',
      '###########^^^^^^^^^^#####',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.light(true, -40);
      yield* b.go(4.6);
      yield* b.jump(6.8);
      yield* b.jump(8.8);
      yield* b.jump(9.5);                 // shard
      yield* b.run(1, s => s.mirrors.some(m => m.turn && m.state === 1), 3); // bump the high mirror
      yield* b.light(false);
      yield* b.until(s => onGround(s) && s.p.y > 6.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '거울과 상자', par: 20,
    lamps: { 1: { kind: 'beam', dir: 90, spread: 5, range: 8 } },
    rows: [
      '############################',
      '#.1........................#',
      '#..........................#',
      '#..........................#',
      '#.............o............#',
      '#..........................#',
      '#..........................#',
      '#.\\.P.K.................D..#',
      '##########SSSSSSSSS#########',
      '##########^^^^^^^^^#########',
      '############################',
    ],
    solve: function* (b) {
      yield* b.run(1, s => s.crates[0].x >= 8.98, 6); // the crate stops the reflected beam
      yield* b.wait(0.1);
      yield* b.jump(9.5);
      yield* b.go(14.5);
      yield* b.jump(14.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '거울 넘기', par: 20,
    signs: ['거울을 뛰어넘을 수도 있어요'],
    lamps: { 1: { kind: 'beam', dir: 90, spread: 5, range: 10, color: 'r' } },
    rows: [
      '############################',
      '#...........1..............#',
      '#..........................#',
      '#..........................#',
      '#................o.........#',
      '#..........................#',
      '#..........................#',
      '#P?.....................D..#',
      '###RRRRRRRRR{SSSSSSSSS######',
      '###^^^^^^^^^#^^^^^^^^^######',
    ],
    solve: function* (b) {
      yield* b.go(10.6);
      yield* b.jump(14.2);                // over the mirror: it keeps the light on the left
      yield* b.go(17.5);
      yield* b.jump(17.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '유리와 거울 시험', par: 20,
    lamps: { 1: { kind: 'beam', dir: 0, spread: 2, range: 12 } },
    rows: [
      '################################',
      '#..............................#',
      '#........o.....................#',
      '#..............................#',
      '#1........{....................#',
      '#.......LL.....................#',
      '#.........r....................#',
      '#.....LL.......................#',
      '#P...........................D.#',
      '##########\\RRRRRRRR###SSSSSS####',
      '###########^^^^^^^^###^^^^^^####',
      '################################',
    ],
    solve: function* (b) {
      yield* b.light(true, -40);
      yield* b.go(4.6);
      yield* b.jump(6.8);
      yield* b.jump(8.8);
      yield* b.jump(9.5);                 // shard
      yield* b.run(1, s => s.mirrors.some(m => m.turn && m.state === 1), 3);
      yield* b.light(false);
      yield* b.until(s => onGround(s) && s.p.y > 7.5);
      yield* b.run(1, s => s.cleared);    // red light through the glass; then the dark shadow bridge
    },
  },
];
