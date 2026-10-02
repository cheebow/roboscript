import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, createSimulation, runToEnd } from './helpers';

const { maxMatchTime } = MATCH_DEFAULTS;

describe('battle result', () => {
  it('ends when a robot reaches 0 HP', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()]);
    runToEnd(simulation);

    expect(simulation.result).toEqual({ winnerId: 'ALPHA', reason: 'destroyed' });
    expect(simulation.robots[1].hp).toBe(0);
    expect(simulation.time).toBeLessThan(maxMatchTime);

    const endTick = simulation.tick;
    simulation.step();
    expect(simulation.tick).toBe(endTick);
  });

  it('is a draw when both robots are destroyed on the same tick', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain({ fire: true })]);
    runToEnd(simulation);
    expect(simulation.result).toEqual({ winnerId: null, reason: 'destroyed' });
  });

  it('times out after the maximum match time', () => {
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()]);
    runToEnd(simulation);
    expect(simulation.time).toBe(maxMatchTime);
    expect(simulation.result).toEqual({ winnerId: null, reason: 'timeout' });
  });

  it('gives a timeout to the robot with more HP', () => {
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()]);
    simulation.robots[0].takeDamage(1);
    runToEnd(simulation);
    expect(simulation.result).toEqual({ winnerId: 'BRAVO', reason: 'timeout' });
  });
});

describe('running out of ammo', () => {
  const twoShots = { ...NO_SPREAD_STATS, maxAmmo: 2 };
  const { shotDamage, maxHp } = twoShots;

  it('ends the match once nobody can shoot and the last bullet has landed, on the HP left', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain({ fire: true })], {
      stats: twoShots,
    });
    runToEnd(simulation);
    expect(simulation.result).toEqual({ winnerId: null, reason: 'out of ammo' });
    expect(simulation.time).toBeLessThan(maxMatchTime);
    // Both shots of both robots were counted before the match was called.
    expect(simulation.robots.map((robot) => robot.hp)).toEqual([maxHp - shotDamage * 2, maxHp - shotDamage * 2]);
    expect(simulation.bullets).toEqual([]);
  });

  it('gives the match to the robot with more HP left', () => {
    // The first robot faces away and wastes its shots.
    const arena = { ...DUEL_ARENA, spawns: [{ ...DUEL_ARENA.spawns[0], rotation: 180 }, DUEL_ARENA.spawns[1]] };
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain({ fire: true })], {
      arena,
      stats: twoShots,
    });
    runToEnd(simulation);
    expect(simulation.result).toEqual({ winnerId: 'BRAVO', reason: 'out of ammo' });
  });

  it('does not end the match while one robot can still shoot', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()], { stats: twoShots });
    runToEnd(simulation);
    expect(simulation.result).toEqual({ winnerId: 'ALPHA', reason: 'timeout' });
    expect(simulation.robots[1].weapon.ammo).toBe(2);
  });
});
