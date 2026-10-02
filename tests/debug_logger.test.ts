import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import type { DebugEvent } from '../src/debug/debug_event';
import { DebugLogger } from '../src/debug/debug_logger';
import { compileBrain, createSimulation, enemySource, FixedBrain, NO_SPREAD_STATS, runToEnd } from './helpers';

/** Plays the sample AI against DumbBot and returns everything that was logged. */
function playLogged(seed = 1, logger: DebugLogger | undefined = new DebugLogger()) {
  const simulation = createSimulation([compileBrain(SAMPLE_AI), compileBrain(enemySource('dumb_bot'))], {
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

  it('reports a change of label with the line that set it', () => {
    expect(select(events, { type: 'ai', robotId: 'ALPHA' })).toMatchObject([
      { tick: 1, message: 'label IDLE -> SEARCH', sourceLine: 18 },
      { message: 'label SEARCH -> TRACK', sourceLine: 15 },
      { message: 'label TRACK -> ATTACK', sourceLine: 11 },
    ]);
  });

  it('reports driving, turning and aiming when they come into use, not on every tick', () => {
    const actions = select(events, { type: 'action', robotId: 'ALPHA' }).filter(
      (event) => event.message !== 'fire',
    );
    // Forward to the centre block, a quarter turn left, along the block, then
    // turning to the enemy, closing in on it and stopping to shoot.
    expect(actions.map(({ message, sourceLine }) => ({ message, sourceLine }))).toEqual([
      { message: 'drive forward', sourceLine: 19 },
      { message: 'turn left', sourceLine: 5 },
      { message: 'turn enemy', sourceLine: 8 },
      { message: 'drive forward', sourceLine: 16 },
      { message: 'drive stop', sourceLine: 12 },
    ]);
  });

  it('reports every shot with the line that fired it', () => {
    const shots = select(events, { type: 'action', robotId: 'ALPHA', message: 'fire' });
    expect(shots).toHaveLength(ROBOT_DEFAULTS.maxAmmo - alpha.weapon.ammo);
    expect(shots.every((event) => event.sourceLine === 13)).toBe(true);
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

  it('reports an action again once it has been out of use for a second', () => {
    const { tickRate } = MATCH_DEFAULTS;
    const program = `loop\n    aim left\n    set n = 0\n    while n < ${tickRate + 5}\n        wait\n        set n = n + 1`;
    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain(program), new FixedBrain()], { maxMatchTime: 4, logger });
    runToEnd(simulation);
    const aims = select(logger.events, { type: 'action', message: 'aim left' });
    expect(aims.length).toBeGreaterThan(1);
    expect(aims[1].tick - aims[0].tick).toBe(tickRate + 6);
  });

  it('warns when a program runs off its end', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain('aim left\nfire'), new FixedBrain()], { maxMatchTime: 1, logger });
    runToEnd(simulation);
    const warnings = select(logger.events, { type: 'warning' });
    expect(warnings).toMatchObject([{ robotId: 'ALPHA', tick: 3 }]);
    expect(warnings[0].message).toContain('program finished');
  });

  it('warns once when a loop never takes an action', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain('loop\n    set n = n + 1'), new FixedBrain()], { maxMatchTime: 1, logger });
    runToEnd(simulation);
    const warnings = select(logger.events, { type: 'warning' });
    expect(warnings).toMatchObject([{ robotId: 'ALPHA', tick: 1 }]);
    expect(warnings[0].message).toContain('too many lines without an action');
  });

  it('reports a draw', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()], { maxMatchTime: 1, logger });
    runToEnd(simulation);
    expect(logger.events.at(-1)).toMatchObject({ type: 'system', message: 'draw (timeout)' });
  });
});
