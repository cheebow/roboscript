import type { RobotStats } from '../data/robot_defaults';
import type {
  AIAction,
  AIContext,
  AimDirection,
  DriveDirection,
  DriveSetting,
  RobotBrain,
  TurnDirection,
} from './ai_context';
import { INITIAL_LABEL } from './ai_context';
import { leadPoint } from './aiming';
import { clamp, headingVector, normalizeAngle } from './math';
import { EMPTY_READING, type SensedRobot, type Sensor, type SensorReading, measure } from './sensor';
import { OPEN_SURROUNDINGS, type Surroundings } from './surroundings';
import type { SpawnPoint, Vec2 } from './types';
import type { Weapon } from './weapon';

/** Heading offset in deg for each direction of driving, relative to the robot's rotation. */
const DRIVE_HEADING_OFFSETS: Record<DriveDirection, number> = {
  forward: 0,
  backward: 180,
};

export interface RobotOptions {
  id: string;
  spawn: SpawnPoint;
  stats: RobotStats;
  brain: RobotBrain;
  sensor: Sensor;
  weapon: Weapon;
}

export class RobotController {
  readonly id: string;
  readonly stats: RobotStats;
  readonly weapon: Weapon;
  position: Vec2;
  /** deg, where the hull faces. */
  rotation: number;
  /** deg, where the gun points relative to the hull: 0 = straight ahead, positive = to the right. */
  gunRotation = 0;
  /** What the hull keeps doing until the brain sets something else. */
  driving: DriveSetting = 'stop';
  hp: number;
  /** What the brain last called what it is doing. For show only. */
  label: string = INITIAL_LABEL;
  /** Braced on the current tick: hits do less damage. */
  guarding = false;
  /** The tick on which the robot last guarded; null until it has. */
  guardedAt: number | null = null;
  /** How many more ticks the robot can guard in this match. */
  guardsLeft: number;
  /** The enemy's sensor did not see the robot on the latest tick. */
  hidden = false;
  /** The hull drove somewhere on the latest tick. */
  moved = false;
  /** sec, the length of a tick, as the robot last sensed. */
  private tickDuration = 0;
  /** Regaining hp on the latest tick: still and out of the enemy's sight for long enough, and hurt. */
  recovering = false;
  /** Ticks in a row that the robot has been still and out of the enemy's sight. */
  private hiddenTicks = 0;
  /** Where the robot stood when it last learnt whether it was hidden: moving since then is not resting. */
  private restingAt: Vec2;
  /** Ticks of recovery in the current rest, and the hp they have given: hp stays a whole number. */
  private restTicks = 0;
  private restGiven = 0;

  private readonly brain: RobotBrain;
  private readonly sensor: Sensor;
  private reading: SensorReading = EMPTY_READING;
  private around: Surroundings = OPEN_SURROUNDINGS;
  /** Where to shoot to hit the enemy if it keeps moving as it does; null until it has been seen. */
  private leadTarget: Vec2 | null = null;
  private sensed: GunReading = NO_GUN_READING;
  /** A bullet has hit the robot, and the brain has not looked at `hit` since. */
  private struck = false;
  /** deg on the field: where the bullet that last hit the robot came from. Null until it is hit. */
  private hitFrom: number | null = null;
  private hitSensed: HitReading = NO_HIT_READING;
  private lastAction: AIAction | null = null;
  /** deg on the field: where a turn of this tick's action stops (`back`, or `left` / `right` by an angle). */
  private turnHeading: number | null = null;
  /** deg on the hull: where an aim `left` / `right` by an angle of this tick's action stops. */
  private aimGunAngle: number | null = null;
  private readonly knownVariables = new Map<string, number>();

  constructor(options: RobotOptions) {
    this.id = options.id;
    this.stats = options.stats;
    this.weapon = options.weapon;
    this.position = { x: options.spawn.x, y: options.spawn.y };
    this.rotation = normalizeAngle(options.spawn.rotation);
    this.hp = options.stats.maxHp;
    this.restingAt = { ...this.position };
    this.guardsLeft = options.stats.maxGuards;
    this.brain = options.brain;
    this.sensor = options.sensor;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get sensorReading(): SensorReading {
    return this.reading;
  }

  /** Whether the way straight ahead was blocked on the latest tick. */
  get blocked(): boolean {
    return this.around.blocked;
  }

  /** Whether the way straight back was blocked on the latest tick. */
  get blockedBehind(): boolean {
    return this.around.blockedBehind;
  }

  /** The terrain and the bullets around the robot as it found them on the latest tick. */
  get surroundings(): Surroundings {
    return this.around;
  }

  /** deg, where the gun points on the field. */
  get gunHeading(): number {
    return normalizeAngle(this.rotation + this.gunRotation);
  }

  /** How the gun stood to the enemy when the robot last looked. */
  get gunReading(): GunReading {
    return this.sensed;
  }

  /** Looks for the enemies still in the match. */
  sense(enemies: readonly SensedRobot[], tickDuration: number): void {
    this.tickDuration = tickDuration;
    this.reading = this.sensor.scanAll(this.position, this.rotation, enemies);
    const { lastSeen, enemyVisible, enemyVelocity } = this.reading;
    if (lastSeen === null) {
      this.sensed = { ...NO_GUN_READING, gunAngle: this.gunRotation };
      return;
    }

    // An enemy out of sight is taken to be where it was last seen.
    this.leadTarget = enemyVisible ? this.leadOn(lastSeen, enemyVelocity, tickDuration) : lastSeen;
    this.sensed = {
      aimAngle: this.gunAngleTo(lastSeen),
      leadAngle: this.gunAngleTo(this.leadTarget),
      gunAngle: this.gunRotation,
      lead: { ...this.leadTarget },
    };
  }

  /** Where to shoot at an enemy seen at `position` that moves by `velocity` per tick. */
  private leadOn(position: Vec2, velocity: Vec2, tickDuration: number): Vec2 {
    const { shotSpeed, radius, bulletRadius } = this.stats;
    // The enemy moves once more before a shot decided now leaves the gun.
    const atFiring = { x: position.x + velocity.x, y: position.y + velocity.y };
    return leadPoint(this.position, atFiring, velocity, shotSpeed * tickDuration, radius + bulletRadius);
  }

  private gunAngleTo(target: Vec2): number {
    return measure(this.position, this.gunHeading, target).angle;
  }

  /** What the brain was told about being hit on the latest tick. */
  get hitReading(): HitReading {
    return this.hitSensed;
  }

  /** Tells the robot that a bullet coming from the given direction on the field (deg) has hit it. */
  noteHit(from: number): void {
    this.struck = true;
    this.hitFrom = from;
  }

  /** Tells the robot what the simulation found around it this tick. */
  noteSurroundings(surroundings: Surroundings): void {
    this.around = surroundings;
  }

  /**
   * Tells the robot whether the enemy's sensor misses it this tick. Resting
   * (still, and out of the enemy's sight) for the recovery delay, and hurt, it
   * regains hp at the recovery rate, a whole point at a time, until it moves,
   * is seen again or is whole. Turning on the spot is resting; driving is not.
   */
  noteHidden(hidden: boolean, tickRate: number): void {
    this.hidden = hidden;
    const still = this.restingAt.x === this.position.x && this.restingAt.y === this.position.y;
    this.restingAt = { ...this.position };
    this.hiddenTicks = hidden && still && this.alive ? this.hiddenTicks + 1 : 0;
    const { recoveryDelay, recoveryRate, maxHp } = this.stats;
    this.recovering = this.hiddenTicks > recoveryDelay * tickRate && this.hp < maxHp && recoveryRate > 0;
    if (!this.recovering) {
      this.restTicks = 0;
      this.restGiven = 0;
      return;
    }
    this.restTicks++;
    const due = Math.floor((this.restTicks * recoveryRate) / tickRate);
    this.hp = Math.min(maxHp, this.hp + due - this.restGiven);
    this.restGiven = due;
  }

  /** What the brain decided on the latest tick, or null before the first. */
  get action(): AIAction | null {
    return this.lastAction;
  }

  /** The values the brain's program has assigned to its own variables so far. */
  get variables(): ReadonlyMap<string, number> {
    return this.knownVariables;
  }

  /** Asks the brain what to do this tick. The brain only ever sees the AIContext. */
  think(): AIAction {
    let lookedAtHit = false;
    const action = this.brain.decide(
      this.buildContext(() => {
        lookedAtHit = true;
      }),
    );
    // A hit is told of once: the brain that has looked is not told again.
    if (lookedAtHit) this.struck = false;
    if (action.label !== null) this.label = action.label;
    this.turnHeading = action.heading;
    this.aimGunAngle = action.gunAngle;
    this.lastAction = action;
    for (const { name, value } of action.assignments) this.knownVariables.set(name, value);
    return action;
  }

  turn(direction: TurnDirection | null, tickDuration: number): void {
    if (direction === null) return;
    const maxStep = this.stats.rotateSpeed * tickDuration;
    this.rotation = normalizeAngle(this.rotation + this.turnStep(direction, maxStep));
  }

  /** Where one tick of driving in the given direction would take the robot if nothing were in the way. */
  stepTarget(direction: DriveDirection, tickDuration: number): Vec2 {
    const heading = headingVector(this.rotation + DRIVE_HEADING_OFFSETS[direction]);
    const step = this.stats.moveSpeed * tickDuration;
    return { x: this.position.x + heading.x * step, y: this.position.y + heading.y * step };
  }

  /** Changes how the hull drives from now on; null leaves it as it is. */
  setDrive(setting: DriveSetting | null): void {
    if (setting !== null) this.driving = setting;
  }

  /** Drives one tick's worth as set, or stays put if anything is in the way. */
  drive(tickDuration: number, isBlocked: (position: Vec2) => boolean): void {
    this.moved = false;
    if (this.driving === 'stop') return;
    const target = this.stepTarget(this.driving, tickDuration);
    if (isBlocked(target)) return;
    this.position = target;
    this.moved = true;
  }

  /** Turns the turret on the hull. Aiming at the enemy goes by where the robot is now, after driving. */
  aim(direction: AimDirection | null, tickDuration: number): void {
    if (direction === null) return;
    const maxStep = this.stats.turretSpeed * tickDuration;
    this.gunRotation = normalizeAngle(this.gunRotation + this.aimStep(direction, maxStep));
  }

  private aimStep(direction: AimDirection, maxStep: number): number {
    switch (direction) {
      case 'left':
        return this.aimGunAngle === null ? -maxStep : clamp(normalizeAngle(this.aimGunAngle - this.gunRotation), -maxStep, maxStep);
      case 'right':
        return this.aimGunAngle === null ? maxStep : clamp(normalizeAngle(this.aimGunAngle - this.gunRotation), -maxStep, maxStep);
      case 'ahead':
        return clamp(-this.gunRotation, -maxStep, maxStep);
      case 'enemy':
        return this.reading.lastSeen === null ? 0 : clamp(this.gunAngleTo(this.reading.lastSeen), -maxStep, maxStep);
      case 'lead':
        return this.leadTarget === null ? 0 : clamp(this.gunAngleTo(this.leadTarget), -maxStep, maxStep);
    }
  }

  /** Uses up one of the robot's guards for the given tick. False, and nothing happens, when it has none left. */
  brace(tick: number): boolean {
    if (this.guardsLeft <= 0) return false;
    this.guardsLeft--;
    this.guardedAt = tick;
    return true;
  }

  /** Takes a hit and returns the damage it did: less than `amount` while guarding. */
  takeDamage(amount: number): number {
    const damage = this.guarding ? Math.round(amount * this.stats.guardDamageFactor) : amount;
    this.hp = Math.max(0, this.hp - damage);
    return damage;
  }

  private turnStep(direction: TurnDirection, maxStep: number): number {
    switch (direction) {
      case 'left':
        return this.turnHeading === null ? -maxStep : clamp(normalizeAngle(this.turnHeading - this.rotation), -maxStep, maxStep);
      case 'right':
        return this.turnHeading === null ? maxStep : clamp(normalizeAngle(this.turnHeading - this.rotation), -maxStep, maxStep);
      case 'enemy':
        return this.reading.lastSeen === null ? 0 : clamp(this.reading.enemyAngle, -maxStep, maxStep);
      case 'cover':
        return clamp(this.around.cover?.angle ?? 0, -maxStep, maxStep);
      case 'hit':
        return clamp(this.hitSensed.hitAngle, -maxStep, maxStep);
      case 'back':
        return this.turnHeading === null ? 0 : clamp(normalizeAngle(this.turnHeading - this.rotation), -maxStep, maxStep);
    }
  }

  /** How the enemy in sight is moving: how fast, and which way from the way the hull faces. Nothing while none is in sight. */
  enemyMotion(): { enemySpeed: number; enemyHeading: number } {
    const { enemyVisible, enemyVelocity } = this.reading;
    const perTick = Math.hypot(enemyVelocity.x, enemyVelocity.y);
    if (!enemyVisible || perTick === 0 || this.tickDuration === 0) return { enemySpeed: 0, enemyHeading: 0 };
    const course = (Math.atan2(enemyVelocity.y, enemyVelocity.x) * 180) / Math.PI;
    return { enemySpeed: perTick / this.tickDuration, enemyHeading: normalizeAngle(course - this.rotation) };
  }

  /** `onHitRead` is called when the brain looks at `hit`. */
  private buildContext(onHitRead: () => void): AIContext {
    const around = this.around;
    const { incomingBullet } = around;
    const hit = this.struck;
    const hitAngle = this.hitFrom === null ? 0 : normalizeAngle(this.hitFrom - this.rotation);
    this.hitSensed = { hit, hitAngle };
    return {
      enemyVisible: this.reading.enemyVisible,
      enemyDistance: this.reading.enemyDistance,
      enemyAngle: this.reading.enemyAngle,
      enemyX: this.reading.lastSeen?.x ?? 0,
      enemyY: this.reading.lastSeen?.y ?? 0,
      hp: this.hp,
      ammo: this.weapon.ammo,
      guards: this.guardsLeft,
      blocked: this.around.blocked,
      heading: this.rotation,
      blockedBehind: this.around.blockedBehind,
      wallAhead: this.around.wallAhead,
      wallBehind: this.around.wallBehind,
      wallLeft: this.around.wallLeft,
      wallRight: this.around.wallRight,
      bulletIncoming: incomingBullet !== null,
      bulletDistance: incomingBullet?.distance ?? 0,
      bulletAngle: incomingBullet?.angle ?? 0,
      // Read through to the surroundings, which look for cover only when asked.
      get coverVisible() {
        return around.cover !== null;
      },
      get coverDistance() {
        return around.cover?.distance ?? 0;
      },
      get coverAngle() {
        return around.cover?.angle ?? 0;
      },
      aimAngle: this.sensed.aimAngle,
      leadAngle: this.sensed.leadAngle,
      gunAngle: this.sensed.gunAngle,
      weaponRange: this.stats.weaponRange,
      ...this.enemyMotion(),
      reload: this.weapon.cooldownTicks * this.tickDuration,
      hidden: this.hidden,
      get hit() {
        onHitRead();
        return hit;
      },
      hitAngle,
      touchingEnemy: around.touchingEnemy,
    };
  }
}

/** How the gun stands to the enemy, as found when the robot looked around. */
export interface GunReading {
  /** deg from the gun to the enemy, or to where it was last seen. 0 if never seen. */
  aimAngle: number;
  /** deg from the gun to the point to shoot at to hit a moving enemy. 0 if never seen. */
  leadAngle: number;
  /** deg, the gun on the hull. */
  gunAngle: number;
  /** The point to shoot at to hit a moving enemy; null until the enemy has been seen. */
  lead: Vec2 | null;
}

const NO_GUN_READING: GunReading = { aimAngle: 0, leadAngle: 0, gunAngle: 0, lead: null };

/** What a robot knows about the bullets that have hit it, as told to its brain. */
export interface HitReading {
  /** A bullet has hit the robot and the brain had not looked since. */
  hit: boolean;
  /** deg from the hull to where the last such bullet came from. 0 before the first hit. */
  hitAngle: number;
}

const NO_HIT_READING: HitReading = { hit: false, hitAngle: 0 };
