import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/default_arena';
import { DUMB_BOT } from '../src/data/enemies/dumb_bot';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/sample_ai';
import { EffectTracker } from '../src/debug/effects';
import { recordMatch } from '../src/debug/recorder';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation } from './helpers';

describe('Simulation.tickEvents', () => {
  it('reports a shot at the muzzle on the tick it is fired', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()]);
    simulation.step();
    const [shooter] = simulation.robots;
    const muzzle = shooter.position.x + NO_SPREAD_STATS.radius + NO_SPREAD_STATS.bulletRadius;
    expect(simulation.tickEvents).toEqual([{ kind: 'shot', x: muzzle, y: shooter.position.y }]);

    simulation.step();
    expect(simulation.tickEvents).toEqual([]);
  });

  it('reports an impact where a bullet hits, and a destruction where a robot dies', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()]);
    const [, target] = simulation.robots;
    const impacts: number[] = [];
    while (simulation.result === null) {
      simulation.step();
      impacts.push(...simulation.tickEvents.filter((event) => event.kind === 'impact').map((event) => event.x));
    }
    const hits = NO_SPREAD_STATS.maxHp / NO_SPREAD_STATS.shotDamage;
    expect(impacts).toHaveLength(hits);
    expect(impacts[0]).toBeCloseTo(target.position.x - NO_SPREAD_STATS.radius - NO_SPREAD_STATS.bulletRadius);
    expect(simulation.tickEvents).toContainEqual({ kind: 'destroyed', ...target.position });
  });

  it('reports an impact where a bullet hits a wall', () => {
    const arena = { ...DEFAULT_ARENA, obstacles: [], spawns: DEFAULT_ARENA.spawns };
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()], {
      arena,
      stats: { ...NO_SPREAD_STATS, maxAmmo: 1 },
    });
    const impacts = [];
    for (let tick = 0; tick < MATCH_DEFAULTS.tickRate; tick++) {
      simulation.step();
      impacts.push(...simulation.tickEvents.filter((event) => event.kind === 'impact'));
    }
    // The player starts on the right facing right, so its one shot ends at the right wall.
    expect(impacts).toHaveLength(1);
    expect(impacts[0].x).toBeCloseTo(arena.width);
  });
});

describe('EffectTracker', () => {
  it('keeps each effect for its lifetime, ageing it every tick', () => {
    const tracker = new EffectTracker({ shot: 2, impact: 3, destroyed: 1 });
    const shot = { kind: 'shot', x: 10, y: 20 } as const;
    const impact = { kind: 'impact', x: 30, y: 40 } as const;

    expect(tracker.update(5, [shot])).toEqual([{ ...shot, age: 0 }]);
    expect(tracker.update(6, [impact])).toEqual([
      { ...shot, age: 1 },
      { ...impact, age: 0 },
    ]);
    expect(tracker.update(7, [])).toEqual([{ ...impact, age: 1 }]);
    expect(tracker.update(8, [])).toEqual([{ ...impact, age: 2 }]);
    expect(tracker.update(9, [])).toEqual([]);
  });
});

describe('effects in a recording', () => {
  const recording = recordMatch(
    {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: 1,
      robots: [
        { id: 'ALPHA', brain: compileBrain(SAMPLE_AI) },
        { id: 'BRAVO', brain: compileBrain(DUMB_BOT) },
      ],
    },
    EFFECT_LIFETIMES,
  );
  const { snapshots, events } = recording;
  const agesAt = (tick: number, kind: string) =>
    (snapshots[tick]?.effects ?? []).filter((effect) => effect.kind === kind).map((effect) => effect.age);

  it('starts with no effects', () => {
    expect(snapshots[0].effects).toEqual([]);
  });

  it('shows a shot effect from the tick of each shot, for its lifetime', () => {
    const shots = events.filter((event) => event.type === 'action' && event.message === 'fire');
    expect(shots.length).toBeGreaterThan(0);
    for (const { tick } of shots) {
      for (let age = 0; age < EFFECT_LIFETIMES.shot; age++) {
        if (tick + age < snapshots.length) expect(agesAt(tick + age, 'shot')).toContain(age);
      }
    }
    const firstShot = shots[0].tick;
    expect(agesAt(firstShot - 1, 'shot')).toEqual([]);
    expect(agesAt(firstShot + EFFECT_LIFETIMES.shot, 'shot')).toEqual([]);
  });

  it('shows an impact effect from the tick of each hit', () => {
    const hits = events.filter((event) => event.type === 'hit');
    for (const { tick } of hits) expect(agesAt(tick, 'impact')).toContain(0);
  });

  it('starts the destruction effect on the last tick, at the destroyed robot', () => {
    const last = snapshots[snapshots.length - 1];
    const loser = last.robots.find((robot) => !robot.alive);
    expect(last.effects).toContainEqual({ kind: 'destroyed', x: loser?.x, y: loser?.y, age: 0 });
  });
});
