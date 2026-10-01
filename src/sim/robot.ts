import type { RobotStats } from '../data/robot_defaults';
import type { AIAction, AIContext, MoveDirection, RobotBrain, RobotState, TurnDirection } from './ai_context';
import { clamp, headingVector, normalizeAngle } from './math';
import { EMPTY_READING, type Sensor, type SensorReading } from './sensor';
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

  private readonly stats: RobotStats;
  private readonly brain: RobotBrain;
  private readonly sensor: Sensor;
  private reading: SensorReading = EMPTY_READING;
  private blockedAhead = false;
  private executed: readonly number[] = [];

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
    return this.blockedAhead;
  }

  sense(enemyPosition: Vec2): void {
    this.reading = this.sensor.scan(this.position, this.rotation, enemyPosition);
  }

  /** Tells the robot whether the simulation found the way straight ahead blocked this tick. */
  noteBlocked(blocked: boolean): void {
    this.blockedAhead = blocked;
  }

  /** Source lines the brain executed on its latest decision. */
  get executedLines(): readonly number[] {
    return this.executed;
  }

  /** Asks the brain what to do this tick. The brain only ever sees the AIContext. */
  think(): AIAction {
    const action = this.brain.decide(this.buildContext());
    if (action.state !== null) this.state = action.state;
    this.executed = action.executedLines;
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

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  private turnStep(direction: TurnDirection, maxStep: number): number {
    switch (direction) {
      case 'left':
        return -maxStep;
      case 'right':
        return maxStep;
      case 'enemy':
        return this.reading.lastSeen === null ? 0 : clamp(this.reading.enemyAngle, -maxStep, maxStep);
    }
  }

  private buildContext(): AIContext {
    return {
      enemyVisible: this.reading.enemyVisible,
      enemyDistance: this.reading.enemyDistance,
      enemyAngle: this.reading.enemyAngle,
      enemyX: this.reading.lastSeen?.x ?? 0,
      enemyY: this.reading.lastSeen?.y ?? 0,
      hp: this.hp,
      ammo: this.weapon.ammo,
      blocked: this.blockedAhead,
    };
  }
}
