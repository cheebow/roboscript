import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, SPAWNS } from './common';

/** Each robot starts behind a wall of its own, with open ground between the two walls. */
export const BUNKERS: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 250, y: 200, width: 30, height: 200 },
    { x: 720, y: 200, width: 30, height: 200 },
  ],
  spawns: SPAWNS,
};
