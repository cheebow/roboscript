import { circleIntersectsRect, distance, segmentRectDistance, segmentRectHit } from './math';
import type { Arena, Rect, Vec2 } from './types';

/** How far from an obstacle a robot in cover stands, edge to edge. */
const COVER_MARGIN = 2;
/** The most two neighbouring hiding places along an obstacle are apart. */
const SPOT_SPACING = 20;
/** How far outside an obstacle's corner the routes around it pass, edge to edge: room for a robot that is a little off its line. */
const CORNER_MARGIN = 6;
/** Lets a robot that exactly touches an obstacle drive along it. */
const TOUCH_TOLERANCE = 1e-6;
/** How far beyond the body's edge a hiding place keeps out of view, so that an enemy that moves a little does not see it at once. */
const HIDE_MARGIN = 8;

/** A stretch a robot can drive in a straight line, to the corner point with the given index. */
interface Link {
  corner: number;
  length: number;
}

/**
 * What taking cover in an arena comes down to, worked out once per arena: the
 * places next to obstacles where a robot can hide, the points off the corners
 * of obstacles that routes around them pass through, and which of these can
 * be driven between in a straight line.
 */
export interface CoverMap {
  radius: number;
  spots: Vec2[];
  corners: Vec2[];
  /** Per corner point: the other corner points in straight reach. */
  cornerLinks: Link[][];
  /** Per hiding place: the corner points in straight reach. */
  spotLinks: Link[][];
}

/** Where to hide and how to get there. */
export interface CoverRoute {
  /** The hiding place. */
  position: Vec2;
  /** Length of the way there; 0 for a robot that is hidden already. */
  distance: number;
  /** The points to drive to one after the other, ending with the hiding place; empty when already there. */
  route: Vec2[];
}

/** Per arena: the cover map for each robot radius asked about so far. */
const coverMaps = new WeakMap<Arena, Map<number, CoverMap>>();

/** The cover map of an arena for robots of the given radius. Kept, so asking again costs nothing. */
export function coverMapOf(arena: Arena, radius: number): CoverMap {
  let byRadius = coverMaps.get(arena);
  if (byRadius === undefined) {
    byRadius = new Map();
    coverMaps.set(arena, byRadius);
  }
  const known = byRadius.get(radius);
  if (known !== undefined) return known;

  const spots = arena.obstacles
    .flatMap((obstacle) => ringAround(obstacle, radius + COVER_MARGIN))
    .filter((spot) => fits(arena, spot, radius));
  const corners = arena.obstacles
    .flatMap((obstacle) => cornersAround(obstacle, radius + CORNER_MARGIN))
    .filter((corner) => fits(arena, corner, radius));
  const linksOf = (from: Vec2): Link[] =>
    corners.flatMap((corner, index) =>
      corner !== from && canDrive(arena, radius, from, corner) ? [{ corner: index, length: distance(from, corner) }] : [],
    );

  const map = { radius, spots, corners, cornerLinks: corners.map(linksOf), spotLinks: spots.map(linksOf) };
  byRadius.set(radius, map);
  return map;
}

/** Points on the rectangle that lies `offset` outside the obstacle, at most SPOT_SPACING apart. */
function ringAround(obstacle: Rect, offset: number): Vec2[] {
  const left = obstacle.x - offset;
  const top = obstacle.y - offset;
  const width = obstacle.width + offset * 2;
  const height = obstacle.height + offset * 2;
  const columns = Math.ceil(width / SPOT_SPACING);
  const rows = Math.ceil(height / SPOT_SPACING);

  const spots: Vec2[] = [];
  for (let column = 0; column <= columns; column++) {
    const x = left + (width * column) / columns;
    spots.push({ x, y: top }, { x, y: top + height });
  }
  // The corners are already in.
  for (let row = 1; row < rows; row++) {
    const y = top + (height * row) / rows;
    spots.push({ x: left, y }, { x: left + width, y });
  }
  return spots;
}

/** The corners of the rectangle that lies `offset` outside the obstacle. */
function cornersAround(obstacle: Rect, offset: number): Vec2[] {
  const xs = [obstacle.x - offset, obstacle.x + obstacle.width + offset];
  const ys = [obstacle.y - offset, obstacle.y + obstacle.height + offset];
  return xs.flatMap((x) => ys.map((y) => ({ x, y })));
}

function fits(arena: Arena, position: Vec2, radius: number): boolean {
  if (position.x < radius || position.x > arena.width - radius) return false;
  if (position.y < radius || position.y > arena.height - radius) return false;
  return arena.obstacles.every((obstacle) => !circleIntersectsRect(position, radius, obstacle));
}

/** Whether a robot can drive straight from one point to the other without running into an obstacle. */
function canDrive(arena: Arena, radius: number, from: Vec2, to: Vec2): boolean {
  const clearance = radius - TOUCH_TOLERANCE;
  return arena.obstacles.every((obstacle) => segmentRectDistance(from, to, obstacle) >= clearance);
}

/**
 * Whether a robot of the given radius at the position is wholly behind an
 * obstacle as seen from the viewer: the straight lines from the viewer to the
 * robot's centre and to either edge of its body all run into an obstacle.
 * Stricter than the sensor, which loses sight of a robot sooner: a hiding
 * place is somewhere the whole body is out of view, not only the centre.
 */
export function isHiddenFrom(arena: Arena, viewer: Vec2, position: Vec2, radius: number): boolean {
  const dx = position.x - viewer.x;
  const dy = position.y - viewer.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return false;
  const reach = radius + HIDE_MARGIN;
  const across = { x: (-dy / length) * reach, y: (dx / length) * reach };
  const points = [position, { x: position.x + across.x, y: position.y + across.y }, { x: position.x - across.x, y: position.y - across.y }];
  return points.every((point) => arena.obstacles.some((obstacle) => segmentRectHit(viewer, point, obstacle) !== null));
}

/**
 * Where a robot at `position` can best hide from someone at `threat`, and the
 * way there: the hiding place with an obstacle between it and the threat that
 * takes the least driving, straight or around the corners of obstacles. A
 * robot that is already hidden is its own cover. Null when there is nowhere
 * to hide.
 */
export function findCover(arena: Arena, radius: number, position: Vec2, threat: Vec2): CoverRoute | null {
  if (isHiddenFrom(arena, threat, position, radius)) return { position: { ...position }, distance: 0, route: [] };

  const map = coverMapOf(arena, radius);
  const { length, previous } = distancesToCorners(map, arena, position);

  let best: { spot: number; distance: number; lastCorner: number | null } | null = null;
  map.spots.forEach((spot, index) => {
    if (!isHiddenFrom(arena, threat, spot, radius)) return;
    for (const link of map.spotLinks[index]) {
      const total = length[link.corner] + link.length;
      if (best === null || total < best.distance) best = { spot: index, distance: total, lastCorner: link.corner };
    }
    const direct = distance(position, spot);
    if ((best === null || direct < best.distance) && canDrive(arena, radius, position, spot)) {
      best = { spot: index, distance: direct, lastCorner: null };
    }
  });
  // TypeScript does not see the assignments made inside the callback.
  const found = best as { spot: number; distance: number; lastCorner: number | null } | null;
  if (found === null || !Number.isFinite(found.distance)) return null;

  const route: Vec2[] = [{ ...map.spots[found.spot] }];
  for (let corner = found.lastCorner; corner !== null; corner = previous[corner]) {
    route.unshift({ ...map.corners[corner] });
  }
  return { position: { ...map.spots[found.spot] }, distance: found.distance, route };
}

/**
 * The shortest way from a position to every corner point: its length
 * (Infinity if there is none) and the corner point before it on that way
 * (null if it is reached straight from the position).
 */
function distancesToCorners(
  map: CoverMap,
  arena: Arena,
  position: Vec2,
): { length: number[]; previous: (number | null)[] } {
  const length = map.corners.map((corner) =>
    canDrive(arena, map.radius, position, corner) ? distance(position, corner) : Number.POSITIVE_INFINITY,
  );
  const previous: (number | null)[] = map.corners.map(() => null);
  const settled = map.corners.map(() => false);

  for (;;) {
    let nearest = -1;
    for (let index = 0; index < length.length; index++) {
      if (!settled[index] && (nearest < 0 || length[index] < length[nearest])) nearest = index;
    }
    if (nearest < 0 || !Number.isFinite(length[nearest])) break;
    settled[nearest] = true;
    for (const link of map.cornerLinks[nearest]) {
      const through = length[nearest] + link.length;
      if (through < length[link.corner]) {
        length[link.corner] = through;
        previous[link.corner] = nearest;
      }
    }
  }
  return { length, previous };
}
