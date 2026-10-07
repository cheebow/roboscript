import { describe, expect, it } from 'vitest';
import { CASTLE_ARENAS } from '../src/data/arenas';
import { castleSpawnsFor } from '../src/data/arenas/castle_common';
import { MAX_TEAM_SIZE, castleHpFor, teamCostLimitFor } from '../src/data/castle';
import { COST_LIMIT } from '../src/data/parts';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import type { RobotBrain } from '../src/sim/ai_context';
import { Simulation, type SimulationConfig } from '../src/sim/simulation';
import type { Arena, Base } from '../src/sim/types';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, runTicks, runToEnd } from './helpers';

/** Open ground; ALPHA (team 0) on the left faces right, BRAVO (team 1) on the right faces left. */
const FIELD: Arena = {
  width: 1000,
  height: 600,
  obstacles: [],
  spawns: [
    { x: 300, y: 300, rotation: 0 },
    { x: 700, y: 300, rotation: 180 },
  ],
};

/** BRAVO's castle, in the middle of the field, right in both robots' line of fire. */
const MID_CASTLE: Base = { team: 1, rect: { x: 480, y: 220, width: 40, height: 160 }, maxHp: 40 };

function castleMatch(
  brains: [RobotBrain, RobotBrain],
  { bases = [MID_CASTLE] as readonly Base[], maxMatchTime = MATCH_DEFAULTS.maxMatchTime as number, arena = FIELD } = {},
): Simulation {
  return new Simulation({
    arena,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime,
    seed: 1,
    robots: [
      { id: 'ALPHA', brain: brains[0], stats: NO_SPREAD_STATS },
      { id: 'BRAVO', brain: brains[1], stats: NO_SPREAD_STATS },
    ],
    teams: [0, 1],
    bases,
  });
}

const FIRE = compileBrain('loop\n    fire\n');

describe('a castle', () => {
  it("is worn down by enemy bullets, and the match ends when it falls", () => {
    const simulation = castleMatch([FIRE, new FixedBrain()]);
    runToEnd(simulation);
    expect(simulation.bases[0].hp).toBe(0);
    expect(simulation.result).toMatchObject({ winnerId: null, winnerTeam: 0, reason: 'base destroyed' });
    expect(simulation.result?.places).toEqual({ ALPHA: 1, BRAVO: 2 });
  });

  it("stops its own team's bullets without taking damage", () => {
    // BRAVO shoots at its own castle for two seconds.
    const simulation = castleMatch([new FixedBrain(), FIRE]);
    runTicks(simulation, 60);
    expect(simulation.bases[0].hp).toBe(MID_CASTLE.maxHp);
    // The bullets stopped at the castle: ALPHA, beyond it, is unhurt.
    expect(simulation.robots[0].hp).toBe(ROBOT_DEFAULTS.maxHp);
  });

  it('blocks sight: robots on either side of it do not see each other', () => {
    const simulation = castleMatch([new FixedBrain(), new FixedBrain()]);
    simulation.step();
    expect(simulation.robots[0].sensorReading.enemyVisible).toBe(false);
    expect(simulation.robots[1].sensorReading.enemyVisible).toBe(false);
  });

  it('blocks driving: a robot cannot push into it', () => {
    const driver = compileBrain('drive forward\nloop\n    wait\n');
    const simulation = castleMatch([driver, new FixedBrain()]);
    runTicks(simulation, 300);
    const alpha = simulation.robots[0];
    expect(alpha.position.x + alpha.stats.radius).toBeLessThanOrEqual(MID_CASTLE.rect.x + 1e-6);
    expect(alpha.position.x).toBeGreaterThan(400);
  });

  it('keeps a match without castles exactly as it was', () => {
    // Same fight, no bases: the bullets fly on and hit BRAVO instead.
    const simulation = castleMatch([FIRE, new FixedBrain()], { bases: [] });
    runTicks(simulation, 60);
    expect(simulation.robots[1].hp).toBeLessThan(ROBOT_DEFAULTS.maxHp);
    expect(simulation.bases).toEqual([]);
  });

  it('belongs to a team: castles without teams are refused', () => {
    const config: SimulationConfig = {
      arena: FIELD,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: 1,
      seed: 1,
      robots: [
        { id: 'ALPHA', brain: new FixedBrain(), stats: NO_SPREAD_STATS },
        { id: 'BRAVO', brain: new FixedBrain(), stats: NO_SPREAD_STATS },
      ],
      bases: [MID_CASTLE],
    };
    expect(() => new Simulation(config)).toThrow('needs teams');
  });
});

describe('the end of a castle match', () => {
  const ENDS: Base[] = [
    { team: 0, rect: { x: 960, y: 220, width: 40, height: 160 }, maxHp: 200 },
    { team: 1, rect: { x: 0, y: 220, width: 40, height: 160 }, maxHp: 200 },
  ];

  it('at the end of time, the healthier castle wins', () => {
    // ALPHA is turned to face left, so its shots wear down team 1's castle at the left wall; nobody else fires.
    const arena: Arena = { ...FIELD, spawns: [{ x: 300, y: 300, rotation: 180 }, { x: 700, y: 300, rotation: 180 }] };
    const simulation = castleMatch([FIRE, new FixedBrain()], { bases: ENDS, maxMatchTime: 2, arena });
    runToEnd(simulation);
    expect(simulation.result).toMatchObject({ winnerTeam: 0, reason: 'timeout' });
    expect(simulation.bases[1].hp).toBeLessThan(200);
  });

  it('with castles equally healthy, the team with more robot HP wins', () => {
    // ALPHA shoots BRAVO once; the castles are never touched.
    const shootOnce = compileBrain('aim enemy\nfire\nloop\n    wait\n');
    const simulation = castleMatch([shootOnce, new FixedBrain()], { bases: ENDS, maxMatchTime: 2 });
    runToEnd(simulation);
    expect(simulation.bases.map((base) => base.hp)).toEqual([200, 200]);
    expect(simulation.result).toMatchObject({ winnerTeam: 0, reason: 'timeout' });
  });

  it('with everything equal, it is a draw', () => {
    const simulation = castleMatch([new FixedBrain(), new FixedBrain()], { bases: ENDS, maxMatchTime: 1 });
    runToEnd(simulation);
    expect(simulation.result).toMatchObject({ winnerTeam: null, reason: 'timeout' });
  });
});

describe('the numbers of the castle match', () => {
  it('scales the castle and the cost pool with the team size', () => {
    // One robot: today's single-robot cost limit, and the castle at its old 200.
    expect(teamCostLimitFor(1)).toBe(COST_LIMIT);
    expect(castleHpFor(1)).toBe(200);
    // Each further robot adds less than a full budget, up to the futsal-sized five.
    expect(teamCostLimitFor(3)).toBe(32);
    expect(castleHpFor(3)).toBe(400);
    expect(MAX_TEAM_SIZE).toBe(5);
    expect(teamCostLimitFor(MAX_TEAM_SIZE)).toBe(52);
    expect(castleHpFor(MAX_TEAM_SIZE)).toBe(600);
  });

  it('seats a smaller match on the first spawns of each side, mirrored', () => {
    for (let teamSize = 1; teamSize <= MAX_TEAM_SIZE; teamSize++) {
      const spawns = castleSpawnsFor(teamSize);
      expect(spawns).toHaveLength(teamSize * 2);
      for (let i = 0; i < teamSize; i++) {
        expect(spawns[teamSize + i]).toEqual({ x: 1000 - spawns[i].x, y: spawns[i].y, rotation: 0 });
      }
    }
    // One robot a side starts level with its castle.
    expect(castleSpawnsFor(1).map((spawn) => spawn.y)).toEqual([300, 300]);
  });
});

describe('the castle arenas', () => {
  it('offers three, each with a castle for both teams at full strength', () => {
    expect(CASTLE_ARENAS).toHaveLength(3);
    for (const { basesFor } of CASTLE_ARENAS) {
      const bases = basesFor(MAX_TEAM_SIZE);
      expect(bases.map((base) => base.team).sort()).toEqual([0, 1]);
      for (const base of bases) expect(base.maxHp).toBe(castleHpFor(MAX_TEAM_SIZE));
    }
  });

  it('plays a deterministic 3 vs 3: the same seed gives the same match', () => {
    const play = () => {
      const { arena, basesFor } = CASTLE_ARENAS[0];
      const rush = () => compileBrain('loop\n    drive forward\n    fire\n');
      const simulation = new Simulation({
        arena,
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: 10,
        seed: 7,
        robots: ['ALPHA-1', 'ALPHA-2', 'ALPHA-3', 'BRAVO-1', 'BRAVO-2', 'BRAVO-3'].map((id) => ({
          id,
          brain: rush(),
          stats: NO_SPREAD_STATS,
        })),
        teams: [0, 0, 0, 1, 1, 1],
        bases: basesFor(3),
      });
      runToEnd(simulation);
      return { result: simulation.result, tick: simulation.tick, hp: simulation.bases.map((base) => base.hp) };
    };
    const first = play();
    expect(first.result).not.toBeNull();
    expect(play()).toEqual(first);
  });

  it('numbers the robots of each team 1 to 3', () => {
    const { arena, basesFor } = CASTLE_ARENAS[0];
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: 1,
      seed: 1,
      robots: ['ALPHA-1', 'ALPHA-2', 'ALPHA-3', 'BRAVO-1', 'BRAVO-2', 'BRAVO-3'].map((id) => ({
        id,
        brain: new FixedBrain(),
        stats: NO_SPREAD_STATS,
      })),
      teams: [0, 0, 0, 1, 1, 1],
      bases: basesFor(3),
    });
    expect(simulation.robots.map((robot) => robot.selfId)).toEqual([1, 2, 3, 1, 2, 3]);
  });
});
