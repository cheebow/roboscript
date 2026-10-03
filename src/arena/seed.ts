/** The largest seed a match is given; seeds run from 1 up to it. */
export const MAX_SEED = 0x7fffffff;

/** A seed for a match of its own: where the robots start and how their shots scatter both follow it. */
export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * MAX_SEED);
}
