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
