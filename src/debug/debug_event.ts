export type DebugEventType = 'sensor' | 'ai' | 'action' | 'hit' | 'warning' | 'system' | 'error';

/**
 * A hit's numbers, carried as data beside the message, so the analysis and
 * the commentary need not parse the text (which may be reworded). A robot
 * hit names `targetId`; a castle hit names `team` instead.
 */
export interface HitData {
  targetId?: string;
  /** The team whose castle was hit. */
  team?: number;
  damage: number;
  /** What the target had left after the hit. */
  hp: number;
  guarded?: boolean;
}

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
  /** For a 'hit' event: its numbers as data. */
  hit?: HitData;
}
