import type { Rect, Vec2 } from './types';

// Coordinates: x grows right, y grows down. Angles are degrees, 0 = facing +x,
// positive = clockwise on screen.

const FULL_TURN = 360;
const HALF_TURN = 180;

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / HALF_TURN;
}

export function radToDeg(radians: number): number {
  return (radians * HALF_TURN) / Math.PI;
}

/** Wraps an angle into (-180, 180]. */
export function normalizeAngle(degrees: number): number {
  let angle = degrees % FULL_TURN;
  if (angle > HALF_TURN) angle -= FULL_TURN;
  if (angle <= -HALF_TURN) angle += FULL_TURN;
  return angle;
}

export function headingVector(rotation: number): Vec2 {
  const radians = degToRad(rotation);
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function circleIntersectsRect(center: Vec2, radius: number, rect: Rect): boolean {
  const nearestX = clamp(center.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(center.y, rect.y, rect.y + rect.height);
  return Math.hypot(center.x - nearestX, center.y - nearestY) < radius;
}

/**
 * Fraction (0..1) along the segment from `from` to `to` where it first touches
 * the circle, or null if it never does.
 */
export function segmentCircleHit(from: Vec2, to: Vec2, center: Vec2, radius: number): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;

  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Fraction (0..1) along the segment where it first enters the rectangle, or
 * null if it never does.
 */
export function segmentRectHit(from: Vec2, to: Vec2, rect: Rect): number | null {
  let tEnter = 0;
  let tExit = 1;
  const axes = [
    { start: from.x, delta: to.x - from.x, min: rect.x, max: rect.x + rect.width },
    { start: from.y, delta: to.y - from.y, min: rect.y, max: rect.y + rect.height },
  ];
  for (const axis of axes) {
    if (axis.delta === 0) {
      if (axis.start < axis.min || axis.start > axis.max) return null;
      continue;
    }
    const t1 = (axis.min - axis.start) / axis.delta;
    const t2 = (axis.max - axis.start) / axis.delta;
    tEnter = Math.max(tEnter, Math.min(t1, t2));
    tExit = Math.min(tExit, Math.max(t1, t2));
    if (tEnter > tExit) return null;
  }
  return tEnter;
}

/**
 * Fraction (0..1) along the segment where it leaves the area
 * [0, width] x [0, height], or null if it stays inside.
 */
export function segmentLeavesBounds(from: Vec2, to: Vec2, width: number, height: number): number | null {
  let tLeave: number | null = null;
  const axes = [
    { start: from.x, end: to.x, max: width },
    { start: from.y, end: to.y, max: height },
  ];
  for (const axis of axes) {
    const delta = axis.end - axis.start;
    let t: number | null = null;
    if (axis.end < 0) t = (0 - axis.start) / delta;
    else if (axis.end > axis.max) t = (axis.max - axis.start) / delta;
    if (t !== null) {
      const bounded = clamp(t, 0, 1);
      tLeave = tLeave === null ? bounded : Math.min(tLeave, bounded);
    }
  }
  return tLeave;
}

/** Shortest distance from a point to the segment between `from` and `to`. */
export function pointSegmentDistance(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, from);
  const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

/** Shortest distance from a point to the rectangle; 0 inside it. */
export function pointRectDistance(point: Vec2, rect: Rect): number {
  const nearestX = clamp(point.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(point.y, rect.y, rect.y + rect.height);
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

/** Shortest distance between a segment and a rectangle; 0 if they touch or cross. */
export function segmentRectDistance(from: Vec2, to: Vec2, rect: Rect): number {
  if (segmentRectHit(from, to, rect) !== null) return 0;
  // They do not cross, so the closest approach involves an end of the segment or a corner of the rectangle.
  const corners: Vec2[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
  return Math.min(
    pointRectDistance(from, rect),
    pointRectDistance(to, rect),
    ...corners.map((corner) => pointSegmentDistance(corner, from, to)),
  );
}
