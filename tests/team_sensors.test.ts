import { describe, expect, it } from 'vitest';
import { castleSpawnsFor } from '../src/data/arenas/castle_common';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { type AIContext, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { Simulation } from '../src/sim/simulation';
import type { Arena, Base } from '../src/sim/types';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runTicks } from './helpers';

/** ALPHA and CHARLIE (team 0) on the left, BRAVO and DELTA (team 1) on the right. */
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

class SensingBrain implements RobotBrain {
  readonly seen: AIContext[] = [];
  decide(context: AIContext) {
    this.seen.push({ ...context });
    return createIdleAction();
  }
}

function teamMatch(brains: RobotBrain[], { bases = [] as readonly Base[] } = {}) {
  return new Simulation({
    arena: ROW,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
    seed: 1,
    robots: brains.map((brain, index) => ({ id: IDS[index], brain, stats: NO_SPREAD_STATS })),
    teams: [0, 1, 0, 1],
    bases,
  });
}

describe('the team words', () => {
  it('tells each robot its number with self_id', () => {
    const alpha = new SensingBrain();
    const charlie = new SensingBrain();
    const simulation = teamMatch([alpha, new FixedBrain(), charlie, new FixedBrain()]);
    simulation.step();
    expect(alpha.seen[0].selfId).toBe(1);
    expect(charlie.seen[0].selfId).toBe(2);
  });

  it('counts the living teammates with allies_alive, and reads the nearest one', () => {
    const alpha = new SensingBrain();
    const simulation = teamMatch([alpha, new FixedBrain(), new FixedBrain(), new FixedBrain()]);
    simulation.step();
    const [seen] = alpha.seen;
    expect(seen.alliesAlive).toBe(1);
    // CHARLIE stands 100 straight behind ALPHA.
    expect(seen.allyDistance).toBeCloseTo(100);
    expect(Math.abs(seen.allyAngle)).toBeCloseTo(180);
    expect(seen.allyHp).toBe(ROBOT_DEFAULTS.maxHp);
  });

  it('drops a destroyed teammate: allies_alive falls and the ally words read 0', () => {
    const charlie = new SensingBrain();
    // BRAVO shoots its nearest enemy, ALPHA, until it falls; CHARLIE watches its teammate go.
    const shooter = compileBrain('loop\n    aim enemy\n    fire\n');
    const simulation = teamMatch([new FixedBrain(), shooter, charlie, new FixedBrain()]);
    runTicks(simulation, 30 * 15);
    expect(simulation.robots[0].alive).toBe(false);
    const last = charlie.seen[charlie.seen.length - 1];
    expect(last.alliesAlive).toBe(0);
    expect(last.allyDistance).toBe(0);
    expect(last.allyHp).toBe(0);
  });

  it('counts the living enemies with enemies_alive, on both sides of the match', () => {
    const alpha = new SensingBrain();
    const bravo = new SensingBrain();
    const simulation = teamMatch([alpha, bravo, new FixedBrain(), new FixedBrain()]);
    simulation.step();
    expect(alpha.seen[0].enemiesAlive).toBe(2);
    expect(bravo.seen[0].enemiesAlive).toBe(2);
  });

  it('drops a destroyed enemy from enemies_alive on the next tick, though nobody watches it fall', () => {
    const delta = new SensingBrain();
    // BRAVO shoots ALPHA until it falls; DELTA, its teammate, only listens.
    const shooter = compileBrain('loop\n    aim enemy\n    fire\n');
    const simulation = teamMatch([new FixedBrain(), shooter, new FixedBrain(), delta]);
    runTicks(simulation, 30 * 15);
    expect(simulation.robots[0].alive).toBe(false);
    expect(delta.seen[0].enemiesAlive).toBe(2);
    expect(delta.seen[delta.seen.length - 1].enemiesAlive).toBe(1);
  });

  it('turns towards the teammate with face ally', () => {
    // CHARLIE faces away from ALPHA, which is straight behind it.
    const arena: Arena = { ...ROW, spawns: [ROW.spawns[0], ROW.spawns[1], { x: 300, y: 300, rotation: 180 }, ROW.spawns[3]] };
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: 1,
      robots: [new FixedBrain(), new FixedBrain(), compileBrain('loop\n    face ally\n    wait\n'), new FixedBrain()].map(
        (brain, index) => ({ id: IDS[index], brain, stats: NO_SPREAD_STATS }),
      ),
      teams: [0, 1, 0, 1],
    });
    runTicks(simulation, 60);
    expect(Math.abs(simulation.robots[2].rotation)).toBeCloseTo(0, 0);
  });
});

describe('the castle words', () => {
  const BASES: Base[] = [
    { team: 0, rect: { x: 960, y: 220, width: 40, height: 160 }, maxHp: 200 },
    { team: 1, rect: { x: 0, y: 220, width: 40, height: 160 }, maxHp: 200 },
  ];

  it('reads the own castle and the enemy castle from each side', () => {
    const alpha = new SensingBrain();
    const bravo = new SensingBrain();
    const simulation = teamMatch([alpha, bravo, new FixedBrain(), new FixedBrain()], { bases: BASES });
    simulation.step();
    const [a] = alpha.seen;
    // ALPHA at (400, 300) faces right: its own castle's centre is at (980, 300), the enemy's at (20, 300).
    expect(a.baseHp).toBe(200);
    expect(a.baseDistance).toBeCloseTo(580);
    expect(a.baseAngle).toBeCloseTo(0);
    expect(a.enemyBaseDistance).toBeCloseTo(380);
    expect(Math.abs(a.enemyBaseAngle)).toBeCloseTo(180);
    const [b] = bravo.seen;
    // BRAVO at (600, 300), team 1: its own castle's centre is at (20, 300), the enemy's at (980, 300).
    expect(b.baseDistance).toBeCloseTo(580);
    expect(b.enemyBaseDistance).toBeCloseTo(380);
  });

  it('watches the castle HP fall', () => {
    const charlie = new SensingBrain();
    // ALPHA turns away and shells the enemy castle on the left.
    const arena: Arena = { ...ROW, spawns: [{ x: 400, y: 300, rotation: 180 }, ROW.spawns[1], ROW.spawns[2], ROW.spawns[3]] };
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: 1,
      robots: [compileBrain('loop\n    fire\n'), new FixedBrain(), charlie, new FixedBrain()].map((brain, index) => ({
        id: IDS[index],
        brain,
        stats: NO_SPREAD_STATS,
      })),
      teams: [0, 1, 0, 1],
      bases: BASES,
    });
    runTicks(simulation, 60);
    const last = charlie.seen[charlie.seen.length - 1];
    expect(last.enemyBaseHp).toBeLessThan(200);
    expect(last.baseHp).toBe(200);
  });

  it('attacks the castle with face enemy_base and drive', () => {
    const rush = compileBrain('face enemy_base\ndrive forward\nloop\n    wait\n');
    const simulation = new Simulation({
      arena: { ...ROW, spawns: castleSpawnsFor(2) },
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: 1,
      robots: [rush, new FixedBrain(), new FixedBrain(), new FixedBrain()].map((brain, index) => ({
        id: IDS[index],
        brain,
        stats: NO_SPREAD_STATS,
      })),
      teams: [0, 0, 1, 1],
      bases: BASES.map((base, index) => ({ ...base, team: index })),
    });
    runTicks(simulation, 30 * 10);
    // ALPHA started on the right and drove left towards team 1's castle.
    expect(simulation.robots[0].position.x).toBeLessThan(300);
  });
});

describe('the equipment words', () => {
  it("reads the robot's own stats", () => {
    const alpha = new SensingBrain();
    const simulation = createSimulation([alpha, new FixedBrain()]);
    simulation.step();
    const [seen] = alpha.seen;
    expect(seen.sensorRange).toBe(ROBOT_DEFAULTS.sensorRange);
    expect(seen.maxSpeed).toBe(ROBOT_DEFAULTS.moveSpeed);
    expect(seen.maxHp).toBe(ROBOT_DEFAULTS.maxHp);
  });

  it('differs between differently equipped machines running the same program', () => {
    const alpha = new SensingBrain();
    const charlie = new SensingBrain();
    const shortSighted = { ...NO_SPREAD_STATS, sensorRange: 300 };
    const simulation = new Simulation({
      arena: ROW,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: 1,
      robots: [
        { id: 'ALPHA', brain: alpha, stats: NO_SPREAD_STATS },
        { id: 'BRAVO', brain: new FixedBrain(), stats: NO_SPREAD_STATS },
        { id: 'CHARLIE', brain: charlie, stats: shortSighted },
        { id: 'DELTA', brain: new FixedBrain(), stats: NO_SPREAD_STATS },
      ],
      teams: [0, 1, 0, 1],
    });
    simulation.step();
    expect(alpha.seen[0].sensorRange).toBe(NO_SPREAD_STATS.sensorRange);
    expect(charlie.seen[0].sensorRange).toBe(300);
  });

  it('reads 0 for the team and castle words outside a team match', () => {
    const alpha = new SensingBrain();
    const simulation = createSimulation([alpha, new FixedBrain()]);
    simulation.step();
    const [seen] = alpha.seen;
    expect(seen.selfId).toBe(1);
    expect(seen.alliesAlive).toBe(0);
    expect(seen.enemiesAlive).toBe(0);
    expect(seen.allyDistance).toBe(0);
    expect(seen.baseHp).toBe(0);
    expect(seen.enemyBaseDistance).toBe(0);
  });
});
