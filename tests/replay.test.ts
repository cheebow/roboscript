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
// Lines of the sample AI (ALPHA's program).
/** `loop`: passed once per round. */
const LOOP_LINE = 2;
/** `fire`: the action taken, on alternate ticks, once the enemy is close enough. */
const FIRE_LINE = 13;
/** What the sample runs on a tick with the enemy hidden and the way clear: it sets the drive (no time) and ends in `wait`. */
const SEARCH_LINES = [2, 3, 6, 7, 17, 18, 19, 20];
/** `fire` in DumbBot (BRAVO's program). */
const BRAVO_FIRE_LINE = 12;

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
  return new ReplayManager(record(), { maxFrameTime, speed, breakpoints, tailTicks, focus: 'ALPHA' });
}

/** A recording of one program (as ALPHA) against a robot that does nothing. */
function replayOf(program: string, maxMatchTime = 2) {
  const recording = recordMatch(
    {
      ...matchConfig(),
      maxMatchTime,
      robots: [
        { id: 'ALPHA', brain: compileBrain(program) },
        { id: 'BRAVO', brain: compileBrain('loop\n    wait') },
      ],
    },
    EFFECT_LIFETIMES,
  );
  return new ReplayManager(recording, { maxFrameTime, speed: 1, breakpoints: [], tailTicks: 0, focus: 'ALPHA' });
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

  it('records the lines the AI ran on each tick, ending with the action it took', () => {
    const linesAt = (tick: number) => snapshots[tick].robots[0].executedLines;
    expect(linesAt(0)).toEqual([]);
    expect(linesAt(1)).toEqual(SEARCH_LINES);
    expect(linesAt(2)).toEqual(SEARCH_LINES);
    const blockedAt = snapshots.findIndex((snapshot) => snapshot.robots[0].blocked);
    expect(linesAt(blockedAt)).toEqual([2, 3, 4, 5]);
    // With a distant enemy in sight, every tick ends on the turn towards it; setting the drive takes no time.
    const sightedAt = snapshots.findIndex((snapshot) => snapshot.robots[0].enemyVisible);
    expect(linesAt(sightedAt)).toEqual([2, 3, 6, 7, 8]);
    expect(linesAt(sightedAt + 1)).toEqual([10, 14, 15, 16, 2, 3, 6, 7, 8]);
  });

  it('records what the AI assigned to its variables, and their values after each tick', () => {
    const { snapshots: counted } = replayOf('loop\n    set n = n + 1\n    wait').recording;
    const alphaAt = (tick: number) => counted[tick].robots[0];
    expect(alphaAt(0).variables).toEqual({});
    expect(alphaAt(1)).toMatchObject({ variables: { n: 1 }, assignments: [{ afterLines: 2, name: 'n', value: 1 }] });
    expect(alphaAt(3).variables).toEqual({ n: 3 });
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

describe('ReplayManager: stepping by line', () => {
  it('starts on the first line the program runs', () => {
    const replay = createReplay();
    expect(replay.tick).toBe(0);
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[0]);
    expect(replay.linesSoFar('ALPHA')).toEqual([]);
    expect(replay.canStepBack).toBe(false);
  });

  it('runs one line per step; lines that are not actions take no time', () => {
    const replay = createReplay();
    for (let step = 1; step < SEARCH_LINES.length; step++) {
      replay.stepLine();
      expect(replay.tick).toBe(0);
      expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[step]);
      expect(replay.linesSoFar('ALPHA')).toEqual(SEARCH_LINES.slice(0, step));
    }
  });

  it('moves the match one tick on when the action line is run', () => {
    const replay = createReplay();
    for (let step = 1; step < SEARCH_LINES.length; step++) replay.stepLine();
    const before = replay.snapshot.robots[0].x;

    replay.stepLine();
    expect(replay.tick).toBe(1);
    expect(replay.snapshot.robots[0].x).not.toBe(before);
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[0]);
    expect(replay.linesSoFar('ALPHA')).toEqual([]);
  });

  it('takes lines back, across a tick as well', () => {
    const replay = createReplay();
    replay.seek(1);
    replay.stepLine();
    replay.stepLineBack();
    expect(replay.tick).toBe(1);
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[0]);

    replay.stepLineBack();
    expect(replay.tick).toBe(0);
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES.at(-1));

    replay.seek(0);
    replay.stepLineBack();
    expect(replay.tick).toBe(0);
  });

  it('pauses playback', () => {
    const replay = createReplay();
    replay.play();
    replay.stepLine();
    expect(replay.playing).toBe(false);
  });

  it('steps only the program in focus; the other one is shown at the start of its tick', () => {
    const replay = createReplay();
    replay.stepLine();
    replay.stepLine();
    expect(replay.currentLine('BRAVO')).toBe(1);
    expect(replay.linesSoFar('BRAVO')).toEqual([]);

    replay.focusOn('BRAVO');
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[0]);
    replay.stepLine();
    expect(replay.currentLine('BRAVO')).toBe(2);
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[0]);
  });

  it('has no current line at the end of the match, and nothing more to step to', () => {
    const replay = createReplay();
    replay.seek(replay.lastTick);
    expect(replay.currentLine('ALPHA')).toBeNull();
    expect(replay.canStep).toBe(false);
    replay.stepLine();
    expect(replay.tick).toBe(replay.lastTick);
  });

  it('shows the variables as they stand line by line', () => {
    const replay = replayOf('loop\n    set n = n + 1\n    set double = n * 2\n    wait');
    expect(replay.variablesOf('ALPHA')).toEqual({});
    replay.stepLine(); // past `loop`
    replay.stepLine(); // past `set n`
    expect(replay.variablesOf('ALPHA')).toEqual({ n: 1 });
    replay.stepLine(); // past `set double`
    expect(replay.variablesOf('ALPHA')).toEqual({ n: 1, double: 2 });
    replay.stepLine(); // past `wait`: the tick is over
    expect(replay.tick).toBe(1);
    expect(replay.variablesOf('ALPHA')).toEqual({ n: 1, double: 2 });

    replay.stepLineBack();
    replay.stepLineBack();
    expect(replay.variablesOf('ALPHA')).toEqual({ n: 1 });
  });

  it('keeps stepping tick by tick through a program that has finished', () => {
    const replay = replayOf('fire');
    replay.stepLine();
    expect(replay.tick).toBe(1);
    expect(replay.currentLine('ALPHA')).toBeNull();
    replay.stepLine();
    expect(replay.tick).toBe(2);
  });
});

describe('ReplayManager: view', () => {
  it('shows each robot the sensor values its program is reading: those of the coming tick', () => {
    const replay = createReplay();
    const { snapshots } = replay.recording;
    const sightedAt = snapshots.findIndex((snapshot) => snapshot.robots[0].enemyVisible);

    replay.seek(sightedAt - 1);
    expect(replay.snapshot.robots[0].enemyVisible).toBe(false);
    expect(replay.view.robots[0].enemyVisible).toBe(true);
    expect(replay.view.robots[0].enemyDistance).toBe(snapshots[sightedAt].robots[0].enemyDistance);
    // Everything else is the shown tick.
    expect(replay.view.robots[0].x).toBe(replay.snapshot.robots[0].x);
    expect(replay.view.tick).toBe(sightedAt - 1);
  });

  it('is the last snapshot itself at the end', () => {
    const replay = createReplay();
    replay.seek(replay.lastTick);
    expect(replay.view).toBe(replay.snapshot);
  });
});

describe('ReplayManager: breakpoints', () => {
  it('stops just before the line runs', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);

    expect(replay.atEnd).toBe(false);
    expect(replay.breakpoint).toEqual({ robotId: 'ALPHA', line: FIRE_LINE });
    expect(replay.currentLine('ALPHA')).toBe(FIRE_LINE);
    expect(replay.linesSoFar('ALPHA')).toEqual([10, 11, 12]);
    // Nothing has been fired yet.
    expect(replay.snapshot.robots[0].ammo).toBe(ROBOT_DEFAULTS.maxAmmo);
  });

  it('runs the line with one step', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const stoppedAt = replay.tick;

    replay.stepLine();
    expect(replay.tick).toBe(stoppedAt + 1);
    expect(replay.snapshot.robots[0].ammo).toBe(ROBOT_DEFAULTS.maxAmmo - 1);
    expect(replay.breakpoint).toBeNull();
  });

  it('stops again every time the line comes round', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const first = replay.tick;

    // The sample turns to the enemy and fires on alternate ticks.
    playUntilStopped(replay);
    expect(replay.tick).toBe(first + 2);
    expect(replay.currentLine('ALPHA')).toBe(FIRE_LINE);
    playUntilStopped(replay);
    expect(replay.tick).toBe(first + 4);
  });

  it('stops before the very first line', () => {
    const replay = createReplay([LOOP_LINE]);
    restartUntilStopped(replay);
    expect(replay.tick).toBe(0);
    expect(replay.currentLine('ALPHA')).toBe(LOOP_LINE);

    playUntilStopped(replay);
    expect(replay.tick).toBe(1);
    expect(replay.currentLine('ALPHA')).toBe(LOOP_LINE);
  });

  it('stops at two breakpoints on the same tick one after the other', () => {
    const replay = createReplay([SEARCH_LINES[1], SEARCH_LINES[3]]);
    restartUntilStopped(replay);
    expect([replay.tick, replay.currentLine('ALPHA')]).toEqual([0, SEARCH_LINES[1]]);
    playUntilStopped(replay);
    expect([replay.tick, replay.currentLine('ALPHA')]).toEqual([0, SEARCH_LINES[3]]);
    playUntilStopped(replay);
    expect([replay.tick, replay.currentLine('ALPHA')]).toEqual([1, SEARCH_LINES[1]]);
  });

  it('does not stop again on a line it was stepped onto', () => {
    const replay = createReplay([SEARCH_LINES[2]]);
    replay.stepLine();
    replay.stepLine();
    expect(replay.currentLine('ALPHA')).toBe(SEARCH_LINES[2]);

    playUntilStopped(replay);
    expect(replay.tick).toBe(1);
  });

  it('stops again when the match is replayed from the end', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const first = replay.tick;
    while (!replay.atEnd) playUntilStopped(replay);

    playUntilStopped(replay);
    expect(replay.tick).toBe(first);
  });

  it('does not stop when stepping by tick or seeking past a breakpoint', () => {
    const replay = createReplay([LOOP_LINE]);
    replay.step();
    replay.step();
    expect(replay.tick).toBe(2);
    replay.seek(50);
    expect(replay.tick).toBe(50);
    expect(replay.breakpoint).toBeNull();
  });

  it('plays on past every breakpoint when asked to', () => {
    const replay = createReplay([FIRE_LINE]);
    restartUntilStopped(replay);
    const stoppedAt = replay.tick;

    replay.playOn();
    expect(replay.breakpoint).toBeNull();
    while (replay.playing) replay.advance(TICK);
    expect(replay.atEnd).toBe(true);
    // ALPHA fired several times on the way, each time passing the breakpoint.
    expect(replay.snapshot.robots[0].ammo).toBeLessThan(ROBOT_DEFAULTS.maxAmmo - 1);
    expect(replay.tick).toBeGreaterThan(stoppedAt + 2);
  });

  it('stops at breakpoints again once playing on has been paused', () => {
    const replay = createReplay([LOOP_LINE]);
    replay.playOn();
    for (let frame = 0; frame < 5; frame++) replay.advance(TICK);
    expect(replay.tick).toBe(5);

    // The line playback was paused on has had its turn; the next time round is a stop.
    replay.pause();
    playUntilStopped(replay);
    expect(replay.tick).toBe(6);
    expect(replay.breakpoint).toEqual({ robotId: 'ALPHA', line: LOOP_LINE });
  });

  it('plays on from the beginning when at the end', () => {
    const replay = createReplay([LOOP_LINE]);
    replay.seek(replay.lastTick);
    replay.playOn();
    expect(replay.tick).toBe(0);
    while (replay.playing) replay.advance(TICK);
    expect(replay.atEnd).toBe(true);
  });

  it('plays straight through without a breakpoint source', () => {
    const replay = createReplay(null);
    restartUntilStopped(replay);
    expect(replay.atEnd).toBe(true);
    expect(replay.breakpoint).toBeNull();
  });

  it('stops for the breakpoints of either robot, at whichever comes first, and puts that robot in focus', () => {
    // BRAVO (DumbBot) fires from further away than ALPHA, so its breakpoint comes first.
    const replay = new ReplayManager(record(), {
      maxFrameTime,
      speed: 1,
      tailTicks: 0,
      focus: 'ALPHA',
      breakpoints: [
        { robotId: 'ALPHA', lines: () => [FIRE_LINE] },
        { robotId: 'BRAVO', lines: () => [BRAVO_FIRE_LINE] },
      ],
    });
    restartUntilStopped(replay);
    expect(replay.breakpoint).toEqual({ robotId: 'BRAVO', line: BRAVO_FIRE_LINE });
    expect(replay.currentLine('BRAVO')).toBe(BRAVO_FIRE_LINE);
    expect(replay.snapshot.robots[1].ammo).toBe(ROBOT_DEFAULTS.maxAmmo);

    // Stepping now runs BRAVO's program.
    replay.stepLine();
    expect(replay.snapshot.robots[1].ammo).toBe(ROBOT_DEFAULTS.maxAmmo - 1);
  });

  it('reads the breakpoint lines as playback goes, so they can be changed meanwhile', () => {
    const lines: number[] = [];
    const replay = new ReplayManager(record(), {
      maxFrameTime,
      speed: 1,
      breakpoints: [{ robotId: 'ALPHA', lines: () => lines }],
      tailTicks: 0,
      focus: 'ALPHA',
    });
    replay.restart();
    replay.advance(TICK);
    expect(replay.playing).toBe(true);

    lines.push(FIRE_LINE);
    while (replay.playing) replay.advance(TICK);
    expect(replay.atEnd).toBe(false);
    expect(replay.breakpoint).toEqual({ robotId: 'ALPHA', line: FIRE_LINE });
  });
});

describe('ReplayManager: seekToLine', () => {
  it('goes to just before the line ran on that tick, with its robot in focus', () => {
    const replay = createReplay();
    const { events } = replay.recording;
    const shot = events.find((event) => event.robotId === 'BRAVO' && event.message === 'fire');
    if (shot === undefined || shot.sourceLine === null) throw new Error('Expected BRAVO to fire');

    replay.seekToLine(shot.tick, 'BRAVO', shot.sourceLine);
    expect(replay.tick).toBe(shot.tick - 1);
    expect(replay.currentLine('BRAVO')).toBe(BRAVO_FIRE_LINE);
    expect(replay.playing).toBe(false);
    expect(replay.snapshot.robots[1].ammo).toBe(ROBOT_DEFAULTS.maxAmmo);
  });

  it('goes to the tick itself when the line did not run on it', () => {
    const replay = createReplay();
    replay.seekToLine(5, 'ALPHA', FIRE_LINE);
    expect(replay.tick).toBe(5);
  });
});
