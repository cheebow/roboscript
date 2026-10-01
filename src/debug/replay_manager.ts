import type { Recording } from './recorder';
import type { RobotSnapshot, Snapshot } from './snapshot';

/** Lines of one robot's program where playback should stop. */
export interface BreakpointSource {
  robotId: string;
  /** Read each time playback moves on, so breakpoints can change while playing. */
  lines(): readonly number[];
}

/** A line of a robot's program. */
export interface ProgramLine {
  robotId: string;
  line: number;
}

export interface ReplayOptions {
  /** sec, upper bound on real time consumed by one advance() call. */
  maxFrameTime: number;
  /** Playback speed multiplier to start with. */
  speed: number;
  /** One entry per robot whose breakpoints should stop playback; none plays straight through. */
  breakpoints: readonly BreakpointSource[];
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
  /** Per robot: lines of the coming tick already checked for breakpoints, so each stops playback once. */
  private readonly checked = new Map<string, number>();
  private stoppedAt: ProgramLine | null = null;
  /** Whether the playback under way passes breakpoints without stopping. */
  private passingBreakpoints = false;

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

  /** The breakpoint playback is stopped at, or null if it is not stopped at one. */
  get breakpoint(): ProgramLine | null {
    return this.stoppedAt;
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
    this.stoppedAt = null;
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
    this.passingBreakpoints = false;
  }

  /** Resumes playback from the shown moment; from the end, it starts over. */
  play(): void {
    if (this.atEnd) {
      this.restart();
      return;
    }
    // Whatever playback is stopped at has had its turn; do not stop there again.
    this.checked.set(this.focusId, Math.max(this.checked.get(this.focusId) ?? 0, this.linesRun + 1));
    this.stoppedAt = null;
    this.isPlaying = true;
  }

  /**
   * Like play(), but does not stop at breakpoints: playback runs on until it
   * is paused or reaches the end. Breakpoints count again from the next play().
   */
  playOn(): void {
    this.play();
    this.passingBreakpoints = true;
  }

  pause(): void {
    this.isPlaying = false;
    this.pending = 0;
    this.passingBreakpoints = false;
  }

  /** Pauses and runs one line of the focused program. Running its action line takes the match one tick on. */
  stepLine(): void {
    this.pause();
    this.stoppedAt = null;
    if (this.atEnd) return;
    if (this.linesRun + 1 < this.comingLines(this.focusId).length) {
      this.linesRun++;
      this.checked.set(this.focusId, Math.max(this.checked.get(this.focusId) ?? 0, this.linesRun));
    } else {
      this.moveTo(this.cursor + 1);
    }
  }

  /** Pauses and takes back one line of the focused program. */
  stepLineBack(): void {
    this.pause();
    this.stoppedAt = null;
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

  /** Consumes real time while playing. Stops after the end or, unless passing them, just before a breakpoint line runs. */
  advance(elapsedSeconds: number): void {
    if (!this.isPlaying) return;
    const elapsed = Math.min(elapsedSeconds, this.options.maxFrameTime);
    this.pending += elapsed * this.speed * this.recording.tickRate;
    while (this.pending >= 1 && this.isPlaying) {
      this.pending -= 1;
      if (this.atEnd) {
        this.tail++;
        if (this.tail >= this.options.tailTicks) this.pause();
      } else if (this.passingBreakpoints || !this.stopAtBreakpoint()) {
        this.moveTo(this.cursor + 1);
        if (this.atEnd && this.options.tailTicks === 0) this.pause();
      }
    }
  }

  /**
   * Looks through the lines of the coming tick that have not been checked yet.
   * At the first one with a breakpoint, stops there with its robot in focus.
   */
  private stopAtBreakpoint(): boolean {
    for (const { robotId, lines } of this.options.breakpoints) {
      const breakpoints = lines();
      const coming = this.comingLines(robotId);
      const from = this.checked.get(robotId) ?? 0;
      this.checked.set(robotId, coming.length);
      if (breakpoints.length === 0) continue;

      const index = coming.findIndex((line, position) => position >= from && breakpoints.includes(line));
      if (index < 0) continue;
      this.checked.set(robotId, index + 1);
      this.focusId = robotId;
      this.linesRun = index;
      this.stoppedAt = { robotId, line: coming[index] };
      this.pause();
      return true;
    }
    return false;
  }

  private moveTo(tick: number): void {
    this.cursor = tick;
    this.linesRun = 0;
    this.tail = 0;
    this.checked.clear();
    this.stoppedAt = null;
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
  return { ...robot, enemyVisible, enemyDistance, enemyAngle, lastSeen, blocked, blockedBehind };
}
