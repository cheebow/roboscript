import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH } from './common';
import { CASTLE_SPAWNS } from './castle_common';

/** A shield block before each castle and a pillar in the middle: attackers must come around, defenders have cover to fall back to. */
export const CASTLE_BASTION: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    { x: 160, y: 240, width: 30, height: 120 },
    { x: 810, y: 240, width: 30, height: 120 },
    { x: 470, y: 250, width: 60, height: 100 },
  ],
  spawns: CASTLE_SPAWNS,
};
