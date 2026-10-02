import type { Vec2 } from './types';

/**
 * Where to shoot to hit a target that keeps moving as it does now: the point
 * where a bullet meets it. The bullet leaves `muzzleOffset` away from `from`
 * and covers `bulletStep` per tick; the target moves by `velocity` per tick.
 * When the bullet cannot catch the target, that is the target's position itself.
 */
export function leadPoint(from: Vec2, target: Vec2, velocity: Vec2, bulletStep: number, muzzleOffset: number): Vec2 {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  // Ticks t until they meet: |target + velocity * t - from| = muzzleOffset + bulletStep * t.
  const a = velocity.x * velocity.x + velocity.y * velocity.y - bulletStep * bulletStep;
  const b = 2 * (dx * velocity.x + dy * velocity.y - bulletStep * muzzleOffset);
  const c = dx * dx + dy * dy - muzzleOffset * muzzleOffset;
  const ticks = smallestPositiveRoot(a, b, c);
  if (ticks === null) return { ...target };
  return { x: target.x + velocity.x * ticks, y: target.y + velocity.y * ticks };
}

/** The smallest t > 0 with a*t^2 + b*t + c = 0, or null if there is none. */
function smallestPositiveRoot(a: number, b: number, c: number): number | null {
  if (a === 0) {
    const root = b === 0 ? -1 : -c / b;
    return root > 0 ? root : null;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const spread = Math.sqrt(discriminant);
  const roots = [(-b - spread) / (2 * a), (-b + spread) / (2 * a)].filter((root) => root > 0);
  return roots.length === 0 ? null : Math.min(...roots);
}
