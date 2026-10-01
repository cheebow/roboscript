import { describe, expect, it } from 'vitest';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { ConeSensor } from '../src/sim/sensor';

const { sensorRange, sensorAngle } = ROBOT_DEFAULTS;
const ORIGIN = { x: 500, y: 300 };
const FACING_RIGHT = 0;

function pointAt(distance: number, angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: ORIGIN.x + Math.cos(radians) * distance, y: ORIGIN.y + Math.sin(radians) * distance };
}

function createSensor(): ConeSensor {
  return new ConeSensor(sensorRange, sensorAngle);
}

describe('ConeSensor', () => {
  it('sees an enemy inside range', () => {
    const reading = createSensor().scan(ORIGIN, FACING_RIGHT, pointAt(sensorRange - 1, 0));
    expect(reading.enemyVisible).toBe(true);
    expect(reading.enemyDistance).toBeCloseTo(sensorRange - 1);
    expect(reading.enemyAngle).toBeCloseTo(0);
  });

  it('does not see an enemy outside range', () => {
    const reading = createSensor().scan(ORIGIN, FACING_RIGHT, pointAt(sensorRange + 1, 0));
    expect(reading.enemyVisible).toBe(false);
  });

  it('sees an enemy inside the field of view', () => {
    const sensor = createSensor();
    const inside = sensorAngle / 2 - 1;
    expect(sensor.scan(ORIGIN, FACING_RIGHT, pointAt(100, inside)).enemyVisible).toBe(true);
    expect(sensor.scan(ORIGIN, FACING_RIGHT, pointAt(100, -inside)).enemyVisible).toBe(true);
  });

  it('does not see an enemy outside the field of view', () => {
    const outside = sensorAngle / 2 + 1;
    expect(createSensor().scan(ORIGIN, FACING_RIGHT, pointAt(100, outside)).enemyVisible).toBe(false);
    expect(createSensor().scan(ORIGIN, FACING_RIGHT, pointAt(100, -outside)).enemyVisible).toBe(false);
    expect(createSensor().scan(ORIGIN, FACING_RIGHT, pointAt(100, 180)).enemyVisible).toBe(false);
  });

  it('reports the angle relative to its own heading, positive to the right', () => {
    const below = pointAt(100, 90);
    expect(createSensor().scan(ORIGIN, 60, below).enemyAngle).toBeCloseTo(30);
    expect(createSensor().scan(ORIGIN, 120, below).enemyAngle).toBeCloseTo(-30);
  });

  it('reports nothing before the enemy was ever seen', () => {
    const reading = createSensor().scan(ORIGIN, FACING_RIGHT, pointAt(100, 180));
    expect(reading).toEqual({ enemyVisible: false, enemyDistance: 0, enemyAngle: 0, lastSeen: null });
  });

  it('keeps the last seen position after losing sight', () => {
    const sensor = createSensor();
    const seenAt = pointAt(100, 0);
    sensor.scan(ORIGIN, FACING_RIGHT, seenAt);

    const reading = sensor.scan(ORIGIN, FACING_RIGHT, pointAt(sensorRange + 200, 0));
    expect(reading.enemyVisible).toBe(false);
    expect(reading.lastSeen).toEqual(seenAt);
    expect(reading.enemyDistance).toBeCloseTo(100);
  });
});
