import type { Simulation } from './simulation';

/**
 * Drives a Simulation from real elapsed time using a fixed timestep, keeping
 * the tick rate independent of the rendering frame rate.
 */
export class MatchController {
  paused = false;
  private accumulator = 0;
  private readonly tickDuration: number;

  constructor(
    readonly simulation: Simulation,
    private readonly maxFrameTime: number,
  ) {
    this.tickDuration = 1 / simulation.tickRate;
  }

  /** Whether the match is still being played. */
  get running(): boolean {
    return this.simulation.result === null;
  }

  /** Consumes real time and runs as many ticks as fit. Returns the number of ticks run. */
  advance(elapsedSeconds: number): number {
    if (this.paused) return 0;
    this.accumulator += Math.min(elapsedSeconds, this.maxFrameTime);
    let ticks = 0;
    while (this.accumulator >= this.tickDuration && this.running) {
      this.simulation.step();
      this.accumulator -= this.tickDuration;
      ticks++;
    }
    return ticks;
  }
}
