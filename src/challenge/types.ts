import type { Loadout } from '../data/parts';
import type { Goal, Stage, Text } from '../tutorial/types';

/** Something about how a challenge was cleared: a condition to clear it, or for a star more. */
export type Condition =
  /** The program has at most this many lines (comments and blank lines not counted). */
  | { kind: 'lines'; max: number }
  /** Cleared within this many seconds of the match. */
  | { kind: 'seconds'; max: number }
  /** ALPHA has at least this much HP left at the end. */
  | { kind: 'hp'; min: number }
  /** ALPHA took no damage. */
  | { kind: 'noHit' }
  /** ALPHA got at least this much HP back by resting out of sight. */
  | { kind: 'recovered'; min: number }
  /** ALPHA took at least this many hits while guarding. */
  | { kind: 'guarded'; min: number }
  /** ALPHA fired at most this many shots. */
  | { kind: 'shots'; max: number };

export interface Challenge {
  id: string;
  title: Text;
  /** What to do, and anything worth knowing. */
  brief: Text;
  stage: Stage;
  goal: Goal;
  /** Conditions that must hold, besides the goal, for the challenge to be cleared. */
  require?: readonly Condition[];
  /** The conditions of the second and the third star. */
  stars: readonly [Condition, Condition];
  /** ALPHA's parts are fixed to these (the rest standard); without them, the player chooses within the cost. */
  parts?: Partial<Loadout>;
  /** The code the challenge starts with. */
  start: string;
  /** A program that clears it, for the tests (with its parts, when they can be chosen). */
  answer: string;
  answerParts?: Partial<Loadout>;
}
