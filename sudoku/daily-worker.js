// Builds a daily puzzle off the main thread.
import { dailyPuzzle } from './logic.js';
self.onmessage = e => {
  const { id, date, kind } = e.data;
  try { self.postMessage({ id, result: dailyPuzzle(date, kind) }); }
  catch (err) { self.postMessage({ id, error: String(err) }); }
};
