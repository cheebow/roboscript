import type { RobotStats } from '../data/robot_defaults';
import type { RobotBrain } from './ai_context';
import { type Bullet, stepBullet } from './bullet';
import { findCover } from './cover';
import { type DebugEventSink, EventReporter } from './event_reporter';
import { circleIntersectsRect, distance, radToDeg, segmentRectDistance } from './math';
import { wallDistance } from './range_finder';
import { MatchRng } from './rng';
import { RobotController } from './robot';
import { ConeSensor, measure } from './sensor';
import type { Bearing, Cover, Surroundings } from './surroundings';
import { findIncomingBullet } from './threats';
import type { Arena, Vec2 } from './types';
import { Gun } from './weapon';

export interface RobotSetup {
  id: string;
  brain: RobotBrain;
  stats: RobotStats;
}

export interface SimulationConfig {
  arena: Arena;
  tickRate: number;
  /** sec */
  maxMatchTime: number;
  seed: number;
  /** Two robots for a duel; up to four for a battle royale. The arena needs a spawn point for each. */
  robots: readonly RobotSetup[];
  /** Receives debug events. The match plays the same with or without it. */
  logger?: DebugEventSink;
}

/** Keeps a robot that exactly touches an obstacle from counting as hidden behind it. */
const LINE_OF_SIGHT_TOLERANCE = 1e-6;

/**
 * `out of ammo`: nobody can shoot any more and no bullet is in the air, so
 * nothing can change the outcome; like a timeout, it goes by the HP left.
 */
export type MatchEndReason = 'destroyed' | 'timeout' | 'out of ammo';

/**
 * Robots no further apart than this many robot radii see each other past a
 * corner that only a robot's width would catch on. Without it, two robots
 * that bump into each other around a corner would neither see nor fight.
 */
const CLOSE_RANGE_RADII = 3;

/** `deflected`: a bullet hit a robot that was guarding. `detected`: a robot caught sight of the enemy. */
export type TickEventKind = 'shot' | 'impact' | 'deflected' | 'destroyed' | 'detected';

/** Something that happened at a place in the arena during one tick. */
export interface TickEvent {
  kind: TickEventKind;
  x: number;
  y: number;
  /** The index of the robot it happened to, for the events that are a robot's own. */
  robot?: number;
}

export interface MatchResult {
  /** null means DRAW. */
  winnerId: string | null;
  reason: MatchEndReason;
  /**
   * Each robot's place, 1 for the best, by id. The last one standing comes
   * first, then the others by how long they lasted; robots standing when the
   * match runs out go by their HP. Robots that cannot be told apart share a place.
   */
  places: Record<string, number>;
}

/**
 * The whole match state, advanced one fixed tick at a time. Has no dependency
 * on rendering or wall-clock time, so it can run headless.
 */
export class Simulation {
  readonly arena: Arena;
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
  /** Per robot: ticks by which each tick of guarding puts off its next shot. */
  private readonly guardRecoveryTicks: number[];
  private nextBulletId = 0;
  /** The tick on which each robot was destroyed, by id. */
  private readonly destroyedAt = new Map<string, number>();

  constructor(config: SimulationConfig) {
    if (config.arena.spawns.length < config.robots.length) {
      throw new Error('Arena does not have a spawn point for every robot');
    }
    this.arena = config.arena;
    this.tickRate = config.tickRate;
    this.seed = config.seed;
    this.rng = new MatchRng(config.seed);
    this.tickDuration = 1 / config.tickRate;
    this.maxTicks = Math.round(config.maxMatchTime * config.tickRate);
    this.guardRecoveryTicks = config.robots.map(({ stats }) => Math.round(stats.guardRecovery * config.tickRate));
    this.robots = config.robots.map(
      ({ id, brain, stats }, index) =>
        new RobotController({
          id,
          spawn: config.arena.spawns[index],
          stats,
          brain,
          sensor: new ConeSensor(stats.sensorRange, stats.sensorAngle, (from, to) =>
            this.hasLineOfSight(stats, from, to),
          ),
          weapon: new Gun(stats, config.tickRate),
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

    // Every robot senses and decides on the same snapshot, so update order
    // gives none an information advantage.
    // A destroyed robot is a wreck: it no longer senses, thinks, drives or shoots.
    const standing = this.robots.filter((robot) => robot.alive);
    for (const robot of standing) this.sense(robot);
    // Every sensor has been read: each robot now learns whether the others' missed it.
    for (const robot of standing) this.recover(robot);
    const actions = this.robots.map((robot) => (robot.alive ? this.think(robot) : null));

    this.robots.forEach((robot, index) => {
      const action = actions[index];
      if (action === null) return;
      robot.guarding = action.guard && robot.brace(this.tick);
      if (action.guard && !robot.guarding) this.reporter?.outOfGuards(robot.id, action.sourceLines.guard);
      robot.setDrive(action.drive);
      robot.turn(action.turn, this.tickDuration);
      robot.drive(this.tickDuration, (position) => this.isBlocked(robot, position));
    });
    // Turrets turn once every robot is where it will be when the shots are fired.
    this.robots.forEach((robot, index) => {
      const action = actions[index];
      if (action !== null) robot.aim(action.aim, this.tickDuration);
    });

    this.robots.forEach((robot, index) => {
      const action = actions[index];
      if (action === null) return;
      robot.weapon.tick();
      // Bracing takes the gun off target: every tick of it puts off the next shot.
      if (robot.guarding) robot.weapon.delay(this.guardRecoveryTicks[index]);
      if (action.fire) this.fire(robot, action.sourceLines.fire);
    });

    this.stepBullets();
    this.result = this.judge();
    if (this.result !== null) this.reporter?.matchEnded(this.result);
  }

  private sense(robot: RobotController): void {
    const before = robot.sensorReading;
    robot.sense(
      this.enemiesOf(robot).map((enemy) => ({ id: enemy.id, position: enemy.position })),
      this.tickDuration,
    );
    const after = robot.sensorReading;
    const visible = after.enemyVisible;
    const wasVisible = before.enemyVisible;
    robot.noteSurroundings(this.surroundingsOf(robot));
    if (visible !== wasVisible || (visible && after.targetId !== before.targetId)) {
      const enemyId = (visible ? after.targetId : before.targetId) ?? '';
      this.reporter?.sensorChanged(robot.id, enemyId, visible);
    }
    if (visible && !wasVisible) {
      this.tickEvents.push({ kind: 'detected', ...robot.position, robot: this.robots.indexOf(robot) });
    }
  }

  /** Hp comes back to a robot every enemy's sensor misses for long enough. Reported when it starts and stops. */
  private recover(robot: RobotController): void {
    const wasRecovering = robot.recovering;
    const seen = this.enemiesOf(robot).some((enemy) => enemy.sensorReading.visibleIds.includes(robot.id));
    robot.noteHidden(!seen, this.tickRate);
    if (robot.recovering !== wasRecovering) this.reporter?.recoveryChanged(robot.id, robot.recovering);
  }

  /** The terrain and the bullets as the robot finds them now. Its sensor must have been read first. */
  private surroundingsOf(robot: RobotController): Surroundings {
    const { position, rotation } = robot;
    const { radius } = robot.stats;
    const bearingTo = (target: Vec2): Bearing => ({ position: { ...target }, ...measure(position, rotation, target) });
    const wallAt = (offset: number) => wallDistance(this.arena, position, rotation + offset, radius);

    const bullet = findIncomingBullet(this.bullets, robot.id, position, radius, this.arena);
    const findCover = this.coverFinderOf(robot);
    let cover: Cover | null | undefined;
    return {
      blocked: this.hitsTerrain(robot.stepTarget('forward', this.tickDuration), radius),
      blockedBehind: this.hitsTerrain(robot.stepTarget('backward', this.tickDuration), radius),
      touchingEnemy: this.robots.some((other) => other !== robot && other.alive && this.areTouching(robot, other)),
      wallAhead: wallAt(0),
      wallBehind: wallAt(180),
      wallLeft: wallAt(-90),
      wallRight: wallAt(90),
      incomingBullet: bullet === null ? null : bearingTo(bullet.position),
      // Worked out when first asked for: many programs never ask.
      get cover() {
        if (cover === undefined) cover = findCover();
        return cover;
      },
    };
  }

  /**
   * A function that finds where the robot, as it stands now, could hide from
   * the enemy: from where that is, or was when last seen. Calling it later
   * still gives the answer for now.
   */
  private coverFinderOf(robot: RobotController): () => Cover | null {
    const position = { ...robot.position };
    const { rotation } = robot;
    const { radius } = robot.stats;
    const { lastSeen } = robot.sensorReading;
    const threat = lastSeen === null ? null : { ...lastSeen };
    return () => {
      if (threat === null) return null;
      const found = findCover(this.arena, radius, position, threat);
      if (found === null) return null;
      const [next] = found.route;
      const angle = next === undefined ? 0 : measure(position, rotation, next).angle;
      return { ...found, angle };
    };
  }

  /**
   * Whether two robots stand against each other: the gap between them is less
   * than the faster of them drives in a tick, so driving cannot close it further.
   */
  private areTouching(a: RobotController, b: RobotController): boolean {
    const gap = distance(a.position, b.position) - a.stats.radius - b.stats.radius;
    return gap < Math.max(a.stats.moveSpeed, b.stats.moveSpeed) * this.tickDuration;
  }

  private think(robot: RobotController) {
    const previousLabel = robot.label;
    const action = robot.think();
    if (robot.label !== previousLabel) {
      this.reporter?.labelChanged(robot.id, previousLabel, robot.label, action.sourceLines.label);
    }
    this.reporter?.actionDecided(robot.id, action);
    return action;
  }

  private fire(robot: RobotController, sourceLine: number | null): void {
    const bullet = robot.weapon.fire(robot.id, robot.position, robot.gunHeading, this.rng, robot.moved);
    if (bullet !== null) {
      this.bullets.push({ ...bullet, id: this.nextBulletId++ });
      this.tickEvents.push({ kind: 'shot', ...bullet.position });
      this.reporter?.fired(robot.id, sourceLine);
    } else if (robot.weapon.ammo === 0) {
      this.reporter?.outOfAmmo(robot.id, sourceLine);
    }
  }

  /**
   * Whether a robot with the given stats at one point can see a robot at the
   * other: no obstacle comes within its own radius of the straight line
   * between them. Seeing the enemy therefore also means it can be driven at,
   * and shot at, directly. At close range, room for its bullet is enough.
   */
  private hasLineOfSight(viewer: RobotStats, from: Vec2, to: Vec2): boolean {
    const { radius, bulletRadius } = viewer;
    const close = distance(from, to) <= radius * CLOSE_RANGE_RADII;
    const clearance = (close ? bulletRadius : radius) - LINE_OF_SIGHT_TOLERANCE;
    return this.arena.obstacles.every((obstacle) => segmentRectDistance(from, to, obstacle) >= clearance);
  }

  /** The other robots still in the match. */
  private enemiesOf(robot: RobotController): RobotController[] {
    return this.robots.filter((other) => other !== robot && other.alive);
  }

  /** Whether a robot of the given radius at the given position would overlap a wall or an obstacle. */
  private hitsTerrain(position: Vec2, radius: number): boolean {
    const { width, height, obstacles } = this.arena;
    if (position.x < radius || position.x > width - radius) return true;
    if (position.y < radius || position.y > height - radius) return true;
    return obstacles.some((obstacle) => circleIntersectsRect(position, radius, obstacle));
  }

  /** Whether the robot cannot be at the given position: terrain or another robot is there. */
  private isBlocked(robot: RobotController, position: Vec2): boolean {
    const { radius } = robot.stats;
    if (this.hitsTerrain(position, radius)) return true;
    return this.robots.some(
      (other) => other !== robot && other.alive && distance(position, other.position) < radius + other.stats.radius,
    );
  }

  private stepBullets(): void {
    const targets = this.robots
      .filter((robot) => robot.alive)
      .map((robot) => ({ id: robot.id, position: robot.position, radius: robot.stats.radius }));

    this.bullets = this.bullets.filter((bullet) => {
      const outcome = stepBullet(bullet, this.tickDuration, this.arena, targets);
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
    const damage = target.takeDamage(bullet.damage);
    // It came from the way opposite to the one it flew.
    target.noteHit(radToDeg(Math.atan2(-bullet.direction.y, -bullet.direction.x)));
    if (target.guarding) this.tickEvents.push({ kind: 'deflected', ...target.position });
    if (wasAlive && !target.alive) {
      this.tickEvents.push({ kind: 'destroyed', ...target.position });
      this.destroyedAt.set(target.id, this.tick);
    }
    this.reporter?.hit(bullet.ownerId, target.id, damage, target.hp, target.guarding);
  }

  private judge(): MatchResult | null {
    const survivors = this.robots.filter((robot) => robot.alive);
    if (survivors.length <= 1) {
      const places = this.places((robot) => (robot.alive ? Number.POSITIVE_INFINITY : (this.destroyedAt.get(robot.id) ?? 0)));
      return { winnerId: survivors.length === 1 ? survivors[0].id : null, reason: 'destroyed', places };
    }
    const spent = this.bullets.length === 0 && survivors.every((robot) => robot.weapon.ammo === 0);
    if (!spent && this.tick < this.maxTicks) return null;

    // Nothing more will happen, or time is up: whoever has the most HP left wins.
    // Those still standing come before those destroyed, by their HP.
    const reason = spent ? 'out of ammo' : 'timeout';
    const places = this.places((robot) =>
      robot.alive ? this.maxTicks + 1 + robot.hp : (this.destroyedAt.get(robot.id) ?? 0),
    );
    const firsts = this.robots.filter((robot) => places[robot.id] === 1);
    return { winnerId: firsts.length === 1 ? firsts[0].id : null, reason, places };
  }

  /** Places from a score for each robot, the highest first; equal scores share a place. */
  private places(score: (robot: RobotController) => number): Record<string, number> {
    const scores = this.robots.map((robot) => ({ id: robot.id, score: score(robot) }));
    const places: Record<string, number> = {};
    for (const { id, score: own } of scores) places[id] = 1 + scores.filter((other) => other.score > own).length;
    return places;
  }
}
