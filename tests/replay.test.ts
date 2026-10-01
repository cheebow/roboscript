import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/default_arena';
import { DUMB_BOT } from '../src/data/enemies/dumb_bot';
import { MATCH_DEFAULTS, PLAYBACK_SPEEDS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/sample_ai';
import { recordMatch } from '../src/debug/recorder';
import { type BreakpointSource, ReplayManager } from '../src/debug/replay_manager';
import { captureSnapshot } from '../src/debug/snapshot';
import { Simulation, type SimulationConfig } from '../src/sim/simulation';
import { compileBrain, runTicks } from './helpers';

const { tickRate, maxFrameTime } = MATCH_DEFAULTS;
const TICK = 1 / tickRate;
/** In the sample AI: `fire`, run from the moment the enemy is close enough. */
const FIRE_LINE = 9;
/** In the sample AI: `turn right`, run only while searching. */
const SEARCH_LINE = 13;
/** In the sample AI: `state SEARCH`, run on every tick. */
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
      { id: 'BRAVO', brain: compileBrain(DUMB_BOT) },
    ],
  };
}

function createReplay(breakpointLines: number[] | null = null, speed = 1) {
  const breakpoints: BreakpointSource | null =
    breakpointLines === null ? null : { robotId: 'ALPHA', lines: () => breakpointLines };
  return new ReplayManager(recordMatch(matchConfig()), { maxFrameTime, speed, breakpoints });
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
  const recording = recordMatch(matchConfig());
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
    expect(linesAt(1)).toEqual([1, 3, 12, 13]);
    const detected = snapshots.findIndex((snapshot) => snapshot.robots[0].enemyVisible);
    expect(linesAt(detected)).toEqual([1, 3, 4, 6, 8, 10, 11]);
    expect(linesAt(snapshots.length - 1)).toEqual([1, 3, 4, 6, 8, 9]);
  });

  it('records the debug events of the match', () => {
    expect(recording.events[0].message).toBe('match started seed=1');
    expect(recording.events.at(-1)?.tick).toBe(snapshots.length - 1);
  });

  it('records the same match for the same seed', () => {
    const again = recordMatch(matchConfig());
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
      expect(replay.snapshot).toEqual(captureSnapshot(simulation));
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
    expect(replay.breakpointsAhead).toEqual([FIRE_LINE]);
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
    expect(replay.breakpointsAhead).toEqual([FIRST_LINE]);

    playUntilStopped(replay);
    expect(replay.atEnd).toBe(true);
  });

  it('stops at each of several breakpoints in turn', () => {
    const replay = createReplay([SEARCH_LINE, FIRE_LINE]);
    restartUntilStopped(replay);
    expect(replay.tick).toBe(0);
    expect(replay.breakpointsAhead).toEqual([SEARCH_LINE]);

    playUntilStopped(replay);
    expect(replay.breakpointsAhead).toEqual([FIRE_LINE]);
    expect(replay.atEnd).toBe(false);
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

  it('reads the breakpoint lines as playback goes, so they can be changed meanwhile', () => {
    const lines: number[] = [];
    const replay = new ReplayManager(recordMatch(matchConfig()), {
      maxFrameTime,
      speed: 1,
      breakpoints: { robotId: 'ALPHA', lines: () => lines },
    });
    replay.restart();
    replay.advance(TICK);
    expect(replay.playing).toBe(true);

    lines.push(FIRE_LINE);
    while (replay.playing) replay.advance(TICK);
    expect(replay.atEnd).toBe(false);
    expect(replay.breakpointsAhead).toEqual([FIRE_LINE]);
  });
});
