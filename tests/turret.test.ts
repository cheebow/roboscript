import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { type AIContext, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { leadPoint } from '../src/sim/aiming';
import { distance } from '../src/sim/math';
import type { Arena, SpawnPoint } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const { turretSpeed, shotSpeed, moveSpeed, radius, bulletRadius, maxHp, shotDamage } = NO_SPREAD_STATS;
const TURRET_STEP = turretSpeed / tickRate;
const BULLET_STEP = shotSpeed / tickRate;
const MUZZLE = radius + bulletRadius;

/** Remembers what its robot sensed on each tick, and does nothing. */
class Probe implements RobotBrain {
  readonly contexts: AIContext[] = [];

  decide(context: AIContext) {
    this.contexts.push(context);
    return createIdleAction();
  }
}

function arenaWith(spawns: [SpawnPoint, SpawnPoint]): Arena {
  return { ...DUEL_ARENA, spawns };
}

describe('turret', () => {
  it('turns on the hull at TURRET_SPEED, clockwise for right, and leaves the hull alone', () => {
    const right = createSimulation([new FixedBrain({ aim: 'right' }), new FixedBrain()]);
    runTicks(right, 5);
    expect(right.robots[0].gunRotation).toBeCloseTo(TURRET_STEP * 5);
    expect(right.robots[0].rotation).toBe(0);
    expect(right.robots[0].gunHeading).toBeCloseTo(TURRET_STEP * 5);

    const left = createSimulation([new FixedBrain({ aim: 'left' }), new FixedBrain()]);
    runTicks(left, 5);
    expect(left.robots[0].gunRotation).toBeCloseTo(-TURRET_STEP * 5);
  });

  it('turns with the hull', () => {
    const simulation = createSimulation([compileBrain('aim right\naim right\nloop\n    turn left'), new FixedBrain()]);
    runTicks(simulation, 7);
    const [robot] = simulation.robots;
    expect(robot.gunRotation).toBeCloseTo(TURRET_STEP * 2);
    expect(robot.gunHeading).toBeCloseTo(robot.rotation + TURRET_STEP * 2);
  });

  it('comes back to the front of the hull with aim ahead, without overshooting', () => {
    const simulation = createSimulation([compileBrain('aim right\naim right\naim right\nloop\n    aim ahead'), new FixedBrain()]);
    runTicks(simulation, 3);
    expect(simulation.robots[0].gunRotation).toBeCloseTo(TURRET_STEP * 3);
    runTicks(simulation, 10);
    expect(simulation.robots[0].gunRotation).toBeCloseTo(0);
  });

  it('fires the way the gun points, not the way the hull faces', () => {
    const program = `${'aim right\n'.repeat(90 / TURRET_STEP)}fire\nloop\n    wait`;
    const simulation = createSimulation([compileBrain(program), new FixedBrain()], {
      arena: arenaWith([{ x: 300, y: 300, rotation: 0 }, { x: 900, y: 100, rotation: 180 }]),
    });
    runTicks(simulation, 90 / TURRET_STEP + 1);
    const [bullet] = simulation.bullets;
    expect(bullet.direction.x).toBeCloseTo(0);
    expect(bullet.direction.y).toBeCloseTo(1);
    expect(bullet.position.x).toBeCloseTo(300);
  });

  it('turns to the enemy with aim enemy, while the hull stays as it is', () => {
    // The enemy is 90 degrees to the right of the way the hull faces.
    const arena = arenaWith([{ x: 400, y: 300, rotation: -90 }, { x: 600, y: 300, rotation: 180 }]);
    const simulation = createSimulation([new FixedBrain({ aim: 'enemy' }), new FixedBrain()], { arena });
    runTicks(simulation, 5);
    expect(simulation.robots[0].gunRotation).toBeCloseTo(TURRET_STEP * 5);
    runTicks(simulation, 20);
    expect(simulation.robots[0].gunRotation).toBeCloseTo(90);
    expect(simulation.robots[0].gunHeading).toBeCloseTo(0);
    expect(simulation.robots[0].rotation).toBe(-90);
  });
});

describe('gun sensors', () => {
  it('tell how far the gun is off the enemy, and where it stands on the hull', () => {
    const probe = new Probe();
    const arena = arenaWith([{ x: 400, y: 300, rotation: -90 }, { x: 600, y: 300, rotation: 180 }]);
    createSimulation([probe, new FixedBrain()], { arena }).step();
    expect(probe.contexts[0]).toMatchObject({ enemyAngle: 90, aimAngle: 90, leadAngle: 90, gunAngle: 0 });
  });

  it('read 0 once aim enemy has the gun on the enemy', () => {
    const arena = arenaWith([{ x: 400, y: 300, rotation: -90 }, { x: 600, y: 300, rotation: 180 }]);
    const program = 'loop\n    if aim_angle > 1 or aim_angle < -1\n        aim enemy\n    else\n        wait';
    const simulation = createSimulation([compileBrain(program), new FixedBrain()], { arena });
    runTicks(simulation, 30);
    const { aimAngle, gunAngle } = simulation.robots[0].gunReading;
    expect(aimAngle).toBeCloseTo(0);
    expect(gunAngle).toBeCloseTo(90);
    // The hull has not turned, so the enemy is still to its right.
    expect(simulation.robots[0].sensorReading.enemyAngle).toBeCloseTo(90);
  });

  it('read 0 before the enemy has been seen', () => {
    const probe = new Probe();
    const hidden: Arena = { ...DUEL_ARENA, obstacles: [{ x: 480, y: 100, width: 40, height: 400 }] };
    createSimulation([probe, new FixedBrain()], { arena: hidden }).step();
    expect(probe.contexts[0]).toMatchObject({ enemyVisible: false, aimAngle: 0, leadAngle: 0, gunAngle: 0 });
  });
});

describe('leadPoint', () => {
  const from = { x: 0, y: 0 };
  const target = { x: 300, y: 0 };

  it('is the target itself when it stands still', () => {
    expect(leadPoint(from, target, { x: 0, y: 0 }, BULLET_STEP, MUZZLE)).toEqual(target);
  });

  it('is where the bullet and a moving target arrive at the same time', () => {
    const velocity = { x: 1, y: 3 };
    const point = leadPoint(from, target, velocity, BULLET_STEP, MUZZLE);
    const ticks = (point.y - target.y) / velocity.y;
    expect(ticks).toBeGreaterThan(0);
    expect(point.x).toBeCloseTo(target.x + velocity.x * ticks);
    expect(distance(from, point)).toBeCloseTo(MUZZLE + BULLET_STEP * ticks);
  });

  it('is further ahead the faster the target crosses', () => {
    const slow = leadPoint(from, target, { x: 0, y: 1 }, BULLET_STEP, MUZZLE);
    const fast = leadPoint(from, target, { x: 0, y: 3 }, BULLET_STEP, MUZZLE);
    expect(fast.y).toBeGreaterThan(slow.y * 2.9);
  });

  it('falls back on the target when the bullet can never catch it', () => {
    expect(leadPoint(from, target, { x: BULLET_STEP * 2, y: 0 }, BULLET_STEP, MUZZLE)).toEqual(target);
  });
});

describe('shooting at a moving enemy', () => {
  const shoot = (aim: 'enemy' | 'lead') => {
    const angle = aim === 'enemy' ? 'aim_angle' : 'lead_angle';
    return `loop\n    if ${angle} > 1 or ${angle} < -1\n        aim ${aim}\n    else\n        fire`;
  };
  const DISTANCE = 300;

  /** HP the target has left after `seconds` under fire from a robot standing still. */
  function targetHp(shooter: string, target: RobotBrain, targetSpawn: SpawnPoint, seconds: number): number {
    const arena = arenaWith([{ x: targetSpawn.x - DISTANCE, y: 300, rotation: 0 }, targetSpawn]);
    const simulation = createSimulation([compileBrain(shooter), target], { arena, maxMatchTime: seconds });
    runTicks(simulation, seconds * tickRate - 1);
    return simulation.robots[1].hp;
  }

  // Crosses in front of the shooter, from the top of the arena to the bottom.
  const crossing: SpawnPoint = { x: 700, y: 60, rotation: 90 };
  const CROSSING_TIME = 4;
  expect(crossing.y + moveSpeed * CROSSING_TIME).toBeLessThan(DUEL_ARENA.height - radius);

  it('misses an enemy that drives across when aiming at where it is', () => {
    expect(targetHp(shoot('enemy'), new FixedBrain({ drive: 'forward' }), crossing, CROSSING_TIME)).toBe(maxHp);
  });

  it('hits it when aiming at where it will be', () => {
    const hp = targetHp(shoot('lead'), new FixedBrain({ drive: 'forward' }), crossing, CROSSING_TIME);
    expect(hp).toBeLessThanOrEqual(maxHp - shotDamage * 3);
  });

  it('hits an enemy that stands still either way', () => {
    const standing: SpawnPoint = { x: 700, y: 300, rotation: 180 };
    for (const aim of ['enemy', 'lead'] as const) {
      expect(targetHp(shoot(aim), new FixedBrain(), standing, 3)).toBeLessThanOrEqual(maxHp - shotDamage * 3);
    }
  });

  it('is thrown off by an enemy that keeps turning back', () => {
    // To and fro, a third of a second each way: back before the bullet arrives.
    const weave = `loop\n    drive forward\n${'    wait\n'.repeat(10)}    drive backward\n${'    wait\n'.repeat(10)}`;
    const middle: SpawnPoint = { x: 700, y: 300, rotation: 90 };
    const straight = targetHp(shoot('lead'), new FixedBrain({ drive: 'forward' }), crossing, CROSSING_TIME);
    const weaving = targetHp(shoot('lead'), compileBrain(weave), middle, CROSSING_TIME);
    expect(weaving).toBeGreaterThan(straight);
  });
});
