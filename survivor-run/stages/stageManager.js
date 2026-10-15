import { STAGE_01 } from './stage01.js?v=20261015o';
import { STAGE_02 } from './stage02.js?v=20261015o';

export const DEFAULT_STAGE_ID = STAGE_01.id;
export const STAGE_DEFINITIONS = Object.freeze([STAGE_01, STAGE_02]);

export function getStageDefinition(stageId = DEFAULT_STAGE_ID) {
  return STAGE_DEFINITIONS.find(stage => stage.id === stageId) || STAGE_01;
}

export function createStageRuntime(stageId = DEFAULT_STAGE_ID) {
  const stage = getStageDefinition(stageId);
  return { stageId: stage.id, waveIndex: 0, waveSpawned: 0, eventIndex: 0 };
}

export function collectStageActions(game) {
  const stage = game.stageDefinition;
  const runtime = game.stageRuntime;
  const actions = [];
  let activeZombies = game.zombies.reduce((count, zombie) => count + (zombie.dead ? 0 : 1), 0);

  while (runtime.waveIndex < stage.waves.length) {
    const wave = stage.waves[runtime.waveIndex];
    if (runtime.waveSpawned >= wave.count) {
      runtime.waveIndex++;
      runtime.waveSpawned = 0;
      continue;
    }
    const spawnAt = wave.start + runtime.waveSpawned * wave.interval;
    if (game.t < spawnAt || activeZombies >= stage.maxActiveZombies) break;
    actions.push({
      type: 'zombie',
      kind: wave.pattern[runtime.waveSpawned % wave.pattern.length],
      lane: wave.lanes?.[runtime.waveSpawned],
    });
    runtime.waveSpawned++;
    activeZombies++;
  }

  while (runtime.eventIndex < stage.events.length && game.t >= stage.events[runtime.eventIndex].at) {
    const { at, ...event } = stage.events[runtime.eventIndex++];
    actions.push(event);
  }
  return actions;
}
