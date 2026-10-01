import type { Rect, SpawnPoint } from '../../sim/types';

// What every arena shares, so that only the middle of the field differs.

export const ARENA_WIDTH = 1000;
export const ARENA_HEIGHT = 600;

/** The first spawn is the player's, on the right. Robots start facing each other. */
export const SPAWNS: SpawnPoint[] = [
  { x: 880, y: 300, rotation: 180 },
  { x: 120, y: 300, rotation: 0 },
];

/** Four blocks towards the corners: cover for a robot that backs away from the middle. */
export const CORNER_BLOCKS: Rect[] = [
  { x: 180, y: 120, width: 80, height: 80 },
  { x: 740, y: 120, width: 80, height: 80 },
  { x: 180, y: 400, width: 80, height: 80 },
  { x: 740, y: 400, width: 80, height: 80 },
];
