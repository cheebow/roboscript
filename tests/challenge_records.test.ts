import { describe, expect, it } from 'vitest';
import { CHALLENGE_MATCH_TIME, CHALLENGES, playChallenge } from '../src/challenge';
import { programSource } from '../src/challenge/records';
import { CHALLENGE_RECORDS } from '../src/data/challenge_records';
import { RULES_VERSION } from '../src/data/rules_version';

// The bundled records are measured, not written: when a test here fails after a
// change to the rules, a challenge or a program, run `npm run records` and
// commit the regenerated src/data/challenge_records.ts.

describe('the bundled challenge records', () => {
  it('were measured under the current rules', () => {
    expect(CHALLENGE_RECORDS.rulesVersion, 'run `npm run records` after a rules change').toBe(RULES_VERSION);
  });

  it('cover exactly the challenges of the game', () => {
    const ids = CHALLENGES.map((challenge) => challenge.id).sort();
    expect(Object.keys(CHALLENGE_RECORDS.challenges).sort(), 'run `npm run records` after adding or removing a challenge').toEqual(ids);
  });

  it('hold sorted, playable seconds, with the samples among them', () => {
    for (const [id, record] of Object.entries(CHALLENGE_RECORDS.challenges)) {
      expect(record.tried, id).toBeGreaterThan(0);
      expect(record.seconds.length, id).toBeLessThanOrEqual(record.tried);
      for (let at = 0; at < record.seconds.length; at += 1) {
        const seconds = record.seconds[at];
        expect(Number.isFinite(seconds), id).toBe(true);
        expect(seconds, id).toBeGreaterThan(0);
        expect(seconds, id).toBeLessThanOrEqual(CHALLENGE_MATCH_TIME);
        if (at > 0) expect(seconds, id).toBeGreaterThanOrEqual(record.seconds[at - 1]);
      }
      for (const sample of record.samples) expect(record.seconds, id).toContain(sample.seconds);
      if (record.seconds.length > 0) expect(record.samples.length, id).toBeGreaterThan(0);
    }
  });

  // The matches are deterministic: one sample per challenge, played back, must land
  // on the very same seconds. This catches a changed program, stage or simulation
  // that slipped past RULES_VERSION. Cleared matches are short, so this stays cheap.
  for (const challenge of CHALLENGES) {
    it(`${challenge.id}: the middle sample plays back to the same record`, () => {
      const record = CHALLENGE_RECORDS.challenges[challenge.id];
      expect(record).toBeDefined();
      if (record === undefined || record.samples.length === 0) return;
      const sample = record.samples[Math.floor(record.samples.length / 2)];
      const source = programSource(sample.program, challenge);
      expect(source, `no program behind ${sample.program}: run \`npm run records\``).not.toBeNull();
      if (source === null) return;
      const played = playChallenge(challenge, source, sample.loadout);
      if ('errors' in played) throw new Error(played.errors.join(' '));
      expect(played.cleared).toBe(true);
      expect(played.record.seconds).toBe(sample.seconds);
    });
  }
});
