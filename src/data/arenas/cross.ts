import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, CORNER_BLOCKS, SPAWNS } from './common';

/** A cross in the middle splits the field into four quarters with a gap at each end of its arms. */
export const CROSS: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 350, y: 280, width: 300, height: 40 },
    { x: 480, y: 150, width: 40, height: 300 },
    ...CORNER_BLOCKS,
  ],
  spawns: SPAWNS,
};
