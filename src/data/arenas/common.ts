import type { Rect, SpawnPoint } from '../../sim/types';

// What every arena shares, so that only the middle of the field differs.

export const ARENA_WIDTH = 1000;
export const ARENA_HEIGHT = 600;

/**
 * How far above the middle of the field the robots start. Starting on the
 * middle line, half a turn apart, two robots that go round obstacles the same
 * way stay half a turn apart for good, with whatever stands in the middle
 * between them, and never meet. This much off the line, they do, in every
 * arena; with 25 they do not, and with 75 the Corridor keeps them apart.
 * Measure again when an arena is added or changed.
 */
const SPAWN_RISE = 50;
const SPAWN_Y = ARENA_HEIGHT / 2 - SPAWN_RISE;

/** The first spawn is the player's, on the right. Robots start facing each other, level with each other. */
export const SPAWNS: SpawnPoint[] = [
  { x: 880, y: SPAWN_Y, rotation: 180 },
  { x: 120, y: SPAWN_Y, rotation: 0 },
];

/**
 * Where the robots of a battle royale start: in the four corners, facing the
 * middle of the arena across it. Clear of the obstacles of every arena.
 */
export const CORNER_SPAWNS: SpawnPoint[] = [
  { x: 920, y: 70, rotation: 180 },
  { x: 80, y: 530, rotation: 0 },
  { x: 80, y: 70, rotation: 0 },
  { x: 920, y: 530, rotation: 180 },
];

/** Four blocks towards the corners: cover for a robot that backs away from the middle. */
export const CORNER_BLOCKS: Rect[] = [
  { x: 180, y: 120, width: 80, height: 80 },
  { x: 740, y: 120, width: 80, height: 80 },
  { x: 180, y: 400, width: 80, height: 80 },
  { x: 740, y: 400, width: 80, height: 80 },
];
