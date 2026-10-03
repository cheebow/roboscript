import { segmentLeavesBounds, segmentRectHit } from '../sim/math';
import type { Arena, Vec2 } from '../sim/types';

/** Degrees between the rays that trace the edge of the field. */
const RAY_STEP = 2;
/** Degrees either side of an obstacle's corner that a ray is sent, so that the shadow's edge is sharp. */
const CORNER_SKIRT = 0.05;

/**
 * The outline of what a sensor at the position sees: as far as its range and
 * as wide as its angle, less the shadows of the obstacles and what lies
 * outside the arena. A polygon in arena units; for a cone, its first point is
 * the robot itself. Rays go from the robot's centre, so the shadows' edges
 * fall a little inside those of the match's line of sight, which allows a
 * robot's radius of clearance.
 */
export function sensorField(
  position: Vec2,
  rotation: number,
  sensor: { sensorRange: number; sensorAngle: number },
  arena: Arena,
): Vec2[] {
  const cone = sensor.sensorAngle < 360;
  const from = cone ? rotation - sensor.sensorAngle / 2 : 0;
  const to = cone ? rotation + sensor.sensorAngle / 2 : 360;
  const angles: number[] = [];
  for (let angle = from; angle < to; angle += RAY_STEP) angles.push(angle);
  angles.push(to);
  for (const obstacle of arena.obstacles) {
    for (const corner of corners(obstacle)) {
      const bearing = (Math.atan2(corner.y - position.y, corner.x - position.x) * 180) / Math.PI;
      for (const skirt of [-CORNER_SKIRT, CORNER_SKIRT]) {
        const angle = cone ? bearing + skirt : within(bearing + skirt, from, to);
        if (!cone || (angle >= from && angle <= to)) angles.push(angle);
      }
    }
  }
  if (!cone) {
    angles.sort((a, b) => wrapped(a, from) - wrapped(b, from));
  } else {
    angles.sort((a, b) => a - b);
  }

  const points = angles.map((angle) => reach(position, angle, sensor.sensorRange, arena));
  return cone ? [{ ...position }, ...points] : points;
}

/** How far a ray from the position in the direction gets before an obstacle or the arena's edge stops it. */
function reach(position: Vec2, angle: number, range: number, arena: Arena): Vec2 {
  const radians = (angle * Math.PI) / 180;
  const end = { x: position.x + Math.cos(radians) * range, y: position.y + Math.sin(radians) * range };
  let nearest = segmentLeavesBounds(position, end, arena.width, arena.height) ?? 1;
  for (const obstacle of arena.obstacles) {
    const hit = segmentRectHit(position, end, obstacle);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  return {
    x: clamp(position.x + (end.x - position.x) * nearest, 0, arena.width),
    y: clamp(position.y + (end.y - position.y) * nearest, 0, arena.height),
  };
}

/** Keeps rounding from putting a point a hair outside the arena. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function corners({ x, y, width, height }: Arena['obstacles'][number]): Vec2[] {
  return [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
  ];
}

/** The angle brought into [from, from + 360). */
function within(angle: number, from: number, _to: number): number {
  return wrapped(angle, from) + from;
}

/** How far past `from` the angle is, going round once. */
function wrapped(angle: number, from: number): number {
  return (((angle - from) % 360) + 360) % 360;
}
