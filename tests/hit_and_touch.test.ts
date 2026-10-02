import { describe, expect, it } from 'vitest';
import { completionsAt } from '../src/ai/completion';
import { parse } from '../src/ai/parser';
import { describeAt } from '../src/ai/reference';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import type { RobotStats } from '../src/data/robot_defaults';
import { type AIContext, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import type { Simulation } from '../src/sim/simulation';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const { maxHp, shotDamage, radius } = NO_SPREAD_STATS;
/** Enough ticks for a shot fired across the duel arena to land. */
const SHOT_LANDS = 20;

/** Does nothing, and looks at `hit` only on the ticks it is asked to. Remembers what it saw. */
class Watcher implements RobotBrain {
  looking = false;
  readonly seen: boolean[] = [];
  readonly angles: number[] = [];
  readonly touching: boolean[] = [];

  decide(context: AIContext) {
    if (this.looking) this.seen.push(context.hit);
    this.angles.push(context.hitAngle);
    this.touching.push(context.touchingEnemy);
    return createIdleAction();
  }
}

/** A robot that only watches, facing one that fires a single shot at it. */
function underFire(shooter: Partial<RobotStats> = {}) {
  const watcher = new Watcher();
  const brains: [RobotBrain, RobotBrain] = [watcher, new FixedBrain({ fire: true })];
  const simulation = createSimulation(brains, {
    robots: [
      { id: 'ALPHA', brain: watcher, stats: NO_SPREAD_STATS },
      { id: 'BRAVO', brain: brains[1], stats: { ...NO_SPREAD_STATS, maxAmmo: 1, ...shooter } },
    ],
  });
  return { simulation, watcher, target: simulation.robots[0] };
}

function runUntilHit(simulation: Simulation): void {
  const [target] = simulation.robots;
  for (let tick = 0; tick < SHOT_LANDS && target.hp === maxHp; tick++) simulation.step();
  expect(target.hp).toBeLessThan(maxHp);
}

describe('hit', () => {
  it('is false until a bullet hits the robot', () => {
    const { simulation, watcher } = underFire();
    watcher.looking = true;
    runTicks(simulation, 3);
    expect(watcher.seen).toEqual([false, false, false]);
  });

  it('is true once the robot is hit, for as long as its brain does not look', () => {
    const { simulation, watcher } = underFire();
    runUntilHit(simulation);
    runTicks(simulation, 30);
    watcher.looking = true;
    simulation.step();
    expect(watcher.seen).toEqual([true]);
  });

  it('is false again from the tick after the brain looked', () => {
    const { simulation, watcher } = underFire();
    runUntilHit(simulation);
    watcher.looking = true;
    runTicks(simulation, 3);
    expect(watcher.seen).toEqual([true, false, false]);
  });

  it('is true once for hits the brain did not look at in between', () => {
    const { simulation, watcher, target } = underFire({ maxAmmo: 2 });
    for (let tick = 0; tick < 3 * tickRate && target.hp > maxHp - 2 * shotDamage; tick++) simulation.step();
    expect(target.hp).toBe(maxHp - 2 * shotDamage);
    watcher.looking = true;
    runTicks(simulation, 2);
    expect(watcher.seen).toEqual([true, false]);
  });

  it('is true for a bullet the robot guarded against', () => {
    const noticed: boolean[] = [];
    const guarding: RobotBrain = {
      decide: (context) => {
        noticed.push(context.hit);
        return { ...createIdleAction(), guard: true };
      },
    };
    const brains: [RobotBrain, RobotBrain] = [guarding, new FixedBrain({ fire: true })];
    const simulation = createSimulation(brains, { stats: { ...NO_SPREAD_STATS, maxGuards: 10_000 } });
    runTicks(simulation, SHOT_LANDS);
    expect(simulation.robots[0].hp).toBeLessThan(maxHp);
    expect(noticed.filter((hit) => hit)).toHaveLength(1);
  });

  it('is not set by the robot\'s own shots', () => {
    const noticed: boolean[] = [];
    const firing: RobotBrain = {
      decide: (context) => {
        noticed.push(context.hit);
        return { ...createIdleAction(), fire: true };
      },
    };
    const simulation = createSimulation([firing, new FixedBrain()]);
    runTicks(simulation, SHOT_LANDS);
    expect(simulation.robots[1].hp).toBeLessThan(maxHp);
    expect(noticed).not.toContain(true);
  });

  it('is noticed, once for each hit, by a program whose loop takes more than a tick', () => {
    const program = compileBrain(
      ['set hits = 0', 'loop', '    if hit', '        set hits = hits + 1', '    wait', '    wait', '    wait'].join('\n'),
    );
    const brains: [RobotBrain, RobotBrain] = [program, new FixedBrain({ fire: true })];
    const simulation = createSimulation(brains, {
      robots: [
        { id: 'ALPHA', brain: program, stats: NO_SPREAD_STATS },
        { id: 'BRAVO', brain: brains[1], stats: { ...NO_SPREAD_STATS, maxAmmo: 3 } },
      ],
    });
    // Three shots, a cooldown apart: each lands before the next is fired.
    runTicks(simulation, 4 * tickRate);
    expect(simulation.robots[0].hp).toBe(maxHp - 3 * shotDamage);
    expect(simulation.robots[0].variables.get('hits')).toBe(3);
  });
});

describe('hit_angle', () => {
  it('is 0 before the first hit', () => {
    const { simulation, watcher } = underFire();
    runTicks(simulation, 3);
    expect(watcher.angles).toEqual([0, 0, 0]);
  });

  it('points at where the bullet came from: straight ahead for a robot facing the shooter', () => {
    const { simulation, watcher } = underFire();
    runUntilHit(simulation);
    simulation.step();
    expect(watcher.angles.at(-1)).toBeCloseTo(0);
  });

  it('is measured from the hull: to the right for a robot with the shooter on its right', () => {
    const watcher = new Watcher();
    const brains: [RobotBrain, RobotBrain] = [watcher, new FixedBrain({ fire: true })];
    // ALPHA faces up the field (rotation -90); BRAVO is to its right and shoots at it.
    const arena = { ...DUEL_ARENA, spawns: [{ ...DUEL_ARENA.spawns[0], rotation: -90 }, DUEL_ARENA.spawns[1]] };
    const simulation = createSimulation(brains, { arena });
    runUntilHit(simulation);
    simulation.step();
    expect(watcher.angles.at(-1)).toBeCloseTo(90);
  });

  it('follows the hull as it turns, and stays after the brain has looked at hit', () => {
    const turning = compileBrain(['loop', '    if hit', '        label HIT', '    turn right'].join('\n'));
    const simulation = createSimulation([turning, new FixedBrain({ fire: true })], {
      stats: { ...NO_SPREAD_STATS, maxAmmo: 1 },
    });
    const [target] = simulation.robots;
    while (target.hp === maxHp) simulation.step();
    runTicks(simulation, 5);
    // The shooter stays where it was: the angle to the hit is the angle to the shooter.
    const { hitAngle } = target.hitReading;
    expect(target.label).toBe('HIT');
    expect(hitAngle).not.toBeCloseTo(0);
    expect(hitAngle).toBeCloseTo(target.sensorReading.enemyAngle);
  });
});

describe('touching_enemy', () => {
  const driving = (): RobotBrain => new FixedBrain({ drive: 'forward' });

  it('is false for robots that stand apart', () => {
    const watchers: [Watcher, Watcher] = [new Watcher(), new Watcher()];
    runTicks(createSimulation(watchers), 3);
    expect(watchers[0].touching).toEqual([false, false, false]);
    expect(watchers[1].touching).toEqual([false, false, false]);
  });

  it('is true for both robots once they have driven into each other', () => {
    const simulation = createSimulation([driving(), driving()]);
    runTicks(simulation, 2 * tickRate);
    expect(simulation.robots.map((robot) => robot.surroundings.touchingEnemy)).toEqual([true, true]);
  });

  it('is true for the robot that was driven into as well', () => {
    const simulation = createSimulation([driving(), new FixedBrain()]);
    runTicks(simulation, 3 * tickRate);
    expect(simulation.robots.map((robot) => robot.surroundings.touchingEnemy)).toEqual([true, true]);
  });

  it('is true for both of two robots that drive at different speeds', () => {
    const brains: [RobotBrain, RobotBrain] = [driving(), driving()];
    const simulation = createSimulation(brains, {
      robots: [
        { id: 'ALPHA', brain: brains[0], stats: { ...NO_SPREAD_STATS, moveSpeed: 160 } },
        { id: 'BRAVO', brain: brains[1], stats: { ...NO_SPREAD_STATS, moveSpeed: 60 } },
      ],
    });
    runTicks(simulation, 2 * tickRate);
    expect(simulation.robots.map((robot) => robot.surroundings.touchingEnemy)).toEqual([true, true]);
  });

  it('is false again once a robot has backed away', () => {
    const program = compileBrain(
      ['drive forward', 'while not touching_enemy', '    wait', 'label BUMPED', 'drive backward', 'loop', '    wait'].join('\n'),
    );
    const simulation = createSimulation([program, new FixedBrain()]);
    const [robot, other] = simulation.robots;
    runTicks(simulation, 3 * tickRate);
    expect(robot.label).toBe('BUMPED');
    expect(robot.surroundings.touchingEnemy).toBe(false);
    expect(other.position.x - robot.position.x).toBeGreaterThan(2 * radius + 10);
  });

  it('leaves blocked to walls and obstacles', () => {
    const simulation = createSimulation([driving(), driving()]);
    runTicks(simulation, 2 * tickRate);
    expect(simulation.robots.map((robot) => robot.blocked)).toEqual([false, false]);
  });
});

describe('turn hit', () => {
  /** ALPHA faces up the field, with BRAVO, which shoots at it once, on its right. */
  function shotFromTheRight(program: string) {
    const brains: [RobotBrain, RobotBrain] = [compileBrain(program), new FixedBrain({ fire: true })];
    const arena = { ...DUEL_ARENA, spawns: [{ ...DUEL_ARENA.spawns[0], rotation: -90 }, DUEL_ARENA.spawns[1]] };
    const simulation = createSimulation(brains, {
      arena,
      robots: [
        { id: 'ALPHA', brain: brains[0], stats: NO_SPREAD_STATS },
        { id: 'BRAVO', brain: brains[1], stats: { ...NO_SPREAD_STATS, maxAmmo: 1 } },
      ],
    });
    return { simulation, robot: simulation.robots[0] };
  }

  it('is a statement of the language', () => {
    expect(parse('loop\n    turn hit')).toMatchObject({
      errors: [],
      program: { body: [{ kind: 'loop', body: [{ kind: 'turn', line: 2, direction: 'hit' }] }] },
    });
    expect(parse('aim hit').errors).toMatchObject([{ line: 1, message: 'Unknown direction "hit"' }]);
  });

  it('does nothing until the robot has been hit', () => {
    const { simulation, robot } = shotFromTheRight('loop\n    turn hit');
    const before = robot.rotation;
    runTicks(simulation, 5);
    expect(robot.hp).toBe(maxHp);
    expect(robot.rotation).toBe(before);
  });

  it('turns the hull to where the bullet came from, and stops there', () => {
    const { simulation, robot } = shotFromTheRight('loop\n    turn hit');
    runUntilHit(simulation);
    simulation.step();
    // A quarter turn to the right, at the speed the hull turns: 6 deg a tick.
    expect(robot.rotation).toBeCloseTo(-90 + NO_SPREAD_STATS.rotateSpeed / tickRate);
    runTicks(simulation, tickRate);
    expect(robot.rotation).toBeCloseTo(0);
    expect(robot.hitReading.hitAngle).toBeCloseTo(0);
    expect(robot.sensorReading.enemyAngle).toBeCloseTo(0);
  });

  it('still knows the way after the program has looked at hit', () => {
    const program = ['loop', '    if hit', '        label HIT', '    turn hit'].join('\n');
    const { simulation, robot } = shotFromTheRight(program);
    runUntilHit(simulation);
    runTicks(simulation, tickRate);
    expect(robot.label).toBe('HIT');
    expect(robot.rotation).toBeCloseTo(0);
  });

  it('is offered and explained as a direction after turn, and as a sensor elsewhere', () => {
    const after = (source: string) => completionsAt(source, source.length, true)?.options.find((option) => option.word === 'hit');
    expect(after('turn ')).toMatchObject({ kind: 'direction' });
    expect(after('if ')).toMatchObject({ kind: 'sensor' });
    expect(completionsAt('aim ', 4, true)?.options.map((option) => option.word)).not.toContain('hit');

    const turning = 'loop\n    if hit\n        turn hit';
    expect(describeAt(turning, turning.indexOf('if hit') + 4)).toMatchObject({ word: 'hit', kind: 'sensor' });
    expect(describeAt(turning, turning.indexOf('turn hit') + 6)).toMatchObject({ word: 'hit', kind: 'direction' });
  });
});
