import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, SPAWNS } from './common';

/** Nothing at all: no cover, and all the room in the world to drive. */
export const BARE_GROUND: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [],
  spawns: SPAWNS,
};
