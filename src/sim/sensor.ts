import { distance, normalizeAngle, radToDeg } from './math';
import type { Vec2 } from './types';

export interface SensorReading {
  enemyVisible: boolean;
  /** To the enemy when visible, otherwise to the last seen position. 0 if never seen. */
  enemyDistance: number;
  /** Relative to the robot's heading, deg, positive = to the right. 0 if never seen. */
  enemyAngle: number;
  lastSeen: Vec2 | null;
}

export const EMPTY_READING: SensorReading = {
  enemyVisible: false,
  enemyDistance: 0,
  enemyAngle: 0,
  lastSeen: null,
};

export interface Sensor {
  scan(position: Vec2, rotation: number, enemyPosition: Vec2): SensorReading;
}

/** Forward-facing cone: sees the enemy only within range and field of view. */
export class ConeSensor implements Sensor {
  private lastSeen: Vec2 | null = null;

  constructor(
    private readonly range: number,
    private readonly angle: number,
  ) {}

  scan(position: Vec2, rotation: number, enemyPosition: Vec2): SensorReading {
    const toEnemy = measure(position, rotation, enemyPosition);
    const visible = toEnemy.distance <= this.range && Math.abs(toEnemy.angle) <= this.angle / 2;
    if (visible) this.lastSeen = { ...enemyPosition };
    if (this.lastSeen === null) return EMPTY_READING;

    const toTarget = visible ? toEnemy : measure(position, rotation, this.lastSeen);
    return {
      enemyVisible: visible,
      enemyDistance: toTarget.distance,
      enemyAngle: toTarget.angle,
      lastSeen: { ...this.lastSeen },
    };
  }
}

function measure(position: Vec2, rotation: number, target: Vec2): { distance: number; angle: number } {
  const dist = distance(position, target);
  if (dist === 0) return { distance: 0, angle: 0 };
  const bearing = radToDeg(Math.atan2(target.y - position.y, target.x - position.x));
  return { distance: dist, angle: normalizeAngle(bearing - rotation) };
}
