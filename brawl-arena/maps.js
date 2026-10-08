// Maps are text. Only the top half (red side) is written; the bottom half is the same
// rows rotated 180°, so both teams get an identical, fair layout.
//   .  grass      #  wall (blocks walking and bullets)
//   ~  water (blocks walking, bullets fly over)      R  red spawn (becomes B for blue)

const TEAM_TOP = [
  '...................',
  '.....R...R...R.....',
  '...................',
  '..###.........###..',
  '...................',
  '.......#####.......',
  '~~.................',
  '~~....#.....#......',
  '......#.....#......',
  '..##.........##....',
  '..#...........~~~..',
  '.......##.##.......',
  '....#.........#....',
  '....#...~~~...#....',
];
const TEAM_MID = '...##....#....##...';

function mirror(top, mid) {
  const bottom = top.map(r => [...r].reverse().join('').replace(/R/g, 'B')).reverse();
  return [...top, mid, ...bottom];
}

export function parseMap(rows) {
  const h = rows.length, w = rows[0].length;
  const tiles = [], spawns = [[], []]; // [blue, red]
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`map row ${y} has ${rows[y].length} tiles, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === 'B') spawns[0].push({ x: x + 0.5, y: y + 0.5 });
      if (ch === 'R') spawns[1].push({ x: x + 0.5, y: y + 0.5 });
      tiles.push(ch === 'B' || ch === 'R' ? '.' : ch);
    }
  }
  // Blue spawns sorted left→right, red mirrored, so slot i faces slot i.
  spawns[0].sort((a, b) => a.x - b.x); spawns[1].sort((a, b) => b.x - a.x);
  return { w, h, tiles, spawns };
}

export const MAPS = {
  team: { name: '돌담 광장', rows: mirror(TEAM_TOP, TEAM_MID) },
};
