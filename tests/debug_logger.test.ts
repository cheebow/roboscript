import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { DUMB_BOT } from '../src/data/enemies/dumb_bot';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/sample_ai';
import type { DebugEvent } from '../src/debug/debug_event';
import { DebugLogger } from '../src/debug/debug_logger';
import { FixedBrain, NO_SPREAD_STATS, compileBrain, createSimulation, runToEnd } from './helpers';

/** Plays the sample AI against DumbBot and returns everything that was logged. */
function playLogged(seed = 1, logger: DebugLogger | undefined = new DebugLogger()) {
  const simulation = createSimulation([compileBrain(SAMPLE_AI), compileBrain(DUMB_BOT)], {
    arena: DEFAULT_ARENA,
    stats: ROBOT_DEFAULTS,
    seed,
    logger,
  });
  runToEnd(simulation);
  return { simulation, events: logger?.events ?? [] };
}

function select(events: readonly DebugEvent[], filter: Partial<DebugEvent>): DebugEvent[] {
  return events.filter((event) =>
    Object.entries(filter).every(([key, value]) => event[key as keyof DebugEvent] === value),
  );
}

describe('debug events of a match', () => {
  const { simulation, events } = playLogged();
  const [alpha, bravo] = simulation.robots;

  it('starts and ends with system events', () => {
    expect(events[0]).toEqual({
      tick: 0,
      timestamp: 0,
      robotId: null,
      type: 'system',
      message: 'match started seed=1',
      sourceLine: null,
    });
    expect(events.at(-1)).toMatchObject({
      tick: simulation.tick,
      robotId: null,
      type: 'system',
      message: 'winner: BRAVO (destroyed)',
    });
  });

  it('stamps events with the tick and its match time', () => {
    for (const event of events) {
      expect(event.timestamp).toBeCloseTo(event.tick / MATCH_DEFAULTS.tickRate);
    }
    const ticks = events.map((event) => event.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it('reports the moment each robot detects the enemy', () => {
    // The centre block hides the robots from each other until both have driven around it.
    const detections = select(events, { type: 'sensor' });
    expect(detections.map(({ robotId, message }) => ({ robotId, message }))).toEqual([
      { robotId: 'ALPHA', message: 'enemy detected: BRAVO' },
      { robotId: 'BRAVO', message: 'enemy detected: ALPHA' },
    ]);
    expect(detections[0].tick).toBe(detections[1].tick);
    expect(detections[0].tick).toBeGreaterThan(1);
  });

  it('reports state changes with the line that set the state', () => {
    expect(select(events, { type: 'ai', robotId: 'ALPHA' })).toMatchObject([
      { tick: 1, message: 'state IDLE -> SEARCH', sourceLine: 15 },
      { message: 'state SEARCH -> TRACK', sourceLine: 12 },
      { message: 'state TRACK -> ATTACK', sourceLine: 9 },
    ]);
  });

  it('reports movement and turning only when they change', () => {
    const actions = select(events, { type: 'action', robotId: 'ALPHA' }).filter(
      (event) => event.message !== 'fire',
    );
    // Forward to the centre block, a quarter turn left, along the block, then towards the enemy and stop to fire.
    expect(actions.map(({ message, sourceLine }) => ({ message, sourceLine }))).toEqual([
      { message: 'move forward', sourceLine: 16 },
      { message: 'move stop', sourceLine: null },
      { message: 'turn left', sourceLine: 3 },
      { message: 'move forward', sourceLine: 16 },
      { message: 'turn stop', sourceLine: null },
      { message: 'move stop', sourceLine: null },
      { message: 'turn left', sourceLine: 3 },
      { message: 'move forward', sourceLine: 16 },
      { message: 'turn stop', sourceLine: null },
      { message: 'turn enemy', sourceLine: 6 },
      { message: 'move stop', sourceLine: null },
    ]);
  });

  it('reports every shot with the line that fired it', () => {
    const shots = select(events, { type: 'action', robotId: 'ALPHA', message: 'fire' });
    expect(shots).toHaveLength(ROBOT_DEFAULTS.maxAmmo - alpha.weapon.ammo);
    expect(shots.every((event) => event.sourceLine === 10)).toBe(true);
  });

  it('reports every hit with the damage and remaining HP', () => {
    const hitsOnAlpha = select(events, { type: 'hit', robotId: 'BRAVO' });
    expect(hitsOnAlpha.map((event) => event.message)).toEqual([
      'ALPHA damage=20 hp=80',
      'ALPHA damage=20 hp=60',
      'ALPHA damage=20 hp=40',
      'ALPHA damage=20 hp=20',
      'ALPHA damage=20 hp=0',
    ]);
    const hitsOnBravo = select(events, { type: 'hit', robotId: 'ALPHA' });
    expect(hitsOnBravo).toHaveLength((ROBOT_DEFAULTS.maxHp - bravo.hp) / ROBOT_DEFAULTS.shotDamage);
  });

  it('logs the same events for the same seed', () => {
    expect(playLogged(1).events).toEqual(events);
  });

  it('does not change the match', () => {
    const unlogged = playLogged(1, undefined).simulation;
    expect(unlogged.tick).toBe(simulation.tick);
    expect(unlogged.result).toEqual(simulation.result);
    expect(unlogged.robots.map((robot) => robot.hp)).toEqual(simulation.robots.map((robot) => robot.hp));
  });
});

describe('other debug events', () => {
  it('warns once when a robot tries to fire with no ammo', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()], {
      stats: { ...NO_SPREAD_STATS, maxAmmo: 1 },
      maxMatchTime: 5,
      logger,
    });
    runToEnd(simulation);
    expect(select(logger.events, { type: 'action', message: 'fire' })).toHaveLength(1);
    expect(select(logger.events, { type: 'warning' })).toMatchObject([
      { robotId: 'ALPHA', message: 'out of ammo' },
    ]);
  });

  it('reports a draw', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()], { maxMatchTime: 1, logger });
    runToEnd(simulation);
    expect(logger.events.at(-1)).toMatchObject({ type: 'system', message: 'draw (timeout)' });
  });
});
