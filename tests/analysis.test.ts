import { describe, expect, it } from 'vitest';
import { analyze, lineCounts, readHit } from '../src/arena/analysis';
import { builtInEntrants, prepareFight } from '../src/arena/match';
import { ARENAS } from '../src/data/arenas';
import { EFFECT_LIFETIMES } from '../src/data/match_defaults';
import { recordMatch } from '../src/debug/recorder';

function recordedFight(names: string[], seed = 3) {
  const entrants = builtInEntrants().filter((entrant) => names.includes(entrant.name));
  const prepared = prepareFight(entrants, ARENAS[1].arena, seed);
  if (!prepared.ok) throw new Error(prepared.problems.join());
  return { recording: recordMatch(prepared.fight.config, EFFECT_LIFETIMES), names: prepared.fight.names };
}

describe('reading a hit from the log', () => {
  it('reads the shooter, the robot hit, the damage, the HP left and a guard', () => {
    const hit = readHit({ tick: 9, timestamp: 0.3, robotId: 'ALPHA', type: 'hit', message: 'BRAVO damage=10 hp=150 (guarded)', sourceLine: null });
    expect(hit).toEqual({ tick: 9, shooterId: 'ALPHA', targetId: 'BRAVO', damage: 10, hp: 150, guarded: true });
    expect(readHit({ tick: 9, timestamp: 0, robotId: 'ALPHA', type: 'action', message: 'fire', sourceLine: 3 })).toBeNull();
  });
});

describe('the analysis of a match', () => {
  it('counts shots, hits and damage that add up', () => {
    const { recording, names } = recordedFight(['Sample', 'SentryBot']);
    const { robots, hits } = analyze(recording, names);
    expect(robots.map((robot) => robot.name)).toEqual(names);
    for (const robot of robots) {
      expect(robot.hits).toBeLessThanOrEqual(robot.shots);
      expect(robot.shots).toBeGreaterThan(0);
    }
    // Damage dealt by one is damage taken by the other.
    expect(robots[0].damageDealt).toBe(robots[1].damageTaken);
    expect(robots[1].damageDealt).toBe(robots[0].damageTaken);
    expect(hits).toHaveLength(robots[0].hits + robots[1].hits);
  });

  it('follows the HP to the end, measures the distance driven and the time in sight', () => {
    const { recording, names } = recordedFight(['AggressiveBot', 'CowardBot']);
    const analysis = analyze(recording, names);
    const lastHp = recording.snapshots[recording.snapshots.length - 1].robots.map((robot) => robot.hp);
    expect(analysis.robots.map((robot) => robot.hp[robot.hp.length - 1])).toEqual(lastHp);
    expect(analysis.robots[0].hp[0]).toBe(200);
    for (const robot of analysis.robots) {
      expect(robot.distance).toBeGreaterThan(0);
      expect(robot.sighted).toBeGreaterThanOrEqual(0);
      expect(robot.sighted).toBeLessThanOrEqual(1);
    }
  });

  it('counts how often each line ran', () => {
    const { recording } = recordedFight(['Sample', 'DumbBot']);
    const counts = lineCounts(recording, 'Sample');
    const ticks = recording.snapshots.length - 1;
    // The loop line runs at least once a tick while the program runs.
    expect(Math.max(...counts.values())).toBeGreaterThan(ticks / 2);
  });
});
