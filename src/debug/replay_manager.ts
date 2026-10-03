import { MATCH_DEFAULTS } from '../data/match_defaults';
import type { Recording } from './recorder';
import type { RobotSnapshot, Snapshot } from './snapshot';

/** A moment at which a robot runs a line: after `tick` ticks, with `index` lines of the coming tick already run. */
export interface LineRun {
  tick: number;
  index: number;
}

export interface ReplayOptions {
  /** sec, upper bound on real time consumed by one advance() call. */
  maxFrameTime: number;
  /** Playback speed multiplier to start with. */
  speed: number;
  /** Ticks to keep playing past the end, so the effects of the last tick can finish. */
  tailTicks: number;
  /** The robot whose program is stepped through line by line to begin with. */
  focus: string;
}

/**
 * Decides which moment of a Recording is on screen: plays it back at a chosen
 * speed, steps through it, and jumps to any tick.
 *
 * A moment is a tick plus a place in the lines the robots run next. The world
 * is shown as it is after `tick` ticks; the programs are shown part-way
 * through the lines of the following tick, whose last line is the action that
 * takes the world one tick further. Only the focused robot's program is
 * stepped line by line; the others are shown at their first line of the tick.
 */
export class ReplayManager {
  speed: number;
  private cursor = 0;
  /** How many of the focused robot's lines for the coming tick have been run. */
  private linesRun = 0;
  private focusId: string;
  private furthest = 0;
  private isPlaying = false;
  /** Playback time not yet turned into ticks, in ticks. */
  private pending = 0;
  private tail = 0;
  /** The runs of each line looked up so far, by robot and line. */
  private readonly runs = new Map<string, readonly LineRun[]>();

  constructor(
    readonly recording: Recording,
    private readonly options: ReplayOptions,
  ) {
    this.speed = options.speed;
    this.focusId = options.focus;
  }

  /** The tick being shown. */
  get tick(): number {
    return this.cursor;
  }

  get lastTick(): number {
    return this.recording.snapshots.length - 1;
  }

  /** The furthest tick shown so far. */
  get reachedTick(): number {
    return this.furthest;
  }

  /** The match as it is after `tick` ticks. */
  get snapshot(): Snapshot {
    return this.recording.snapshots[this.cursor];
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get atEnd(): boolean {
    return this.cursor === this.lastTick;
  }

  /** Ticks played past the end of the recording; the last snapshot stays on screen meanwhile. */
  get overrun(): number {
    return this.tail;
  }

  /** Whether the focused program has a line (or the recording a tick) left to step to. */
  get canStep(): boolean {
    return !this.atEnd;
  }

  get canStepBack(): boolean {
    return this.cursor > 0 || this.linesRun > 0;
  }

  /** Chooses the robot whose program is stepped line by line. Its place returns to the start of the tick. */
  focusOn(robotId: string): void {
    if (robotId === this.focusId) return;
    this.focusId = robotId;
    this.linesRun = 0;
  }

  /** The line the robot runs next, or null when its program has nothing left to run. */
  currentLine(robotId: string): number | null {
    return this.comingLines(robotId)[this.linesRunBy(robotId)] ?? null;
  }

  /** The lines the robot has run since the shown tick, in order. */
  linesSoFar(robotId: string): readonly number[] {
    return this.comingLines(robotId).slice(0, this.linesRunBy(robotId));
  }

  /** The robot's own variables as they stand at the shown moment. */
  variablesOf(robotId: string): Readonly<Record<string, number>> {
    const values = { ...this.robotAt(this.cursor, robotId).variables };
    if (this.atEnd) return values;
    const linesRun = this.linesRunBy(robotId);
    for (const { afterLines, name, value } of this.robotAt(this.cursor + 1, robotId).assignments) {
      if (afterLines <= linesRun) values[name] = value;
    }
    return values;
  }

  /**
   * The shown tick with each robot's sensor values replaced by what it senses
   * on the coming tick. Those are the values its program is reading at the
   * shown moment, and they describe the world exactly as it is drawn.
   */
  get view(): Snapshot {
    if (this.atEnd) return this.snapshot;
    const coming = this.recording.snapshots[this.cursor + 1];
    return {
      ...this.snapshot,
      robots: this.snapshot.robots.map((robot, index) => withSensorsOf(robot, coming.robots[index])),
    };
  }

  /** Plays from the beginning. */
  restart(): void {
    this.moveTo(0);
    this.isPlaying = true;
  }

  /** Resumes playback from the shown moment; from the end, it starts over. */
  play(): void {
    if (this.atEnd) this.restart();
    else this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
    this.pending = 0;
  }

  /** Pauses and runs one line of the focused program. Running its action line takes the match one tick on. */
  stepLine(): void {
    this.pause();
    if (this.atEnd) return;
    const lines = this.comingLines(this.focusId);
    // A tick that ran out of lines without an action goes round the same lines up to the line budget:
    // once round them is enough to see, then on to the next tick.
    const goesRound = lines.length >= MATCH_DEFAULTS.lineBudget && lines.slice(0, this.linesRun + 1).includes(lines[this.linesRun + 1]);
    if (this.linesRun + 1 < lines.length && !goesRound) {
      this.linesRun++;
    } else {
      this.moveTo(this.cursor + 1);
    }
  }

  /**
   * Steps over a call: on through the lines of whatever function the line
   * calls, to the next line of the same part of the program (the main program,
   * or the function the line is in). `ownerOf` gives the function of a line.
   */
  stepOver(ownerOf: (line: number) => string | null): void {
    const start = this.currentLine(this.focusId);
    if (start === null) {
      this.stepLine();
      return;
    }
    const home = ownerOf(start);
    // However long the call goes on, it stops at the end of the match.
    for (;;) {
      this.stepLine();
      const line = this.currentLine(this.focusId);
      if (this.atEnd || line === null || ownerOf(line) === home) return;
    }
  }

  /** Pauses and takes back one line of the focused program. */
  stepLineBack(): void {
    this.pause();
    if (this.linesRun > 0) {
      this.linesRun--;
    } else if (this.cursor > 0) {
      this.moveTo(this.cursor - 1);
      this.linesRun = Math.max(0, this.comingLines(this.focusId).length - 1);
    }
  }

  /** Pauses and moves one tick forward. */
  step(): void {
    this.seek(this.cursor + 1);
  }

  /** Pauses and moves one tick back. */
  stepBack(): void {
    this.seek(this.cursor - 1);
  }

  /** Pauses and jumps to the given tick, clamped to the recording. */
  seek(tick: number): void {
    this.pause();
    this.moveTo(Math.min(Math.max(Math.round(tick), 0), this.lastTick));
  }

  /**
   * Pauses just before the robot runs the given line on the given tick, with
   * that robot in focus. Falls back to the end of that tick if the line was
   * not run on it.
   */
  seekToLine(tick: number, robotId: string, line: number): void {
    this.seek(tick - 1);
    const index = this.atEnd ? -1 : this.comingLines(robotId).lastIndexOf(line);
    if (tick < 1 || index < 0) {
      this.seek(tick);
      return;
    }
    this.focusId = robotId;
    this.linesRun = index;
  }

  /** Every moment at which the robot runs the given line, in order. */
  runsOf(robotId: string, line: number): readonly LineRun[] {
    const key = `${robotId} ${line}`;
    let found = this.runs.get(key);
    if (found === undefined) {
      const runs: LineRun[] = [];
      for (let tick = 0; tick < this.lastTick; tick++) {
        this.robotAt(tick + 1, robotId).executedLines.forEach((executed, index) => {
          if (executed === line) runs.push({ tick, index });
        });
      }
      found = runs;
      this.runs.set(key, found);
    }
    return found;
  }

  /**
   * Which run of the line the robot is at right now, counting from 0, or null
   * when it is not just about to run it.
   */
  runAt(robotId: string, line: number): number | null {
    const index = this.linesRunBy(robotId);
    const position = this.runsOf(robotId, line).findIndex((run) => run.tick === this.cursor && run.index === index);
    return position < 0 ? null : position;
  }

  /**
   * Pauses just before the next time the robot runs the given line, with that
   * robot in focus; after the last time, it starts again from the first.
   * Returns false, and stays put, when the line never runs.
   */
  seekToNextRun(robotId: string, line: number): boolean {
    const runs = this.runsOf(robotId, line);
    const index = this.linesRunBy(robotId);
    const next = runs.find((run) => run.tick > this.cursor || (run.tick === this.cursor && run.index > index));
    return this.seekToRun(robotId, next ?? runs[0]);
  }

  /** Like seekToNextRun, but to the time before; before the first time, it goes to the last. */
  seekToPreviousRun(robotId: string, line: number): boolean {
    const runs = this.runsOf(robotId, line);
    const index = this.linesRunBy(robotId);
    const earlier = runs.filter((run) => run.tick < this.cursor || (run.tick === this.cursor && run.index < index));
    return this.seekToRun(robotId, earlier.at(-1) ?? runs.at(-1));
  }

  private seekToRun(robotId: string, run: LineRun | undefined): boolean {
    if (run === undefined) return false;
    this.pause();
    this.moveTo(run.tick);
    this.focusId = robotId;
    this.linesRun = run.index;
    return true;
  }

  /** Consumes real time while playing, up to the end of the recording and its tail. */
  advance(elapsedSeconds: number): void {
    if (!this.isPlaying) return;
    const elapsed = Math.min(elapsedSeconds, this.options.maxFrameTime);
    this.pending += elapsed * this.speed * this.recording.tickRate;
    while (this.pending >= 1 && this.isPlaying) {
      this.pending -= 1;
      if (this.atEnd) {
        this.tail++;
        if (this.tail >= this.options.tailTicks) this.pause();
      } else {
        this.moveTo(this.cursor + 1);
        if (this.atEnd && this.options.tailTicks === 0) this.pause();
      }
    }
  }

  private moveTo(tick: number): void {
    this.cursor = tick;
    this.linesRun = 0;
    this.tail = 0;
    this.furthest = Math.max(this.furthest, tick);
  }

  private linesRunBy(robotId: string): number {
    return robotId === this.focusId ? this.linesRun : 0;
  }

  /** The lines the robot runs on the tick after the shown one. */
  private comingLines(robotId: string): readonly number[] {
    return this.atEnd ? [] : this.robotAt(this.cursor + 1, robotId).executedLines;
  }

  private robotAt(tick: number, robotId: string): RobotSnapshot {
    const robot = this.recording.snapshots[tick].robots.find((candidate) => candidate.id === robotId);
    if (robot === undefined) throw new Error(`No robot "${robotId}" in the recording`);
    return robot;
  }
}

function withSensorsOf(robot: RobotSnapshot, sensing: RobotSnapshot): RobotSnapshot {
  const { enemyVisible, enemyDistance, enemyAngle, lastSeen, blocked, blockedBehind } = sensing;
  const { wallAhead, wallBehind, wallLeft, wallRight, incomingBullet, cover } = sensing;
  const { aimAngle, leadAngle, gunAngle, lead, hit, hitAngle, touchingEnemy } = sensing;
  // Whether the robot is hidden is known before its program runs, so the program reads the coming tick's value too.
  const { targetId, hidden, recovering, enemySpeed, enemyHeading } = sensing;
  return {
    ...robot,
    enemySpeed,
    enemyHeading,
    targetId,
    hidden,
    recovering,
    enemyVisible,
    enemyDistance,
    enemyAngle,
    lastSeen,
    blocked,
    blockedBehind,
    wallAhead,
    wallBehind,
    wallLeft,
    wallRight,
    incomingBullet,
    cover,
    aimAngle,
    leadAngle,
    gunAngle,
    lead,
    hit,
    hitAngle,
    touchingEnemy,
  };
}
