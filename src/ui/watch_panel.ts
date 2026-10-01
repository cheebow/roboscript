import type { RobotSnapshot } from '../debug/snapshot';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber } from './format';

const VARIABLE_NAMES = [
  'enemy_visible',
  'enemy_distance',
  'enemy_angle',
  'blocked',
  'blocked_behind',
  'hp',
  'ammo',
  'state',
  'last_seen_x',
  'last_seen_y',
] as const;

/** Shows the variables one robot's AI saw on the displayed tick, under their RoboScript names. */
export class WatchPanel {
  private readonly fields: FieldList;

  /** `robotName` is the element that says whose variables are shown. */
  constructor(
    container: HTMLElement,
    private readonly robotName: HTMLElement,
  ) {
    this.fields = new FieldList(container, VARIABLE_NAMES);
  }

  update(robot: RobotSnapshot): void {
    if (this.robotName.textContent !== robot.id) this.robotName.textContent = robot.id;
    const { lastSeen } = robot;
    this.fields.set([
      String(robot.enemyVisible),
      formatNumber(robot.enemyDistance),
      formatNumber(robot.enemyAngle),
      String(robot.blocked),
      String(robot.blockedBehind),
      String(robot.hp),
      String(robot.ammo),
      robot.state,
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.x),
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.y),
    ]);
  }
}
