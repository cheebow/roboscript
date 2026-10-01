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
