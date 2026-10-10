// BETA rules: chain merging and extra goals. Importing this file installs them into logic.js through `ext`;
// they only apply to states whose options say so (state.opts = { chain: true, goal: {...} }), so the normal game never sees them.
import { ext, DIRS, EMPTY, NUM, PIN, ONCE, isNum, isGate } from './logic.js';

// Chain merge: after a merge at cell j, the merged tile absorbs an equal neighbour (checked up, right, down, left),
// which doubles it again and may open a gate; repeat until no equal neighbour is left. No extra move is spent.
// Pinned neighbours are never absorbed. Mutates `out`, pushes opened gate cells into `opened`, returns the steps.
function chain(out, n, j, opened) {
  const steps = [];
  for (;;) {
    const e = out[j] & 15, r = (j / n) | 0, c = j % n;
    if (e >= 13) return steps;
    let hit = -1;
    for (const [dr, dc] of DIRS) {
      const r2 = r + dr, c2 = c + dc;
      if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) continue;
      const k = r2 * n + c2, t = out[k];
      if (isNum(t) && (t & 15) === e && (t < PIN || t >= ONCE)) { hit = k; break; }
    }
    if (hit < 0) return steps;
    out[hit] = EMPTY; out[j] += 1;
    const step = { cell: hit, exp: e + 1, opened: [] };
    for (let k = 0; k < out.length; k++) if (isGate(out[k]) && out[k] - 2 === e + 1) { out[k] = EMPTY; step.opened.push(k); opened.push(k); }
    steps.push(step);
  }
}

// Goals (opts.goal.kind):
//   one    merge every number tile into a single tile
//   exit   bring the marked tile (token "k", value 1, it never merges) to the exit cell goal.cell = [row, col]
//   count  have goal.n tiles of value goal.value at the same time
//   line   every number tile lies in one row or column: goal.axis 'row' | 'col', goal.index
function win(codes, opts) {
  const g = opts.goal, n = Math.round(Math.sqrt(codes.length));
  if (g.kind === 'exit') return codes[g.cell[0] * n + g.cell[1]] === NUM;
  const e = g.kind === 'count' ? Math.round(Math.log2(g.value)) : 0;
  let tiles = 0;
  for (let k = 0; k < codes.length; k++) {
    const c = codes[k];
    if (!isNum(c)) continue;
    if (g.kind === 'one') { if (++tiles > 1) return false; }
    else if (g.kind === 'count') { if ((c & 15) === e && ++tiles >= g.n) return true; }
    else if (g.kind === 'line') { if ((g.axis === 'row' ? (k / n) | 0 : k % n) !== g.index) return false; tiles++; }
  }
  return g.kind === 'count' ? false : tiles > 0;
}

ext.chain = chain;
ext.win = win;
export { chain, win };
