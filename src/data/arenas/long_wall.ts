import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, CORNER_BLOCKS, SPAWNS } from './common';

/** A tall, thin wall in the middle: a long way around, and a fight at close quarters where the robots meet. */
export const LONG_WALL: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [{ x: 480, y: 150, width: 40, height: 300 }, ...CORNER_BLOCKS],
  spawns: SPAWNS,
};
