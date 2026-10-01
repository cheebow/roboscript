import type { RobotStats } from '../data/robot_defaults';
import type { AIAction, AIContext, MoveDirection, RobotBrain, RobotState, TurnDirection } from './ai_context';
import { clamp, headingVector, normalizeAngle } from './math';
import { EMPTY_READING, type Sensor, type SensorReading } from './sensor';
import type { SpawnPoint, Vec2 } from './types';
import type { Weapon } from './weapon';

/** Heading offset in deg for each move direction, relative to the robot's rotation. */
const MOVE_HEADING_OFFSETS: Record<MoveDirection, number> = {
  forward: 0,
  right: 90,
  backward: 180,
  left: -90,
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

  sense(enemyPosition: Vec2): void {
    this.reading = this.sensor.scan(this.position, this.rotation, enemyPosition);
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

  /** Moves one tick's worth, sliding along whatever blocks the direct path. */
  move(direction: MoveDirection | null, tickDuration: number, isBlocked: (position: Vec2) => boolean): void {
    if (direction === null) return;
    const heading = headingVector(this.rotation + MOVE_HEADING_OFFSETS[direction]);
    const step = this.stats.moveSpeed * tickDuration;
    const dx = heading.x * step;
    const dy = heading.y * step;
    const { x, y } = this.position;
    const candidates: Vec2[] = [
      { x: x + dx, y: y + dy },
      { x: x + dx, y },
      { x, y: y + dy },
    ];
    for (const candidate of candidates) {
      if (!isBlocked(candidate)) {
        this.position = candidate;
        return;
      }
    }
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
    };
  }
}
