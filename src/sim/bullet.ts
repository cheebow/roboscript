import { segmentCircleHit, segmentLeavesBounds, segmentRectHit } from './math';
import type { Arena, Rect, Vec2 } from './types';

export interface Bullet {
  id: number;
  ownerId: string;
  position: Vec2;
  /** unit vector */
  direction: Vec2;
  /** units/sec */
  speed: number;
  damage: number;
  remainingRange: number;
  radius: number;
}

export interface BulletTarget {
  id: string;
  position: Vec2;
  radius: number;
}

export type BulletStepResult =
  | { kind: 'flying' }
  | { kind: 'expired' }
  | { kind: 'wall' }
  | { kind: 'base'; baseIndex: number }
  | { kind: 'hit'; targetId: string };

/**
 * Moves the bullet by one tick and reports what it ran into. The whole path of
 * the tick is tested, so a fast bullet cannot skip over a target. Castles
 * (`bases`) stop every bullet like an obstacle, but report which one was hit.
 */
export function stepBullet(
  bullet: Bullet,
  tickDuration: number,
  arena: Arena,
  targets: BulletTarget[],
  bases: readonly Rect[] = [],
): BulletStepResult {
  const travel = Math.min(bullet.speed * tickDuration, bullet.remainingRange);
  const from = bullet.position;
  const to = {
    x: from.x + bullet.direction.x * travel,
    y: from.y + bullet.direction.y * travel,
  };

  let wallT = segmentLeavesBounds(from, to, arena.width, arena.height);
  for (const obstacle of arena.obstacles) {
    const t = segmentRectHit(from, to, obstacle);
    if (t !== null && (wallT === null || t < wallT)) wallT = t;
  }

  let baseT: number | null = null;
  let baseIndex: number | null = null;
  bases.forEach((base, index) => {
    const t = segmentRectHit(from, to, base);
    if (t !== null && (baseT === null || t < baseT)) {
      baseT = t;
      baseIndex = index;
    }
  });

  let hitT: number | null = null;
  let hitId: string | null = null;
  for (const target of targets) {
    if (target.id === bullet.ownerId) continue;
    const t = segmentCircleHit(from, to, target.position, target.radius + bullet.radius);
    if (t !== null && (hitT === null || t < hitT)) {
      hitT = t;
      hitId = target.id;
    }
  }

  const beats = (t: number, ...others: (number | null)[]) => others.every((other) => other === null || t < other);
  if (hitT !== null && hitId !== null && beats(hitT, wallT, baseT)) {
    bullet.position = pointAt(from, to, hitT);
    return { kind: 'hit', targetId: hitId };
  }
  if (baseT !== null && baseIndex !== null && beats(baseT, wallT)) {
    bullet.position = pointAt(from, to, baseT);
    return { kind: 'base', baseIndex };
  }
  if (wallT !== null) {
    bullet.position = pointAt(from, to, wallT);
    return { kind: 'wall' };
  }

  bullet.position = to;
  bullet.remainingRange -= travel;
  return bullet.remainingRange <= 0 ? { kind: 'expired' } : { kind: 'flying' };
}

function pointAt(from: Vec2, to: Vec2, t: number): Vec2 {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
