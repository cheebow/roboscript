import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import type { Arena } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const { moveSpeed, rotateSpeed, radius } = NO_SPREAD_STATS;

/** Robots start far apart so they never get in each other's way. */
const WIDE_ARENA: Arena = {
  ...DUEL_ARENA,
  spawns: [
    { x: 100, y: 300, rotation: 0 },
    { x: 900, y: 500, rotation: 180 },
  ],
};

function simulate(action: ConstructorParameters<typeof FixedBrain>[0], arena: Arena = WIDE_ARENA) {
  return createSimulation([new FixedBrain(action), new FixedBrain()], { arena });
}

describe('movement', () => {
  it('moves forward at MOVE_SPEED', () => {
    const simulation = simulate({ move: 'forward' });
    runTicks(simulation, tickRate);
    expect(simulation.robots[0].position.x).toBeCloseTo(100 + moveSpeed);
    expect(simulation.robots[0].position.y).toBeCloseTo(300);
  });

  it('moves relative to its heading', () => {
    const cases = [
      { move: 'backward', x: 100 - moveSpeed / 2, y: 300 },
      { move: 'right', x: 100, y: 300 + moveSpeed / 2 },
      { move: 'left', x: 100, y: 300 - moveSpeed / 2 },
    ] as const;
    for (const { move, x, y } of cases) {
      const simulation = simulate({ move });
      runTicks(simulation, tickRate / 2);
      expect(simulation.robots[0].position.x).toBeCloseTo(x);
      expect(simulation.robots[0].position.y).toBeCloseTo(y);
    }
  });

  it('turns at ROTATE_SPEED, clockwise for right', () => {
    const right = simulate({ turn: 'right' });
    runTicks(right, tickRate / 2);
    expect(right.robots[0].rotation).toBeCloseTo(rotateSpeed / 2);

    const left = simulate({ turn: 'left' });
    runTicks(left, tickRate / 2);
    expect(left.robots[0].rotation).toBeCloseTo(-rotateSpeed / 2);
  });

  it('is stopped by the arena wall', () => {
    const simulation = simulate({ move: 'backward' });
    runTicks(simulation, tickRate * 2);
    expect(simulation.robots[0].position.x).toBeGreaterThanOrEqual(radius);
    expect(simulation.robots[0].position.x).toBeLessThan(radius + moveSpeed / tickRate);
  });

  it('is stopped by an obstacle', () => {
    const obstacle = { x: 200, y: 250, width: 50, height: 100 };
    const simulation = simulate({ move: 'forward' }, { ...WIDE_ARENA, obstacles: [obstacle] });
    runTicks(simulation, tickRate * 2);
    expect(simulation.robots[0].position.x).toBeLessThanOrEqual(obstacle.x - radius);
    expect(simulation.robots[0].position.x).toBeGreaterThan(obstacle.x - radius - moveSpeed / tickRate);
  });

  it('is stopped by the other robot', () => {
    const simulation = createSimulation([new FixedBrain({ move: 'forward' }), new FixedBrain()]);
    runTicks(simulation, tickRate * 3);
    const [mover, other] = simulation.robots;
    expect(other.position.x - mover.position.x).toBeGreaterThanOrEqual(radius * 2);
  });

  it('turns toward the enemy with turn enemy', () => {
    const arena: Arena = {
      ...DUEL_ARENA,
      spawns: [
        { x: 400, y: 300, rotation: 30 },
        { x: 600, y: 300, rotation: 180 },
      ],
    };
    const simulation = simulate({ turn: 'enemy' }, arena);
    runTicks(simulation, tickRate);
    expect(simulation.robots[0].rotation).toBeCloseTo(0);
  });
});
