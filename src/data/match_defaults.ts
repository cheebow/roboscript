export const MATCH_DEFAULTS = {
  /** simulation ticks per second */
  tickRate: 30,
  /** sec */
  maxMatchTime: 120,
  /** The seed the tests play with; in the app every match draws a seed of its own (`randomSeed`). */
  seed: 1,
  /** sec, upper bound on real time consumed per frame (e.g. after the tab was in the background) */
  maxFrameTime: 0.25,
  /** Most lines a program may run in one tick without an action, so an endless loop cannot hang a match. */
  lineBudget: 1000,
} as const;

export const ROBOT_IDS = ['ALPHA', 'BRAVO'] as const;

/** Replay speed multipliers offered to the player. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export const DEFAULT_PLAYBACK_SPEED = 1;

/** How many ticks each visual effect stays on screen. */
export const EFFECT_LIFETIMES = {
  shot: 2,
  impact: 4,
  hit: 8,
  deflected: 8,
  destroyed: 15,
  detected: 20,
  baseDestroyed: 15,
  baseHit: 10,
  signalHeard: 30,
} as const;
/** Playback runs this many ticks past the end, so the effects of the last tick can finish. */
export const REPLAY_TAIL_TICKS = Math.max(...Object.values(EFFECT_LIFETIMES));
