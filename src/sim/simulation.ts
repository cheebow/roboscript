import type { RobotStats } from '../data/robot_defaults';
import type { RobotBrain } from './ai_context';
import { type Bullet, stepBullet } from './bullet';
import { type DebugEventSink, EventReporter } from './event_reporter';
import { circleIntersectsRect, distance, segmentRectHit } from './math';
import { MatchRng } from './rng';
import { RobotController } from './robot';
import { ConeSensor } from './sensor';
import type { Arena, Vec2 } from './types';
import { Gun } from './weapon';

export interface RobotSetup {
  id: string;
  brain: RobotBrain;
}

export interface SimulationConfig {
  arena: Arena;
  stats: RobotStats;
  tickRate: number;
  /** sec */
  maxMatchTime: number;
  seed: number;
  robots: [RobotSetup, RobotSetup];
  /** Receives debug events. The match plays the same with or without it. */
  logger?: DebugEventSink;
}

/** Keeps a robot that exactly touches an obstacle from counting as hidden behind it. */
const LINE_OF_SIGHT_TOLERANCE = 1e-6;

export type MatchEndReason = 'destroyed' | 'timeout';

export type TickEventKind = 'shot' | 'impact' | 'destroyed';

/** Something that happened at a place in the arena during one tick. */
export interface TickEvent {
  kind: TickEventKind;
  x: number;
  y: number;
}

export interface MatchResult {
  /** null means DRAW. */
  winnerId: string | null;
  reason: MatchEndReason;
}

/**
 * The whole match state, advanced one fixed tick at a time. Has no dependency
 * on rendering or wall-clock time, so it can run headless.
 */
export class Simulation {
  readonly arena: Arena;
  readonly stats: RobotStats;
  readonly tickRate: number;
  readonly seed: number;
  readonly robots: RobotController[];
  bullets: Bullet[] = [];
  /** Number of ticks completed. */
  tick = 0;
  result: MatchResult | null = null;
  /** Shots, impacts and destructions of the latest tick. */
  tickEvents: TickEvent[] = [];

  private readonly rng: MatchRng;
  private readonly tickDuration: number;
  private readonly maxTicks: number;
  private readonly reporter: EventReporter | null;
  private nextBulletId = 0;

  constructor(config: SimulationConfig) {
    if (config.arena.spawns.length < config.robots.length) {
      throw new Error('Arena does not have a spawn point for every robot');
    }
    this.arena = config.arena;
    this.stats = config.stats;
    this.tickRate = config.tickRate;
    this.seed = config.seed;
    this.rng = new MatchRng(config.seed);
    this.tickDuration = 1 / config.tickRate;
    this.maxTicks = Math.round(config.maxMatchTime * config.tickRate);
    this.robots = config.robots.map(
      (setup, index) =>
        new RobotController({
          id: setup.id,
          spawn: config.arena.spawns[index],
          stats: config.stats,
          brain: setup.brain,
          sensor: new ConeSensor(config.stats.sensorRange, config.stats.sensorAngle, (from, to) =>
            this.hasLineOfSight(from, to),
          ),
          weapon: new Gun(config.stats, config.tickRate),
        }),
    );
    this.reporter = config.logger === undefined ? null : new EventReporter(config.logger, config.tickRate);
    this.reporter?.matchStarted(config.seed);
  }

  /** Elapsed match time in sec. */
  get time(): number {
    return this.tick / this.tickRate;
  }

  step(): void {
    if (this.result !== null) return;
    this.tick++;
    this.tickEvents = [];
    this.reporter?.beginTick(this.tick);

    // Both robots sense and decide on the same snapshot, so update order
    // gives neither an information advantage.
    for (const robot of this.robots) this.sense(robot);
    const actions = this.robots.map((robot) => this.think(robot));

    this.robots.forEach((robot, index) => {
      const action = actions[index];
      robot.turn(action.turn, this.tickDuration);
      robot.move(action.move, this.tickDuration, (position) => this.isBlocked(robot, position));
    });

    this.robots.forEach((robot, index) => {
      robot.weapon.tick();
      if (actions[index].fire) this.fire(robot, actions[index].sourceLines.fire);
    });

    this.stepBullets();
    this.result = this.judge();
    if (this.result !== null) this.reporter?.matchEnded(this.result);
  }

  private sense(robot: RobotController): void {
    const enemy = this.enemyOf(robot);
    const wasVisible = robot.sensorReading.enemyVisible;
    robot.sense(enemy.position);
    const visible = robot.sensorReading.enemyVisible;
    robot.noteBlocked(this.hitsTerrain(robot.stepTarget('forward', this.tickDuration)));
    if (visible !== wasVisible) this.reporter?.sensorChanged(robot.id, enemy.id, visible);
  }

  private think(robot: RobotController) {
    const previousState = robot.state;
    const action = robot.think();
    if (robot.state !== previousState) {
      this.reporter?.stateChanged(robot.id, previousState, robot.state, action.sourceLines.state);
    }
    this.reporter?.actionDecided(robot.id, action);
    return action;
  }

  private fire(robot: RobotController, sourceLine: number | null): void {
    const bullet = robot.weapon.fire(robot.id, robot.position, robot.rotation, this.rng);
    if (bullet !== null) {
      this.bullets.push({ ...bullet, id: this.nextBulletId++ });
      this.tickEvents.push({ kind: 'shot', ...bullet.position });
      this.reporter?.fired(robot.id, sourceLine);
    } else if (robot.weapon.ammo === 0) {
      this.reporter?.outOfAmmo(robot.id, sourceLine);
    }
  }

  /**
   * Whether a robot at one point can see a robot at the other: no obstacle
   * comes within a robot's radius of the straight line between them. Seeing
   * the enemy therefore also means it can be driven at, and shot at, directly.
   */
  private hasLineOfSight(from: Vec2, to: Vec2): boolean {
    const margin = this.stats.radius - LINE_OF_SIGHT_TOLERANCE;
    return !this.arena.obstacles.some((obstacle) => {
      const widened = {
        x: obstacle.x - margin,
        y: obstacle.y - margin,
        width: obstacle.width + margin * 2,
        height: obstacle.height + margin * 2,
      };
      return segmentRectHit(from, to, widened) !== null;
    });
  }

  private enemyOf(robot: RobotController): RobotController {
    return this.robots[0] === robot ? this.robots[1] : this.robots[0];
  }

  /** Whether a robot at the given position would overlap a wall or an obstacle. */
  private hitsTerrain(position: Vec2): boolean {
    const { radius } = this.stats;
    const { width, height, obstacles } = this.arena;
    if (position.x < radius || position.x > width - radius) return true;
    if (position.y < radius || position.y > height - radius) return true;
    return obstacles.some((obstacle) => circleIntersectsRect(position, radius, obstacle));
  }

  /** Whether the robot cannot be at the given position: terrain or another robot is there. */
  private isBlocked(robot: RobotController, position: Vec2): boolean {
    if (this.hitsTerrain(position)) return true;
    const { radius } = this.stats;
    return this.robots.some(
      (other) => other !== robot && other.alive && distance(position, other.position) < radius * 2,
    );
  }

  private stepBullets(): void {
    const targets = this.robots
      .filter((robot) => robot.alive)
      .map((robot) => ({ id: robot.id, position: robot.position, radius: this.stats.radius }));

    this.bullets = this.bullets.filter((bullet) => {
      const outcome = stepBullet(bullet, this.tickDuration, this.arena, targets, this.stats.bulletRadius);
      if (outcome.kind === 'hit' || outcome.kind === 'wall') {
        this.tickEvents.push({ kind: 'impact', ...bullet.position });
      }
      if (outcome.kind === 'hit') this.applyHit(bullet, outcome.targetId);
      return outcome.kind === 'flying';
    });
  }

  private applyHit(bullet: Bullet, targetId: string): void {
    const target = this.robots.find((robot) => robot.id === targetId);
    if (target === undefined) throw new Error(`Bullet hit unknown robot "${targetId}"`);
    const wasAlive = target.alive;
    target.takeDamage(bullet.damage);
    if (wasAlive && !target.alive) this.tickEvents.push({ kind: 'destroyed', ...target.position });
    this.reporter?.hit(bullet.ownerId, target.id, bullet.damage, target.hp);
  }

  private judge(): MatchResult | null {
    const survivors = this.robots.filter((robot) => robot.alive);
    if (survivors.length < this.robots.length) {
      return { winnerId: survivors.length === 1 ? survivors[0].id : null, reason: 'destroyed' };
    }
    if (this.tick < this.maxTicks) return null;

    const [first, second] = this.robots;
    if (first.hp === second.hp) return { winnerId: null, reason: 'timeout' };
    return { winnerId: first.hp > second.hp ? first.id : second.id, reason: 'timeout' };
  }
}
