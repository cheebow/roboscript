import type { Assignment, RobotState } from '../sim/ai_context';
import type { MatchResult, Simulation } from '../sim/simulation';
import type { Vec2 } from '../sim/types';
import type { EffectSnapshot } from './effects';

export interface RobotSnapshot {
  id: string;
  x: number;
  y: number;
  /** deg */
  rotation: number;
  hp: number;
  alive: boolean;
  state: RobotState;
  ammo: number;
  /** Seconds until the weapon can fire again. */
  cooldown: number;
  // What the sensor reported at the start of the tick, i.e. what the AI decided on.
  enemyVisible: boolean;
  enemyDistance: number;
  enemyAngle: number;
  lastSeen: Vec2 | null;
  blocked: boolean;
  blockedBehind: boolean;
  /** Source lines the AI executed on this tick, in order; the last is the action it took. */
  executedLines: readonly number[];
  /** What the AI assigned to its variables on this tick, in order. */
  assignments: readonly Assignment[];
  /** The AI's variables as they were after this tick. */
  variables: Readonly<Record<string, number>>;
}

export interface BulletSnapshot {
  x: number;
  y: number;
  /** Unit vector of its flight direction. */
  directionX: number;
  directionY: number;
}

/** Everything needed to display the match as it was after `tick` ticks. */
export interface Snapshot {
  tick: number;
  /** Match time in sec. */
  time: number;
  robots: RobotSnapshot[];
  bullets: BulletSnapshot[];
  /** Visual effects still running on this tick. */
  effects: EffectSnapshot[];
  /** Set only once the match is over. */
  result: MatchResult | null;
}

/**
 * Copies the current state out of a simulation; later ticks do not affect the
 * copy. `effects` are the effects running on this tick, if any are tracked.
 */
export function captureSnapshot(simulation: Simulation, effects: EffectSnapshot[] = []): Snapshot {
  return {
    tick: simulation.tick,
    time: simulation.time,
    robots: simulation.robots.map((robot) => {
      const { enemyVisible, enemyDistance, enemyAngle, lastSeen } = robot.sensorReading;
      return {
        id: robot.id,
        x: robot.position.x,
        y: robot.position.y,
        rotation: robot.rotation,
        hp: robot.hp,
        alive: robot.alive,
        state: robot.state,
        ammo: robot.weapon.ammo,
        cooldown: robot.weapon.cooldownTicks / simulation.tickRate,
        enemyVisible,
        enemyDistance,
        enemyAngle,
        lastSeen: lastSeen === null ? null : { ...lastSeen },
        blocked: robot.blocked,
        blockedBehind: robot.blockedBehind,
        executedLines: [...(robot.action?.executedLines ?? [])],
        assignments: (robot.action?.assignments ?? []).map((assignment) => ({ ...assignment })),
        variables: Object.fromEntries(robot.variables),
      };
    }),
    bullets: simulation.bullets.map((bullet) => ({
      x: bullet.position.x,
      y: bullet.position.y,
      directionX: bullet.direction.x,
      directionY: bullet.direction.y,
    })),
    effects,
    result: simulation.result,
  };
}
