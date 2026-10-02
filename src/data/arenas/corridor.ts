import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, SPAWNS } from './common';

/**
 * Two long walls make three lanes. The robots face each other down the middle
 * one, which is too narrow to get out of the line of fire; the outer lanes
 * lead around.
 */
export const CORRIDOR: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 250, y: 190, width: 500, height: 30 },
    { x: 250, y: 380, width: 500, height: 30 },
  ],
  spawns: SPAWNS,
};
