import { ARENAS, type ArenaDefinition } from '../data/arenas';
import type { MatchRng } from '../sim/rng';

/** The largest seed a match is given; seeds run from 1 up to it. */
const MAX_SEED = 0x7fffffff;

/** A seed for a match of its own: where the robots start and how their shots scatter both follow it. */
export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * MAX_SEED);
}

/** A seed for a match of a contest, drawn from the contest's own numbers so that the contest can be played again. */
export function drawSeed(rng: MatchRng): number {
  return 1 + Math.floor(rng.next() * (MAX_SEED - 1));
}

/** A map for a match of a contest, drawn from the contest's own numbers. */
export function drawArena(rng: MatchRng): ArenaDefinition {
  return ARENAS[Math.floor(rng.next() * ARENAS.length)];
}
