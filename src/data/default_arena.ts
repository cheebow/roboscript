import type { Arena } from '../sim/types';

// Obstacles are point-symmetric around the centre so neither spawn is favoured.
export const DEFAULT_ARENA: Arena = {
  width: 1000,
  height: 600,
  obstacles: [
    { x: 240, y: 110, width: 60, height: 130 },
    { x: 700, y: 360, width: 60, height: 130 },
    { x: 450, y: 140, width: 100, height: 50 },
    { x: 450, y: 410, width: 100, height: 50 },
    { x: 300, y: 440, width: 130, height: 40 },
    { x: 570, y: 120, width: 130, height: 40 },
  ],
  // The first spawn is the player's, on the right. Robots start back to back,
  // so each has to search before it sees the other.
  spawns: [
    { x: 880, y: 300, rotation: 0 },
    { x: 120, y: 300, rotation: 180 },
  ],
};
