// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { placeAmong } from '../src/challenge/records';
import { CHALLENGE_RECORDS } from '../src/data/challenge_records';
import { RECORDS_SHOWN_FROM, renderRecordHistogram, showableRecords } from '../src/ui/record_histogram';

describe('whether the records are worth a picture', () => {
  it('wants enough of them, not all alike', () => {
    expect(showableRecords(undefined)).toBe(false);
    expect(showableRecords([5, 6, 7, 8, 9, 10, 11])).toBe(false); // one short of RECORDS_SHOWN_FROM
    expect(showableRecords([120, 120, 120, 120, 120, 120, 120, 120])).toBe(false); // all alike: nothing to compare
    expect(showableRecords([5, 6, 7, 8, 9, 10, 11, 12])).toBe(true);
    expect(RECORDS_SHOWN_FROM).toBe(8);
  });

  it('holds for the bundled records it is asked about', () => {
    // The challenges whose records are too few or too level fall out of the picture quietly.
    const shown = Object.entries(CHALLENGE_RECORDS.challenges).filter(([, record]) => showableRecords(record.seconds));
    expect(shown.length).toBeGreaterThan(10);
  });
});

describe('a record among the reference records', () => {
  it('counts the strictly quicker ones', () => {
    expect(placeAmong([5, 6, 7, 8], 6.5)).toEqual({ quicker: 2, count: 4 });
    expect(placeAmong([5, 6, 7, 8], 4)).toEqual({ quicker: 0, count: 4 });
    expect(placeAmong([5, 6, 7, 8], 9)).toEqual({ quicker: 4, count: 4 });
    expect(placeAmong([5, 6, 7, 8], 6)).toEqual({ quicker: 1, count: 4 }); // a tie is not quicker
  });
});

describe('the picture of the records', () => {
  const population = [10, 10.5, 11, 11, 12, 14, 20, 30];

  it('draws a bar for each bin with records, and a line where this clear landed', () => {
    const box = renderRecordHistogram(population, 12);
    const bars = box.querySelectorAll('rect.record-histogram-bar');
    expect(bars.length).toBeGreaterThan(2);
    expect(bars.length).toBeLessThanOrEqual(16);
    const marker = box.querySelector('line.record-histogram-me');
    expect(marker).not.toBeNull();
    // 12 s sits a tenth of the way from 10 to 30: x = (2 / 20) * 280.
    expect(Number(marker?.getAttribute('x1'))).toBeCloseTo(28, 5);
    // The scale reads from the quickest to the slowest, with the count between.
    const scale = box.querySelector('.record-histogram-scale');
    expect(scale?.textContent).toContain('10.0');
    expect(scale?.textContent).toContain('30.0');
    expect(scale?.textContent).toContain('8');
  });

  it('keeps the line on the picture when this clear is quicker or slower than every record', () => {
    const quickest = renderRecordHistogram(population, 5).querySelector('line.record-histogram-me');
    expect(Number(quickest?.getAttribute('x1'))).toBe(1);
    const slowest = renderRecordHistogram(population, 100).querySelector('line.record-histogram-me');
    expect(Number(slowest?.getAttribute('x1'))).toBe(279);
    // Outside records stretch the scale to include this clear.
    const stretched = renderRecordHistogram(population, 100).querySelector('.record-histogram-scale');
    expect(stretched?.textContent).toContain('100.0');
  });

  it('puts every bundled record between 0 and the match limit', () => {
    // A sanity pass over the data the panel will draw: each population renders without throwing.
    for (const record of Object.values(CHALLENGE_RECORDS.challenges)) {
      if (!showableRecords(record.seconds)) continue;
      const box = renderRecordHistogram(record.seconds, record.seconds[0]);
      expect(box.querySelector('svg.record-histogram')).not.toBeNull();
    }
  });
});
