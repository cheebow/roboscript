import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH } from './common';
import { CASTLE_SPAWNS } from './castle_common';

/**
 * Short shields between the lanes before each castle, and a pillar in the
 * middle. The three lanes and the castles' centre lines stay clear, so a
 * march never dead-ends and a siege always has a line to the castle; the
 * shields only cut the diagonals between the lanes.
 */
export const CASTLE_BASTION: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 150, y: 200, width: 30, height: 50 },
    { x: 150, y: 350, width: 30, height: 50 },
    { x: 820, y: 200, width: 30, height: 50 },
    { x: 820, y: 350, width: 30, height: 50 },
    { x: 470, y: 250, width: 60, height: 100 },
  ],
  spawns: CASTLE_SPAWNS,
};
