import { ADVANCED_CHAPTERS } from './chapters_advanced';
import { BASIC_CHAPTERS } from './chapters_basic';
import { CASTLE_CHAPTER } from './chapter_castle';
import { judge, missingWord, type Outcome } from './checks';
import { recordMatch } from '../debug/recorder';
import { EFFECT_LIFETIMES } from '../data/match_defaults';
import type { Recording } from '../debug/recorder';
import { stageLoadout, tutorialMatch } from './match';
import type { Chapter, Step } from './types';
import type { Loadout } from '../data/parts';

/** Every chapter of the tutorial, in order. */
export const CHAPTERS: readonly Chapter[] = [...BASIC_CHAPTERS, ...ADVANCED_CHAPTERS, CASTLE_CHAPTER];

/** Every step, in order, with the chapter it is in. */
export const STEPS: readonly { chapter: Chapter; step: Step }[] = CHAPTERS.flatMap((chapter) => chapter.steps.map((step) => ({ chapter, step })));

/** Whether a match played with the source meets the step's check; for a step whose check is a match. */
export function judgeStep(step: Step, source: string, recording: Recording): Outcome {
  if (step.check.kind !== 'match') return { done: true, tick: 0 };
  const missing = step.check.uses === undefined ? null : missingWord(source, step.check.uses);
  if (missing !== null) return { done: false, why: { en: `Use \`${missing}\` in the program.`, ja: `プログラムで \`${missing}\` を使ってみましょう。` } };
  return judge(step.check.goal, recording, step.stage);
}

/** ticks the match goes on after the step is cleared, so that what cleared it can be seen. */
const AFTER_CLEARED = 30;

/**
 * The match as the tutorial shows it: when the step is cleared in it, it ends
 * a moment after, rather than playing on to a time-out that says nothing.
 */
export function trimmed(recording: Recording, outcome: Outcome): Recording {
  if (!outcome.done) return recording;
  const end = outcome.tick + AFTER_CLEARED;
  if (end >= recording.snapshots.length - 1) return recording;
  return {
    ...recording,
    snapshots: recording.snapshots.slice(0, end + 1),
    events: recording.events.filter((event) => event.tick <= end),
  };
}

/** Plays the step's match with the source and judges it: for the tests, which play every answer. */
export function playStep(step: Step, source: string, parts: Partial<Loadout> = {}): Outcome | { errors: string[] } {
  if (step.stage === undefined) throw new Error(`Step ${step.id} has no stage`);
  const built = tutorialMatch(step.stage, source, { ...stageLoadout(step.stage), ...parts });
  if (!built.ok) return { errors: built.errors.map((error) => error.message) };
  return judgeStep(step, source, recordMatch(built.match.config, EFFECT_LIFETIMES));
}
