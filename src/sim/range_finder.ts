import { headingVector, segmentLeavesBounds, segmentRectHit } from './math';
import type { Arena, Vec2 } from './types';

/**
 * How far it is from the edge of a robot at `position` to the nearest wall or
 * obstacle straight along `heading` (deg). Measured along a line from the
 * robot's centre; 0 when the robot touches what is there.
 */
export function wallDistance(arena: Arena, position: Vec2, heading: number, radius: number): number {
  // Longer than any line inside the arena.
  const reach = arena.width + arena.height;
  const direction = headingVector(heading);
  const to = { x: position.x + direction.x * reach, y: position.y + direction.y * reach };

  let nearest = segmentLeavesBounds(position, to, arena.width, arena.height) ?? 1;
  for (const obstacle of arena.obstacles) {
    const hit = segmentRectHit(position, to, obstacle);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  return Math.max(0, nearest * reach - radius);
}
