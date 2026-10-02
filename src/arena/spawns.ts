import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { circleIntersectsRect } from '../sim/math';
import { MatchRng } from '../sim/rng';
import type { Arena, SpawnPoint } from '../sim/types';

/** How far from where the arena puts it a robot may start: a little to either side, a lot up or down. */
export const SCATTER = { x: 40, y: 200 };
/** Room kept between a robot where it starts and any wall or obstacle. */
const CLEARANCE = 8;
/** Places tried before the arena's own are settled for. */
const ATTEMPTS = 20;
/** Keeps the starting places from following the same numbers as the shots of the match. */
const SEED_SALT = 0x5eed5;

/**
 * The arena with its two robots starting somewhere else, decided by the seed:
 * the same seed always gives the same places. The second robot is moved as
 * far as the first, the opposite way, so an arena that looks the same turned
 * half around still favours neither. Obstacles and headings stay as they are.
 */
export function scatterSpawns(arena: Arena, seed: number): Arena {
  const [first, second, ...others] = arena.spawns;
  const rng = new MatchRng(seed ^ SEED_SALT);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const dx = Math.round(rng.range(-SCATTER.x, SCATTER.x));
    const dy = Math.round(rng.range(-SCATTER.y, SCATTER.y));
    const moved = [shifted(first, dx, dy), shifted(second, -dx, -dy)];
    if (moved.every((spawn) => hasRoom(arena, spawn))) return { ...arena, spawns: [...moved, ...others] };
  }
  return arena;
}

function shifted(spawn: SpawnPoint, dx: number, dy: number): SpawnPoint {
  return { ...spawn, x: spawn.x + dx, y: spawn.y + dy };
}

/** Whether a robot fits at the place, with room to spare on every side. */
function hasRoom(arena: Arena, { x, y }: SpawnPoint): boolean {
  const reach = ROBOT_DEFAULTS.radius + CLEARANCE;
  if (x < reach || x > arena.width - reach || y < reach || y > arena.height - reach) return false;
  return arena.obstacles.every((obstacle) => !circleIntersectsRect({ x, y }, reach, obstacle));
}
