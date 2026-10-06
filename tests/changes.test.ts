import { describe, expect, it } from 'vitest';
import { CHANGES, changesSince, latestChangeDate } from '../src/data/changes';

describe('the record of changes', () => {
  it('is dated, in both languages, newest first', () => {
    expect(CHANGES.length).toBeGreaterThan(0);
    for (const change of CHANGES) {
      expect(change.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(change.en.trim()).not.toBe('');
      expect(change.ja.trim()).not.toBe('');
    }
    const dates = CHANGES.map((change) => change.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('tells what is newer than the day last seen; everything when nothing was seen', () => {
    expect(changesSince(null)).toEqual([...CHANGES]);
    expect(changesSince(latestChangeDate()!)).toEqual([]);
    expect(changesSince('9999-12-31')).toEqual([]);
    const oldest = CHANGES[CHANGES.length - 1].date;
    for (const change of changesSince('0000-01-01')) expect(change.date >= oldest).toBe(true);
    expect(changesSince('0000-01-01')).toEqual([...CHANGES]);
    // Seen up to the oldest day: only what came after it is news.
    expect(changesSince(oldest).every((change) => change.date > oldest)).toBe(true);
  });
});
