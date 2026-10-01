import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import type { Arena, SpawnPoint } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const { moveSpeed, rotateSpeed, radius } = NO_SPREAD_STATS;
const START: SpawnPoint = { x: 100, y: 300, rotation: 0 };
/** Out of the way, so that the robots never get in each other's way. */
const FAR_AWAY: SpawnPoint = { x: 900, y: 500, rotation: 180 };

function simulate(action: ConstructorParameters<typeof FixedBrain>[0], arena: Partial<Arena> = {}) {
  return createSimulation([new FixedBrain(action), new FixedBrain()], {
    arena: { ...DUEL_ARENA, spawns: [START, FAR_AWAY], ...arena },
  });
}

describe('movement', () => {
  it('moves forward at MOVE_SPEED', () => {
    const simulation = simulate({ move: 'forward' });
    runTicks(simulation, tickRate);
    expect(simulation.robots[0].position.x).toBeCloseTo(START.x + moveSpeed);
    expect(simulation.robots[0].position.y).toBeCloseTo(START.y);
  });

  it('moves backward without turning around', () => {
    const simulation = simulate({ move: 'backward' }, { spawns: [{ ...START, x: 500 }, FAR_AWAY] });
    runTicks(simulation, tickRate / 2);
    expect(simulation.robots[0].position.x).toBeCloseTo(500 - moveSpeed / 2);
    expect(simulation.robots[0].rotation).toBe(0);
  });

  it('moves along its heading', () => {
    const simulation = simulate({ move: 'forward' }, { spawns: [{ ...START, rotation: 90 }, FAR_AWAY] });
    runTicks(simulation, tickRate / 2);
    expect(simulation.robots[0].position.x).toBeCloseTo(START.x);
    expect(simulation.robots[0].position.y).toBeCloseTo(START.y + moveSpeed / 2);
  });

  it('turns at ROTATE_SPEED, clockwise for right', () => {
    const right = simulate({ turn: 'right' });
    runTicks(right, tickRate / 2);
    expect(right.robots[0].rotation).toBeCloseTo(rotateSpeed / 2);

    const left = simulate({ turn: 'left' });
    runTicks(left, tickRate / 2);
    expect(left.robots[0].rotation).toBeCloseTo(-rotateSpeed / 2);
  });

  it('turns before it moves, so a turning robot drives a curve', () => {
    const simulation = simulate({ turn: 'right', move: 'forward' });
    runTicks(simulation, tickRate / 2);
    const { position, rotation } = simulation.robots[0];
    expect(rotation).toBeCloseTo(90);
    expect(position.x).toBeGreaterThan(START.x);
    expect(position.y).toBeGreaterThan(START.y);
  });

  it('is stopped by the arena wall', () => {
    const simulation = simulate({ move: 'backward' });
    runTicks(simulation, tickRate * 2);
    expect(simulation.robots[0].position.x).toBeGreaterThanOrEqual(radius);
    expect(simulation.robots[0].position.x).toBeLessThan(radius + moveSpeed / tickRate);
  });

  it('is stopped by an obstacle', () => {
    const obstacle = { x: 200, y: 250, width: 50, height: 100 };
    const simulation = simulate({ move: 'forward' }, { obstacles: [obstacle] });
    runTicks(simulation, tickRate * 2);
    expect(simulation.robots[0].position.x).toBeLessThanOrEqual(obstacle.x - radius);
    expect(simulation.robots[0].position.x).toBeGreaterThan(obstacle.x - radius - moveSpeed / tickRate);
  });

  it('does not slide along an obstacle it hits at an angle', () => {
    const obstacle = { x: 200, y: 0, width: 50, height: 600 };
    const diagonal: SpawnPoint = { ...START, rotation: 45 };
    const simulation = simulate({ move: 'forward' }, { obstacles: [obstacle], spawns: [diagonal, FAR_AWAY] });
    runTicks(simulation, tickRate * 2);
    const stoppedAt = { ...simulation.robots[0].position };
    expect(stoppedAt.x).toBeLessThanOrEqual(obstacle.x - radius);

    runTicks(simulation, tickRate);
    expect(simulation.robots[0].position).toEqual(stoppedAt);
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
    const simulation = createSimulation([new FixedBrain({ turn: 'enemy' }), new FixedBrain()], { arena });
    runTicks(simulation, tickRate);
    expect(simulation.robots[0].rotation).toBeCloseTo(0);
  });
});
