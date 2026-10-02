import { describe, expect, it } from 'vitest';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { centreInside, placeMarks } from '../src/view/battle_view';

const { radius } = ROBOT_DEFAULTS;
const ARENA_HEIGHT = 600;
const LINE = 8;
/** As far up and as far down as a robot can get. */
const TOP = radius;
const BOTTOM = ARENA_HEIGHT - radius;

const marksAt = (y: number, labelLines = 1) => placeMarks(y, radius, labelLines, LINE, ARENA_HEIGHT);

describe('placeMarks', () => {
  it('puts the HP bar above a robot and its labels below, the guard label above the bar', () => {
    const y = 300;
    const { barY, labelsY, guardY, guardBaseline } = marksAt(y);
    expect(barY).toBeLessThan(y - radius);
    expect(labelsY).toBeGreaterThan(y + radius);
    expect(guardBaseline).toBe('bottom');
    expect(guardY).toBeLessThan(barY);
  });

  it('puts the HP bar below a robot at the top edge, between it and its labels', () => {
    const { barY, labelsY } = marksAt(TOP);
    expect(barY).toBeGreaterThan(TOP + radius);
    expect(barY).toBeLessThan(labelsY);
  });

  it('puts the guard label under the labels of a robot at the top edge', () => {
    const { labelsY, guardY, guardBaseline } = marksAt(TOP, 2);
    expect(guardBaseline).toBe('top');
    expect(guardY).toBe(labelsY + 2 * LINE);
  });

  it('puts the labels above a robot at the bottom edge, over the HP bar, the guard label over them', () => {
    const { barY, labelsY, guardY, guardBaseline } = marksAt(BOTTOM, 2);
    expect(labelsY + 2 * LINE).toBeLessThan(barY);
    expect(barY).toBeLessThan(BOTTOM - radius);
    expect(guardBaseline).toBe('bottom');
    expect(guardY).toBe(labelsY);
  });

  it('keeps everything inside the arena wherever the robot stands', () => {
    for (const labelLines of [1, 2]) {
      for (let y = TOP; y <= BOTTOM; y++) {
        const { barY, labelsY, guardY, guardBaseline } = marksAt(y, labelLines);
        const guardTop = guardBaseline === 'top' ? guardY : guardY - LINE;
        const tops = [barY, labelsY, guardTop];
        const bottoms = [barY + 3, labelsY + labelLines * LINE, guardTop + LINE];
        expect(Math.min(...tops), `top at y=${y}`).toBeGreaterThanOrEqual(0);
        expect(Math.max(...bottoms), `bottom at y=${y}`).toBeLessThanOrEqual(ARENA_HEIGHT);
      }
    }
  });

  it('does not put anything on the robot itself', () => {
    for (let y = TOP; y <= BOTTOM; y++) {
      const { barY, labelsY } = marksAt(y, 2);
      expect(barY + 3 <= y - radius || barY >= y + radius, `bar at y=${y}`).toBe(true);
      expect(labelsY + 2 * LINE <= y - radius || labelsY >= y + radius, `labels at y=${y}`).toBe(true);
    }
  });
});

describe('centreInside', () => {
  const WIDTH = 1000;

  it('leaves a text where it belongs when all of it fits', () => {
    expect(centreInside(500, 60, WIDTH)).toBe(500);
    expect(centreInside(60, 60, WIDTH)).toBe(60);
  });

  it('moves a text in from the left and the right edge', () => {
    expect(centreInside(16, 60, WIDTH)).toBe(60);
    expect(centreInside(984, 60, WIDTH)).toBe(940);
  });

  it('starts a text wider than the arena at the left edge', () => {
    expect(centreInside(500, 700, WIDTH)).toBe(700);
  });
});
