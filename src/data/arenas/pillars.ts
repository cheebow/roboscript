import type { Arena } from '../../sim/types';
import { ARENA_HEIGHT, ARENA_WIDTH, SPAWNS } from './common';

const SIZE = 50;
const pillar = (x: number, y: number) => ({ x, y, width: SIZE, height: SIZE });

/** Seven pillars spread over the field: cover everywhere, and never a long clear line of fire. */
export const PILLARS: Arena = {
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  obstacles: [
    pillar(210, 275),
    pillar(740, 275),
    pillar(340, 120),
    pillar(610, 430),
    pillar(340, 430),
    pillar(610, 120),
    pillar(475, 275),
  ],
  spawns: SPAWNS,
};
