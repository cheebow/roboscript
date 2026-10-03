export type DebugEventType = 'sensor' | 'ai' | 'action' | 'hit' | 'warning' | 'system' | 'error';

export interface DebugEvent {
  /** Number of ticks completed when the event happened; 0 = before the first tick. */
  tick: number;
  /** Match time in sec. */
  timestamp: number;
  /** The robot the event belongs to, or null for match-wide events. */
  robotId: string | null;
  type: DebugEventType;
  message: string;
  /** Line of the AI source responsible, if any. */
  sourceLine: number | null;
}
