import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { OPEN_FIELD } from '../src/data/arenas/open_field';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { distance } from '../src/sim/math';
import type { Arena, Vec2 } from '../src/sim/types';
import { sensorField } from '../src/view/sensor_field';

const BARE: Arena = { ...OPEN_FIELD, obstacles: [] };
const CENTRE: Vec2 = { x: 500, y: 300 };

/** Whether the point lies inside the polygon (even-odd rule). */
function inside(polygon: readonly Vec2[], point: Vec2): boolean {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) within = !within;
  }
  return within;
}

describe('sensorField', () => {
  it('covers the whole arena for a sensor that sees all round and further than the arena is wide', () => {
    const field = sensorField(CENTRE, 0, ROBOT_DEFAULTS, BARE);
    for (const point of field) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(BARE.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(BARE.height);
    }
    expect(inside(field, { x: 10, y: 10 })).toBe(true);
    expect(inside(field, { x: 990, y: 590 })).toBe(true);
  });

  it('is a circle of the range for a sensor that sees all round but not far', () => {
    const field = sensorField(CENTRE, 0, { sensorRange: 100, sensorAngle: 360 }, BARE);
    for (const point of field) expect(distance(point, CENTRE)).toBeCloseTo(100, 5);
    expect(inside(field, { x: 550, y: 300 })).toBe(true);
    expect(inside(field, { x: 650, y: 300 })).toBe(false);
  });

  it('is a cone ahead of a sensor that sees only in front, starting at the robot', () => {
    const field = sensorField(CENTRE, 0, { sensorRange: 200, sensorAngle: 120 }, BARE);
    expect(field[0]).toEqual(CENTRE);
    expect(inside(field, { x: 600, y: 300 })).toBe(true);
    expect(inside(field, { x: 600, y: 350 })).toBe(true);
    expect(inside(field, { x: 400, y: 300 })).toBe(false);
    expect(inside(field, { x: 500, y: 400 })).toBe(false);
  });

  it('turns with the robot', () => {
    const field = sensorField(CENTRE, 90, { sensorRange: 200, sensorAngle: 120 }, BARE);
    expect(inside(field, { x: 500, y: 400 })).toBe(true);
    expect(inside(field, { x: 600, y: 300 })).toBe(false);
  });

  it('leaves out what lies behind an obstacle', () => {
    // The centre block of the default arena, seen from its right: the ground beyond it is in its shadow.
    const block = DEFAULT_ARENA.obstacles[0];
    const viewer = { x: block.x + block.width + 100, y: block.y + block.height / 2 };
    const field = sensorField(viewer, 180, ROBOT_DEFAULTS, DEFAULT_ARENA);
    expect(inside(field, { x: viewer.x - 50, y: viewer.y })).toBe(true);
    expect(inside(field, { x: block.x - 50, y: viewer.y })).toBe(false);
    // Above the block, the ground is seen past its corner.
    expect(inside(field, { x: block.x + block.width - 50, y: block.y - 80 })).toBe(true);
  });
});
