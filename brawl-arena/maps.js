// Maps are text. Only the top half (red side) is written; the bottom half is the same
// rows rotated 180°, so both teams get an identical, fair layout.
//   .  grass      #  wall (blocks walking and bullets)
//   ~  water (blocks walking, bullets fly over)      *  bush (hides whoever stands in it)
//   R  red spawn (becomes B for blue)

const TEAM_TOP = [
  '...................',
  '.....R...R...R.....',
  '...................',
  '..###.........###..',
  '.***...........***.',
  '.......#####.......',
  '~~..........***....',
  '~~....#.....#......',
  '......#.***.#......',
  '..##.........##....',
  '..#...........~~~..',
  '.......##.##.......',
  '....#..**.....#....',
  '....#...~~~...#....',
];
const TEAM_MID = '...##.**.#.**.##...';

function mirror(top, mid) {
  const bottom = top.map(r => [...r].reverse().join('').replace(/R/g, 'B')).reverse();
  return [...top, mid, ...bottom];
}

// Survival map: only the top-left quarter is written (13×13, the last row/column are the centre lines);
// it is mirrored left↔right and top↔bottom. S = a start spot, X = power box.
const SURV_QUARTER = [
  '.............',
  '.............',
  '..S....**....',
  '.......**....',
  '..##.........',
  '..#....X.....',
  '....~~....#..',
  '....~~....#..',
  '..........#..',
  '...**...X....',
  '...**........',
  '.......##....',
  '.S..X........',
];
function mirror4(q) {
  const n = q.length, size = n * 2 - 1, rows = [];
  for (let y = 0; y < size; y++) {
    const qy = y < n ? y : size - 1 - y;
    let r = '';
    for (let x = 0; x < size; x++) r += q[qy][x < n ? x : size - 1 - x];
    rows.push(r);
  }
  return rows;
}

export function parseMap(rows) {
  const h = rows.length, w = rows[0].length;
  const tiles = [], spawns = [[], []], starts = []; // spawns: [blue, red]; starts: survival start spots
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`map row ${y} has ${rows[y].length} tiles, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === 'B') spawns[0].push({ x: x + 0.5, y: y + 0.5 });
      if (ch === 'R') spawns[1].push({ x: x + 0.5, y: y + 0.5 });
      if (ch === 'S') starts.push({ x: x + 0.5, y: y + 0.5 });
      tiles.push(ch === 'B' || ch === 'R' || ch === 'S' ? '.' : ch);
    }
  }
  // Blue spawns sorted left→right, red mirrored, so slot i faces slot i.
  spawns[0].sort((a, b) => a.x - b.x); spawns[1].sort((a, b) => b.x - a.x);
  // Survival start spots in a ring order (by angle around the centre), so neighbours aren't on top of each other.
  starts.sort((a, b) => Math.atan2(a.y - h / 2, a.x - w / 2) - Math.atan2(b.y - h / 2, b.x - w / 2));
  return { w, h, tiles, spawns, starts };
}

export const MAPS = {
  team: { name: '돌담 광장', rows: mirror(TEAM_TOP, TEAM_MID) },
  survival: { name: '독구름 숲', rows: mirror4(SURV_QUARTER) },
  // Small practice yard for the tutorial: one dummy (R) to shoot at, a wall and a bush.
  tutorial: {
    name: '연습장',
    rows: [
      '.............',
      '.............',
      '......R......',
      '.............',
      '..###....***.',
      '.........***.',
      '.............',
      '...~~........',
      '.............',
      '.............',
      '.............',
      '......B......',
      '.............',
    ],
    marker: { x: 9.5, y: 8.5 }, // where the "walk here" step points
  },
};
