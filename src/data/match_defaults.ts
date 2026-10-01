export const MATCH_DEFAULTS = {
  /** simulation ticks per second */
  tickRate: 30,
  /** sec */
  maxMatchTime: 120,
  seed: 1,
  /** sec, upper bound on real time consumed per frame (e.g. after the tab was in the background) */
  maxFrameTime: 0.25,
} as const;

export const ROBOT_IDS = ['ALPHA', 'BRAVO'] as const;

/** Replay speed multipliers offered to the player (SPEC §24). */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export const DEFAULT_PLAYBACK_SPEED = 1;
