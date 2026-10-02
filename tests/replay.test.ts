import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, PLAYBACK_SPEEDS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { recordMatch } from '../src/debug/recorder';
import { ReplayManager } from '../src/debug/replay_manager';
import { captureSnapshot } from '../src/debug/snapshot';
import { Simulation, type SimulationConfig } from '../src/sim/simulation';
import { compileBrain, enemySource, runTicks } from './helpers';

const { tickRate, maxFrameTime } = MATCH_DEFAULTS;
const TICK = 1 / tickRate;
// Lines of the sample AI (ALPHA's program).
/** `fire`: the action taken, on alternate ticks, once the enemy is close enough. */
const FIRE_LINE = 15;
/** What the sample runs on a tick with the enemy hidden and the way clear: round the loop, into `search`, ending in `wait`. */
const SEARCH_LINES = [25, 26, 28, 29, 31, 32, 21, 22, 23];
/** Round the loop into `attack`, as far as its `turn enemy`. */
const SIGHTED_LINES = [25, 26, 28, 29, 30, 10];
/** `fire` in DumbBot (BRAVO's program). */
const BRAVO_FIRE_LINE = 12;

/** The real game setup: the sample AI against DumbBot. */
function matchConfig(seed = 1): SimulationConfig {
  return {
    arena: DEFAULT_ARENA,
    tickRate,
    maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
    seed,
    robots: [
      { id: 'ALPHA', brain: compileBrain(SAMPLE_AI), stats: ROBOT_DEFAULTS },
      { id: 'BRAVO', brain: compileBrain(enemySource('dumb_bot')), stats: ROBOT_DEFAULTS },
    ],
  };
}

function record(seed = 1) {
  return recordMatch(matchConfig(seed), EFFECT_LIFETIMES);
}

function createReplay(speed = 1, tailTicks = 0) {
  return new ReplayManager(record(), { maxFrameTime, speed, tailTicks, focus: 'ALPHA' });
}

/** A recording of one program (as ALPHA) against a robot that does nothing. */
function replayOf(program: string, maxMatchTime = 2) {
  const recording = recordMatch(
    {
      ...matchConfig(),
      maxMatchTime,
      robots: [
        { id: 'ALPHA', brain: compileBrain(program), stats: ROBOT_DEFAULTS },
        { id: 'BRAVO', brain: compileBrain('loop\n    wait'), stats: ROBOT_DEFAULTS },
      ],
    },
    EFFECT_LIFETIMES,
  );
  return new ReplayManager(recording, { maxFrameTime, speed: 1, tailTicks: 0, focus: 'ALPHA' });
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
    expect(snapshots[0].robots.map(({ id, x, y, hp, label }) => ({ id, x, y, hp, label }))).toEqual([
      { id: 'ALPHA', x: playerSpawn.x, y: playerSpawn.y, hp: ROBOT_DEFAULTS.maxHp, label: 'IDLE' },
      { id: 'BRAVO', x: enemySpawn.x, y: enemySpawn.y, hp: ROBOT_DEFAULTS.maxHp, label: 'IDLE' },
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
    expect(linesAt(blockedAt)).toEqual([25, 26, 27, 5, 6]);
    // With a distant enemy in sight, every tick ends on the turn towards it; setting the drive takes no time.
    const sightedAt = snapshots.findIndex((snapshot) => snapshot.robots[0].enemyVisible);
    expect(linesAt(sightedAt)).toEqual(SIGHTED_LINES);
    expect(linesAt(sightedAt + 1)).toEqual([12, 16, 17, 18, ...SIGHTED_LINES]);
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
      const replay = createReplay(speed);
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
    const replay = createReplay(1, TAIL);
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
    const replay = createReplay(1, TAIL);
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

describe('ReplayManager: the runs of a line', () => {
  it('lists every moment at which the robot runs the line, in order', () => {
    const replay = createReplay();
    const { snapshots } = replay.recording;
    const shots = replay.runsOf('ALPHA', FIRE_LINE);

    // The sample fires on the fourth line of its tick (12, 13, 14, then 15); it tries more often than the gun allows.
    expect(shots.length).toBeGreaterThan(ROBOT_DEFAULTS.maxAmmo - snapshots.at(-1)!.robots[0].ammo);
    for (const { tick, index } of shots) {
      expect(snapshots[tick + 1].robots[0].executedLines[index]).toBe(FIRE_LINE);
    }
    expect(shots.map((run) => run.tick)).toEqual([...shots.map((run) => run.tick)].sort((a, b) => a - b));
    expect(shots.every((run) => run.index === 3)).toBe(true);
  });

  it('counts a line once for every time it runs within a tick', () => {
    // Two rounds of the while loop before the tick ends on the wait.
    const replay = replayOf('loop\n    set n = 0\n    while n < 2\n        set n = n + 1\n    wait');
    const runs = replay.runsOf('ALPHA', 4);
    expect(runs.slice(0, 4)).toEqual([
      { tick: 0, index: 3 },
      { tick: 0, index: 5 },
      { tick: 1, index: 3 },
      { tick: 1, index: 5 },
    ]);
  });

  it('is empty for a line that never runs', () => {
    const replay = replayOf('loop\n    if hp > 1000\n        fire\n    wait');
    expect(replay.runsOf('ALPHA', 3)).toEqual([]);
    expect(replay.runsOf('ALPHA', 99)).toEqual([]);
  });

  it('are those of the robot asked for', () => {
    const replay = createReplay();
    expect(replay.runsOf('BRAVO', BRAVO_FIRE_LINE)[0]).not.toEqual(replay.runsOf('ALPHA', FIRE_LINE)[0]);
  });
});

describe('ReplayManager: going to where a line runs', () => {
  it('goes to just before the next time the line runs, paused', () => {
    const replay = createReplay();
    replay.play();
    const [first] = replay.runsOf('ALPHA', FIRE_LINE);

    expect(replay.seekToNextRun('ALPHA', FIRE_LINE)).toBe(true);
    expect(replay.playing).toBe(false);
    expect(replay.tick).toBe(first.tick);
    expect(replay.currentLine('ALPHA')).toBe(FIRE_LINE);
    expect(replay.linesSoFar('ALPHA')).toEqual([12, 13, 14]);
    // Nothing has been fired yet; one step fires.
    expect(replay.snapshot.robots[0].ammo).toBe(ROBOT_DEFAULTS.maxAmmo);
    replay.stepLine();
    expect(replay.snapshot.robots[0].ammo).toBe(ROBOT_DEFAULTS.maxAmmo - 1);
  });

  it('goes on to the time after that when asked again', () => {
    const replay = createReplay();
    const runs = replay.runsOf('ALPHA', FIRE_LINE);
    replay.seekToNextRun('ALPHA', FIRE_LINE);
    replay.seekToNextRun('ALPHA', FIRE_LINE);
    expect(replay.tick).toBe(runs[1].tick);
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBe(1);
  });

  it('starts from wherever the match is being shown', () => {
    const replay = createReplay();
    const runs = replay.runsOf('ALPHA', FIRE_LINE);
    replay.seek(runs[2].tick - 1);
    replay.seekToNextRun('ALPHA', FIRE_LINE);
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBe(2);
  });

  it('starts over from the first time after the last', () => {
    const replay = createReplay();
    const runs = replay.runsOf('ALPHA', FIRE_LINE);
    replay.seek(replay.lastTick);
    expect(replay.seekToNextRun('ALPHA', FIRE_LINE)).toBe(true);
    expect(replay.tick).toBe(runs[0].tick);
  });

  it('goes back to the time before, and from the first to the last', () => {
    const replay = createReplay();
    const runs = replay.runsOf('ALPHA', FIRE_LINE);
    replay.seekToNextRun('ALPHA', FIRE_LINE);
    replay.seekToNextRun('ALPHA', FIRE_LINE);

    expect(replay.seekToPreviousRun('ALPHA', FIRE_LINE)).toBe(true);
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBe(0);
    replay.seekToPreviousRun('ALPHA', FIRE_LINE);
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBe(runs.length - 1);
  });

  it('visits each time a line runs within one tick', () => {
    const replay = replayOf('loop\n    set n = 0\n    while n < 2\n        set n = n + 1\n    wait');
    replay.seekToNextRun('ALPHA', 4);
    expect([replay.tick, replay.linesSoFar('ALPHA').length]).toEqual([0, 3]);
    expect(replay.variablesOf('ALPHA')).toEqual({ n: 0 });
    replay.seekToNextRun('ALPHA', 4);
    expect([replay.tick, replay.linesSoFar('ALPHA').length]).toEqual([0, 5]);
    expect(replay.variablesOf('ALPHA')).toEqual({ n: 1 });
    replay.seekToNextRun('ALPHA', 4);
    expect([replay.tick, replay.linesSoFar('ALPHA').length]).toEqual([1, 3]);
  });

  it('puts the robot of the line in focus', () => {
    const replay = createReplay();
    replay.seekToNextRun('BRAVO', BRAVO_FIRE_LINE);
    expect(replay.currentLine('BRAVO')).toBe(BRAVO_FIRE_LINE);
    // Stepping now runs BRAVO's program.
    replay.stepLine();
    expect(replay.snapshot.robots[1].ammo).toBe(ROBOT_DEFAULTS.maxAmmo - 1);
  });

  it('stays put, and says so, for a line that never runs', () => {
    const replay = replayOf('loop\n    if hp > 1000\n        fire\n    wait');
    replay.seek(5);
    expect(replay.seekToNextRun('ALPHA', 3)).toBe(false);
    expect(replay.seekToPreviousRun('ALPHA', 3)).toBe(false);
    expect(replay.tick).toBe(5);
  });

  it('tells which run of the line the robot is at, if it is at one', () => {
    const replay = createReplay();
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBeNull();
    replay.seekToNextRun('ALPHA', FIRE_LINE);
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBe(0);
    replay.stepLine();
    expect(replay.runAt('ALPHA', FIRE_LINE)).toBeNull();
  });
});

describe('ReplayManager: playing', () => {
  it('plays straight through to the end', () => {
    const replay = createReplay();
    restartUntilStopped(replay);
    expect(replay.atEnd).toBe(true);
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
