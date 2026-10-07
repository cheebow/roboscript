import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import type { RobotBrain } from '../src/sim/ai_context';
import { Simulation } from '../src/sim/simulation';
import type { Arena } from '../src/sim/types';
import { winnersOf } from '../src/sim/winners';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, runTicks, runToEnd } from './helpers';

/** ALPHA and CHARLIE (team 0) on the left, BRAVO and DELTA (team 1) on the right, all in a row on open ground. */
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

function teamMatch(brains: RobotBrain[], { arena = ROW, maxMatchTime = MATCH_DEFAULTS.maxMatchTime as number } = {}) {
  return new Simulation({
    arena,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime,
    seed: 1,
    robots: brains.map((brain, index) => ({ id: IDS[index], brain, stats: NO_SPREAD_STATS })),
    teams: [0, 1, 0, 1],
  });
}

const SHOOTER = 'loop\n    aim enemy\n    fire\n';

describe('a team match', () => {
  it('points the sensor at the nearest enemy, never at a teammate', () => {
    const simulation = teamMatch([new FixedBrain(), new FixedBrain(), new FixedBrain(), new FixedBrain()]);
    simulation.step();
    const [alpha, bravo, charlie] = simulation.robots;
    expect(alpha.sensorReading.targetId).toBe('BRAVO');
    expect(bravo.sensorReading.targetId).toBe('ALPHA');
    // CHARLIE is behind ALPHA: the nearest enemy is BRAVO, not its teammate in between.
    expect(charlie.sensorReading.targetId).toBe('BRAVO');
  });

  it("lets a teammate's bullets pass through", () => {
    // CHARLIE shoots straight ahead, through ALPHA, at BRAVO.
    const simulation = teamMatch([new FixedBrain(), new FixedBrain(), compileBrain('loop\n    fire\n'), new FixedBrain()]);
    runTicks(simulation, 60);
    const [alpha, bravo] = simulation.robots;
    expect(alpha.hp).toBe(ROBOT_DEFAULTS.maxHp);
    expect(bravo.hp).toBeLessThan(ROBOT_DEFAULTS.maxHp);
  });

  it('tells each robot its team and its number within it', () => {
    const simulation = teamMatch([new FixedBrain(), new FixedBrain(), new FixedBrain(), new FixedBrain()]);
    expect(simulation.robots.map((robot) => robot.team)).toEqual([0, 1, 0, 1]);
    expect(simulation.robots.map((robot) => robot.selfId)).toEqual([1, 1, 2, 2]);
  });

  it('is won by the team left standing, and teammates share its place', () => {
    const simulation = teamMatch([compileBrain(SHOOTER), new FixedBrain(), compileBrain(SHOOTER), new FixedBrain()]);
    runToEnd(simulation);
    expect(simulation.result).toMatchObject({ winnerId: null, winnerTeam: 0, reason: 'destroyed' });
    expect(simulation.result?.places).toEqual({ ALPHA: 1, CHARLIE: 1, BRAVO: 2, DELTA: 2 });
    expect(simulation.result === null ? null : winnersOf(simulation.result)).toEqual(['ALPHA', 'CHARLIE']);
  });

  it('at the end of time, goes by the HP the teams have left', () => {
    // Only ALPHA shoots, and not for long enough to destroy anybody.
    const simulation = teamMatch(
      [compileBrain('fire\nfire\nloop\n    wait\n'), new FixedBrain(), new FixedBrain(), new FixedBrain()],
      { maxMatchTime: 2 },
    );
    runToEnd(simulation);
    expect(simulation.result).toMatchObject({ winnerTeam: 0, reason: 'timeout' });
  });

  it('is a draw when the teams have as much HP left', () => {
    const simulation = teamMatch([new FixedBrain(), new FixedBrain(), new FixedBrain(), new FixedBrain()], {
      maxMatchTime: 1,
    });
    runToEnd(simulation);
    expect(simulation.result).toMatchObject({ winnerTeam: null, reason: 'timeout' });
    expect(simulation.result === null ? undefined : winnersOf(simulation.result)).toBeNull();
  });

  it('refuses teams that do not cover every robot', () => {
    expect(() =>
      new Simulation({
        arena: ROW,
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: 1,
        seed: 1,
        robots: [new FixedBrain(), new FixedBrain()].map((brain, index) => ({ id: IDS[index], brain, stats: NO_SPREAD_STATS })),
        teams: [0],
      }),
    ).toThrow('team for every robot');
  });
});

describe('outside a team match', () => {
  it('declares no winning team, and robots belong to no team', () => {
    const simulation = new Simulation({
      arena: ROW,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: 1,
      seed: 1,
      robots: [new FixedBrain(), new FixedBrain()].map((brain, index) => ({ id: IDS[index], brain, stats: NO_SPREAD_STATS })),
    });
    expect(simulation.robots.map((robot) => robot.team)).toEqual([null, null]);
    expect(simulation.robots.map((robot) => robot.selfId)).toEqual([null, null]);
    runToEnd(simulation);
    expect(simulation.result?.winnerTeam).toBeUndefined();
  });
});
