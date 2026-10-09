// Chapter 1. Map legend in ../levels.js. `solve` is the scripted solution the tests play.
import { onGround } from '../bot.js';

export default [
  {
    name: '첫 걸음', par: 20,
    signs: ['◀ ▶로 걷고, 점프로 뛰어요'],
    rows: [
      '########################',
      '#......................#',
      '#..............o.......#',
      '#.............###......#',
      '#......................#',
      '#P?.........#.........D#',
      '#####^^^###########^^###',
      '########################',
    ],
    solve: function* (b) {
      yield* b.go(4.4);
      yield* b.jump(8.8);
      yield* b.go(11.3);
      yield* b.jump(12.5);
      yield* b.jump(15.3);                // ledge: shard
      yield* b.go(17.6);
      yield* b.until(onGround);
      yield* b.go(18.2);
      yield* b.jump(21.6);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '첫 불빛', par: 20,
    signs: ['손전등을 켜면 빛 블록이 생겨요', '숨은 문이 있어요. 벽을 비춰 보세요'],
    rows: [
      '##############################',
      '##############################',
      '####.......###########.......#',
      '#..........#########.........#',
      '#............................#',
      '#............................#',
      '#...........o................#',
      '#............................#',
      '#..P.?..............?........H',
      '######LLLLLLLLL###############',
      '######.........###############',
      '######^^^^^^^^^###############',
      '##############################',
    ],
    solve: function* (b) {
      yield* b.go(5.5);
      yield* b.light(true, 15);           // bridge appears
      yield* b.go(12.2);
      yield* b.jump(12.6);                // shard over the bridge
      yield* b.go(27.5);
      yield* b.run(1, s => s.cleared);    // the halo finds the hidden door
    },
  },
  {
    name: '빛 계단', par: 15,
    signs: ['손전등 버튼을 끌면 원하는 곳을 비춰요'],
    rows: [
      '######################',
      '#.................o..#',
      '#....................#',
      '#..................D.#',
      '#.............LL.#####',
      '#................#####',
      '#..........LL....#####',
      '#................#####',
      '#.......LL.......#####',
      '#................#####',
      '#....LL..........#####',
      '#P?..............#####',
      '####^^^^^^^^^^^^^#####',
      '######################',
    ],
    solve: function* (b) {
      yield* b.light(true, -45);
      yield* b.go(3.4);
      yield* b.jump(5.9);
      yield* b.jump(8.9);
      yield* b.jump(11.9);
      yield* b.jump(14.9);
      yield* b.jump(18.4);
      yield* b.jump(18.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '빛의 벽', par: 20,
    signs: ['빛 블록은 벽도 돼요. 끄고 지나가세요'],
    rows: [
      '############################',
      '############################',
      '############################',
      '############################',
      '##########........##########',
      '#......L......o.....L......#',
      '#......L............L......#',
      '#.P?...L............L....D.#',
      '##########LLLLLLLL##########',
      '##########^^^^^^^^##########',
      '############################',
    ],
    solve: function* (b) {
      yield* b.go(8.6);                   // through the wall in the dark
      yield* b.light(true, 30);           // the bridge appears
      yield* b.go(14.5);
      yield* b.jump(14.5);                // shard
      yield* b.go(18.7);
      yield* b.light(false);              // the second wall melts away
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '떨어지는 빛', par: 20,
    signs: ['불을 켠 채 깜빡을 누르면 떨어지고, 떼면 멈춰요'],
    rows: [
      '##############',
      '#........#####',
      '#........#####',
      '#P?......#####',
      '#####....#####',
      '#####....#####',
      '#####LLLL#####',
      '#####......###',
      '#####.....o###',
      '#####....#####',
      '#####LLLL#####',
      '#####........#',
      '#####........#',
      '#####......D.#',
      '#####LLLL#####',
      '#####....#####',
      '#####....#####',
      '#####....#####',
      '#####^^^^#####',
      '##############',
    ],
    solve: function* (b) {
      yield* b.light(true, 90);
      yield* b.go(6.5);
      yield* b.until(s => onGround(s) && s.p.y > 4);
      yield* b.light(false);              // drop through
      yield* b.until(s => s.p.y > 6.3);
      yield* b.light(true);               // and catch the next floor
      yield* b.until(s => onGround(s) && s.p.y > 8);
      yield* b.go(8.3);
      yield* b.jump(10.3);                // shard pocket
      yield* b.go(7);
      yield* b.until(onGround);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 10.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 12);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '숨은 문', par: 15,
    rows: [
      '########################',
      '########################',
      '#.............o.########',
      '#...............########',
      '#...............H#######',
      '#............###########',
      '#.........LL....########',
      '#...............########',
      '#......LL.......########',
      '#P..............########',
      '########################',
      '########################',
    ],
    solve: function* (b) {
      yield* b.light(true, -40);
      yield* b.go(5.6);
      yield* b.jump(7.8);
      yield* b.jump(10.8);
      yield* b.jump(13.8);
      yield* b.go(14.4);
      yield* b.jump(14.5);                // shard
      yield* b.run(1, s => s.cleared);    // close to the wall, the hidden door shows up
    },
  },
  {
    name: '빛 기둥', par: 20,
    signs: ['뛰고 깜빡을 누른 채 기둥을 지나세요'],
    rows: [
      '##############################',
      '##############################',
      '##############################',
      '#.............L.....L........#',
      '#.............L.....L........#',
      '#.............L..o..L........#',
      '#.............L.....L........#',
      '#.P?..........L.....L......D.#',
      '########LLLLLLLLLLLLLLLLL#####',
      '########^^^^^^^^^^^^^^^^^#####',
      '##############################',
    ],
    solve: function* (b) {
      const through = wall => s => (s.p.x + s.p.w / 2 < wall + 1.4 ? { lightSet: false } : { lightSet: true });
      yield* b.light(true, 60);
      yield* b.go(12.6);
      yield* b.jump(16.8, { after: through(14) });
      yield* b.go(17.5);
      yield* b.jump(17.5);                // shard
      yield* b.go(18.6);
      yield* b.jump(22.8, { after: through(20) });
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '빛의 탑', par: 30,
    signs: ['깜빡을 누른 채 뛰고, 위에서 떼세요'],
    rows: [
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '#..........o.#',
      '#............#',
      '#.D..........#',
      '###LLLLLLLLLL#',
      '#............#',
      '#LLLLLLLLLL###',
      '#............#',
      '####LLLLLLLLL#',
      '#............#',
      '#LLLLLLLLL####',
      '#.P?.........#',
      '##############',
    ],
    solve: function* (b) {
      const climb = function* (x) { yield* b.light(false); yield* b.jump(x, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) }); };
      yield* b.go(6);
      yield* climb(6);
      yield* b.go(11.2);
      yield* b.go(10.4);
      yield* climb(10.4);
      yield* b.go(2.6);
      yield* b.go(3.0);
      yield* climb(3.0);
      yield* b.go(11.6);
      yield* climb(11.5);
      yield* b.jump(11.5);                // shard
      yield* b.run(-1, s => s.cleared);
    },
  },
  {
    name: '위로, 옆으로', par: 20,
    rows: [
      '##############################',
      '##############################',
      '##############################',
      '##############################',
      '##############################',
      '##############################',
      '#..............L....L........#',
      '#..............L..o.L........#',
      '#..............L....L........#',
      '#..............L....L......D.#',
      '#LLLLLLLL###LLLLLLLLLLLLL#####',
      '#.P......###.............#####',
      '############^^^^^^^^^^^^^#####',
      '##############################',
    ],
    solve: function* (b) {
      const through = wall => s => (s.p.x + s.p.w / 2 < wall + 1.4 ? { lightSet: false } : { lightSet: true });
      yield* b.go(5);
      yield* b.light(false, 60);
      yield* b.jump(5, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(13.6);
      yield* b.jump(17.8, { after: through(15) });
      yield* b.go(18.5);
      yield* b.jump(18.5);                // shard
      yield* b.go(19.6);
      yield* b.jump(23.8, { after: through(20) });
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '손전등 시험', par: 25,
    rows: [
      '##################################',
      '#........#########################',
      '#........#########################',
      '#P.......#########################',
      '#####....#########################',
      '#####....#######...............###',
      '#####....#######...............###',
      '#####....#######............o..###',
      '#####LLLL#######...............###',
      '#####........L.................###',
      '#####........L.............LL..###',
      '#####........L.................H##',
      '#####LLLL#######LLLLLLLLLL########',
      '#####....#######..........########',
      '#####....#######^^^^^^^^^^########',
      '#####^^^^#########################',
      '##################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 90);
      yield* b.go(6.5);
      yield* b.until(s => onGround(s) && s.p.y > 5);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 8.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 10);
      yield* b.go(11.5);
      yield* b.light(false);              // through the light wall
      yield* b.go(15.4);
      yield* b.light(true, 30);           // the bridge
      yield* b.go(26.3);
      yield* b.jump(27.6);
      yield* b.jump(28.5);                // shard
      yield* b.go(30);
      yield* b.run(1, s => s.cleared);    // the hidden door
    },
  },
];
