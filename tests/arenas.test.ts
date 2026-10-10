import { describe, expect, it } from 'vitest';
import { ARENAS, CASTLE_ARENAS, DEFAULT_ARENA, DEFAULT_ARENA_DEFINITION, findArena } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { TEMPLATES } from '../src/data/templates';
import { circleIntersectsRect } from '../src/sim/math';
import type { Rect } from '../src/sim/types';
import { compileBrain, createSimulation, runToEnd } from './helpers';

const SEEDS = [1, 2, 3, 4, 5];

function sorted(rects: Rect[]): Rect[] {
  return [...rects].sort((a, b) => a.x - b.x || a.y - b.y);
}

/** The templates that hide and recover: a match against them can run out the clock. */
const HIDERS = ['cover_bot', 'hit_and_hide_bot'];
/** The share of a hider's matches that may run out the clock. HitAndHideBot rests after every shot, not only when hurt: a little more. */
const MOST_TIMEOUTS: Record<string, number> = { cover_bot: 0.2, hit_and_hide_bot: 0.25 };

describe('arena list', () => {
  it('offers nine arenas, each with a unique id, the centre block first', () => {
    expect(ARENAS.map((arena) => arena.name)).toEqual([
      'Center Block',
      'Open Field',
      'Long Wall',
      'Bare Ground',
      'Pillars',
      'Corridor',
      'Bunkers',
      'Cross',
      'Zigzag',
    ]);
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
  it('has every obstacle inside the field', () => {
    for (const { x, y, width, height } of arena.obstacles) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(arena.width);
      expect(y + height).toBeLessThanOrEqual(arena.height);
    }
  });

  it('looks the same turned half around', () => {
    const turned = arena.obstacles.map(({ x, y, width, height }) => ({
      x: arena.width - x - width,
      y: arena.height - y - height,
      width,
      height,
    }));
    expect(sorted(turned)).toEqual(sorted(arena.obstacles));
  });

  it('starts the robots level with each other, as far from either end, facing each other', () => {
    const [player, enemy] = arena.spawns;
    expect(enemy).toEqual({ x: arena.width - player.x, y: player.y, rotation: 0 });
    expect(player.rotation).toBe(180);
  });

  it('starts the robots off the middle line, so that two that go round obstacles the same way still meet', () => {
    // On the line they would start half a turn apart, and stay so, with the middle of the field between them.
    const [player] = arena.spawns;
    expect(player.y).toBe(arena.height / 2 - 50);
  });

  it('starts the robots clear of every obstacle', () => {
    for (const spawn of arena.spawns) {
      expect(arena.obstacles.some((obstacle) => circleIntersectsRect(spawn, ROBOT_DEFAULTS.radius, obstacle))).toBe(false);
    }
  });

  it('lets the robots see each other at the start, or keeps them apart with an obstacle', () => {
    // Either way, both are in the same situation.
    const simulation = createSimulation([compileBrain('loop\n    wait'), compileBrain('loop\n    wait')], { arena });
    simulation.step();
    const [player, enemy] = simulation.robots;
    expect(player.sensorReading.enemyVisible).toBe(enemy.sensorReading.enemyVisible);
  });

  it('lets every pair of different templates fight to a finish, without running out the clock', () => {
    // Two robots running the same program can stay half a turn apart and never meet; that is left to the player.
    // CoverBot and HitAndHideBot hide and recover, which can run out the clock: see the tests at the end.
    for (const player of TEMPLATES) {
      for (const enemy of TEMPLATES) {
        if (enemy === player || HIDERS.includes(player.id) || HIDERS.includes(enemy.id)) continue;
        for (const seed of SEEDS) {
          const simulation = createSimulation(
            [compileBrain(player.source), compileBrain(enemy.source)],
            { arena, stats: ROBOT_DEFAULTS, seed },
          );
          runToEnd(simulation);
          // Two that dodge everything may use up their ammo; that ends the match as well.
          expect(simulation.result?.reason, `${player.name} vs ${enemy.name}, seed ${seed}`).not.toBe('timeout');
        }
      }
    }
  });
});

describe.each(CASTLE_ARENAS)('castle arena $name', ({ id, arena, basesFor }) => {
  const bases = basesFor(3);

  it('keeps the duel and battle royale pickers free of it', () => {
    expect(ARENAS.some((other) => other.id === id)).toBe(false);
  });

  it('has every obstacle and both castles inside the field', () => {
    for (const { x, y, width, height } of [...arena.obstacles, ...bases.map((base) => base.rect)]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(arena.width);
      expect(y + height).toBeLessThanOrEqual(arena.height);
    }
  });

  it('looks the same turned half around, castles included', () => {
    const turn = ({ x, y, width, height }: Rect) => ({
      x: arena.width - x - width,
      y: arena.height - y - height,
      width,
      height,
    });
    expect(sorted(arena.obstacles.map(turn))).toEqual(sorted(arena.obstacles));
    expect(sorted(bases.map((base) => turn(base.rect)))).toEqual(sorted(bases.map((base) => base.rect)));
  });

  it('starts five robots a side, mirrored, each facing the enemy castle', () => {
    expect(arena.spawns).toHaveLength(10);
    const [right, left] = [arena.spawns.slice(0, 5), arena.spawns.slice(5)];
    for (const [index, spawn] of right.entries()) {
      expect(spawn.rotation).toBe(180);
      expect(left[index]).toEqual({ x: arena.width - spawn.x, y: spawn.y, rotation: 0 });
    }
  });

  it('starts every robot clear of the obstacles, the castles and its teammates', () => {
    for (const spawn of arena.spawns) {
      for (const block of [...arena.obstacles, ...bases.map((base) => base.rect)]) {
        expect(circleIntersectsRect(spawn, ROBOT_DEFAULTS.radius, block)).toBe(false);
      }
    }
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y) >= ROBOT_DEFAULTS.radius * 2;
    for (const a of arena.spawns) {
      for (const b of arena.spawns) {
        if (a !== b) expect(apart(a, b)).toBe(true);
      }
    }
  });
});

describe.each(HIDERS)('%s against the clock', (hiderId) => {
  it('runs out the clock in some matches, by hiding and recovering, but in few', () => {
    const hider = TEMPLATES.find((template) => template.id === hiderId);
    if (hider === undefined) throw new Error(`Expected ${hiderId}`);
    let timeouts = 0;
    let matches = 0;
    for (const { arena } of ARENAS) {
      for (const other of TEMPLATES) {
        if (other === hider) continue;
        for (const seed of SEEDS) {
          for (const [first, second] of [[hider, other], [other, hider]]) {
            const simulation = createSimulation([compileBrain(first.source), compileBrain(second.source)], { arena, stats: ROBOT_DEFAULTS, seed });
            runToEnd(simulation);
            matches++;
            if (simulation.result?.reason === 'timeout') timeouts++;
          }
        }
      }
    }
    // A match that runs out the clock goes to the robot with more hp: hiding is no way to a draw.
    expect(timeouts).toBeGreaterThan(0);
    expect(timeouts / matches).toBeLessThan(MOST_TIMEOUTS[hiderId]);
  }, 60_000); // Matches that run out the clock take a while to simulate.
});
