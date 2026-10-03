import { describe, expect, it } from 'vitest';
import { MAX_ENTRANTS, arenaFor, builtInEntrants, fightNames, prepareFight } from '../src/arena/match';
import { ARENAS } from '../src/data/arenas';
import { CORNER_SPAWNS } from '../src/data/arenas/common';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import type { RobotBrain } from '../src/sim/ai_context';
import { circleIntersectsRect } from '../src/sim/math';
import { Simulation } from '../src/sim/simulation';
import type { Arena } from '../src/sim/types';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, runTicks, runToEnd } from './helpers';

/** Three robots on open ground: ALPHA in the middle, BRAVO near it on the right, CHARLIE far off on the left. */
const THREE: Arena = {
  width: 1000,
  height: 600,
  obstacles: [],
  spawns: [
    { x: 500, y: 300, rotation: 0 },
    { x: 650, y: 300, rotation: 180 },
    { x: 150, y: 300, rotation: 0 },
  ],
};

function royale(brains: RobotBrain[], arena: Arena = THREE, maxMatchTime: number = MATCH_DEFAULTS.maxMatchTime) {
  return new Simulation({
    arena,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime,
    seed: 1,
    robots: brains.map((brain, index) => ({ id: ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'][index], brain, stats: NO_SPREAD_STATS })),
  });
}

describe('a battle royale', () => {
  it("points each robot's sensor at the nearest enemy in sight", () => {
    const simulation = royale([new FixedBrain(), new FixedBrain(), new FixedBrain()]);
    simulation.step();
    const [alpha, bravo, charlie] = simulation.robots;
    expect(alpha.sensorReading.targetId).toBe('BRAVO');
    expect(bravo.sensorReading.targetId).toBe('ALPHA');
    expect(charlie.sensorReading.targetId).toBe('ALPHA');
    expect([...alpha.sensorReading.visibleIds].sort()).toEqual(['BRAVO', 'CHARLIE']);
  });

  it('goes on after the first robot is destroyed, and ends with the last one standing first', () => {
    // ALPHA shoots BRAVO, the nearest; then CHARLIE, once it is the only one left.
    const shooter = compileBrain('loop\n    if lead_angle > 1 or lead_angle < -1\n        aim lead\n    else\n        fire');
    const simulation = royale([shooter, new FixedBrain(), new FixedBrain()]);
    runToEnd(simulation);
    const [alpha, bravo, charlie] = simulation.robots;
    expect(bravo.alive).toBe(false);
    expect(charlie.alive).toBe(false);
    expect(alpha.alive).toBe(true);
    expect(simulation.result).toEqual({ winnerId: 'ALPHA', reason: 'destroyed', places: { ALPHA: 1, CHARLIE: 2, BRAVO: 3 } });
  });

  it('places the robots standing when time runs out by their HP, ahead of those destroyed', () => {
    const simulation = royale([new FixedBrain(), new FixedBrain(), new FixedBrain()], THREE, 1);
    const [alpha, bravo] = simulation.robots;
    alpha.takeDamage(50);
    bravo.takeDamage(50);
    runToEnd(simulation);
    expect(simulation.result).toEqual({ winnerId: 'CHARLIE', reason: 'timeout', places: { CHARLIE: 1, ALPHA: 2, BRAVO: 2 } });
  });

  it('counts a robot as hidden only when no enemy sees it', () => {
    // CHARLIE sees ALPHA (although BRAVO is its target), so ALPHA is not hidden and does not recover.
    const simulation = royale([new FixedBrain(), new FixedBrain(), new FixedBrain()]);
    simulation.robots[0].takeDamage(50);
    runTicks(simulation, MATCH_DEFAULTS.tickRate * 2);
    expect(simulation.robots[0].hidden).toBe(false);
    expect(simulation.robots[0].hp).toBe(NO_SPREAD_STATS.maxHp - 50);
  });

  it('forgets an enemy once it is destroyed, rather than looking for its wreck', () => {
    const shooter = compileBrain('loop\n    if lead_angle > 1 or lead_angle < -1\n        aim lead\n    else\n        fire');
    const twoOnly: Arena = { ...THREE, spawns: THREE.spawns.slice(0, 2).concat([{ x: 150, y: 300, rotation: 0 }]) };
    const simulation = royale([shooter, new FixedBrain(), new FixedBrain()], twoOnly);
    while (simulation.robots[1].alive) simulation.step();
    simulation.step();
    expect(simulation.robots[0].sensorReading.targetId).toBe('CHARLIE');
  });
});

describe('the corners a battle royale starts in', () => {
  it('leave room for a robot in every arena', () => {
    const reach = ROBOT_DEFAULTS.radius + 8;
    for (const { name, arena } of ARENAS) {
      for (const spawn of CORNER_SPAWNS) {
        expect(arena.obstacles.every((obstacle) => !circleIntersectsRect(spawn, reach, obstacle)), name).toBe(true);
      }
    }
    expect(MAX_ENTRANTS).toBe(4);
  });

  it('are picked and handed out by the seed, the same for the same seed', () => {
    const arena = ARENAS[0].arena;
    expect(arenaFor(arena, 5, 3).spawns).toHaveLength(3);
    expect(arenaFor(arena, 5, 3)).toEqual(arenaFor(arena, 5, 3));
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(arenaFor(arena, seed, 4).spawns)));
    expect(orders.size).toBeGreaterThan(1);
    for (let seed = 0; seed < 10; seed++) expect(new Set(arenaFor(arena, seed, 4).spawns.map((s) => `${s.x},${s.y}`)).size).toBe(4);
  });

  it('are not used for a duel, which starts where the arena puts it', () => {
    const arena = ARENAS[0].arena;
    expect(arenaFor(arena, 5, 2).spawns).toHaveLength(2);
    expect(arenaFor(arena, 5, 2).spawns[0].x).toBeGreaterThan(800);
  });
});

describe('entrants of a battle royale', () => {
  it('number the names that repeat, from the second on', () => {
    const [sample, dumb] = builtInEntrants();
    expect(fightNames([sample, dumb, sample, sample])).toEqual(['Sample', 'DumbBot', 'Sample (2)', 'Sample (3)']);
  });

  it('are set up four at a time, each in a corner', () => {
    const four = builtInEntrants().slice(0, 4);
    const prepared = prepareFight(four, ARENAS[0].arena, 3);
    if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
    expect(prepared.fight.config.robots).toHaveLength(4);
    expect(prepared.fight.config.arena.spawns).toHaveLength(4);
  });

  it('fight to a finish in every arena, the templates four at a time', () => {
    let timeouts = 0;
    let matches = 0;
    const entrants = builtInEntrants();
    for (const { arena } of ARENAS) {
      for (let seed = 1; seed <= 4; seed++) {
        const four = [0, 1, 2, 3].map((offset) => entrants[(seed * 3 + offset) % entrants.length]);
        const prepared = prepareFight(four, arena, seed);
        if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
        const simulation = new Simulation(prepared.fight.config);
        runToEnd(simulation);
        matches++;
        if (simulation.result?.reason === 'timeout') timeouts++;
        expect(Object.values(simulation.result?.places ?? {})).toContain(1);
      }
    }
    expect(timeouts / matches).toBeLessThan(0.25);
  }, 60_000);
});
