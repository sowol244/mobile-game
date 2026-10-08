// Each stage's scripted solution lives next to its map (levels/c*.js, field `solve`).
import { LEVELS } from './levels.js';

export const SOLUTIONS = Object.fromEntries(LEVELS.map(L => [L.id, L.solve]));
