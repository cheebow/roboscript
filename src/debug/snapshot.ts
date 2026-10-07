import type { Assignment, DriveSetting } from '../sim/ai_context';
import type { TeamReading } from '../sim/robot';
import type { MatchResult, Simulation } from '../sim/simulation';
import type { Bearing, Cover } from '../sim/surroundings';
import type { Vec2 } from '../sim/types';
import type { EffectSnapshot } from './effects';

export interface RobotSnapshot {
  id: string;
  x: number;
  y: number;
  /** deg, where the hull faces. */
  rotation: number;
  /** deg, where the gun points on the field. */
  gunHeading: number;
  /** How the hull is set to drive. */
  driving: DriveSetting;
  hp: number;
  alive: boolean;
  /** What the robot's program calls what it is doing. */
  label: string;
  ammo: number;
  /** Ticks of guarding the robot has left. */
  guards: number;
  /** Seconds until the weapon can fire again. */
  cooldown: number;
  /** How the enemy in sight moves, as the robot's program reads it (enemy_speed, enemy_heading). */
  enemySpeed: number;
  enemyHeading: number;
  /** Ticks since the robot last guarded: 0 on a tick it guards, null if it never has. */
  guardAge: number | null;
  // What the sensor reported at the start of the tick, i.e. what the AI decided on.
  enemyVisible: boolean;
  /** The enemy the sensor reading is about (the nearest in sight, else the one seen last); null if none. */
  targetId: string | null;
  enemyDistance: number;
  enemyAngle: number;
  lastSeen: Vec2 | null;
  blocked: boolean;
  blockedBehind: boolean;
  wallAhead: number;
  wallBehind: number;
  wallLeft: number;
  wallRight: number;
  /** The nearest bullet on course to hit the robot, if any. */
  incomingBullet: Bearing | null;
  /** Where the robot could hide from the enemy, if anywhere. */
  cover: Cover | null;
  /** How the gun stood to the enemy and to the point to shoot at, and on the hull. */
  aimAngle: number;
  leadAngle: number;
  gunAngle: number;
  /** The point to shoot at to hit the enemy as it moves; null until it has been seen. */
  lead: Vec2 | null;
  /** How far the robot's gun shoots. */
  weaponRange: number;
  /** Whether the AI was told of a hit, and where the bullet that last hit the robot came from. */
  hit: boolean;
  hitAngle: number;
  /** The robot and the enemy stood against each other. */
  touchingEnemy: boolean;
  /** The enemy's sensor did not see the robot on this tick. */
  hidden: boolean;
  /** Regaining hp on this tick. */
  recovering: boolean;
  /** The robot's team and its number within it, in a team match; null otherwise. */
  team: number | null;
  selfId: number | null;
  /** What its program reads of its team (ally_signal, base_hp, ...); null outside a team match. */
  teamSense: TeamReading | null;
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
  /** The HP each castle has left, in the order of the match's bases; empty without castles. */
  bases: readonly number[];
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
      const { enemyVisible, enemyDistance, enemyAngle, lastSeen, targetId } = robot.sensorReading;
      const { wallAhead, wallBehind, wallLeft, wallRight, incomingBullet, cover, touchingEnemy } = robot.surroundings;
      const { hit, hitAngle } = robot.hitReading;
      const { aimAngle, leadAngle, gunAngle, lead } = robot.gunReading;
      return {
        id: robot.id,
        x: robot.position.x,
        y: robot.position.y,
        rotation: robot.rotation,
        gunHeading: robot.gunHeading,
        driving: robot.driving,
        hp: robot.hp,
        alive: robot.alive,
        label: robot.label,
        ammo: robot.weapon.ammo,
        guards: robot.guardsLeft,
        cooldown: robot.weapon.cooldownTicks / simulation.tickRate,
        ...robot.enemyMotion(),
        guardAge: robot.guardedAt === null ? null : simulation.tick - robot.guardedAt,
        enemyVisible,
        targetId,
        enemyDistance,
        enemyAngle,
        lastSeen: lastSeen === null ? null : { ...lastSeen },
        blocked: robot.blocked,
        blockedBehind: robot.blockedBehind,
        wallAhead,
        wallBehind,
        wallLeft,
        wallRight,
        incomingBullet: copyBearing(incomingBullet),
        cover: cover === null ? null : { ...cover, position: { ...cover.position }, route: cover.route.map((point) => ({ ...point })) },
        aimAngle,
        leadAngle,
        gunAngle,
        lead: lead === null ? null : { ...lead },
        weaponRange: robot.stats.weaponRange,
        hit,
        hitAngle,
        touchingEnemy,
        hidden: robot.hidden,
        recovering: robot.recovering,
        team: robot.team,
        selfId: robot.selfId,
        teamSense: robot.team === null ? null : { ...robot.teamSense },
        executedLines: [...(robot.action?.executedLines ?? [])],
        assignments: (robot.action?.assignments ?? []).map((assignment) => ({ ...assignment })),
        variables: Object.fromEntries(robot.variables),
      };
    }),
    bases: simulation.bases.map((base) => base.hp),
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

function copyBearing(bearing: Bearing | null): Bearing | null {
  return bearing === null ? null : { ...bearing, position: { ...bearing.position } };
}
