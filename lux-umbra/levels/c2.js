// Chapter 2. Generated from puzzle rooms; map legend in ../levels.js. `solve` is the scripted solution the tests play.
import { onGround } from '../bot.js';

export default [
  {
    name: '그림자와 깜빡', par: 30,
    signs: ['그림자 블록은 빛을 받으면 사라져요', '그림자 바닥은 어둠에서만 밟혀요', '깜빡을 누르는 동안 불이 꺼져요', '공중에서 깜빡을 누르고 떼세요'],
    rows: [
      '####################################################',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###...............L..........................#',
      '#.....###......o........L..........................#',
      '#......S................L..........................#',
      '#......S................L..........................#',
      '#.P.?..S..?.........?...L.....?.................D..#',
      '############SSSSSSS###LLLLLLL###..L..S..L..S..######',
      '############.......###.......###..............######',
      '############^^^^^^^###^^^^^^^###^^^^^^^^^^^^^^######',
      '####################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(9.5);
      yield* b.light(false);
      yield* b.go(15.5); yield* b.jump(15.5);
      yield* b.go(19.5);
      yield* b.light(true, 60);
      yield* b.go(22.6);
      yield* b.jump(26.8, { after: s => (s.p.x + s.p.w / 2 < 25.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(29.5);
      yield* b.light(true, 60);
      yield* b.go(31.4);
      yield* b.jump(34.5);
      yield* b.jump(37.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(40.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(43.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(46.6);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '녹는 벽', par: 25,
    rows: [
      '####################################',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L...............#',
      '#...###............L..o............#',
      '#....S.............L.......S.......#',
      '#....S.............L.......S.......#',
      '#.P..S.............L.......S....D..#',
      '########SSSSSSSS#LLLLLLL##SSS#######',
      '########........#.......##...#######',
      '########^^^^^^^^#^^^^^^^##^^^#######',
      '####################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(7.5);
      yield* b.light(false);
      yield* b.go(16.5);
      yield* b.light(true, 60);
      yield* b.go(17.6);
      yield* b.jump(21.8, { after: s => (s.p.x + s.p.w / 2 < 20.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(22.5); yield* b.jump(22.5);
      yield* b.go(24.5);
      yield* b.light(true, 0);
      yield* b.go(25.6);
      yield* b.jump(30.5);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '디딤돌', par: 30,
    rows: [
      '#####################################################',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#...............................................###.#',
      '#............S.........o........................###.#',
      '#............S..................................###.#',
      '#.P..........S..................................H##.#',
      '####LLLLLL##SSS##..L..S..L..S..#SSSSSSSSS#SSSSSS#####',
      '####......##...##..............#.........#......#####',
      '####^^^^^^##^^^##^^^^^^^^^^^^^^#^^^^^^^^^#^^^^^^#####',
      '#####################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 30);
      yield* b.go(10.5);
      yield* b.light(true, 0);
      yield* b.go(11.6);
      yield* b.jump(16.5);
      yield* b.light(true, 60);
      yield* b.go(16.4);
      yield* b.jump(19.5);
      yield* b.jump(22.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(25.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(28.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(31.6);
      yield* b.light(false);
      yield* b.go(41.5);
      yield* b.go(41.4);
      yield* b.light(true, 0);
      yield* b.until(s => s.reveal[12 * s.w + 48] === 1);
      yield* b.light(false);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '빛의 탑', par: 40,
    rows: [
      '###############################################',
      '#...###.............########.###..............#',
      '#...###...........o.########.###..............#',
      '#...###......................###..............#',
      '#...###......................###..............#',
      '#...###.##LLLLLLLLLL###......###..............#',
      '#...###.............###......###..............#',
      '#...###.LLLLLLLLLL#####......###..............#',
      '#...###.............###......###..............#',
      '#...###.###LLLLLLLLL###LLLL..###..............#',
      '#....L..............###.......S...............#',
      '#....L..LLLLLLLLL######.......S...............#',
      '#.P..L..............###.......S............D..#',
      '#######################LLLL######SSSSSSSS######',
      '#######################....######........######',
      '#######################^^^^######^^^^^^^^######',
      '###############################################',
    ],
    solve: function* (b) {
      yield* b.light(false);
      yield* b.go(7.5);
      yield* b.go(13);
      yield* b.light(false, 90); yield* b.jump(13, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(18.4);
      yield* b.light(false, 90); yield* b.jump(18.4, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(10.0);
      yield* b.light(false, 90); yield* b.jump(10.0, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(18.6);
      yield* b.light(false, 90); yield* b.jump(18.6, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.jump(18.5);
      yield* b.light(true, 90);
      yield* b.go(21.5);
      yield* b.go(24.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(28.5);
      yield* b.light(true, 0);
      yield* b.go(32.5);
      yield* b.light(false);
      yield* b.go(41.5);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '어둠 건너기', par: 35,
    rows: [
      '############################################################',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..........................###.#',
      '#...###.....................L..o.......................###.#',
      '#....S......................L.......S..................###.#',
      '#....S......................L.......S..................###.#',
      '#.P..S..................C...L.......S..................H##.#',
      '########..L..S..L..S..####LLLLLLL##SSS##LLLLLLLL#SSSSSS#####',
      '########..............####.......##...##........#......#####',
      '########^^^^^^^^^^^^^^####^^^^^^^##^^^##^^^^^^^^#^^^^^^#####',
      '############################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(7.5);
      yield* b.light(true, 60);
      yield* b.go(7.4);
      yield* b.jump(10.5);
      yield* b.jump(13.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(16.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(19.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(22.6);
      yield* b.go(24.5);
      yield* b.light(true, 60);
      yield* b.go(26.6);
      yield* b.jump(30.8, { after: s => (s.p.x + s.p.w / 2 < 29.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(31.5); yield* b.jump(31.5);
      yield* b.go(33.5);
      yield* b.light(true, 0);
      yield* b.go(34.6);
      yield* b.jump(39.5);
      yield* b.light(true, 30);
      yield* b.go(48.5);
      yield* b.go(48.4);
      yield* b.light(true, 0);
      yield* b.until(s => s.reveal[12 * s.w + 55] === 1);
      yield* b.light(false);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '그림자 탑', par: 45,
    rows: [
      '#################################################################',
      '#........................########......L........................#',
      '#......................o.########......L........................#',
      '#......................................L........................#',
      '#......................................L........................#',
      '#............##SSSSSSSSSS###...........L........................#',
      '#........................###...........L........................#',
      '#............SSSSSSSSSS#####...........L........................#',
      '#........................###...........L........................#',
      '#............###SSSSSSSSS###SSSS.......L........................#',
      '#........................###...........L........................#',
      '#............SSSSSSSSS######...........L........................#',
      '#.P......................###.......C...L.....................D..#',
      '####SSSSSSSS################SSSS#####LLLLLLL#..L..S..L..S..######',
      '####........################....#####.......#..............######',
      '####^^^^^^^^################^^^^#####^^^^^^^#^^^^^^^^^^^^^^######',
      '#################################################################',
    ],
    solve: function* (b) {
      yield* b.light(false);
      yield* b.go(12.5);
      yield* b.go(18);
      yield* b.light(true, 90); yield* b.jump(18, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(23.4);
      yield* b.light(true, 90); yield* b.jump(23.4, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(15.0);
      yield* b.light(true, 90); yield* b.jump(15.0, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(23.6);
      yield* b.light(true, 90); yield* b.jump(23.6, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.jump(23.5);
      yield* b.light(false, 90);
      yield* b.go(26.5);
      yield* b.go(29.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(true);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(false);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(33.5);
      yield* b.go(35.5);
      yield* b.light(true, 60);
      yield* b.go(37.6);
      yield* b.jump(41.8, { after: s => (s.p.x + s.p.w / 2 < 40.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(44.5);
      yield* b.light(true, 60);
      yield* b.go(44.4);
      yield* b.jump(47.5);
      yield* b.jump(50.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(53.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(56.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(59.6);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '깜빡 계단', par: 55,
    rows: [
      '#####################################################################################',
      '#.......................................########............###.......###.......###.#',
      '#.....................................o.########............###.......###.......###.#',
      '#...........................................................###.......###.......###.#',
      '#...........................................................###.......###.......###.#',
      '#..............###..........##LLLLLLLLLL###.................###.......###.......###.#',
      '#..............###......................###.................###.......###.......###.#',
      '#...........LL.###..........LLLLLLLLLL#####.................###.......###.......###.#',
      '#..............###......................###.................###.......###.......###.#',
      '#........LL....###..........###LLLLLLLLL###LLLL.............###.......###.......###.#',
      '#..............###...S..................###..................L.........L........###.#',
      '#.....LL.......###...S......LLLLLLLLL######..................L.........L........###.#',
      '#.P............###...S....C.............###..................L.........L........H##.#',
      '#####^^^^^^^^^^#####SSS####################LLLL##SSSSSSSSSS####LLLLLL#####SSSSSS#####',
      '####################...####################....##..........####......#####......#####',
      '####################^^^####################^^^^##^^^^^^^^^^####^^^^^^#####^^^^^^#####',
      '#####################################################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, -45);
      yield* b.go(4.5);
      yield* b.jump(6.9);
      yield* b.jump(9.9);
      yield* b.jump(12.9);
      yield* b.jump(15.8);
      yield* b.go(18.6);
      yield* b.until(onGround);
      yield* b.light(true, 0);
      yield* b.go(19.6);
      yield* b.jump(24.5);
      yield* b.go(26.5);
      yield* b.go(33);
      yield* b.light(false, 90); yield* b.jump(33, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(38.4);
      yield* b.light(false, 90); yield* b.jump(38.4, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(30.0);
      yield* b.light(false, 90); yield* b.jump(30.0, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(38.6);
      yield* b.light(false, 90); yield* b.jump(38.6, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.jump(38.5);
      yield* b.light(true, 90);
      yield* b.go(41.5);
      yield* b.go(44.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(48.5);
      yield* b.light(false);
      yield* b.go(59.5);
      yield* b.light(false);
      yield* b.go(62.6);
      yield* b.light(true, 30);
      yield* b.go(69.6);
      yield* b.light(false);
      yield* b.go(73.5);
      yield* b.go(73.4);
      yield* b.light(true, 0);
      yield* b.until(s => s.reveal[12 * s.w + 80] === 1);
      yield* b.light(false);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '두 탑', par: 70,
    rows: [
      '###################################################################################################',
      '#....................L....................########.###................########....................#',
      '#....................L..................o.########.###................########....................#',
      '#....................L.............................###............................................#',
      '#....................L.............................###............................................#',
      '#....................L........##SSSSSSSSSS###......###....##LLLLLLLLLL###.........................#',
      '#....................L....................###......###................###.........................#',
      '#....................L........SSSSSSSSSS#####......###....LLLLLLLLLL#####.........................#',
      '#....................L....................###......###................###.........................#',
      '#....................L........###SSSSSSSSS###SSSS..###....###LLLLLLLLL###LLLL.....................#',
      '#....................L....................###.......S.................###.........................#',
      '#....................L........SSSSSSSSS######.......S.....LLLLLLLLL######.........................#',
      '#.P..................L......C.............###.......S...C.............###......................D..#',
      '####..L..S..L..S..#LLLLLLL###################SSSS########################LLLL##..L..S..L..S..######',
      '####..............#.......###################....########################....##..............######',
      '####^^^^^^^^^^^^^^#^^^^^^^###################^^^^########################^^^^##^^^^^^^^^^^^^^######',
      '###################################################################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 60);
      yield* b.go(3.4);
      yield* b.jump(6.5);
      yield* b.jump(9.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(12.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(15.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(18.6);
      yield* b.light(true, 60);
      yield* b.go(19.6);
      yield* b.jump(23.8, { after: s => (s.p.x + s.p.w / 2 < 22.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(26.5);
      yield* b.go(28.5);
      yield* b.go(35);
      yield* b.light(true, 90); yield* b.jump(35, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(40.4);
      yield* b.light(true, 90); yield* b.jump(40.4, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(32.0);
      yield* b.light(true, 90); yield* b.jump(32.0, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(40.6);
      yield* b.light(true, 90); yield* b.jump(40.6, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.jump(40.5);
      yield* b.light(false, 90);
      yield* b.go(43.5);
      yield* b.go(46.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(true);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(false);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(50.5);
      yield* b.light(true, 0);
      yield* b.go(54.5);
      yield* b.go(56.5);
      yield* b.go(63);
      yield* b.light(false, 90); yield* b.jump(63, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(68.4);
      yield* b.light(false, 90); yield* b.jump(68.4, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(60.0);
      yield* b.light(false, 90); yield* b.jump(60.0, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(68.6);
      yield* b.light(false, 90); yield* b.jump(68.6, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.light(true, 90);
      yield* b.go(71.5);
      yield* b.go(74.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(78.5);
      yield* b.light(true, 60);
      yield* b.go(78.4);
      yield* b.jump(81.5);
      yield* b.jump(84.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(87.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(90.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(93.6);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '밤의 다리', par: 55,
    rows: [
      '############################################################################################',
      '#...........L...................................########...............###.............###.#',
      '#...........L...................................########...............###.............###.#',
      '#...........L..........................................................###.............###.#',
      '#...........L..........................................................###.............###.#',
      '#...........L.......................##LLLLLLLLLL###....................###.............###.#',
      '#...........L...................................###....................###.............###.#',
      '#...........L.......................LLLLLLLLLL#####....................###.............###.#',
      '#...........L...................................###....................###.............###.#',
      '#...........L.......................###LLLLLLLLL###LLLL................###.............###.#',
      '#.....S.....L...........o.......................###.....................S....S.........###.#',
      '#.....S.....L.......................LLLLLLLLL######.....................S....S.........###.#',
      '#.P...S.....L.....................C.............###..................C..S....S.........H##.#',
      '#####SSS##LLLLLLL#..L..S..L..S..###################LLLL##SSSSSSSSSS#########SSS##SSSSSS#####',
      '#####...##.......#..............###################....##..........#########...##......#####',
      '#####^^^##^^^^^^^#^^^^^^^^^^^^^^###################^^^^##^^^^^^^^^^#########^^^##^^^^^^#####',
      '############################################################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(4.6);
      yield* b.jump(9.5);
      yield* b.light(true, 60);
      yield* b.go(10.6);
      yield* b.jump(14.8, { after: s => (s.p.x + s.p.w / 2 < 13.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(17.5);
      yield* b.light(true, 60);
      yield* b.go(17.4);
      yield* b.jump(20.5);
      yield* b.jump(23.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(26.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(29.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(32.6);
      yield* b.go(34.5);
      yield* b.go(41);
      yield* b.light(false, 90); yield* b.jump(41, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(46.4);
      yield* b.light(false, 90); yield* b.jump(46.4, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(38.0);
      yield* b.light(false, 90); yield* b.jump(38.0, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(46.6);
      yield* b.light(false, 90); yield* b.jump(46.6, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.light(true, 90);
      yield* b.go(49.5);
      yield* b.go(52.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(56.5);
      yield* b.light(false);
      yield* b.go(67.5);
      yield* b.go(69.5);
      yield* b.light(true, 0);
      yield* b.go(74.5);
      yield* b.light(true, 0);
      yield* b.go(75.6);
      yield* b.jump(80.5);
      yield* b.go(80.4);
      yield* b.light(true, 0);
      yield* b.until(s => s.reveal[12 * s.w + 87] === 1);
      yield* b.light(false);
      yield* b.run(1, s => s.cleared);
    },
  },

  {
    name: '그림자 시험', par: 80,
    rows: [
      '##########################################################################################################################',
      '#...###...............................########...L....................########...........................L...........###.#',
      '#...###...............................########...L....................########...........................L...........###.#',
      '#...###..........................................L.......................................................L...........###.#',
      '#...###..........................................L.......................................................L...........###.#',
      '#...###...................##LLLLLLLLLL###........L........##SSSSSSSSSS###................................L...........###.#',
      '#...###...............................###........L....................###................................L...........###.#',
      '#...###...................LLLLLLLLLL#####........L........SSSSSSSSSS#####................................L...........###.#',
      '#...###...............................###........L....................###................................L...........###.#',
      '#...###...................###LLLLLLLLL###LLLL....L........###SSSSSSSSS###SSSS....o.......................L...........###.#',
      '#....S................................###........L....................###........S.......................L...........###.#',
      '#....S....................LLLLLLLLL######........L........SSSSSSSSS######........S.......................L...........###.#',
      '#.P..S..................C.............###........L......C.............###........S....C..................L...........H##.#',
      '########..L..S..L..S..###################LLLL##LLLLLLL###################SSSS###SSS#####..L..S..L..S..#LLLLLLL#SSSSSS#####',
      '########..............###################....##.......###################....###...#####..............#.......#......#####',
      '########^^^^^^^^^^^^^^###################^^^^##^^^^^^^###################^^^^###^^^#####^^^^^^^^^^^^^^#^^^^^^^#^^^^^^#####',
      '##########################################################################################################################',
    ],
    solve: function* (b) {
      yield* b.light(true, 0);
      yield* b.go(7.5);
      yield* b.light(true, 60);
      yield* b.go(7.4);
      yield* b.jump(10.5);
      yield* b.jump(13.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(16.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(19.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(22.6);
      yield* b.go(24.5);
      yield* b.go(31);
      yield* b.light(false, 90); yield* b.jump(31, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(36.4);
      yield* b.light(false, 90); yield* b.jump(36.4, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(28.0);
      yield* b.light(false, 90); yield* b.jump(28.0, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.go(36.6);
      yield* b.light(false, 90); yield* b.jump(36.6, { after: s => (s.p.vy > -2 ? { lightSet: true } : null) });
      yield* b.light(true, 90);
      yield* b.go(39.5);
      yield* b.go(42.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(false);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(true);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(46.5);
      yield* b.light(true, 60);
      yield* b.go(47.6);
      yield* b.jump(51.8, { after: s => (s.p.x + s.p.w / 2 < 50.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(54.5);
      yield* b.go(56.5);
      yield* b.go(63);
      yield* b.light(true, 90); yield* b.jump(63, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(68.4);
      yield* b.light(true, 90); yield* b.jump(68.4, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(60.0);
      yield* b.light(true, 90); yield* b.jump(60.0, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.go(68.6);
      yield* b.light(true, 90); yield* b.jump(68.6, { after: s => (s.p.vy > -2 ? { lightSet: false } : null) });
      yield* b.light(false, 90);
      yield* b.go(71.5);
      yield* b.go(74.6);
      yield* b.until(s => onGround(s) && s.p.y > 7);
      yield* b.light(true);
      yield* b.until(s => s.p.y > 9.3);
      yield* b.light(false);
      yield* b.until(s => onGround(s) && s.p.y > 11);
      yield* b.go(78.5);
      yield* b.light(true, 0);
      yield* b.go(79.6);
      yield* b.jump(84.5);
      yield* b.go(86.5);
      yield* b.light(true, 60);
      yield* b.go(87.4);
      yield* b.jump(90.5);
      yield* b.jump(93.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(96.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
      yield* b.jump(99.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
      yield* b.jump(102.6);
      yield* b.light(true, 60);
      yield* b.go(103.6);
      yield* b.jump(107.8, { after: s => (s.p.x + s.p.w / 2 < 106.4 ? { lightSet: false } : { lightSet: true }) });
      yield* b.go(110.5);
      yield* b.go(110.4);
      yield* b.light(true, 0);
      yield* b.until(s => s.reveal[12 * s.w + 117] === 1);
      yield* b.light(false);
      yield* b.run(1, s => s.cleared);
    },
  },

];
