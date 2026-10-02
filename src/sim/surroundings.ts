import type { Vec2 } from './types';

/** A place as seen from a robot. */
export interface Bearing {
  position: Vec2;
  distance: number;
  /** Relative to the robot's heading, deg, positive = to the right. */
  angle: number;
}

/** What a robot makes out of the terrain and the bullets around it on one tick. */
export interface Surroundings {
  /** A wall or an obstacle keeps the robot from moving one step forward / backward. */
  blocked: boolean;
  blockedBehind: boolean;
  /** Another robot stands right against this one: driving cannot bring them any closer. */
  touchingEnemy: boolean;
  /** Distance from the robot's edge to the nearest wall or obstacle in each direction. */
  wallAhead: number;
  wallBehind: number;
  wallLeft: number;
  wallRight: number;
  /** The nearest bullet that hits the robot if it stays where it is. */
  incomingBullet: Bearing | null;
  /**
   * The place to hide from the enemy that takes the least driving. Finding it
   * is the costly part of looking around, so it may be worked out only when
   * first read; it then still describes the moment the robot looked around.
   */
  readonly cover: Cover | null;
}

/** A hiding place as seen from a robot. */
export interface Cover {
  /** The hiding place itself. */
  position: Vec2;
  /** Length of the way there; 0 for a robot that is hidden already. */
  distance: number;
  /** Direction of the next point on the way, relative to the robot's heading, deg, positive = to the right. */
  angle: number;
  /** The points to drive to one after the other, ending with the hiding place. */
  route: Vec2[];
}

export const OPEN_SURROUNDINGS: Surroundings = {
  blocked: false,
  blockedBehind: false,
  touchingEnemy: false,
  wallAhead: 0,
  wallBehind: 0,
  wallLeft: 0,
  wallRight: 0,
  incomingBullet: null,
  cover: null,
};
