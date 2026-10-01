import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { FixedBrain, createSimulation, runToEnd } from './helpers';

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
