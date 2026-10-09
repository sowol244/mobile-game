// Chapter 2. Map legend in ../levels.js. `solve` is the scripted solution the tests play.
import { onGround } from '../bot.js';

export default [
  {
    name: '그림자 벽', par: 15,
    signs: ['그림자 블록은 빛을 받으면 사라져요'],
    rows: [
      '######################',
      '######################',
      '######################',
      '######################',
      '#......S....o..S.....#',
      '#......S.......S.....#',
      '#P?....S.......S...D.#',
      '######################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(10);
      yield* b.jump(12.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 바닥', par: 20,
    signs: ['그림자 바닥은 어둠에서만 밟혀요'],
    rows: [
      '##########################',
      '##########################',
      '########....o...##########',
      '########........##########',
      '#....S...................#',
      '#....S......S............#',
      '#P...S..?...............D#',
      '#########SSSSSSSS#########',
      '#########^^^^^^^^#########',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(7.5);
      yield* b.light(false);              // dark: the shadow floor holds
      yield* b.go(11.2);
      yield* b.jump(12.4);
      yield* b.jump(12.5);                // shard
      yield* b.go(15.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '녹는 벽', par: 25,
    signs: ['그림자 블록은 빛을 받으면 사라져요', '그림자 바닥은 어둠에서만 밟혀요', '빛을 켠 채 뛰어넘으세요'],
    rows: [
      '#####################################',
      '#####################################',
      '##############.......################',
      '##############...o...################',
      '#......#######.......#.......#......#',
      '#......S.................S..........#',
      '#......S........S........S..........#',
      '#.P..?.S.?...........?...S........D.#',
      '###########SSSS#########SSS##########',
      '###########....#########...##########',
      '###########^^^^#########^^^##########',
      '#####################################',
    ],
    solve: function* (b) {
      yield* b.go(5.5);
      yield* b.light(true, 0);            // the shadow wall melts
      yield* b.go(9.5);
      yield* b.light(false);              // dark again: the shadow floor holds
      yield* b.go(15.3);
      yield* b.jump(16.4);                // onto the shadow step
      yield* b.jump(17.6);                // shard, land below
      yield* b.go(23.6);
      yield* b.light(true, 0);
      yield* b.jump(28.5);                // through the melted wall, over the vanished floor
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 상자', par: 15,
    signs: ['빛을 켜면 바닥도 바뀌어요'],
    rows: [
      '##################',
      '#................#',
      '#.....SSSSS......#',
      '#.....S...S......#',
      '#.....S?P.S......#',
      '#.....SSSSS......#',
      '#..o.............#',
      '#..SS............#',
      '#...............D#',
      '###LLLLLLLLLLLL###',
      '###............###',
      '###^^^^^^^^^^^^###',
      '##################',
    ],
    solve: function* (b) {
      yield* b.light(true, 90);           // the cage melts, the light floor catches you
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.go(5.6);
      yield* b.jump(3.8, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) }); // land on the shadow ledge: shard
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 7.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '공중 점멸', par: 20,
    signs: ['떨어지면서 손전등을 켜 보세요', '공중에서 깜빡을 누르고 떼며 디딤돌을 고르세요'],
    rows: [
      '##################################',
      '#......###########################',
      '#......###########################',
      '#.P.?.....########################',
      '#######...########################',
      '#######...#####..................#',
      '#######...#####..................#',
      '#######LLL#####..................#',
      '#######...#####..................#',
      '#######..........................#',
      '#######...............o..........#',
      '#######.....?C.................D.#',
      '#######LLL#####..L..S..L..########',
      '#######...#####...........########',
      '#######^^^#####^^^^^^^^^^^########',
      '##################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 90);
      yield* b.go(8.5);
      yield* b.until(s => onGround(s) && s.p.y > 5);
      yield* b.light(false);              // drop through the first light floor
      yield* b.until(s => s.p.y > 8.3);
      yield* b.light(true);               // catch the second one
      yield* b.until(s => onGround(s) && s.p.y > 10);
      b.aim = 60;
      yield* b.go(14.3);
      yield* b.jump(17.5);
      yield* b.jump(20.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(23.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null), airMx: null });
      yield* b.jump(27.5);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '골라 내리기', par: 20,
    signs: ['켜면 빛 바닥, 끄면 그림자 바닥'],
    rows: [
      '################',
      '#........#######',
      '#P?......#######',
      '#####.....######',
      '#####.....######',
      '#####LLLLL######',
      '###.......######',
      '###o......######',
      '#####SSSSS######',
      '#####.....######',
      '#####.....######',
      '#####LLLLL######',
      '#####.....######',
      '#####.........D#',
      '#####SSSSS######',
      '#####.....######',
      '#####.....######',
      '#####.....######',
      '#####^^^^^######',
      '################',
    ],
    solve: function* (b) {
      yield* b.go(7);
      yield* b.until(s => onGround(s) && s.p.y > 6);
      yield* b.go(3.5);                   // shard pocket
      yield* b.go(7);
      yield* b.light(true, 90);
      yield* b.until(s => onGround(s) && s.p.y > 9);
      yield* b.light(false);
      yield* b.until(s => onGround(s) && s.p.y > 12);
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 탑', par: 30,
    signs: ['뛰어오른 뒤 위에서 깜빡을 누르세요'],
    rows: [
      '##############',
      '##############',
      '##############',
      '##############',
      '##############',
      '#..........o.#',
      '#............#',
      '#.D..........#',
      '###SSSSSSSSSS#',
      '#............#',
      '#SSSSSSSSSS###',
      '#............#',
      '####SSSSSSSSS#',
      '#............#',
      '#SSSSSSSSS####',
      '#.P?.........#',
      '##############',
    ],
    solve: function* (b) {
      const climb = function* (x) { yield* b.light(true, 90); yield* b.jump(x, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) }); };
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
    name: '먼 문', par: 15,
    signs: ['먼 곳은 손전등으로 비춰 보세요'],
    rows: [
      '##################',
      '##################',
      '##################',
      '########...o..####',
      '#.............####',
      '#.............####',
      '#P?...........H###',
      '########SSSSSS####',
      '########^^^^^^####',
      '##################',
    ],
    solve: function* (b) {
      yield* b.go(7.4);
      yield* b.light(true, 0);
      yield* b.until(s => s.reveal[6 * s.w + 14] === 1);
      yield* b.light(false);
      yield* b.go(11.5);
      yield* b.jump(11.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자에서 빛으로', par: 20,
    signs: ['깜빡을 누른 채 뛰고, 다리 위에서 떼세요'],
    rows: [
      '##########################',
      '##########################',
      '#........................#',
      '#.................o......#',
      '#........................#',
      '#......................D.#',
      '#..........SS.LLLLLLLL####',
      '#........................#',
      '#.......SS...............#',
      '#........................#',
      '#....SS..................#',
      '#P?......................#',
      '####^^^^^^^^^^^^^^^^^^^^^#',
      '##########################',
    ],
    solve: function* (b) {
      yield* b.go(3.3);
      yield* b.jump(5.8);
      yield* b.jump(8.8);
      yield* b.jump(11.8);
      yield* b.go(12.4);
      b.aim = 60;
      yield* b.jump(16, { after: s => (s.p.x > 12.9 ? { lightSet: true } : null) });
      yield* b.go(18.2);
      yield* b.jump(18.5);                // shard
      yield* b.run(1, s => s.cleared);
    },
  },
  {
    name: '그림자 시험', par: 20,
    rows: [
      '##############################',
      '#.........................####',
      '#...SSSSS.................####',
      '#...S...S.................####',
      '#...S.P.S.................####',
      '#...SSSSS......o..........####',
      '#.........................####',
      '#.........................H###',
      '#LLLLLLLLLL##SSSSSS##LLLL#####',
      '#..........##......##....#####',
      '#^^^^^^^^^^##^^^^^^##^^^^#####',
      '##############################',
    ],
    solve: function* (b) {
      yield* b.light(true, 15);
      yield* b.until(s => onGround(s) && s.p.y > 6);
      yield* b.go(12);
      yield* b.light(false);
      yield* b.go(15.5);
      yield* b.jump(15.5);                // shard
      yield* b.go(19.6);
      yield* b.light(true);               // finds the door and the bridge
      yield* b.run(1, s => s.cleared);
    },
  },
];
