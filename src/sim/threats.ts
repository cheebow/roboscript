import type { Bullet } from './bullet';
import { distance, segmentCircleHit, segmentLeavesBounds, segmentRectHit } from './math';
import type { Arena, Vec2 } from './types';

/**
 * The nearest bullet that will hit a robot of the given radius standing at
 * `position` if it stays there: fired by someone else, with the robot on its
 * remaining path and no wall or obstacle before it. Null when no bullet is on
 * such a course.
 */
export function findIncomingBullet(
  bullets: readonly Bullet[],
  robotId: string,
  position: Vec2,
  radius: number,
  arena: Arena,
): Bullet | null {
  let nearest: Bullet | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const bullet of bullets) {
    if (bullet.ownerId === robotId) continue;
    const separation = distance(bullet.position, position);
    if (separation >= nearestDistance || !willHit(bullet, position, radius, arena)) continue;
    nearest = bullet;
    nearestDistance = separation;
  }
  return nearest;
}

function willHit(bullet: Bullet, target: Vec2, radius: number, arena: Arena): boolean {
  const from = bullet.position;
  const to = {
    x: from.x + bullet.direction.x * bullet.remainingRange,
    y: from.y + bullet.direction.y * bullet.remainingRange,
  };
  const hit = segmentCircleHit(from, to, target, radius + bullet.radius);
  if (hit === null) return false;

  const stops = [
    segmentLeavesBounds(from, to, arena.width, arena.height),
    ...arena.obstacles.map((obstacle) => segmentRectHit(from, to, obstacle)),
  ];
  return stops.every((stop) => stop === null || stop > hit);
}
