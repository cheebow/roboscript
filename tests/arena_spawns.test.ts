import { describe, expect, it } from 'vitest';
import { SCATTER, scatterSpawns } from '../src/arena/spawns';
import { ARENAS, DEFAULT_ARENA } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { circleIntersectsRect } from '../src/sim/math';

const { radius } = ROBOT_DEFAULTS;
const SEEDS = Array.from({ length: 200 }, (_, index) => index * 7919 + 1);

describe('scatterSpawns', () => {
  it('starts the robots in the same places for the same seed', () => {
    expect(scatterSpawns(DEFAULT_ARENA, 42)).toEqual(scatterSpawns(DEFAULT_ARENA, 42));
  });

  it('starts them in other places for other seeds', () => {
    const places = new Set(SEEDS.map((seed) => JSON.stringify(scatterSpawns(DEFAULT_ARENA, seed).spawns[0])));
    expect(places.size).toBeGreaterThan(SEEDS.length / 2);
  });

  it('moves both robots as far, opposite ways', () => {
    const [first, second] = DEFAULT_ARENA.spawns;
    for (const seed of SEEDS) {
      const [movedFirst, movedSecond] = scatterSpawns(DEFAULT_ARENA, seed).spawns;
      expect(movedFirst.x - first.x).toBe(second.x - movedSecond.x);
      expect(movedFirst.y - first.y).toBe(second.y - movedSecond.y);
    }
  });

  it('keeps the robots within reach of where the arena puts them', () => {
    const [first] = DEFAULT_ARENA.spawns;
    for (const seed of SEEDS) {
      const [moved] = scatterSpawns(DEFAULT_ARENA, seed).spawns;
      expect(Math.abs(moved.x - first.x)).toBeLessThanOrEqual(SCATTER.x);
      expect(Math.abs(moved.y - first.y)).toBeLessThanOrEqual(SCATTER.y);
    }
  });

  it('uses the room it has: robots start high and low, not just near the middle', () => {
    const heights = SEEDS.map((seed) => scatterSpawns(DEFAULT_ARENA, seed).spawns[0].y - DEFAULT_ARENA.spawns[0].y);
    expect(Math.min(...heights)).toBeLessThan(-SCATTER.y / 2);
    expect(Math.max(...heights)).toBeGreaterThan(SCATTER.y / 2);
  });

  it('starts every robot inside the field and clear of every obstacle, in every arena', () => {
    for (const { name, arena } of ARENAS) {
      for (const seed of SEEDS) {
        for (const spawn of scatterSpawns(arena, seed).spawns) {
          const where = `${name}, seed ${seed}: (${spawn.x}, ${spawn.y})`;
          expect(spawn.x >= radius && spawn.x <= arena.width - radius, where).toBe(true);
          expect(spawn.y >= radius && spawn.y <= arena.height - radius, where).toBe(true);
          for (const obstacle of arena.obstacles) expect(circleIntersectsRect(spawn, radius, obstacle), where).toBe(false);
        }
      }
    }
  });

  it('leaves the obstacles, the headings and the arena itself as they are', () => {
    const before = JSON.stringify(DEFAULT_ARENA);
    const scattered = scatterSpawns(DEFAULT_ARENA, 42);
    expect(JSON.stringify(DEFAULT_ARENA)).toBe(before);
    expect(scattered.obstacles).toBe(DEFAULT_ARENA.obstacles);
    expect(scattered.spawns.map((spawn) => spawn.rotation)).toEqual(DEFAULT_ARENA.spawns.map((spawn) => spawn.rotation));
    expect(scattered.spawns).toHaveLength(DEFAULT_ARENA.spawns.length);
  });
});
