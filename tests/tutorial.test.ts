import { describe, expect, it } from 'vitest';
import { STEPS, playStep } from '../src/tutorial';

/** The code a step starts with: its own, or the answer of the step before (what a player who did it has). */
function startOf(index: number): string {
  for (let at = index; at >= 0; at--) {
    const { step } = STEPS[at];
    if (at === index && step.start !== undefined) return step.start;
    if (at < index && step.answer !== undefined) return step.answer;
    if (at < index && step.start !== undefined) return step.start;
  }
  return '';
}

describe('the tutorial', () => {
  it('has steps with ids of their own', () => {
    const ids = STEPS.map(({ step }) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every step a title and an explanation in both languages', () => {
    for (const { step } of STEPS) {
      for (const text of [step.title, step.body, ...(step.task ? [step.task] : []), ...(step.hints ?? [])]) {
        expect(text.en.trim(), step.id).not.toBe('');
        expect(text.ja.trim(), step.id).not.toBe('');
      }
    }
  });

  STEPS.forEach(({ step }, index) => {
    if (step.check.kind !== 'match') return;
    it(`step ${step.id}: the answer clears it`, () => {
      const answer = step.answer ?? step.start;
      expect(answer, 'a match step needs an answer or working start code').toBeDefined();
      expect(playStep(step, answer ?? '')).toMatchObject({ done: true });
    });
    if (step.check.goal.kind === 'run') return;
    it(`step ${step.id}: the code it starts with does not clear it`, () => {
      expect(playStep(step, startOf(index))).not.toMatchObject({ done: true });
    });
  });
});

describe('tutorial progress', () => {
  it('reads back what was kept, and starts afresh from anything else', async () => {
    const { readProgress } = await import('../src/tutorial/progress');
    expect(readProgress(JSON.stringify({ version: 1, current: 'loop', cleared: ['fire', 3], code: { fire: 'fire\n', bad: 1 } }))).toEqual({
      current: 'loop',
      cleared: ['fire'],
      code: { fire: 'fire\n' },
    });
    expect(readProgress('not json')).toEqual({ current: null, cleared: [], code: {} });
    expect(readProgress(null)).toEqual({ current: null, cleared: [], code: {} });
  });
});

describe('a tutorial match', () => {
  it('ends a second after the step is cleared, and plays on to its end when it is not', async () => {
    const { trimmed } = await import('../src/tutorial');
    const { tutorialMatch } = await import('../src/tutorial/match');
    const { recordMatch } = await import('../src/debug/recorder');
    const { EFFECT_LIFETIMES } = await import('../src/data/match_defaults');
    const { RANGE } = await import('../src/tutorial/stages');
    const built = tutorialMatch(RANGE, 'loop\n    fire');
    if (!built.ok) throw new Error('does not compile');
    const recording = recordMatch(built.match.config, EFFECT_LIFETIMES);
    const cut = trimmed(recording, { done: true, tick: 40 });
    expect(cut.snapshots).toHaveLength(71);
    expect(cut.events.every((event) => event.tick <= 70)).toBe(true);
    expect(trimmed(recording, { done: false, why: { en: '', ja: '' } })).toBe(recording);
  });
});
