import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, CORNER_BLOCKS, SPAWNS } from './common';

/** Nothing in the middle: the robots see each other from the start and fight head-on. */
export const OPEN_FIELD: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [...CORNER_BLOCKS],
  spawns: SPAWNS,
};
