import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { type AIContext, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { Simulation } from '../src/sim/simulation';
import type { Arena } from '../src/sim/types';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runTicks } from './helpers';

/** ALPHA and CHARLIE (team 0) face BRAVO and DELTA (team 1) on open ground. */
const ROW: Arena = {
  width: 1000,
  height: 600,
  obstacles: [],
  spawns: [
    { x: 400, y: 300, rotation: 0 },
    { x: 600, y: 300, rotation: 180 },
    { x: 300, y: 300, rotation: 0 },
    { x: 700, y: 300, rotation: 180 },
  ],
};

const IDS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

/** Records what the brain senses, and does nothing. */
class SensingBrain implements RobotBrain {
  readonly seen: AIContext[] = [];
  decide(context: AIContext) {
    this.seen.push({ ...context });
    return createIdleAction();
  }
}

/** Runs the given brain, recording what it saw each tick. */
function watched(brain: RobotBrain, watcher: SensingBrain): RobotBrain {
  return {
    decide(context: AIContext) {
      watcher.seen.push({ ...context });
      return brain.decide(context);
    },
  };
}

function teamMatch(brains: RobotBrain[]) {
  return new Simulation({
    arena: ROW,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
    seed: 1,
    robots: brains.map((brain, index) => ({ id: IDS[index], brain, stats: NO_SPREAD_STATS })),
    teams: [0, 1, 0, 1],
  });
}

describe('signal', () => {
  it('reaches the team from the next tick on, and stays until a new number is sent', () => {
    const charlie = new SensingBrain();
    const sender = compileBrain('signal 7\nloop\n    wait\n');
    const simulation = teamMatch([sender, new FixedBrain(), charlie, new FixedBrain()]);
    runTicks(simulation, 3);
    expect(charlie.seen.map((context) => context.allySignal)).toEqual([0, 7, 7]);
  });

  it('is read as it stood at the start of the tick, whoever thinks first', () => {
    // CHARLIE (index 2) sends on tick 1; ALPHA (index 0) thinks before it, yet reads the same tick-start 0.
    const alpha = new SensingBrain();
    const sender = compileBrain('signal 5\nloop\n    wait\n');
    const simulation = teamMatch([alpha, new FixedBrain(), sender, new FixedBrain()]);
    runTicks(simulation, 2);
    expect(alpha.seen.map((context) => context.allySignal)).toEqual([0, 5]);
  });

  it('keeps the number of the highest-numbered machine when two send on the same tick', () => {
    // ALPHA (index 0) sends 1 and CHARLIE (index 2) sends 2 on the same tick: 2 stays.
    const alpha = new SensingBrain();
    const bravo = new SensingBrain();
    const simulation = teamMatch([
      watched(compileBrain('signal 1\nloop\n    wait\n'), alpha),
      bravo,
      compileBrain('signal 2\nloop\n    wait\n'),
      new FixedBrain(),
    ]);
    runTicks(simulation, 2);
    expect(alpha.seen.map((context) => context.allySignal)).toEqual([0, 2]);
    // The other team's radio hears nothing of it.
    expect(bravo.seen.map((context) => context.allySignal)).toEqual([0, 0]);
  });

  it('does not take a tick: the robot acts on the same tick it signals', () => {
    const simulation = teamMatch([
      compileBrain('signal 1\nfire\nloop\n    wait\n'),
      new FixedBrain(),
      new FixedBrain(),
      new FixedBrain(),
    ]);
    simulation.step();
    expect(simulation.bullets.length).toBe(1);
  });

  it('is a note to the robot itself outside a team match', () => {
    const watcher = new SensingBrain();
    const simulation = createSimulation([watched(compileBrain('signal 9\nloop\n    wait\n'), watcher), new FixedBrain()]);
    runTicks(simulation, 2);
    expect(watcher.seen.map((context) => context.allySignal)).toEqual([0, 9]);
  });
});

describe('signal to one machine', () => {
  it('reaches only the machine it is addressed to, with the sender\'s number', () => {
    // ALPHA (self_id 1) sends to machine 2: CHARLIE (self_id 2) hears it, ALPHA's own mailbox stays empty.
    const alpha = new SensingBrain();
    const charlie = new SensingBrain();
    const simulation = teamMatch([
      watched(compileBrain('signal 7 to 2\nloop\n    wait\n'), alpha),
      new FixedBrain(),
      charlie,
      new FixedBrain(),
    ]);
    runTicks(simulation, 2);
    expect(charlie.seen.map((context) => context.allySignal)).toEqual([0, 7]);
    expect(charlie.seen.map((context) => context.allySignalFrom)).toEqual([0, 1]);
    expect(alpha.seen.map((context) => context.allySignal)).toEqual([0, 0]);
  });

  it('tells everyone who sent a broadcast, through ally_signal_from', () => {
    // CHARLIE (self_id 2) broadcasts: ALPHA reads the number and the sender's 2.
    const alpha = new SensingBrain();
    const simulation = teamMatch([alpha, new FixedBrain(), compileBrain('signal 4\nloop\n    wait\n'), new FixedBrain()]);
    runTicks(simulation, 2);
    expect(alpha.seen.map((context) => context.allySignalFrom)).toEqual([0, 2]);
  });

  it('takes a computed addressee, and self_id as a note to the robot itself', () => {
    const alpha = new SensingBrain();
    const simulation = teamMatch([
      watched(compileBrain('signal 9 to self_id + 1 - 1\nloop\n    wait\n'), alpha),
      new FixedBrain(),
      new FixedBrain(),
      new FixedBrain(),
    ]);
    runTicks(simulation, 2);
    expect(alpha.seen.map((context) => context.allySignal)).toEqual([0, 9]);
  });

  it('does nothing when no teammate has the number', () => {
    const charlie = new SensingBrain();
    const simulation = teamMatch([compileBrain('signal 1 to 9\nloop\n    wait\n'), new FixedBrain(), charlie, new FixedBrain()]);
    runTicks(simulation, 2);
    expect(charlie.seen.map((context) => context.allySignal)).toEqual([0, 0]);
  });

  it('leaves a variable called "to" alone: "signal to" still sends its value to everyone', () => {
    const charlie = new SensingBrain();
    const simulation = teamMatch([compileBrain('set to = 3\nsignal to\nloop\n    wait\n'), new FixedBrain(), charlie, new FixedBrain()]);
    runTicks(simulation, 2);
    expect(charlie.seen.map((context) => context.allySignal)).toEqual([0, 3]);
  });
});
