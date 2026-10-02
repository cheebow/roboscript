import { describe, expect, it } from 'vitest';
import type { RobotStats } from '../src/data/robot_defaults';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { distance } from '../src/sim/math';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const { maxHp, maxAmmo, moveSpeed } = NO_SPREAD_STATS;
/** Long enough for the first shot of each robot to land, too short for a second. */
const ONE_VOLLEY_TICKS = 20;

/** A duel between two robots whose stats differ from the usual ones as given. */
function duel(brains: [RobotBrain, RobotBrain], alpha: Partial<RobotStats>, bravo: Partial<RobotStats>) {
  return createSimulation(brains, {
    robots: [
      { id: 'ALPHA', brain: brains[0], stats: { ...NO_SPREAD_STATS, ...alpha } },
      { id: 'BRAVO', brain: brains[1], stats: { ...NO_SPREAD_STATS, ...bravo } },
    ],
  });
}

const idle = (): [RobotBrain, RobotBrain] => [new FixedBrain(), new FixedBrain()];
const firing = (): [RobotBrain, RobotBrain] => [new FixedBrain({ fire: true }), new FixedBrain({ fire: true })];
const driving = (): [RobotBrain, RobotBrain] => [
  new FixedBrain({ drive: 'forward' }),
  new FixedBrain({ drive: 'forward' }),
];

describe('robots with stats of their own', () => {
  it('start with their own HP, ammo and guards', () => {
    const [alpha, bravo] = duel(idle(), { maxHp: 150, maxAmmo: 10, maxGuards: 1 }, { maxHp: 60 }).robots;
    expect([alpha.hp, alpha.weapon.ammo, alpha.guardsLeft]).toEqual([150, 10, 1]);
    expect([bravo.hp, bravo.weapon.ammo, bravo.guardsLeft]).toEqual([60, maxAmmo, NO_SPREAD_STATS.maxGuards]);
  });

  it('drive at their own speed', () => {
    const ticks = 10;
    const simulation = duel(driving(), { moveSpeed: moveSpeed / 2 }, {});
    const [alpha, bravo] = simulation.robots;
    const [alphaStart, bravoStart] = [alpha.position.x, bravo.position.x];
    runTicks(simulation, ticks);
    expect(alpha.position.x - alphaStart).toBeCloseTo(((moveSpeed / 2) * ticks) / tickRate);
    expect(bravoStart - bravo.position.x).toBeCloseTo((moveSpeed * ticks) / tickRate);
  });

  it('are hurt by the damage of the gun that shot them', () => {
    const simulation = duel(firing(), { shotDamage: 10 }, { shotDamage: 30 });
    runTicks(simulation, ONE_VOLLEY_TICKS);
    expect(simulation.robots.map((robot) => robot.hp)).toEqual([maxHp - 30, maxHp - 10]);
  });

  it('shoot as far as their own gun reaches', () => {
    const simulation = duel(firing(), { weaponRange: 100 }, {});
    runTicks(simulation, ONE_VOLLEY_TICKS);
    expect(simulation.robots.map((robot) => robot.hp)).toEqual([maxHp - NO_SPREAD_STATS.shotDamage, maxHp]);
  });

  it('are told how far their own gun shoots', () => {
    const told: number[] = [];
    const listening = (): RobotBrain => ({
      decide: (context) => {
        told.push(context.weaponRange);
        return createIdleAction();
      },
    });
    duel([listening(), listening()], { weaponRange: 250 }, {}).step();
    expect(told).toEqual([250, NO_SPREAD_STATS.weaponRange]);
  });

  it('can hold their fire until the enemy is within weapon_range', () => {
    // The robots stand 200 apart: within reach of the usual gun, out of reach of a gun that shoots 150.
    const patient = (): RobotBrain => compileBrain('loop\n    if enemy_distance < weapon_range\n        fire\n    else\n        wait');
    const simulation = duel([patient(), patient()], { weaponRange: 150 }, {});
    runTicks(simulation, 5);
    expect(simulation.robots.map((robot) => robot.weapon.ammo)).toEqual([maxAmmo, maxAmmo - 1]);
  });

  it('see as far as their own sensor reaches', () => {
    const simulation = duel(idle(), { sensorRange: 100 }, {});
    simulation.step();
    expect(simulation.robots.map((robot) => robot.sensorReading.enemyVisible)).toEqual([false, true]);
  });

  it('are put off their next shot by their own guard recovery', () => {
    const bracing = (): RobotBrain => new FixedBrain({ guard: true, fire: true });
    const tireless = { maxGuards: 10_000 };
    const simulation = duel([bracing(), bracing()], { ...tireless, guardRecovery: 0 }, tireless);
    runTicks(simulation, ONE_VOLLEY_TICKS);
    expect(simulation.robots.map((robot) => robot.weapon.ammo)).toEqual([maxAmmo - 1, maxAmmo]);
  });

  it('stop where they touch, whatever their sizes', () => {
    const [small, large] = [16, 30];
    const simulation = duel(driving(), { radius: small }, { radius: large });
    const [alpha, bravo] = simulation.robots;
    runTicks(simulation, 2 * tickRate);
    const gap = distance(alpha.position, bravo.position) - (small + large);
    expect(gap).toBeGreaterThanOrEqual(0);
    // Each stopped less than one step short of the other.
    expect(gap).toBeLessThan((2 * moveSpeed) / tickRate);
  });

  it('are hit by a bullet that passes within their own radius', () => {
    const [small, large] = [8, 40];
    // ALPHA's shots fly along y = 300; BRAVO stands 30 below that line.
    const hpOfBravo = (radius: number) => {
      const brains: [RobotBrain, RobotBrain] = [new FixedBrain({ fire: true }), new FixedBrain()];
      const simulation = duel(brains, {}, { radius });
      simulation.robots[1].position.y += 30;
      runTicks(simulation, ONE_VOLLEY_TICKS);
      return simulation.robots[1].hp;
    };
    expect(hpOfBravo(small)).toBe(maxHp);
    expect(hpOfBravo(large)).toBe(maxHp - NO_SPREAD_STATS.shotDamage);
  });
});
