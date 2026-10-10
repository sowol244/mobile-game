// Each stage's scripted solutions live next to its map (levels/c*.js):
//   solve — the main path: clears the stage and takes only the first light shard
//   full  — the same route plus the hidden routes: takes all three shards
import { LEVELS } from './levels.js';

export const MAIN_SOLUTIONS = Object.fromEntries(LEVELS.map(L => [L.id, L.solve]));
export const SOLUTIONS = Object.fromEntries(LEVELS.map(L => [L.id, L.full]));
