import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeLoadout, linesOf, playChallenge } from '../src/challenge';
import { teamCostLimitFor } from '../src/data/castle';
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
      // The screen starts every challenge from standard parts: with the fixed ones on, they must fit as they are.
      const loadout = challengeLoadout(challenge, { ...STANDARD_LOADOUT, ...challenge.answerParts });
      const size = challenge.stage.teamSize;
      if (size === undefined) expect(costOf(loadout), challenge.id).toBeLessThanOrEqual(COST_LIMIT);
      else expect(costOf(loadout) * size, challenge.id).toBeLessThanOrEqual(teamCostLimitFor(size));
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

describe('calling by name', () => {
  const challenge = CHALLENGES.find((each) => each.id === 'base-call-by-name');
  if (challenge === undefined) throw new Error('no base-call-by-name');

  it('is not cleared by calling everyone: the whole team turns back and loses the race', () => {
    const broadcast = challenge.answer.replaceAll('signal 1 to 2', 'signal 1').replaceAll('signal 0 to 2', 'signal 0');
    expect(playChallenge(challenge, broadcast)).toMatchObject({ cleared: false });
  });

  it('sees a directed signal wherever it is written, in a function too', async () => {
    const { judgeChallenge } = await import('../src/challenge');
    const played = playChallenge(challenge, challenge.answer);
    expect(played).toMatchObject({ cleared: true });
    // The same match judged against programs that do and do not call by name.
    const { recordMatch } = await import('../src/debug/recorder');
    const { EFFECT_LIFETIMES } = await import('../src/data/match_defaults');
    const { challengeMatch } = await import('../src/challenge');
    const built = challengeMatch(challenge, challenge.answer, { ...STANDARD_LOADOUT });
    if (!built.ok) throw new Error('does not compile');
    const recording = recordMatch(built.match.config, EFFECT_LIFETIMES);
    expect(judgeChallenge(challenge, 'def call()\n    signal 1 to 2\nloop\n    wait', recording)).toMatchObject({ cleared: true });
    const without = judgeChallenge(challenge, 'loop\n    signal 1\n    wait', recording);
    expect(without).toMatchObject({ cleared: false });
    expect(without.why?.ja).toContain('signal … to …');
  });
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

describe('the champion', () => {
  /** Wins of the first robot against the second over every map, seeds 1 to `seeds`, from both sides. */
  async function wins(a: { source: string; parts: object }, b: { source: string; parts: object }, seeds: number) {
    const { prepareFight } = await import('../src/arena/match');
    const { ARENAS } = await import('../src/data/arenas');
    const { Simulation } = await import('../src/sim/simulation');
    const entrant = (name: string, robot: { source: string; parts: object }) => ({ id: name, name, origin: 'garage' as const, loadout: { ...STANDARD_LOADOUT, ...robot.parts }, source: robot.source });
    let won = 0;
    let played = 0;
    for (const { arena } of ARENAS) {
      for (let seed = 1; seed <= seeds; seed++) {
        for (const first of [true, false]) {
          const pair = first ? [entrant('A', a), entrant('B', b)] : [entrant('B', b), entrant('A', a)];
          const prepared = prepareFight(pair, arena, seed);
          if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
          const simulation = new Simulation(prepared.fight.config);
          while (simulation.result === null) simulation.step();
          if (simulation.result.winnerId === 'A') won++;
          played++;
        }
      }
    }
    return won / played;
  }

  it('beats every built-in robot in most matches', async () => {
    const { CHAMPION, CHAMPION_LOADOUT } = await import('../src/challenge/champion');
    const { TEMPLATES } = await import('../src/data/templates');
    for (const template of TEMPLATES) {
      const rate = await wins({ source: CHAMPION, parts: CHAMPION_LOADOUT }, { source: template.source, parts: {} }, 2);
      expect(rate, template.name).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('is beaten more often than not by SentryBot built to shoot from beyond what it can see', async () => {
    const { CHAMPION, CHAMPION_LOADOUT } = await import('../src/challenge/champion');
    const { SENTRY_BOT } = await import('../src/data/templates/sentry_bot');
    const rate = await wins({ source: SENTRY_BOT, parts: { legs: 'sprint', gun: 'cannon', sensor: 'scope' } }, { source: CHAMPION, parts: CHAMPION_LOADOUT }, 4);
    expect(rate).toBeGreaterThan(0.5);
  });
});
