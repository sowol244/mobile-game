// Runs the BFS solver off the main thread (hints and the daily puzzle) so the page never freezes on a phone.
import { solve, dailyStage } from './logic.js';

self.onmessage = e => {
  const { id, type } = e.data;
  let result = null;
  try {
    if (type === 'solve') {
      const s = e.data.state;
      const r = solve({ n: s.n, codes: new Uint8Array(s.codes), target: s.target, goal: s.goal }, { maxDepth: s.maxDepth, maxStates: 1500000 });
      result = r && { depth: r.depth, path: r.path, aborted: !!r.aborted };
    } else if (type === 'daily') result = dailyStage(e.data.day);
  } catch (err) { result = { error: String(err) }; }
  self.postMessage({ id, result });
};
