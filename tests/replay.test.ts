import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, PLAYBACK_SPEEDS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { recordMatch } from '../src/debug/recorder';
import { type BreakpointSource, ReplayManager } from '../src/debug/replay_manager';
import { captureSnapshot } from '../src/debug/snapshot';
import { Simulation, type SimulationConfig } from '../src/sim/simulation';
import { compileBrain, enemySource, runTicks } from './helpers';

const { tickRate, maxFrameTime } = MATCH_DEFAULTS;
const TICK = 1 / tickRate;
/** In the sample AI: `fire`, run from the moment the enemy is close enough. */
const FIRE_LINE = 10;
/** In the sample AI: `move forward` with the enemy hidden, run from the first tick until the way is blocked. */
const APPROACH_LINE = 16;
/** In the sample AI: `if blocked`, run on every tick. */
const FIRST_LINE = 1;

/** The real game setup: the sample AI against DumbBot. */
function matchConfig(seed = 1): SimulationConfig {
  return {
    arena: DEFAULT_ARENA,
    stats: ROBOT_DEFAULTS,
    tickRate,
    maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
    seed,
    robots: [
      { id: 'ALPHA', brain: compileBrain(SAMPLE_AI) },
      { id: 'BRAVO', brain: compileBrain(enemySource('dumb_bot')) },
    ],
  };
}

function record(seed = 1) {
  return recordMatch(matchConfig(seed), EFFECT_LIFETIMES);
}

/** `breakpointLines` are ALPHA's; null plays without any breakpoint source. */
function createReplay(breakpointLines: number[] | null = null, speed = 1, tailTicks = 0) {
  const breakpoints: BreakpointSource[] =
    breakpointLines === null ? [] : [{ robotId: 'ALPHA', lines: () => breakpointLines }];
  return new ReplayManager(record(), { maxFrameTime, speed, breakpoints, tailTicks });
}

function hit(line: number, robotId = 'ALPHA') {
  return { robotId, line };
}

/** Resumes and plays frame by frame until playback stops by itself. */
function playUntilStopped(replay: ReplayManager): void {
  replay.play();
  while (replay.playing) replay.advance(TICK);
}

/** Starts from the beginning and plays frame by frame until playback stops by itself. */
function restartUntilStopped(replay: ReplayManager): void {
  replay.restart();
  while (replay.playing) replay.advance(TICK);
}

describe('recordMatch', () => {
  const recording = record();
  const { snapshots } = recording;

  it('keeps one snapshot per tick, starting with the initial position', () => {
    expect(snapshots.map((snapshot) => snapshot.tick)).toEqual(snapshots.map((_, index) => index));
    expect(snapshots[0]).toMatchObject({ tick: 0, time: 0, bullets: [], result: null });
    const [playerSpawn, enemySpawn] = DEFAULT_ARENA.spawns;
    expect(snapshots[0].robots.map(({ id, x, y, hp, state }) => ({ id, x, y, hp, state }))).toEqual([
      { id: 'ALPHA', x: playerSpawn.x, y: playerSpawn.y, hp: 100, state: 'IDLE' },
      { id: 'BRAVO', x: enemySpawn.x, y: enemySpawn.y, hp: 100, state: 'IDLE' },
    ]);
  });

  it('ends with the snapshot that holds the result', () => {
    expect(snapshots.at(-1)?.result).toEqual({ winnerId: 'BRAVO', reason: 'destroyed' });
    expect(snapshots.slice(0, -1).every((snapshot) => snapshot.result === null)).toBe(true);
  });

  it('records the lines the AI executed on each tick', () => {
    const linesAt = (tick: number) => snapshots[tick].robots[0].executedLines;
    expect(linesAt(0)).toEqual([]);
    expect(linesAt(1)).toEqual([1, 4, 5, 14, 15, 16]);
    const blockedAt = snapshots.findIndex((snapshot) => snapshot.robots[0].blocked);
    expect(linesAt(blockedAt)).toEqual([1, 2, 3]);
    const sightedAt = snapshots.findIndex((snapshot) => snapshot.robots[0].enemyVisible);
    expect(linesAt(sightedAt)).toEqual([1, 4, 5, 6, 8, 11, 12, 13]);
    expect(linesAt(snapshots.length - 1)).toEqual([1, 4, 5, 6, 8, 9, 10]);
  });

  it('records the debug events of the match', () => {
    expect(recording.events[0].message).toBe('match started seed=1');
    expect(recording.events.at(-1)?.tick).toBe(snapshots.length - 1);
  });

  it('records the same match for the same seed', () => {
    const again = record();
    expect(again.snapshots).toEqual(snapshots);
    expect(again.events).toEqual(recording.events);
  });
});

describe('ReplayManager: seek', () => {
  it('restores the state the simulation had at that tick', () => {
    const replay = createReplay();
    for (const tick of [0, 1, 24, 100, replay.lastTick]) {
      const simulation = new Simulation(matchConfig());
      runTicks(simulation, tick);
      replay.seek(tick);
      expect(replay.tick).toBe(tick);
      expect(replay.snapshot).toEqual({ ...captureSnapshot(simulation), effects: replay.snapshot.effects });
    }
  });

  it('can jump back as well as forward', () => {
    const replay = createReplay();
    replay.seek(100);
    replay.seek(10);
    expect(replay.snapshot.tick).toBe(10);
    expect(replay.reachedTick).toBe(100);
  });

  it('clamps to the recording', () => {
    const replay = createReplay();
    replay.seek(-5);
    expect(replay.tick).toBe(0);
    replay.seek(1_000_000);
    expect(replay.tick).toBe(replay.lastTick);
  });

  it('pauses playback', () => {
    const replay = createReplay();
    replay.play();
    replay.seek(10);
    expect(replay.playing).toBe(false);
    replay.advance(TICK);
    expect(replay.tick).toBe(10);
  });
});

describe('ReplayManager: playback', () => {
  it('starts paused at the beginning', () => {
    const replay = createReplay();
    expect(replay.playing).toBe(false);
    replay.advance(TICK);
    expect(replay.tick).toBe(0);
  });

  it('advances one tick per tick of real time at 1x', () => {
    const replay = createReplay();
    replay.play();
    for (let frame = 0; frame < tickRate; frame++) replay.advance(TICK);
    expect(replay.tick).toBe(tickRate);
  });

  it('scales with the playback speed', () => {
    for (const speed of PLAYBACK_SPEEDS) {
      const replay = createReplay(null, speed);
      replay.play();
      for (let frame = 0; frame < 40; frame++) replay.advance(TICK);
      expect(replay.tick).toBe(40 * speed);
    }
  });

  it('applies a speed change while playing', () => {
    const replay = createReplay();
    replay.play();
    replay.advance(TICK);
    replay.speed = 4;
    replay.advance(TICK);
    expect(replay.tick).toBe(5);
  });

  it('does not advance while paused, and resumes where it left off', () => {
    const replay = createReplay();
    replay.play();
    replay.advance(TICK);
    replay.pause();
    replay.advance(TICK);
    expect(replay.tick).toBe(1);
    replay.play();
    replay.advance(TICK);
    expect(replay.tick).toBe(2);
  });

  it('caps the catch-up after a long frame', () => {
    const replay = createReplay();
    replay.play();
    replay.advance(10);
    expect(replay.tick).toBeLessThanOrEqual(Math.ceil(maxFrameTime * tickRate));
  });

  it('restarts from the beginning', () => {
    const replay = createReplay();
    replay.seek(40);
    replay.restart();
    expect(replay.tick).toBe(0);
    expect(replay.playing).toBe(true);
  });

  it('stops at the end, and plays again from the beginning', () => {
    const replay = createReplay();
    playUntilStopped(replay);
    expect(replay.tick).toBe(replay.lastTick);
    expect(replay.atEnd).toBe(true);

    replay.play();
    expect(replay.tick).toBe(0);
    expect(replay.playing).toBe(true);
    expect(replay.reachedTick).toBe(replay.lastTick);
  });
});

describe('ReplayManager: tail', () => {
  const TAIL = 5;

  it('keeps playing past the end for the tail, showing the last snapshot', () => {
    const replay = createReplay(null, 1, TAIL);
    replay.seek(replay.lastTick - 1);
    replay.play();
    replay.advance(TICK);
    expect(replay.atEnd).toBe(true);
    expect(replay.playing).toBe(true);
    expect(replay.overrun).toBe(0);

    for (let tick = 1; tick < TAIL; tick++) {
      replay.advance(TICK);
      expect(replay.overrun).toBe(tick);
      expect(replay.playing).toBe(true);
    }
    replay.advance(TICK);
    expect(replay.overrun).toBe(TAIL);
    expect(replay.playing).toBe(false);
    expect(replay.tick).toBe(replay.lastTick);
  });

  it('forgets the tail when moving to another tick', () => {
    const replay = createReplay(null, 1, TAIL);
    playUntilStopped(replay);
    expect(replay.overrun).toBe(TAIL);
    replay.seek(replay.lastTick);
    expect(replay.overrun).toBe(0);

    playUntilStopped(replay);
    replay.stepBack();
    expect(replay.overrun).toBe(0);
  });
});

describe('ReplayManager: stepping', () => {
  it('steps one tick forward and back, pausing playback', () => {
    const replay = createReplay();
    replay.play();
    replay.step();
    expect(replay.playing).toBe(false);
    expect(replay.tick).toBe(1);
    replay.step();
    expect(replay.tick).toBe(2);
    replay.stepBack();
    expect(replay.tick).toBe(1);
  });

  it('stays put at either end', () => {
    const replay = createReplay();
    replay.stepBack();
    expect(replay.tick).toBe(0);
    replay.seek(replay.lastTick);
    replay.step();
    expect(replay.tick).toBe(replay.lastTick);
  });
});

describe('ReplayManager: breakpoints', () => {
  const linesAt = (replay: ReplayManager, tick: number) => replay.recording.snapshots[tick].robots[0].executedLines;

  it('stops just before the tick on which a breakpoint line starts being executed', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);

    expect(replay.atEnd).toBe(false);
    expect(linesAt(replay, replay.tick)).not.toContain(FIRE_LINE);
    expect(linesAt(replay, replay.tick + 1)).toContain(FIRE_LINE);
    expect(replay.breakpointsAhead).toEqual([hit(FIRE_LINE)]);
  });

  it('shows the state before the line takes effect; one step executes it', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const ammoBefore = replay.snapshot.robots[0].ammo;
    expect(ammoBefore).toBe(ROBOT_DEFAULTS.maxAmmo);

    replay.step();
    expect(replay.snapshot.robots[0].executedLines).toContain(FIRE_LINE);
    expect(replay.snapshot.robots[0].ammo).toBe(ammoBefore - 1);
    expect(replay.breakpointsAhead).toEqual([]);
  });

  it('plays on from a breakpoint without stopping while the line keeps being executed', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const stoppedAt = replay.tick;

    playUntilStopped(replay);
    expect(replay.tick).toBeGreaterThan(stoppedAt);
    expect(replay.atEnd).toBe(true);
  });

  it('stops before the first tick for a line that is executed from the start', () => {
    const replay = createReplay([FIRST_LINE]);
    replay.restart();
    expect(replay.playing).toBe(false);
    expect(replay.tick).toBe(0);
    expect(replay.breakpointsAhead).toEqual([hit(FIRST_LINE)]);

    playUntilStopped(replay);
    expect(replay.atEnd).toBe(true);
  });

  it('stops at each of several breakpoints in turn, every time a line starts being executed again', () => {
    const replay = createReplay([APPROACH_LINE, FIRE_LINE]);
    replay.restart();
    const stops: number[][] = [];
    while (!replay.atEnd) {
      stops.push(replay.breakpointsAhead.map(({ line }) => line));
      playUntilStopped(replay);
    }

    // Driving on starts on the first tick and again after each turn at the block; firing starts last.
    expect(stops[0]).toEqual([APPROACH_LINE]);
    expect(stops.at(-1)).toEqual([FIRE_LINE]);
    expect(stops.filter((lines) => lines.includes(APPROACH_LINE)).length).toBeGreaterThan(1);
    expect(stops.every((lines) => lines.length === 1)).toBe(true);
  });

  it('stops again when the match is replayed from the end', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const stoppedAt = replay.tick;
    playUntilStopped(replay);
    expect(replay.atEnd).toBe(true);

    playUntilStopped(replay);
    expect(replay.tick).toBe(stoppedAt);
  });

  it('does not stop when stepping or seeking past a breakpoint', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const stoppedAt = replay.tick;

    replay.seek(0);
    for (let tick = 0; tick < stoppedAt + 5; tick++) replay.step();
    expect(replay.tick).toBe(stoppedAt + 5);
    replay.seek(stoppedAt + 50);
    expect(replay.tick).toBe(stoppedAt + 50);
  });

  it('reports no breakpoint ahead without a breakpoint source, and plays straight through', () => {
    const replay = createReplay(null);
    restartUntilStopped(replay);
    expect(replay.atEnd).toBe(true);
    replay.seek(0);
    expect(replay.breakpointsAhead).toEqual([]);
  });

  it('stops for the breakpoints of either robot, at whichever comes first, and says whose it is', () => {
    // Both programs fire from line 10: BRAVO (DumbBot) from further away, so it comes first.
    const replay = new ReplayManager(record(), {
      maxFrameTime,
      speed: 1,
      tailTicks: 0,
      breakpoints: [
        { robotId: 'ALPHA', lines: () => [FIRE_LINE] },
        { robotId: 'BRAVO', lines: () => [FIRE_LINE] },
      ],
    });
    restartUntilStopped(replay);
    expect(replay.breakpointsAhead).toEqual([hit(FIRE_LINE, 'BRAVO')]);
    const bravoStop = replay.tick;

    playUntilStopped(replay);
    expect(replay.breakpointsAhead).toEqual([hit(FIRE_LINE, 'ALPHA')]);
    expect(replay.tick).toBeGreaterThan(bravoStop);
  });

  it('reads the breakpoint lines as playback goes, so they can be changed meanwhile', () => {
    const lines: number[] = [];
    const replay = new ReplayManager(record(), {
      maxFrameTime,
      speed: 1,
      breakpoints: [{ robotId: 'ALPHA', lines: () => lines }],
      tailTicks: 0,
    });
    replay.restart();
    replay.advance(TICK);
    expect(replay.playing).toBe(true);

    lines.push(FIRE_LINE);
    while (replay.playing) replay.advance(TICK);
    expect(replay.atEnd).toBe(false);
    expect(replay.breakpointsAhead).toEqual([hit(FIRE_LINE)]);
  });
});
