import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { DebugLogger } from '../src/debug/debug_logger';
import { captureSnapshot } from '../src/debug/snapshot';
import { FixedBrain, compileBrain, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const { recoveryDelay, recoveryRate, maxHp } = ROBOT_DEFAULTS;
const DELAY_TICKS = recoveryDelay * tickRate;

/** Two robots that stand still, hidden from each other by the centre block, the first one hurt. */
function hiddenAndHurt(damage = 100) {
  const simulation = createSimulation([new FixedBrain(), new FixedBrain()], { arena: DEFAULT_ARENA, stats: ROBOT_DEFAULTS });
  simulation.robots[0].takeDamage(damage);
  return simulation;
}

describe('recovering out of the enemy\'s sight', () => {
  it('starts after the delay and regains hp at the rate, a whole point at a time', () => {
    const simulation = hiddenAndHurt();
    const [hurt] = simulation.robots;
    runTicks(simulation, DELAY_TICKS);
    expect(hurt.hp).toBe(maxHp - 100);
    expect(hurt.recovering).toBe(false);

    simulation.step();
    expect(hurt.recovering).toBe(true);
    runTicks(simulation, tickRate - 1);
    expect(hurt.hp).toBe(maxHp - 100 + recoveryRate);
    expect(Number.isInteger(hurt.hp)).toBe(true);
  });

  it('does not happen while the robot drives, even out of the enemy\'s sight', () => {
    const simulation = createSimulation([new FixedBrain({ drive: 'forward' }), new FixedBrain()], {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
    });
    const [hurt] = simulation.robots;
    hurt.takeDamage(100);
    runTicks(simulation, DELAY_TICKS + tickRate);
    expect(hurt.hidden).toBe(true);
    expect(hurt.recovering).toBe(false);
    expect(hurt.hp).toBe(maxHp - 100);
  });

  it('goes on while the robot only turns on the spot', () => {
    const simulation = createSimulation([new FixedBrain({ turn: 'left' }), new FixedBrain()], {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
    });
    const [hurt] = simulation.robots;
    hurt.takeDamage(100);
    runTicks(simulation, DELAY_TICKS + tickRate);
    expect(hurt.hp).toBe(maxHp - 100 + recoveryRate);
  });

  it('stops at full hp', () => {
    const simulation = hiddenAndHurt(5);
    const [hurt] = simulation.robots;
    runTicks(simulation, DELAY_TICKS + tickRate * 2);
    expect(hurt.hp).toBe(maxHp);
    expect(hurt.recovering).toBe(false);
  });

  it('does not happen while the enemy sees the robot', () => {
    // In the duel arena the robots see each other from the start.
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()], { stats: ROBOT_DEFAULTS });
    const [hurt] = simulation.robots;
    hurt.takeDamage(100);
    runTicks(simulation, DELAY_TICKS + tickRate * 2);
    expect(hurt.hp).toBe(maxHp - 100);
    expect(hurt.hidden).toBe(false);
    expect(hurt.recovering).toBe(false);
  });

  it('goes by the enemy\'s sensor, not the robot\'s own', () => {
    // The enemy sees only close by; the robot sees far. The robot is hidden from the enemy while it still sees the enemy.
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()], {
      stats: ROBOT_DEFAULTS,
      robots: [
        { id: 'ALPHA', brain: new FixedBrain(), stats: ROBOT_DEFAULTS },
        { id: 'BRAVO', brain: new FixedBrain(), stats: { ...ROBOT_DEFAULTS, sensorRange: 100 } },
      ],
    });
    simulation.step();
    const [far, near] = simulation.robots;
    expect(far.sensorReading.enemyVisible).toBe(true);
    expect(far.hidden).toBe(true);
    expect(near.hidden).toBe(false);
  });

  it('is cut off when the enemy catches sight of the robot, and starts over after the delay', () => {
    // The robot waits below the centre block; the enemy starts above it, on the far left, and drives down past it.
    const roundTheBlock = {
      ...DEFAULT_ARENA,
      spawns: [
        { x: 500, y: 420, rotation: 180 },
        { x: 120, y: 100, rotation: 90 },
      ],
    };
    const simulation = createSimulation([new FixedBrain(), new FixedBrain({ drive: 'forward' })], {
      arena: roundTheBlock,
      stats: ROBOT_DEFAULTS,
    });
    const [hurt] = simulation.robots;
    hurt.takeDamage(100);
    // Until the enemy sees the robot past the block, the robot recovers.
    let recoveredTicks = 0;
    do {
      simulation.step();
      if (hurt.recovering) recoveredTicks++;
    } while (hurt.hidden && simulation.tick < tickRate * 20);
    expect(hurt.hidden).toBe(false);
    expect(recoveredTicks).toBeGreaterThan(0);
    expect(hurt.recovering).toBe(false);
  });

  it('is told to the program as "hidden", and shown in the snapshot and the log', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation(
      [compileBrain('loop\n    if hidden\n        label HIDDEN\n    else\n        label SEEN\n    wait'), new FixedBrain()],
      { arena: DEFAULT_ARENA, stats: ROBOT_DEFAULTS, logger },
    );
    simulation.robots[0].takeDamage(50);
    runTicks(simulation, DELAY_TICKS + 2);
    const [robot] = captureSnapshot(simulation).robots;
    expect(robot.label).toBe('HIDDEN');
    expect(robot.hidden).toBe(true);
    expect(robot.recovering).toBe(true);
    expect(logger.events.map((event) => event.message)).toContain('hidden from the enemy: recovering hp');
  });

  it('is a reserved word: a program cannot set a variable called hidden', () => {
    expect(() => compileBrain('set hidden = 1\nloop\n    wait')).toThrow(/hidden/);
  });
});
