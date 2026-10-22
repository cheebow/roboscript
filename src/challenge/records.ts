import type { Loadout } from '../data/parts';
import { findTemplate } from '../data/templates';
import { HIT_HUNTER, HUNTER } from './challenges';
import type { Challenge } from './types';

/**
 * The reference records of a challenge: how quickly a set of known programs and
 * parts cleared it, measured once with `npm run records` and bundled with the
 * game (`src/data/challenge_records.ts`, generated). The matches are
 * deterministic, so the records hold until the rules, a challenge or one of the
 * programs change — the tests in `tests/challenge_records.test.ts` watch that.
 */

/** One cleared reference try, kept so it can be played again. */
export interface ChallengeRecordSample {
  /** What cleared it: 'answer', 'hunter', 'hit-hunter' or a template id. */
  program: string;
  /** The parts it was played with: playChallenge with these plays the same try. */
  loadout: Loadout;
  seconds: number;
}

export interface ChallengeRecord {
  /** The seconds of every cleared reference try, from the quickest. */
  seconds: readonly number[];
  /** The quickest, middle and slowest try, for playing back as a spot check. */
  samples: readonly ChallengeRecordSample[];
  /** How many tries were played in all, cleared or not. */
  tried: number;
}

export interface ChallengeRecords {
  /** The RULES_VERSION the records were measured under. */
  rulesVersion: string;
  /** Challenge id → its reference records. */
  challenges: Record<string, ChallengeRecord>;
}

/** The program keys every challenge is measured with, besides its own answer. */
export const RECORD_PROGRAM_KEYS = ['answer', 'hunter', 'hit-hunter'] as const;

/** The source behind a sample's program key; null when the key no longer names a program. */
export function programSource(key: string, challenge: Challenge): string | null {
  if (key === 'answer') return challenge.answer;
  if (key === 'hunter') return HUNTER;
  if (key === 'hit-hunter') return HIT_HUNTER;
  return findTemplate(key)?.source ?? null;
}

/** Of the reference records, the share (in whole percent) that this many seconds beats. */
export function percentileOf(population: readonly number[], seconds: number): number {
  if (population.length === 0) return 0;
  const slower = population.filter((each) => each > seconds).length;
  return Math.round((slower / population.length) * 100);
}
