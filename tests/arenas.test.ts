import { describe, expect, it } from 'vitest';
import { ARENAS, DEFAULT_ARENA, DEFAULT_ARENA_DEFINITION, findArena } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { TEMPLATES, templateSource } from '../src/data/templates';
import { circleIntersectsRect } from '../src/sim/math';
import type { Rect } from '../src/sim/types';
import { compileBrain, createSimulation, runToEnd } from './helpers';

const SEEDS = [1, 2, 3, 4, 5];

function sorted(rects: Rect[]): Rect[] {
  return [...rects].sort((a, b) => a.x - b.x || a.y - b.y);
}

describe('arena list', () => {
  it('offers three arenas, each with a unique id, the centre block first', () => {
    expect(ARENAS.map((arena) => arena.name)).toEqual(['Center Block', 'Open Field', 'Long Wall']);
    expect(new Set(ARENAS.map((arena) => arena.id)).size).toBe(ARENAS.length);
    expect(DEFAULT_ARENA).toBe(ARENAS[0].arena);
  });

  it('finds an arena by id and falls back to the default for unknown ids', () => {
    expect(findArena('open_field').name).toBe('Open Field');
    expect(findArena('no_such_arena')).toBe(DEFAULT_ARENA_DEFINITION);
    expect(findArena(null)).toBe(DEFAULT_ARENA_DEFINITION);
  });
});

describe.each(ARENAS)('arena $name', ({ arena }) => {
  it('has between 4 and 6 obstacles, all inside the field', () => {
    expect(arena.obstacles.length).toBeGreaterThanOrEqual(4);
    expect(arena.obstacles.length).toBeLessThanOrEqual(6);
    for (const { x, y, width, height } of arena.obstacles) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(arena.width);
      expect(y + height).toBeLessThanOrEqual(arena.height);
    }
  });

  it('favours neither side: it looks the same turned half around', () => {
    const turned = arena.obstacles.map(({ x, y, width, height }) => ({
      x: arena.width - x - width,
      y: arena.height - y - height,
      width,
      height,
    }));
    expect(sorted(turned)).toEqual(sorted(arena.obstacles));

    const [player, enemy] = arena.spawns;
    expect({ x: arena.width - player.x, y: arena.height - player.y }).toEqual({ x: enemy.x, y: enemy.y });
  });

  it('starts the robots clear of every obstacle', () => {
    for (const spawn of arena.spawns) {
      expect(arena.obstacles.some((obstacle) => circleIntersectsRect(spawn, ROBOT_DEFAULTS.radius, obstacle))).toBe(false);
    }
  });

  it('lets every pair of templates fight to a finish, without running out the clock', () => {
    for (const player of TEMPLATES) {
      for (const enemy of TEMPLATES) {
        for (const seed of SEEDS) {
          const simulation = createSimulation(
            [compileBrain(templateSource(player, 0)), compileBrain(templateSource(enemy, 1))],
            { arena, stats: ROBOT_DEFAULTS, seed },
          );
          runToEnd(simulation);
          expect(simulation.result?.reason, `${player.name} vs ${enemy.name}, seed ${seed}`).toBe('destroyed');
        }
      }
    }
  });
});
