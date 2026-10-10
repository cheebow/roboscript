import type { RobotStats } from '../data/robot_defaults';
import type { RobotBrain } from './ai_context';
import { type Bullet, stepBullet } from './bullet';
import { findCover } from './cover';
import { type DebugEventSink, EventReporter } from './event_reporter';
import { circleIntersectsRect, distance, radToDeg, segmentRectDistance } from './math';
import { wallDistance } from './range_finder';
import { MatchRng } from './rng';
import { RobotController, type TeamReading } from './robot';
import { ConeSensor, measure } from './sensor';
import type { Bearing, Cover, Surroundings } from './surroundings';
import { findIncomingBullet } from './threats';
import type { Arena, Base, Vec2 } from './types';
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
  /** Two robots for a duel; up to four for a battle royale, up to ten for a castle match. The arena needs a spawn point for each. */
  robots: readonly RobotSetup[];
  /**
   * The team of each robot, in the order of `robots`, for a team match:
   * teammates do not count as enemies, and their bullets pass through each
   * other. Without it, every robot is on its own.
   */
  teams?: readonly number[];
  /**
   * The teams' castles, for a castle match. A castle blocks movement, bullets
   * and sight like an obstacle; enemy bullets wear it down, and a team whose
   * castle falls loses at once. The castle is the goal: a team with a castle
   * stays in the match even with every robot destroyed.
   */
  bases?: readonly Base[];
  /** Receives debug events. The match plays the same with or without it. */
  logger?: DebugEventSink;
}

/** Keeps a robot that exactly touches an obstacle from counting as hidden behind it. */
const LINE_OF_SIGHT_TOLERANCE = 1e-6;

/**
 * `out of ammo`: nobody can shoot any more and no bullet is in the air, so
 * nothing can change the outcome; like a timeout, it goes by the HP left.
 */
export type MatchEndReason = 'destroyed' | 'timeout' | 'out of ammo' | 'base destroyed';

/**
 * Robots no further apart than this many robot radii see each other past a
 * corner that only a robot's width would catch on. Without it, two robots
 * that bump into each other around a corner would neither see nor fight.
 */
const CLOSE_RANGE_RADII = 3;

/** Mixed into the seed of each robot's own random numbers, so that they are not the match's (which scatter the shots). */
const DICE_SALT = 0xd1ce;

/** The seed of the random numbers of the robot at `index`: from the match's seed, and different for every robot. */
function diceSeed(seed: number, index: number): number {
  return (seed ^ DICE_SALT ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

/**
 * `deflected`: a bullet hit a robot that was guarding. `detected`: a robot
 * caught sight of the enemy. `signalHeard`: a new number landed in a
 * robot's mailbox (`from` is its sender). `baseHit`: an enemy bullet wore
 * a castle down.
 */
export type TickEventKind = 'shot' | 'impact' | 'hit' | 'deflected' | 'destroyed' | 'detected' | 'baseDestroyed' | 'baseHit' | 'signalHeard';

/** Something that happened at a place in the arena during one tick. */
export interface TickEvent {
  kind: TickEventKind;
  x: number;
  y: number;
  /** The index of the robot it happened to, for the events that are a robot's own. */
  robot?: number;
  /** The index of the robot it came from, for the events that travel between robots (a signal heard). */
  from?: number;
  /** The index in `bases` of the castle it happened to. */
  base?: number;
  /** deg on the field: the way the bullet was flying, for a robot hit. */
  angle?: number;
}

/** A castle as it stands during the match: its definition plus the HP it has left. */
export interface BaseState extends Base {
  hp: number;
}

export interface MatchResult {
  /** null means DRAW, and in a team match, always null: see winnerTeam. */
  winnerId: string | null;
  /** In a team match, the team that won; null for a draw. Not there in other matches. */
  winnerTeam?: number | null;
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
  /** The castles of a castle match, with the HP each has left; empty otherwise. */
  readonly bases: BaseState[];
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
  /** Each robot's team, by its index; every robot on a team of its own outside a team match. */
  private readonly teamOf: readonly number[];
  private readonly teamMatch: boolean;
  /**
   * The radio, one mailbox per robot: the number last addressed to it, and
   * who sent it (the sender's self_id; 0 before anything came). `signal 3`
   * writes every mailbox of the sender's team, own included; `signal 3 to 2`
   * only machine 2's. Writes land after everyone has thought, in robot
   * order, so all read the same tick-start value and the highest-numbered
   * sender of a tick wins. Outside a team match every robot is its own
   * team: the radio is a note to itself.
   */
  private readonly mailboxes: number[];
  private readonly mailboxFrom: number[];
  /**
   * What stands in the way of driving, bullets and sight: the arena's
   * obstacles, plus the castles. Without castles this IS `arena` itself, so
   * that a match without them plays out exactly as before (and the cover map
   * cached by the obstacles array stays shared).
   */
  private readonly terrain: Arena;

  constructor(config: SimulationConfig) {
    if (config.arena.spawns.length < config.robots.length) {
      throw new Error('Arena does not have a spawn point for every robot');
    }
    if (config.teams !== undefined && config.teams.length !== config.robots.length) {
      throw new Error('A team match needs a team for every robot');
    }
    if (config.bases !== undefined && config.bases.length > 0 && config.teams === undefined) {
      throw new Error('Castles belong to teams: a castle match needs teams');
    }
    this.arena = config.arena;
    this.teamMatch = config.teams !== undefined;
    this.teamOf = config.teams ?? config.robots.map((_, index) => index);
    this.bases = (config.bases ?? []).map((base) => ({ ...base, rect: { ...base.rect }, hp: base.maxHp }));
    this.terrain =
      this.bases.length === 0
        ? config.arena
        : { ...config.arena, obstacles: [...config.arena.obstacles, ...this.bases.map((base) => base.rect)] };
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
          dice: new MatchRng(diceSeed(config.seed, index)),
          team: this.teamMatch ? this.teamOf[index] : undefined,
          selfId: this.teamMatch ? this.selfIdOf(index) : undefined,
        }),
    );
    this.mailboxes = config.robots.map(() => 0);
    this.mailboxFrom = config.robots.map(() => 0);
    // What each robot knows of its team as the match stands ready: a snapshot
    // at tick 0 (and the waiting view before a match) shows full castles and
    // living teammates, not zeros.
    for (const robot of this.robots) robot.noteTeam(this.teamReadingOf(robot));
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
    // What each learns of its team, before any of them thinks: a signal sent this tick is read the next.
    for (const robot of standing) robot.noteTeam(this.teamReadingOf(robot));
    const actions = this.robots.map((robot) => (robot.alive ? this.think(robot) : null));
    // The radio takes the signals once everyone has thought: in robot order, so the last writer of a tick wins.
    actions.forEach((action, index) => {
      if (action === null || action.signal === null) return;
      const team = this.teamOf[index];
      const value = action.signal;
      const recipients =
        action.signalTo === null
          ? this.robots.map((_, other) => other).filter((other) => this.teamOf[other] === team)
          : this.robots.map((_, other) => other).filter((other) => this.teamOf[other] === team && this.selfIdOf(other) === action.signalTo);
      if (action.signalTo !== null && recipients.length === 0) {
        this.reporter?.signalToNobody(this.robots[index].id, action.signalTo);
        return;
      }
      for (const recipient of recipients) {
        // A new number in the mailbox is seen flying over; the same number again (whoever sends it) is not.
        const news = this.mailboxes[recipient] !== value;
        this.mailboxes[recipient] = value;
        this.mailboxFrom[recipient] = this.selfIdOf(index);
        if (news && recipient !== index && this.robots[recipient].alive) {
          this.tickEvents.push({ kind: 'signalHeard', ...this.robots[recipient].position, robot: recipient, from: index });
        }
      }
    });

    // Every robot moves at once: each makes room by where the others stood at the start of the tick,
    // so that none has the way first by its place in the list.
    const starts = new Map(this.robots.map((robot) => [robot, { ...robot.position }]));
    this.robots.forEach((robot, index) => {
      const action = actions[index];
      if (action === null) return;
      robot.guarding = action.guard && robot.brace(this.tick);
      if (action.guard && !robot.guarding) this.reporter?.outOfGuards(robot.id, action.sourceLines.guard);
      robot.setDrive(action.drive);
      robot.turn(action.turn, this.tickDuration);
      robot.drive(this.tickDuration, (position) => this.isBlocked(robot, position, starts));
    });
    this.undoClashes(starts);
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

  /** What the robot knows of its team as the tick starts: the nearest living teammate, the radio, and both castles. */
  /** The robot's number within its team (1-based), as self_id reads it. */
  private selfIdOf(index: number): number {
    return this.teamOf.slice(0, index + 1).filter((team) => team === this.teamOf[index]).length;
  }

  private teamReadingOf(robot: RobotController): TeamReading {
    const index = this.robots.indexOf(robot);
    const team = this.teamOf[index];
    const { position, rotation } = robot;
    const bearingTo = (target: Vec2) => measure(position, rotation, target);
    const centerOf = ({ rect }: BaseState) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

    const allies = this.robots.filter((other, i) => other !== robot && this.teamOf[i] === team && other.alive);
    // The team knows how many it faced, and every enemy that falls falls to its bullets: the shooter sees it and tells the rest by radio.
    const enemiesAlive = !this.teamMatch ? 0 : this.robots.filter((other, i) => this.teamOf[i] !== team && other.alive).length;
    const nearest =
      allies.length === 0
        ? null
        : allies.reduce((best, ally) => (distance(position, ally.position) < distance(position, best.position) ? ally : best));
    const toAlly = nearest === null ? null : bearingTo(nearest.position);

    const ownBase = this.bases.find((base) => base.team === team) ?? null;
    const enemyBases = this.bases.filter((base) => base.team !== team);
    const enemyBase =
      enemyBases.length === 0
        ? null
        : enemyBases.reduce((best, base) => (distance(position, centerOf(base)) < distance(position, centerOf(best)) ? base : best));

    return {
      alliesAlive: allies.length,
      enemiesAlive,
      touchingAlly: allies.some((ally) => this.areTouching(robot, ally)),
      allySignal: this.mailboxes[index],
      allySignalFrom: this.mailboxFrom[index],
      allyDistance: toAlly?.distance ?? 0,
      allyAngle: toAlly?.angle ?? 0,
      allyHp: nearest?.hp ?? 0,
      baseHp: ownBase?.hp ?? 0,
      baseDistance: ownBase === null ? 0 : bearingTo(centerOf(ownBase)).distance,
      baseAngle: ownBase === null ? 0 : bearingTo(centerOf(ownBase)).angle,
      enemyBaseHp: enemyBase?.hp ?? 0,
      enemyBaseDistance: enemyBase === null ? 0 : bearingTo(centerOf(enemyBase)).distance,
      enemyBaseAngle: enemyBase === null ? 0 : bearingTo(centerOf(enemyBase)).angle,
    };
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
    const wallAt = (offset: number) => wallDistance(this.terrain, position, rotation + offset, radius);

    // A teammate's bullets pass through: they are no threat.
    const threats = this.teamMatch
      ? this.bullets.filter((each) => each.ownerId === robot.id || !this.sameTeam(each.ownerId, robot.id))
      : this.bullets;
    const bullet = findIncomingBullet(threats, robot.id, position, radius, this.terrain);
    const findCover = this.coverFinderOf(robot);
    let cover: Cover | null | undefined;
    return {
      blocked: this.hitsTerrain(robot.stepTarget('forward', this.tickDuration), radius),
      blockedBehind: this.hitsTerrain(robot.stepTarget('backward', this.tickDuration), radius),
      touchingEnemy: this.enemiesOf(robot).some((enemy) => this.areTouching(robot, enemy)),
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
      const found = findCover(this.terrain, radius, position, threat);
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
  /** Close enough that neither could drive into the gap: moving at once, two robots that meet stop short by up to both steps. */
  private areTouching(a: RobotController, b: RobotController): boolean {
    const gap = distance(a.position, b.position) - a.stats.radius - b.stats.radius;
    return gap < (a.stats.moveSpeed + b.stats.moveSpeed) * this.tickDuration;
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
    return this.terrain.obstacles.every((obstacle) => segmentRectDistance(from, to, obstacle) >= clearance);
  }

  /** The robots of other teams still in the match: in a match without teams, every other robot still in it. */
  private enemiesOf(robot: RobotController): RobotController[] {
    const team = this.teamOf[this.robots.indexOf(robot)];
    return this.robots.filter((other, index) => other !== robot && other.alive && this.teamOf[index] !== team);
  }

  private sameTeam(a: string, b: string): boolean {
    const index = (id: string) => this.robots.findIndex((robot) => robot.id === id);
    return this.teamOf[index(a)] === this.teamOf[index(b)];
  }

  /** Whether a robot of the given radius at the given position would overlap a wall, an obstacle or a castle. */
  private hitsTerrain(position: Vec2, radius: number): boolean {
    const { width, height, obstacles } = this.terrain;
    if (position.x < radius || position.x > width - radius) return true;
    if (position.y < radius || position.y > height - radius) return true;
    return obstacles.some((obstacle) => circleIntersectsRect(position, radius, obstacle));
  }

  /** Whether the robot cannot be at the given position: terrain is there, or another robot where it stood (`at`, else where it is). */
  private isBlocked(robot: RobotController, position: Vec2, at?: ReadonlyMap<RobotController, Vec2>): boolean {
    const { radius } = robot.stats;
    if (this.hitsTerrain(position, radius)) return true;
    return this.robots.some(
      (other) => other !== robot && other.alive && distance(position, at?.get(other) ?? other.position) < radius + other.stats.radius,
    );
  }

  /**
   * Two robots that drove into the same room on the same tick both stay where
   * they were. Going back can put a robot in the way of one that moved next
   * to it, so this goes on until no two overlap.
   */
  private undoClashes(starts: ReadonlyMap<RobotController, Vec2>): void {
    const standing = this.robots.filter((robot) => robot.alive);
    for (let changed = true; changed; ) {
      changed = false;
      for (const robot of standing) {
        for (const other of standing) {
          if (other === robot || distance(robot.position, other.position) >= robot.stats.radius + other.stats.radius) continue;
          for (const each of [robot, other]) {
            if (!each.moved) continue;
            each.pushedBack(starts.get(each) ?? each.position);
            changed = true;
          }
        }
      }
    }
  }

  private stepBullets(): void {
    const baseRects = this.bases.map((base) => base.rect);
    this.bullets = this.bullets.filter((bullet) => {
      // Read afresh for every bullet: a robot destroyed by one bullet of this tick is no longer in the way of the next.
      // A teammate's bullet passes through: only the robots of other teams are in its way (and its owner, which it never hits).
      const targets = this.robots
        .filter((robot) => robot.alive && (!this.teamMatch || robot.id === bullet.ownerId || !this.sameTeam(robot.id, bullet.ownerId)))
        .map((robot) => ({ id: robot.id, position: robot.position, radius: robot.stats.radius }));
      const outcome = stepBullet(bullet, this.tickDuration, this.arena, targets, baseRects);
      if (outcome.kind === 'hit' || outcome.kind === 'wall' || outcome.kind === 'base') {
        this.tickEvents.push({ kind: 'impact', ...bullet.position });
      }
      if (outcome.kind === 'hit') this.applyHit(bullet, outcome.targetId);
      if (outcome.kind === 'base') this.applyBaseHit(bullet, outcome.baseIndex);
      return outcome.kind === 'flying';
    });
  }

  /** Every bullet stops at a castle; only an enemy's wears it down. */
  private applyBaseHit(bullet: Bullet, baseIndex: number): void {
    const base = this.bases[baseIndex];
    const shooter = this.robots.findIndex((robot) => robot.id === bullet.ownerId);
    if (this.teamOf[shooter] === base.team || base.hp <= 0) return;
    base.hp = Math.max(0, base.hp - bullet.damage);
    this.tickEvents.push({ kind: 'baseHit', ...bullet.position, base: baseIndex });
    this.reporter?.hitBase(bullet.ownerId, base.team, bullet.damage, base.hp);
    if (base.hp === 0) {
      const { rect } = base;
      this.tickEvents.push({ kind: 'baseDestroyed', x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, base: baseIndex });
    }
  }

  private applyHit(bullet: Bullet, targetId: string): void {
    const target = this.robots.find((robot) => robot.id === targetId);
    if (target === undefined) throw new Error(`Bullet hit unknown robot "${targetId}"`);
    const wasAlive = target.alive;
    const damage = target.takeDamage(bullet.damage);
    // It came from the way opposite to the one it flew.
    target.noteHit(radToDeg(Math.atan2(-bullet.direction.y, -bullet.direction.x)));
    this.tickEvents.push({
      kind: 'hit',
      ...target.position,
      robot: this.robots.indexOf(target),
      angle: radToDeg(Math.atan2(bullet.direction.y, bullet.direction.x)),
    });
    if (target.guarding) this.tickEvents.push({ kind: 'deflected', ...target.position });
    if (wasAlive && !target.alive) {
      this.tickEvents.push({ kind: 'destroyed', ...target.position });
      this.destroyedAt.set(target.id, this.tick);
    }
    this.reporter?.hit(bullet.ownerId, target.id, damage, target.hp, target.guarding);
  }

  private judge(): MatchResult | null {
    if (this.teamMatch) return this.judgeTeams();
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

  /**
   * In a castle match only the castle decides: a team is out when its castle
   * falls, however many robots it has lost, and a wiped-out team plays on
   * behind its walls. Without castles a team is out when its last robot
   * falls. A team still in beats one that is out, and teams out on the same
   * tick draw. At the end of time, or when nobody can shoot, castle HP
   * decides first, then the HP of the robots still standing. Teammates share
   * their team's place.
   */
  private judgeTeams(): MatchResult | null {
    const teams = [...new Set(this.teamOf)];
    const members = (team: number) => this.robots.filter((_, index) => this.teamOf[index] === team);
    const baseOf = (team: number) => this.bases.find((base) => base.team === team);
    const baseFell = (team: number) => {
      const base = baseOf(team);
      return base !== undefined && base.hp <= 0;
    };
    const wiped = (team: number) => members(team).every((robot) => !robot.alive);
    const out = (team: number) => (baseOf(team) === undefined ? wiped(team) : baseFell(team));
    const lastedUntil = (team: number) =>
      baseFell(team) ? this.tick : Math.max(...members(team).map((robot) => this.destroyedAt.get(robot.id) ?? 0));
    const hpLeft = (team: number) => members(team).reduce((sum, robot) => sum + (robot.alive ? robot.hp : 0), 0);

    let reason: MatchEndReason;
    /** Compared entry by entry; a longer lead decides before anything after it. */
    let score: (team: number) => number[];
    if (teams.some(out)) {
      reason = teams.some(baseFell) ? 'base destroyed' : 'destroyed';
      score = (team) => (out(team) ? [0, lastedUntil(team)] : [1, 0]);
    } else {
      const survivors = this.robots.filter((robot) => robot.alive);
      const spent = this.bullets.length === 0 && survivors.every((robot) => robot.weapon.ammo === 0);
      if (!spent && this.tick < this.maxTicks) return null;
      reason = spent ? 'out of ammo' : 'timeout';
      score = (team) => [1, baseOf(team)?.hp ?? 0, hpLeft(team)];
    }

    const beats = (a: number[], b: number[]) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const gap = (a[i] ?? 0) - (b[i] ?? 0);
        if (gap !== 0) return gap > 0;
      }
      return false;
    };
    const scores = new Map(teams.map((team) => [team, score(team)]));
    const placeOf = (team: number) =>
      1 + teams.filter((other) => beats(scores.get(other) ?? [], scores.get(team) ?? [])).length;
    const teamPlaces = new Map(teams.map((team) => [team, placeOf(team)]));
    const places = Object.fromEntries(this.robots.map((robot, index) => [robot.id, teamPlaces.get(this.teamOf[index]) ?? 1]));
    const firsts = teams.filter((team) => teamPlaces.get(team) === 1);
    return { winnerId: null, winnerTeam: firsts.length === 1 ? firsts[0] : null, reason, places };
  }

  /** Places from a score for each robot, the highest first; equal scores share a place. */
  private places(score: (robot: RobotController) => number): Record<string, number> {
    const scores = this.robots.map((robot) => ({ id: robot.id, score: score(robot) }));
    const places: Record<string, number> = {};
    for (const { id, score: own } of scores) places[id] = 1 + scores.filter((other) => other.score > own).length;
    return places;
  }
}
