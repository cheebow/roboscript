import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH } from './common';
import { CASTLE_SPAWNS } from './castle_common';

/** Two long walls split the middle ground into three lanes: teams choose where to push and where to hold. */
export const CASTLE_LANES: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 350, y: 180, width: 300, height: 25 },
    { x: 350, y: 395, width: 300, height: 25 },
  ],
  spawns: CASTLE_SPAWNS,
};
