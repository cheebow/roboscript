import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../data/match_defaults';
import { type Loadout, STANDARD_LOADOUT } from '../data/parts';
import { recordMatch } from '../debug/recorder';
import { tutorialMatch } from '../tutorial/match';
import { type ChallengeResult, judgeChallenge } from './judge';
import type { Challenge } from './types';

export { CHALLENGES } from './challenges';
export { describeCondition, describeGoal, judgeChallenge, linesOf, type ChallengeResult } from './judge';
export type { Challenge, Condition } from './types';

/** sec: a whole match, as in the arena. */
export const CHALLENGE_MATCH_TIME = MATCH_DEFAULTS.maxMatchTime;

/** The parts a try is played with: the challenge's fixed ones over the player's. */
export function challengeLoadout(challenge: Challenge, chosen: Loadout): Loadout {
  return { ...chosen, ...challenge.parts };
}

/** The match of a challenge with the source; the errors of the program when it has any. */
export function challengeMatch(challenge: Challenge, source: string, loadout: Loadout) {
  return tutorialMatch(challenge.stage, source, challengeLoadout(challenge, loadout), CHALLENGE_MATCH_TIME);
}

/** Plays the challenge with the source and judges it: for the tests, which play every answer. */
export function playChallenge(challenge: Challenge, source: string, parts: Partial<Loadout> = {}): ChallengeResult | { errors: string[] } {
  const built = challengeMatch(challenge, source, { ...STANDARD_LOADOUT, ...parts });
  if (!built.ok) return { errors: built.errors.map((error) => error.message) };
  return judgeChallenge(challenge, source, recordMatch(built.match.config, EFFECT_LIFETIMES));
}
