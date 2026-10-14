import { TARGET_BOT } from '../tutorial/stages';
import type { Stage } from '../tutorial/types';

// Stages of the book's own, for what the tutorial's stages do not show.

/** ALPHA faces down the field, with the target off to its side: driving on, it crosses in front of the target. */
export const BROADSIDE: Stage = {
  arena: {
    width: 1000,
    height: 600,
    obstacles: [],
    spawns: [
      { x: 500, y: 150, rotation: 90 },
      { x: 120, y: 300, rotation: 0 },
    ],
  },
  bot: TARGET_BOT,
  seed: 31,
};
