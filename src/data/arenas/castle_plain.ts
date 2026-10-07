import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH } from './common';
import { CASTLE_SPAWNS } from './castle_common';

/** Open ground between the castles: the plainest test of rushing and defending. */
export const CASTLE_PLAIN: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [],
  spawns: CASTLE_SPAWNS,
};
