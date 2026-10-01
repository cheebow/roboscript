import type { RobotSnapshot } from '../debug/snapshot';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber } from './format';

const VARIABLE_NAMES = [
  'enemy_visible',
  'enemy_distance',
  'enemy_angle',
  'blocked',
  'hp',
  'ammo',
  'state',
  'last_seen_x',
  'last_seen_y',
] as const;

/** Shows the variables the player's AI saw on the displayed tick, under their RoboScript names. */
export class WatchPanel {
  private readonly fields: FieldList;

  constructor(container: HTMLElement) {
    this.fields = new FieldList(container, VARIABLE_NAMES);
  }

  update(robot: RobotSnapshot): void {
    const { lastSeen } = robot;
    this.fields.set([
      String(robot.enemyVisible),
      formatNumber(robot.enemyDistance),
      formatNumber(robot.enemyAngle),
      String(robot.blocked),
      String(robot.hp),
      String(robot.ammo),
      robot.state,
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.x),
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.y),
    ]);
  }
}
