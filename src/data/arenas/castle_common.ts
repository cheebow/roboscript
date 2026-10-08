import type { Base, Rect, SpawnPoint } from '../../sim/types';
import { MAX_TEAM_SIZE, castleHpFor } from '../castle';
import { ARENA_HEIGHT, ARENA_WIDTH } from './common';

// What every castle arena shares: a castle at each end wall and up to five
// spawns in front of it. Team 0 (the player's) holds the right end, team 1
// the left, mirroring the duel spawns.

const CASTLE_WIDTH = 50;
const CASTLE_HEIGHT = 160;
const CASTLE_Y = (ARENA_HEIGHT - CASTLE_HEIGHT) / 2;

/** Team 1's castle, against the left wall. */
export const LEFT_CASTLE: Rect = { x: 0, y: CASTLE_Y, width: CASTLE_WIDTH, height: CASTLE_HEIGHT };
/** Team 0's castle, against the right wall. */
export const RIGHT_CASTLE: Rect = { x: ARENA_WIDTH - CASTLE_WIDTH, y: CASTLE_Y, width: CASTLE_WIDTH, height: CASTLE_HEIGHT };

/** Both castles, as tough as the team size calls for: team 0 right, team 1 left. */
export function castleBasesFor(teamSize: number): Base[] {
  const maxHp = castleHpFor(teamSize);
  return [
    { team: 0, rect: RIGHT_CASTLE, maxHp },
    { team: 1, rect: LEFT_CASTLE, maxHp },
  ];
}

const SPAWN_INSET = 130;
/**
 * The first robot of a side starts level with its castle; the others above
 * and below it, further out as the team grows. The rows clear every castle
 * arena's walls and shields, and the first three are the rows of old, so a
 * shared match of up to three a side replays exactly as it did.
 */
const SPAWN_YS = [300, 150, 450, 90, 510];

/**
 * All ten spawns, team 0's five first: what a castle arena carries, so the
 * simulation's spawn check always has enough. A match of fewer robots picks
 * its spawns with `castleSpawnsFor`.
 */
export const CASTLE_SPAWNS: SpawnPoint[] = [
  ...SPAWN_YS.map((y) => ({ x: ARENA_WIDTH - SPAWN_INSET, y, rotation: 180 })),
  ...SPAWN_YS.map((y) => ({ x: SPAWN_INSET, y, rotation: 0 })),
];

/** The spawns of a match of `teamSize` robots a side: the first `teamSize` of each side, team 0's first. */
export function castleSpawnsFor(teamSize: number): SpawnPoint[] {
  return [...CASTLE_SPAWNS.slice(0, teamSize), ...CASTLE_SPAWNS.slice(MAX_TEAM_SIZE, MAX_TEAM_SIZE + teamSize)];
}
