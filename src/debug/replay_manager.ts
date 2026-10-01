import type { Recording } from './recorder';
import type { Snapshot } from './snapshot';

/** Lines of one robot's program where playback should stop. */
export interface BreakpointSource {
  robotId: string;
  /** Read each time playback moves on, so breakpoints can change while playing. */
  lines(): readonly number[];
}

export interface ReplayOptions {
  /** sec, upper bound on real time consumed by one advance() call. */
  maxFrameTime: number;
  /** Playback speed multiplier to start with. */
  speed: number;
  /** null plays straight through. */
  breakpoints: BreakpointSource | null;
  /** Ticks to keep playing past the end, so the effects of the last tick can finish. */
  tailTicks: number;
}

/**
 * Decides which tick of a Recording is on screen: plays it back at a chosen
 * speed, steps through it, and jumps to any tick.
 *
 * A breakpoint stops playback just before its line runs: on the tick before
 * the first tick that executes the line, so the line's effect is not yet
 * visible and one step forward executes it.
 */
export class ReplayManager {
  speed: number;
  private cursor = 0;
  private furthest = 0;
  private isPlaying = false;
  /** Playback time not yet turned into ticks, in ticks. */
  private pending = 0;
  private tail = 0;

  constructor(
    readonly recording: Recording,
    private readonly options: ReplayOptions,
  ) {
    this.speed = options.speed;
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

  /**
   * Breakpoint lines that the next tick executes and the shown tick did not.
   * Playback stops when this is not empty.
   */
  get breakpointsAhead(): number[] {
    const { breakpoints } = this.options;
    if (breakpoints === null || this.atEnd) return [];
    const executed = this.executedLines(this.cursor, breakpoints.robotId);
    const executedNext = this.executedLines(this.cursor + 1, breakpoints.robotId);
    return breakpoints.lines().filter((line) => executedNext.includes(line) && !executed.includes(line));
  }

  /** Plays from the beginning, unless a breakpoint stops it before the first tick. */
  restart(): void {
    this.pause();
    this.moveTo(0);
    this.isPlaying = this.breakpointsAhead.length === 0;
  }

  /** Resumes playback from the shown tick; from the end, it starts over. */
  play(): void {
    if (this.atEnd) this.restart();
    else this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
    this.pending = 0;
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

  /** Consumes real time while playing. Stops after the end or just before a breakpoint line runs. */
  advance(elapsedSeconds: number): void {
    if (!this.isPlaying) return;
    const elapsed = Math.min(elapsedSeconds, this.options.maxFrameTime);
    this.pending += elapsed * this.speed * this.recording.tickRate;
    while (this.pending >= 1 && this.isPlaying) {
      this.pending -= 1;
      if (this.atEnd) {
        this.tail++;
      } else {
        this.moveTo(this.cursor + 1);
      }
      const finished = this.atEnd && this.tail >= this.options.tailTicks;
      if (finished || this.breakpointsAhead.length > 0) this.pause();
    }
  }

  private moveTo(tick: number): void {
    this.cursor = tick;
    this.tail = 0;
    this.furthest = Math.max(this.furthest, tick);
  }

  private executedLines(tick: number, robotId: string): readonly number[] {
    const robot = this.recording.snapshots[tick].robots.find((candidate) => candidate.id === robotId);
    if (robot === undefined) throw new Error(`No robot "${robotId}" in the recording`);
    return robot.executedLines;
  }
}
