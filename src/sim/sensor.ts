import { distance, normalizeAngle, radToDeg } from './math';
import type { Vec2 } from './types';

export interface SensorReading {
  enemyVisible: boolean;
  /** To the enemy when visible, otherwise to the last seen position. 0 if never seen. */
  enemyDistance: number;
  /** Relative to the robot's heading, deg, positive = to the right. 0 if never seen. */
  enemyAngle: number;
  lastSeen: Vec2 | null;
  /** How far the enemy moved since the previous tick; zero unless it was visible on both. */
  enemyVelocity: Vec2;
}

export const EMPTY_READING: SensorReading = {
  enemyVisible: false,
  enemyDistance: 0,
  enemyAngle: 0,
  lastSeen: null,
  enemyVelocity: { x: 0, y: 0 },
};

export interface Sensor {
  scan(position: Vec2, rotation: number, enemyPosition: Vec2): SensorReading;
}

/** Tells whether anything stands between two points. */
export type LineOfSight = (from: Vec2, to: Vec2) => boolean;

const UNOBSTRUCTED: LineOfSight = () => true;

/**
 * Sees the enemy within range, inside a cone around the heading, and only with
 * a free line of sight. A cone of 360 deg sees in every direction.
 */
export class ConeSensor implements Sensor {
  private lastSeen: Vec2 | null = null;
  /** Where the enemy was on the previous scan, if it was visible then. */
  private previous: Vec2 | null = null;

  constructor(
    private readonly range: number,
    private readonly angle: number,
    private readonly hasLineOfSight: LineOfSight = UNOBSTRUCTED,
  ) {}

  scan(position: Vec2, rotation: number, enemyPosition: Vec2): SensorReading {
    const toEnemy = measure(position, rotation, enemyPosition);
    const visible =
      toEnemy.distance <= this.range &&
      Math.abs(toEnemy.angle) <= this.angle / 2 &&
      this.hasLineOfSight(position, enemyPosition);
    const enemyVelocity =
      visible && this.previous !== null
        ? { x: enemyPosition.x - this.previous.x, y: enemyPosition.y - this.previous.y }
        : { x: 0, y: 0 };
    this.previous = visible ? { ...enemyPosition } : null;
    if (visible) this.lastSeen = { ...enemyPosition };
    if (this.lastSeen === null) return EMPTY_READING;

    const toTarget = visible ? toEnemy : measure(position, rotation, this.lastSeen);
    return {
      enemyVisible: visible,
      enemyDistance: toTarget.distance,
      enemyAngle: toTarget.angle,
      lastSeen: { ...this.lastSeen },
      enemyVelocity,
    };
  }
}

/** How far away a target is from a robot, and how far off its heading (deg, positive = to the right). */
export function measure(position: Vec2, rotation: number, target: Vec2): { distance: number; angle: number } {
  const dist = distance(position, target);
  if (dist === 0) return { distance: 0, angle: 0 };
  const bearing = radToDeg(Math.atan2(target.y - position.y, target.x - position.x));
  return { distance: dist, angle: normalizeAngle(bearing - rotation) };
}
