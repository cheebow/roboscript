import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeLoadout, linesOf, playChallenge } from '../src/challenge';
import { COST_LIMIT, STANDARD_LOADOUT, costOf } from '../src/data/parts';

describe('the challenges', () => {
  it('have ids of their own and words in both languages', () => {
    const ids = CHALLENGES.map((challenge) => challenge.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const challenge of CHALLENGES) {
      for (const text of [challenge.title, challenge.brief]) {
        expect(text.en.trim(), challenge.id).not.toBe('');
        expect(text.ja.trim(), challenge.id).not.toBe('');
      }
    }
  });

  it('keep the parts of their answers within the cost limit, with any fixed parts on', () => {
    for (const challenge of CHALLENGES) {
      const loadout = challengeLoadout(challenge, { ...STANDARD_LOADOUT, ...challenge.answerParts });
      expect(costOf(loadout), challenge.id).toBeLessThanOrEqual(COST_LIMIT);
    }
  });

  for (const challenge of CHALLENGES) {
    it(`${challenge.id}: the answer clears it`, () => {
      expect(playChallenge(challenge, challenge.answer, challenge.answerParts)).toMatchObject({ cleared: true });
    });
    it(`${challenge.id}: the code it starts with does not clear it`, () => {
      expect(playChallenge(challenge, challenge.start)).toMatchObject({ cleared: false });
    });
  }
});

describe('lines of a program', () => {
  it('count only the lines that do something', () => {
    expect(linesOf('# a comment\n\nloop\n    fire  # shoot\n   \n')).toBe(2);
  });
});

describe('challenge progress', () => {
  it('reads back what was kept, and starts afresh from anything else', async () => {
    const { readChallengeProgress } = await import('../src/challenge/progress');
    const best = { stars: 2, lines: 12, seconds: 9.5, hp: 80 };
    expect(
      readChallengeProgress(
        JSON.stringify({ version: 1, current: 'pistol', code: { pistol: 'fire\n', bad: 1 }, best: { pistol: best, odd: { stars: 7 } }, loadout: { gun: 'pistol' } }),
      ),
    ).toEqual({ current: 'pistol', code: { pistol: 'fire\n' }, best: { pistol: best }, loadout: { ...STANDARD_LOADOUT, gun: 'pistol' } });
    expect(readChallengeProgress('not json')).toEqual({ current: null, code: {}, best: {}, loadout: STANDARD_LOADOUT });
  });

  it('keeps the better try: more stars, then more HP left, then quicker', async () => {
    const { better } = await import('../src/challenge/progress');
    const two = { stars: 2, lines: 12, seconds: 20, hp: 80 };
    expect(better(undefined, two)).toBe(two);
    expect(better(two, { ...two, stars: 1, hp: 200 })).toBe(two);
    expect(better(two, { ...two, hp: 100 })).toEqual({ ...two, hp: 100 });
    expect(better(two, { ...two, seconds: 10 })).toEqual({ ...two, seconds: 10 });
    expect(better(two, { ...two, seconds: 30 })).toBe(two);
  });
});
