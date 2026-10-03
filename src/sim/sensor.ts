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
  /** Which enemy the reading is about: the nearest one in sight, else the one last seen. Null if none has been seen. */
  targetId: string | null;
  /** Every enemy in sight on this scan. */
  visibleIds: readonly string[];
}

export const EMPTY_READING: SensorReading = {
  enemyVisible: false,
  enemyDistance: 0,
  enemyAngle: 0,
  lastSeen: null,
  enemyVelocity: { x: 0, y: 0 },
  targetId: null,
  visibleIds: [],
};

/** An enemy the sensor may see. */
export interface SensedRobot {
  id: string;
  position: Vec2;
}

export interface Sensor {
  /** Looks for the enemies still in the match. */
  scanAll(position: Vec2, rotation: number, enemies: readonly SensedRobot[]): SensorReading;
}

/** Tells whether anything stands between two points. */
export type LineOfSight = (from: Vec2, to: Vec2) => boolean;

const UNOBSTRUCTED: LineOfSight = () => true;

/**
 * Sees an enemy within range, inside a cone around the heading, and only with
 * a free line of sight. A cone of 360 deg sees in every direction. With more
 * than one enemy, the reading is about the nearest one in sight; with none in
 * sight, about the one seen last, at the place it was seen.
 */
export class ConeSensor implements Sensor {
  private lastSeen: Vec2 | null = null;
  /** The enemy the reading is about. */
  private targetId: string | null = null;
  /** Where the target was on the previous scan, if it was visible then. */
  private previous: Vec2 | null = null;

  constructor(
    private readonly range: number,
    private readonly angle: number,
    private readonly hasLineOfSight: LineOfSight = UNOBSTRUCTED,
  ) {}

  /** Looks for a single enemy. */
  scan(position: Vec2, rotation: number, enemyPosition: Vec2): SensorReading {
    return this.scanAll(position, rotation, [{ id: 'enemy', position: enemyPosition }]);
  }

  scanAll(position: Vec2, rotation: number, enemies: readonly SensedRobot[]): SensorReading {
    const inSight = enemies
      .map((enemy) => ({ enemy, bearing: measure(position, rotation, enemy.position) }))
      .filter(
        ({ enemy, bearing }) =>
          bearing.distance <= this.range &&
          Math.abs(bearing.angle) <= this.angle / 2 &&
          this.hasLineOfSight(position, enemy.position),
      );
    const nearest = inSight.reduce<(typeof inSight)[number] | null>(
      (best, candidate) => (best === null || candidate.bearing.distance < best.bearing.distance ? candidate : best),
      null,
    );
    // An enemy remembered but no longer in the match is forgotten: there is nothing left to find there.
    if (nearest === null && !enemies.some((enemy) => enemy.id === this.targetId)) {
      this.targetId = null;
      this.lastSeen = null;
    }

    const visible = nearest !== null;
    const stillTarget = visible && nearest.enemy.id === this.targetId;
    const enemyVelocity =
      visible && stillTarget && this.previous !== null
        ? { x: nearest.enemy.position.x - this.previous.x, y: nearest.enemy.position.y - this.previous.y }
        : { x: 0, y: 0 };
    this.previous = visible ? { ...nearest.enemy.position } : null;
    if (visible) {
      this.lastSeen = { ...nearest.enemy.position };
      this.targetId = nearest.enemy.id;
    }
    const visibleIds = inSight.map(({ enemy }) => enemy.id);
    if (this.lastSeen === null) return { ...EMPTY_READING, visibleIds };

    const toTarget = visible ? nearest.bearing : measure(position, rotation, this.lastSeen);
    return {
      enemyVisible: visible,
      enemyDistance: toTarget.distance,
      enemyAngle: toTarget.angle,
      lastSeen: { ...this.lastSeen },
      enemyVelocity,
      targetId: this.targetId,
      visibleIds,
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
