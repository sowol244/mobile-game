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

// ---------- stages 2–5: generated maps ----------
// Stage 1 of each mode uses the hand-made map above; later stages get their own layout (built from a
// fixed seed, so a stage always looks the same) and their own colour theme (art.js THEMES, by index).
const STAGE_NAMES = {
  team: ['돌담 광장', '단풍 갈림길', '눈밭 요새', '모래 협곡', '용암 다리'],
  survival: ['독구름 숲', '낙엽 숲', '설원', '사막 오아시스', '화산섬'],
};

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Every open tile reachable from every other, and not too cramped.
function playable(rows) {
  const m = parseMap(rows), open = i => !['#', '~', 'X'].includes(m.tiles[i]);
  const total = m.tiles.filter((t, i) => open(i)).length;
  if (total < m.tiles.length * 0.78) return false;
  const start = m.tiles.findIndex((t, i) => open(i)), seen = new Set([start]), q = [start];
  while (q.length) {
    const c = q.pop(), x = c % m.w, y = (c - x) / m.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * m.w + nx;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(n) || !open(n)) continue;
      seen.add(n); q.push(n);
    }
  }
  return seen.size === total;
}

function scatter(g, rand, { x0, y0, x1, y1, keep }) {
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const put = (x, y, ch) => { if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && g[y][x] === '.' && !keep(x, y)) g[y][x] = ch; };
  const rect = (x, y, w, h, ch) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, ch); };
  for (let k = ri(6, 8); k > 0; k--) {
    const t = rand(), x = ri(x0, x1), y = ri(y0, y1);
    if (t < 0.35) rect(x, y, ri(2, 5), 1, '#');
    else if (t < 0.6) rect(x, y, 1, ri(2, 3), '#');
    else if (t < 0.8) { rect(x, y, 2, 1, '#'); put(x, y + 1, '#'); }
    else rect(x, y, 2, 2, '#');
  }
  for (let k = 2; k > 0; k--) rect(ri(x0, x1 - 2), ri(y0 + 2, y1 - 1), ri(2, 3), ri(1, 2), '~');
  for (let k = ri(3, 4); k > 0; k--) rect(ri(x0, x1 - 2), ri(y0, y1 - 1), ri(2, 3), 2, '*');
  return ri;
}

function genTeam(rand) {
  const g = Array.from({ length: 14 }, () => Array(19).fill('.'));
  for (const x of [5, 9, 13]) g[1][x] = 'R';
  scatter(g, rand, { x0: 0, y0: 3, x1: 18, y1: 13, keep: () => false });
  let half = '';
  for (let i = 0; i < 9; i++) half += rand() < 0.15 ? '#' : rand() < 0.18 ? '*' : '.';
  const mid = half + (rand() < 0.4 ? '#' : '.') + [...half].reverse().join('');
  return mirror(g.map(r => r.join('')), mid);
}

function genSurvival(rand) {
  const g = Array.from({ length: 13 }, () => Array(13).fill('.'));
  const starts = [[2, 2], [1, 12]];
  for (const [x, y] of starts) g[y][x] = 'S';
  const near = (x, y) => starts.some(([sx, sy]) => Math.abs(sx - x) <= 2 && Math.abs(sy - y) <= 2);
  const ri = scatter(g, rand, { x0: 0, y0: 0, x1: 12, y1: 12, keep: near });
  // Power boxes: 2 in the quarter (×4) + 1 on the centre row (×2) = 10.
  let boxes = 0;
  for (let tries = 0; boxes < 2 && tries < 200; tries++) { const x = ri(3, 10), y = ri(3, 10); if (g[y][x] === '.' && !near(x, y)) { g[y][x] = 'X'; boxes++; } }
  for (let tries = 0; tries < 200; tries++) { const x = ri(4, 10); if (g[12][x] === '.' && !near(x, 12)) { g[12][x] = 'X'; break; } }
  return mirror4(g.map(r => r.join('')));
}

const stageCache = new Map();
export function stageMap(mode, stage) {
  const key = `${mode}:${stage}`;
  if (stageCache.has(key)) return stageCache.get(key);
  const name = STAGE_NAMES[mode][stage - 1];
  let def;
  if (stage === 1) def = { ...MAPS[mode], name, theme: 0 };
  else {
    for (let seed = stage * 977 + (mode === 'team' ? 1 : 2); ; seed += 101) {
      const rows = (mode === 'team' ? genTeam : genSurvival)(seeded(seed));
      const ok = playable(rows) && (mode === 'team' || rows.join('').split('X').length - 1 === 10);
      if (ok) { def = { name, rows, theme: stage - 1 }; break; }
    }
  }
  stageCache.set(key, def);
  return def;
}
