import type { RobotController } from '../sim/robot';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber } from './format';

const VARIABLE_NAMES = [
  'enemy_visible',
  'enemy_distance',
  'enemy_angle',
  'hp',
  'ammo',
  'state',
  'last_seen_x',
  'last_seen_y',
] as const;

/** Shows the variables the player's AI sees, under the names used in RoboScript. */
export class WatchPanel {
  private readonly fields: FieldList;

  constructor(container: HTMLElement) {
    this.fields = new FieldList(container, VARIABLE_NAMES);
  }

  update(robot: RobotController): void {
    const { enemyVisible, enemyDistance, enemyAngle, lastSeen } = robot.sensorReading;
    this.fields.set([
      String(enemyVisible),
      formatNumber(enemyDistance),
      formatNumber(enemyAngle),
      String(robot.hp),
      String(robot.weapon.ammo),
      robot.state,
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.x),
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.y),
    ]);
  }
}
