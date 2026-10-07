export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  /** deg */
  rotation: number;
}

export interface Arena {
  width: number;
  height: number;
  obstacles: Rect[];
  spawns: SpawnPoint[];
}

/**
 * A team's castle: a block with HP of its own. It blocks movement, bullets
 * and sight like an obstacle; enemy bullets wear it down, and the match is
 * lost with it.
 */
export interface Base {
  team: number;
  rect: Rect;
  maxHp: number;
}
