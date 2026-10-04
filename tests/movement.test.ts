import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import type { Arena, SpawnPoint } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runTicks } from './helpers';

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
  it('drives forward at MOVE_SPEED', () => {
    const simulation = simulate({ drive: 'forward' });
    runTicks(simulation, tickRate);
    expect(simulation.robots[0].position.x).toBeCloseTo(START.x + moveSpeed);
    expect(simulation.robots[0].position.y).toBeCloseTo(START.y);
  });

  it('drives backward without turning around', () => {
    const simulation = simulate({ drive: 'backward' }, { spawns: [{ ...START, x: 500 }, FAR_AWAY] });
    runTicks(simulation, tickRate / 2);
    expect(simulation.robots[0].position.x).toBeCloseTo(500 - moveSpeed / 2);
    expect(simulation.robots[0].rotation).toBe(0);
  });

  it('drives along its heading', () => {
    const simulation = simulate({ drive: 'forward' }, { spawns: [{ ...START, rotation: 90 }, FAR_AWAY] });
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

  it('turns before it drives on, so a turning robot drives a curve', () => {
    const simulation = simulate({ turn: 'right', drive: 'forward' });
    runTicks(simulation, tickRate / 2);
    const { position, rotation } = simulation.robots[0];
    expect(rotation).toBeCloseTo(90);
    expect(position.x).toBeGreaterThan(START.x);
    expect(position.y).toBeGreaterThan(START.y);
  });

  it('is stopped by the arena wall', () => {
    const simulation = simulate({ drive: 'backward' });
    runTicks(simulation, tickRate * 2);
    expect(simulation.robots[0].position.x).toBeGreaterThanOrEqual(radius);
    expect(simulation.robots[0].position.x).toBeLessThan(radius + moveSpeed / tickRate);
  });

  it('is stopped by an obstacle', () => {
    const obstacle = { x: 200, y: 250, width: 50, height: 100 };
    const simulation = simulate({ drive: 'forward' }, { obstacles: [obstacle] });
    runTicks(simulation, tickRate * 2);
    expect(simulation.robots[0].position.x).toBeLessThanOrEqual(obstacle.x - radius);
    expect(simulation.robots[0].position.x).toBeGreaterThan(obstacle.x - radius - moveSpeed / tickRate);
  });

  it('does not slide along an obstacle it hits at an angle', () => {
    const obstacle = { x: 200, y: 0, width: 50, height: 600 };
    const diagonal: SpawnPoint = { ...START, rotation: 45 };
    const simulation = simulate({ drive: 'forward' }, { obstacles: [obstacle], spawns: [diagonal, FAR_AWAY] });
    runTicks(simulation, tickRate * 2);
    const stoppedAt = { ...simulation.robots[0].position };
    expect(stoppedAt.x).toBeLessThanOrEqual(obstacle.x - radius);

    runTicks(simulation, tickRate);
    expect(simulation.robots[0].position).toEqual(stoppedAt);
  });

  it('is stopped by the other robot', () => {
    const simulation = createSimulation([new FixedBrain({ drive: 'forward' }), new FixedBrain()]);
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

  it('leaves the turret where it is on the hull when the hull turns', () => {
    const simulation = simulate({ turn: 'right' });
    runTicks(simulation, tickRate / 2);
    const [robot] = simulation.robots;
    expect(robot.gunRotation).toBe(0);
    expect(robot.gunHeading).toBeCloseTo(robot.rotation);
  });
});

describe('driving', () => {
  const STEP = moveSpeed / tickRate;

  /** The first robot after running the program for the given number of ticks. */
  function drive(program: string, ticks: number, arena: Partial<Arena> = {}) {
    const simulation = createSimulation([compileBrain(program), new FixedBrain()], {
      arena: { ...DUEL_ARENA, spawns: [START, FAR_AWAY], ...arena },
    });
    runTicks(simulation, ticks);
    return simulation.robots[0];
  }

  it('stands still until told to drive', () => {
    const robot = drive('loop\n    wait', 10);
    expect(robot.driving).toBe('stop');
    expect(robot.position).toEqual({ x: START.x, y: START.y });
  });

  it('keeps going once set, tick after tick', () => {
    const robot = drive('drive forward\nloop\n    wait', tickRate);
    expect(robot.driving).toBe('forward');
    expect(robot.position.x).toBeCloseTo(START.x + moveSpeed);
  });

  it('keeps going while the robot aims, fires, guards or turns', () => {
    const straight = drive('drive forward\nloop\n    aim left\n    fire\n    guard', 30);
    expect(straight.position.x).toBeCloseTo(START.x + STEP * 30);
    expect(straight.position.y).toBeCloseTo(START.y);

    const curving = drive('drive forward\nloop\n    turn right', 15);
    expect(curving.rotation).toBeCloseTo(90);
    expect(curving.position.y).toBeGreaterThan(START.y);
  });

  it('stops on drive stop, and reverses on drive backward', () => {
    const stopped = drive('drive forward\nwait\nwait\ndrive stop\nloop\n    wait', 20);
    expect(stopped.driving).toBe('stop');
    // The setting takes effect on the tick it is made.
    expect(stopped.position.x).toBeCloseTo(START.x + STEP * 2);

    const reversed = drive('drive forward\nwait\nwait\ndrive backward\nloop\n    wait', 6, {
      spawns: [{ ...START, x: 500 }, FAR_AWAY],
    });
    expect(reversed.position.x).toBeCloseTo(500 + STEP * 2 - STEP * 4);
  });

  it('goes on even after the program has ended', () => {
    const robot = drive('drive forward\nwait', 30);
    expect(robot.position.x).toBeCloseTo(START.x + STEP * 30);
  });

  it('is held up by an obstacle, and gets going again once the hull points clear of it', () => {
    const wall = { x: 200, y: 0, width: 50, height: 600 };
    const program = 'drive forward\nloop\n    if blocked\n        turn right\n    else\n        wait';
    const early = drive(program, tickRate, { obstacles: [wall] });
    expect(early.position.x).toBeLessThanOrEqual(wall.x - radius);

    const later = drive(program, tickRate * 4, { obstacles: [wall] });
    expect(later.driving).toBe('forward');
    expect(later.position.x).toBeLessThanOrEqual(wall.x - radius);
    expect(later.position.y).toBeGreaterThan(START.y + moveSpeed);
  });
});

describe('face back', () => {
  it('turns the hull right round, a tick at a time, and then goes on', () => {
    const simulation = createSimulation([compileBrain('face back\nlabel DONE\nloop\n    wait\n'), compileBrain('loop\n    wait\n')]);
    const start = simulation.robots[0].rotation;
    runTicks(simulation, 1);
    // One tick of turning: still far from facing back.
    expect(Math.abs(simulation.robots[0].rotation - start)).toBeLessThan(10);
    runTicks(simulation, 60);
    const turned = Math.abs(((simulation.robots[0].rotation - start + 540) % 360) - 180);
    expect(turned).toBeCloseTo(180, 0);
    expect(simulation.robots[0].label).toBe('DONE');
  });

  it('cannot be written as turn back, which would turn for a tick only', async () => {
    const { compileScript } = await import('../src/ai/roboscript');
    const compiled = compileScript('turn back');
    expect(compiled.ok ? [] : compiled.errors.map((error) => error.message)).toEqual([
      '"turn back" would turn only one tick: to turn until the hull faces the other way, use face back',
    ]);
  });
});
