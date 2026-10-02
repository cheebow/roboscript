import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, SPAWNS } from './common';

/** One wall down from the top and one up from the bottom: the way across bends twice. */
export const ZIGZAG: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 380, y: 0, width: 40, height: 380 },
    { x: 580, y: 220, width: 40, height: 380 },
  ],
  spawns: SPAWNS,
};
