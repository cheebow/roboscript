import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { STANDARD_LOADOUT, statsOf } from '../src/data/parts';
import type { AIAction, RobotBrain } from '../src/sim/ai_context';
import { createIdleAction } from '../src/sim/ai_context';
import { headingVector } from '../src/sim/math';
import type { Simulation } from '../src/sim/simulation';
import type { SpawnPoint } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, createSimulation } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const HOVER = statsOf({ ...STANDARD_LOADOUT, legs: 'hover' });
const WALKER = statsOf({ ...STANDARD_LOADOUT, legs: 'walker' });
const FAR_AWAY: SpawnPoint = { x: 950, y: 560, rotation: 180 };

/** A robot that does, tick by tick, what `plan` says for that tick. */
function planned(plan: (tick: number) => Partial<AIAction>): RobotBrain {
  let tick = 0;
  return { decide: () => ({ ...createIdleAction(), ...plan(tick++) }) };
}

function hoverAt(start: SpawnPoint, brain: RobotBrain): Simulation {
  return createSimulation([brain, new FixedBrain()], {
    arena: { ...DUEL_ARENA, spawns: [start, FAR_AWAY] },
    robots: [
      { id: 'ALPHA', brain, stats: HOVER },
      { id: 'BRAVO', brain: new FixedBrain(), stats: HOVER },
    ],
  });
}

/** Where the robot is after each of `ticks` more ticks. */
function track(simulation: Simulation, ticks: number): { x: number; y: number }[] {
  const seen = [];
  for (let tick = 0; tick < ticks; tick++) {
    simulation.step();
    seen.push({ ...simulation.robots[0].position });
  }
  return seen;
}

describe('Hover legs', () => {
  const fullStep = HOVER.moveSpeed / tickRate;

  it('are fast, and take a moment to get going', () => {
    const simulation = hoverAt({ x: 100, y: 300, rotation: 0 }, new FixedBrain({ drive: 'forward' }));
    const [first, second] = track(simulation, 2);
    expect(first.x - 100).toBeCloseTo(fullStep * (1 - HOVER.slide));
    expect(second.x - first.x).toBeGreaterThan(first.x - 100);
    track(simulation, tickRate);
    const [before, after] = [simulation.robots[0].position.x, track(simulation, 1)[0].x];
    expect(after - before).toBeCloseTo(fullStep, 1);
    expect(HOVER.moveSpeed).toBeGreaterThan(statsOf(STANDARD_LOADOUT).moveSpeed);
  });

  it('slide on after drive stop, still on the move, and stop within a second', () => {
    const simulation = hoverAt({ x: 100, y: 300, rotation: 0 }, planned((tick) => ({ drive: tick < tickRate ? 'forward' : 'stop' })));
    track(simulation, tickRate);
    const stoppedFrom = simulation.robots[0].position.x;
    simulation.step();
    expect(simulation.robots[0].moved).toBe(true);
    track(simulation, tickRate);
    expect(simulation.robots[0].moved).toBe(false);
    const slid = simulation.robots[0].position.x - stoppedFrom;
    expect(slid).toBeGreaterThan(2 * fullStep);
    expect(slid).toBeLessThan(fullStep / (1 - HOVER.slide) + 1);
  });

  it('drift the old way for a while after turning', () => {
    // Up to speed facing right, then a sharp turn: it still goes right for a while, though it faces down.
    const simulation = hoverAt({ x: 100, y: 100, rotation: 0 }, planned((tick) => ({ drive: 'forward', turn: tick >= tickRate && tick < tickRate + 15 ? 'right' : null })));
    track(simulation, tickRate + 15);
    const robot = simulation.robots[0];
    expect(robot.rotation).toBeCloseTo(90);
    const [from, to] = [{ ...robot.position }, track(simulation, 1)[0]];
    const way = { x: to.x - from.x, y: to.y - from.y };
    const facing = headingVector(robot.rotation);
    // Not straight where it faces: a good part of the way is still to the right.
    expect(way.x).toBeGreaterThan(0.5);
    expect(way.x * facing.x + way.y * facing.y).toBeLessThan(Math.hypot(way.x, way.y));
  });

  it('stop dead against a wall, without sliding along it', () => {
    const simulation = hoverAt({ x: 900, y: 300, rotation: 0 }, new FixedBrain({ drive: 'forward' }));
    track(simulation, 2 * tickRate);
    const robot = simulation.robots[0];
    const stuck = { ...robot.position };
    expect(stuck.x).toBeGreaterThan(1000 - HOVER.radius - fullStep - 1);
    track(simulation, 5);
    expect(robot.position).toEqual(stuck);
    expect(robot.position.y).toBe(300);
  });

  it('stop dead when two run into each other, and do not overlap', () => {
    const a = new FixedBrain({ drive: 'forward' });
    const b = new FixedBrain({ drive: 'forward' });
    const simulation = createSimulation([a, b], {
      arena: { ...DUEL_ARENA, spawns: [{ x: 300, y: 300, rotation: 0 }, { x: 700, y: 300, rotation: 180 }] },
      robots: [
        { id: 'ALPHA', brain: a, stats: HOVER },
        { id: 'BRAVO', brain: b, stats: HOVER },
      ],
    });
    for (let tick = 0; tick < 4 * tickRate; tick++) {
      simulation.step();
      const [one, two] = simulation.robots;
      expect(Math.hypot(one.position.x - two.position.x, one.position.y - two.position.y)).toBeGreaterThanOrEqual(2 * HOVER.radius - 1e-9);
    }
  });
});

describe('Walker legs', () => {
  it('are slow, but their shots on the move scatter far less, whatever the gun', () => {
    expect(WALKER.moveSpeed).toBeLessThan(statsOf(STANDARD_LOADOUT).moveSpeed);
    for (const gun of ['pistol', 'standard', 'rapid', 'cannon']) {
      const walking = statsOf({ ...STANDARD_LOADOUT, legs: 'walker', gun });
      const rolling = statsOf({ ...STANDARD_LOADOUT, gun });
      expect(walking.movingShotSpread).toBeCloseTo(rolling.movingShotSpread * 0.3);
    }
  });

  it('stop at once, as every legs but the Hover do', () => {
    expect(WALKER.slide).toBe(0);
    for (const legs of ['sprint', 'standard', 'pivot']) expect(statsOf({ ...STANDARD_LOADOUT, legs }).slide).toBe(0);
  });
});
