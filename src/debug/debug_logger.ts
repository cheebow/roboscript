import type { DebugEvent } from './debug_event';

/** Collects the debug events of one match in memory. */
export class DebugLogger {
  private readonly recorded: DebugEvent[] = [];

  get events(): readonly DebugEvent[] {
    return this.recorded;
  }

  log(event: DebugEvent): void {
    this.recorded.push(event);
  }
}
