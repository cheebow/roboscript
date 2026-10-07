import type { Base, Rect, SpawnPoint } from '../../sim/types';
import { CASTLE_HP } from '../castle';
import { ARENA_HEIGHT, ARENA_WIDTH } from './common';

// What every castle arena shares: a castle at each end wall and three spawns
// in front of it. Team 0 (the player's) holds the right end, team 1 the left,
// mirroring the duel spawns.

const CASTLE_WIDTH = 50;
const CASTLE_HEIGHT = 160;
const CASTLE_Y = (ARENA_HEIGHT - CASTLE_HEIGHT) / 2;

/** Team 1's castle, against the left wall. */
export const LEFT_CASTLE: Rect = { x: 0, y: CASTLE_Y, width: CASTLE_WIDTH, height: CASTLE_HEIGHT };
/** Team 0's castle, against the right wall. */
export const RIGHT_CASTLE: Rect = { x: ARENA_WIDTH - CASTLE_WIDTH, y: CASTLE_Y, width: CASTLE_WIDTH, height: CASTLE_HEIGHT };

/** Both castles at full strength: team 0 right, team 1 left. */
export const CASTLE_BASES: Base[] = [
  { team: 0, rect: RIGHT_CASTLE, maxHp: CASTLE_HP },
  { team: 1, rect: LEFT_CASTLE, maxHp: CASTLE_HP },
];

const SPAWN_INSET = 130;
const SPAWN_YS = [150, 300, 450];

/**
 * Six spawns: the first three for team 0 before its castle on the right, the
 * next three for team 1 on the left, facing each other, clear of the castles
 * and of every castle arena's obstacles.
 */
export const CASTLE_SPAWNS: SpawnPoint[] = [
  ...SPAWN_YS.map((y) => ({ x: ARENA_WIDTH - SPAWN_INSET, y, rotation: 180 })),
  ...SPAWN_YS.map((y) => ({ x: SPAWN_INSET, y, rotation: 0 })),
];
