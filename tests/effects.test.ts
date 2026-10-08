import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { EffectTracker } from '../src/debug/effects';
import { recordMatch } from '../src/debug/recorder';
import {
  compileBrain,
  createSimulation,
  enemySource,
  FixedBrain,
  NO_SPREAD_STATS,
  TIRELESS_GUARD_STATS,
} from './helpers';

describe('Simulation.tickEvents', () => {
  it('reports a shot at the muzzle on the tick it is fired', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()]);
    simulation.step();
    const [shooter] = simulation.robots;
    const muzzle = shooter.position.x + NO_SPREAD_STATS.radius + NO_SPREAD_STATS.bulletRadius;
    expect(simulation.tickEvents.filter((event) => event.kind !== 'detected')).toEqual([
      { kind: 'shot', x: muzzle, y: shooter.position.y },
    ]);

    simulation.step();
    expect(simulation.tickEvents).toEqual([]);
  });

  it('reports a detection at each robot on the tick it catches sight of the enemy, with the index of the robot', () => {
    // In the duel arena the robots see each other from the start.
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()]);
    simulation.step();
    const [alpha, bravo] = simulation.robots;
    expect(simulation.tickEvents).toEqual([
      { kind: 'detected', ...alpha.position, robot: 0 },
      { kind: 'detected', ...bravo.position, robot: 1 },
    ]);
    simulation.step();
    expect(simulation.tickEvents).toEqual([]);
  });

  it('reports a detection again only after the enemy was out of sight', () => {
    const simulation = createSimulation([compileBrain(SAMPLE_AI), compileBrain(enemySource('dumb_bot'))], {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
    });
    const detections: number[] = [];
    while (simulation.result === null) {
      simulation.step();
      for (const event of simulation.tickEvents) if (event.kind === 'detected') detections.push(simulation.tick);
    }
    // Hidden by the centre block at first, they catch sight of each other once they have driven round it.
    expect(detections.length).toBeGreaterThanOrEqual(2);
    expect(detections[0]).toBeGreaterThan(1);
    const sightings = simulation.robots.map((robot) => robot.sensorReading.enemyVisible);
    expect(sightings).toEqual([true, true]);
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
    // The shooter stands near the right wall and faces it; the other robot is out of the way.
    const arena = {
      ...DEFAULT_ARENA,
      obstacles: [],
      spawns: [
        { x: 900, y: 300, rotation: 0 },
        { x: 100, y: 500, rotation: 0 },
      ],
    };
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()], {
      arena,
      stats: { ...NO_SPREAD_STATS, maxAmmo: 1 },
    });
    const impacts = [];
    for (let tick = 0; tick < MATCH_DEFAULTS.tickRate; tick++) {
      simulation.step();
      impacts.push(...simulation.tickEvents.filter((event) => event.kind === 'impact'));
    }
    expect(impacts).toHaveLength(1);
    expect(impacts[0].x).toBeCloseTo(arena.width);
  });
});

describe('a hit on a guarding robot', () => {
  /** The events of the tick on which the first robot is first hit. */
  function eventsOfFirstHit(program: string) {
    const simulation = createSimulation([compileBrain(program), new FixedBrain({ fire: true })], {
      stats: TIRELESS_GUARD_STATS,
    });
    const [target] = simulation.robots;
    while (target.hp === NO_SPREAD_STATS.maxHp) simulation.step();
    return { events: simulation.tickEvents, target };
  }

  it('is reported at the robot, besides the impact of the bullet', () => {
    const { events, target } = eventsOfFirstHit('loop\n    guard');
    expect(events.map((event) => event.kind).sort()).toEqual(['deflected', 'impact']);
    expect(events.find((event) => event.kind === 'deflected')).toMatchObject({ x: target.position.x, y: target.position.y });
  });

  it('is not reported for a robot that takes the hit unguarded', () => {
    const { events } = eventsOfFirstHit('loop\n    wait');
    expect(events.map((event) => event.kind)).toEqual(['impact']);
  });
});

describe('EffectTracker', () => {
  it('keeps each effect for its lifetime, ageing it every tick', () => {
    const tracker = new EffectTracker({ shot: 2, impact: 3, deflected: 1, destroyed: 1, detected: 1, baseDestroyed: 1, baseHit: 1, signal: 1, signalHeard: 1 });
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
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: 1,
      robots: [
        { id: 'ALPHA', brain: compileBrain(SAMPLE_AI), stats: ROBOT_DEFAULTS },
        { id: 'BRAVO', brain: compileBrain(enemySource('dumb_bot')), stats: ROBOT_DEFAULTS },
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

  it('shows a detection effect, marked with the robot, from the tick it catches sight of the enemy', () => {
    const detections = events.filter((event) => event.type === 'sensor' && event.message.startsWith('enemy detected'));
    expect(detections.length).toBeGreaterThan(0);
    for (const { tick, robotId } of detections) {
      const robot = snapshots[tick].robots.findIndex((candidate) => candidate.id === robotId);
      const started = snapshots[tick].effects.filter((effect) => effect.kind === 'detected' && effect.age === 0);
      expect(started.map((effect) => effect.robot)).toContain(robot);
      // The effect sits where the robot was when it looked, at the start of the tick: at most one step from where it ends it.
      const effect = started.find((candidate) => candidate.robot === robot);
      const { x, y } = snapshots[tick].robots[robot];
      expect(Math.hypot((effect?.x ?? 0) - x, (effect?.y ?? 0) - y)).toBeLessThan(ROBOT_DEFAULTS.moveSpeed / MATCH_DEFAULTS.tickRate + 1);
    }
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

describe('signal and base-hit events', () => {
  const teamed = (brains: [FixedBrain, FixedBrain]) => createSimulation(brains, { teams: [0, 0] });

  it('reports a new number on the radio once, at the sender and at each teammate', () => {
    const simulation = teamed([new FixedBrain({ signal: 1 }), new FixedBrain()]);
    simulation.step();
    const [sender, mate] = simulation.robots;
    expect(simulation.tickEvents).toEqual([
      { kind: 'signal', ...sender.position, robot: 0 },
      { kind: 'signalHeard', ...mate.position, robot: 1, from: 0 },
    ]);
    // The same number sent again is not news.
    simulation.step();
    expect(simulation.tickEvents).toEqual([]);
  });

  it('reports nothing of a signal in a duel but the send itself', () => {
    const simulation = createSimulation([new FixedBrain({ signal: 1 }), new FixedBrain()]);
    simulation.step();
    const signals = simulation.tickEvents.filter((event) => event.kind === 'signal' || event.kind === 'signalHeard');
    expect(signals).toEqual([{ kind: 'signal', ...simulation.robots[0].position, robot: 0 }]);
  });

  it('reports a hit on a castle whenever an enemy bullet wears it down', () => {
    const base = { team: 1, rect: { x: 480, y: 220, width: 40, height: 160 }, maxHp: 40 };
    const simulation = createSimulation([compileBrain('loop\n    fire\n'), new FixedBrain()], { teams: [0, 1], bases: [base] });
    let hits = 0;
    while (simulation.result === null && simulation.tick < 600) {
      simulation.step();
      hits += simulation.tickEvents.filter((event) => event.kind === 'baseHit').length;
    }
    expect(hits).toBe(base.maxHp / NO_SPREAD_STATS.shotDamage);
  });
});
