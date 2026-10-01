import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, CORNER_BLOCKS, SPAWNS } from './common';

/**
 * A wide block in the middle hides the robots from each other and has to be
 * driven around. It is wide enough that robots coming around it meet outside
 * firing distance, with time to turn towards each other first.
 */
export const CENTER_BLOCK: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [{ x: 300, y: 255, width: 400, height: 90 }, ...CORNER_BLOCKS],
  spawns: SPAWNS,
};
