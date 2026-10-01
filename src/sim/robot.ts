import type { RobotStats } from '../data/robot_defaults';
import type { AIAction, AIContext, MoveDirection, RobotBrain, RobotState, TurnDirection } from './ai_context';
import { clamp, headingVector, normalizeAngle } from './math';
import { EMPTY_READING, type Sensor, type SensorReading } from './sensor';
import { OPEN_SURROUNDINGS, type Surroundings } from './surroundings';
import type { SpawnPoint, Vec2 } from './types';
import type { Weapon } from './weapon';

/** Heading offset in deg for each move direction, relative to the robot's rotation. */
const MOVE_HEADING_OFFSETS: Record<MoveDirection, number> = {
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
  readonly weapon: Weapon;
  position: Vec2;
  /** deg */
  rotation: number;
  hp: number;
  state: RobotState = 'IDLE';
  /** Braced on the current tick: hits do less damage. */
  guarding = false;

  private readonly stats: RobotStats;
  private readonly brain: RobotBrain;
  private readonly sensor: Sensor;
  private reading: SensorReading = EMPTY_READING;
  private around: Surroundings = OPEN_SURROUNDINGS;
  private lastAction: AIAction | null = null;
  private readonly knownVariables = new Map<string, number>();

  constructor(options: RobotOptions) {
    this.id = options.id;
    this.weapon = options.weapon;
    this.position = { x: options.spawn.x, y: options.spawn.y };
    this.rotation = normalizeAngle(options.spawn.rotation);
    this.hp = options.stats.maxHp;
    this.stats = options.stats;
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

  sense(enemyPosition: Vec2): void {
    this.reading = this.sensor.scan(this.position, this.rotation, enemyPosition);
  }

  /** Tells the robot what the simulation found around it this tick. */
  noteSurroundings(surroundings: Surroundings): void {
    this.around = surroundings;
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
    const action = this.brain.decide(this.buildContext());
    if (action.state !== null) this.state = action.state;
    this.lastAction = action;
    for (const { name, value } of action.assignments) this.knownVariables.set(name, value);
    return action;
  }

  turn(direction: TurnDirection | null, tickDuration: number): void {
    if (direction === null) return;
    const maxStep = this.stats.rotateSpeed * tickDuration;
    this.rotation = normalizeAngle(this.rotation + this.turnStep(direction, maxStep));
  }

  /** Where one tick of movement in the given direction would take the robot if nothing were in the way. */
  stepTarget(direction: MoveDirection, tickDuration: number): Vec2 {
    const heading = headingVector(this.rotation + MOVE_HEADING_OFFSETS[direction]);
    const step = this.stats.moveSpeed * tickDuration;
    return { x: this.position.x + heading.x * step, y: this.position.y + heading.y * step };
  }

  /** Moves one tick's worth along the heading, or stays put if anything is in the way. */
  move(direction: MoveDirection | null, tickDuration: number, isBlocked: (position: Vec2) => boolean): void {
    if (direction === null) return;
    const target = this.stepTarget(direction, tickDuration);
    if (!isBlocked(target)) this.position = target;
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
        return -maxStep;
      case 'right':
        return maxStep;
      case 'enemy':
        return this.reading.lastSeen === null ? 0 : clamp(this.reading.enemyAngle, -maxStep, maxStep);
      case 'cover':
        return clamp(this.around.cover?.angle ?? 0, -maxStep, maxStep);
    }
  }

  private buildContext(): AIContext {
    const around = this.around;
    const { incomingBullet } = around;
    return {
      enemyVisible: this.reading.enemyVisible,
      enemyDistance: this.reading.enemyDistance,
      enemyAngle: this.reading.enemyAngle,
      enemyX: this.reading.lastSeen?.x ?? 0,
      enemyY: this.reading.lastSeen?.y ?? 0,
      hp: this.hp,
      ammo: this.weapon.ammo,
      blocked: this.around.blocked,
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
    };
  }
}
