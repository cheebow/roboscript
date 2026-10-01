import { describe, expect, it } from 'vitest';
import { pointRectDistance, pointSegmentDistance, segmentRectDistance } from '../src/sim/math';

const RECT = { x: 100, y: 100, width: 50, height: 20 };

describe('pointSegmentDistance', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 10, y: 0 };

  it('measures to the nearest point along the segment', () => {
    expect(pointSegmentDistance({ x: 5, y: 3 }, from, to)).toBeCloseTo(3);
  });

  it('measures to the nearer end beyond the segment', () => {
    expect(pointSegmentDistance({ x: 13, y: 4 }, from, to)).toBeCloseTo(5);
    expect(pointSegmentDistance({ x: -3, y: -4 }, from, to)).toBeCloseTo(5);
  });

  it('handles a segment of zero length', () => {
    expect(pointSegmentDistance({ x: 3, y: 4 }, from, from)).toBeCloseTo(5);
  });
});

describe('pointRectDistance', () => {
  it('is 0 inside and on the edge', () => {
    expect(pointRectDistance({ x: 120, y: 110 }, RECT)).toBe(0);
    expect(pointRectDistance({ x: 100, y: 110 }, RECT)).toBe(0);
  });

  it('measures straight to an edge, and diagonally to a corner', () => {
    expect(pointRectDistance({ x: 120, y: 90 }, RECT)).toBeCloseTo(10);
    expect(pointRectDistance({ x: 153, y: 124 }, RECT)).toBeCloseTo(5);
  });
});

describe('segmentRectDistance', () => {
  it('is 0 when the segment crosses or ends in the rectangle', () => {
    expect(segmentRectDistance({ x: 90, y: 110 }, { x: 200, y: 110 }, RECT)).toBe(0);
    expect(segmentRectDistance({ x: 90, y: 110 }, { x: 120, y: 110 }, RECT)).toBe(0);
  });

  it('measures from a segment passing beside an edge', () => {
    expect(segmentRectDistance({ x: 0, y: 130 }, { x: 300, y: 130 }, RECT)).toBeCloseTo(10);
  });

  it('measures from the end of a segment that stops short', () => {
    expect(segmentRectDistance({ x: 0, y: 110 }, { x: 92, y: 110 }, RECT)).toBeCloseTo(8);
  });

  it('measures to a corner for a segment passing diagonally', () => {
    // The line x + y = 290 passes the corner (150, 120) at a distance of 20 / sqrt(2).
    expect(segmentRectDistance({ x: 290, y: 0 }, { x: 0, y: 290 }, RECT)).toBeCloseTo(20 / Math.SQRT2);
  });

  it('gives the true distance near a corner, not that to the bounding box grown on each side', () => {
    // 10 units right of and 10 above the top-right corner: about 14.1 away, though within 12 on each axis.
    const beside = { x: 160, y: 90 };
    expect(segmentRectDistance(beside, { x: 300, y: 90 }, RECT)).toBeCloseTo(Math.hypot(10, 10));
  });
});
