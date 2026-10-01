import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { MatchController } from '../src/sim/match_controller';
import { FixedBrain, createSimulation, runToEnd } from './helpers';

const { tickRate, maxMatchTime, maxFrameTime } = MATCH_DEFAULTS;

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

describe('MatchController', () => {
  it('runs ticks at the fixed rate regardless of frame length', () => {
    const controller = new MatchController(createSimulation([new FixedBrain(), new FixedBrain()]), maxFrameTime);
    const frameTime = 1 / 60;
    let ticks = 0;
    for (let frame = 0; frame < 60; frame++) ticks += controller.advance(frameTime);
    expect(Math.abs(ticks - tickRate)).toBeLessThanOrEqual(1);
  });

  it('does not advance while paused, and resumes where it left off', () => {
    const controller = new MatchController(createSimulation([new FixedBrain(), new FixedBrain()]), maxFrameTime);
    const frameTime = 1 / tickRate;
    controller.advance(frameTime);
    const tick = controller.simulation.tick;

    controller.paused = true;
    expect(controller.advance(frameTime)).toBe(0);
    expect(controller.simulation.tick).toBe(tick);

    controller.paused = false;
    controller.advance(frameTime);
    expect(controller.simulation.tick).toBe(tick + 1);
  });

  it('caps the catch-up after a long frame', () => {
    const controller = new MatchController(createSimulation([new FixedBrain(), new FixedBrain()]), maxFrameTime);
    expect(controller.advance(10)).toBeLessThanOrEqual(Math.ceil(maxFrameTime * tickRate));
  });
});
