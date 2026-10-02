import type { RobotSnapshot } from '../debug/snapshot';
import { createElement } from './dom';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber } from './format';

const SENSOR_NAMES = [
  'enemy_visible',
  'enemy_distance',
  'enemy_angle',
  'aim_angle',
  'lead_angle',
  'gun_angle',
  'weapon_range',
  'blocked',
  'blocked_behind',
  'touching_enemy',
  'hp',
  'ammo',
  'guards',
  'label',
  'last_seen_x',
  'last_seen_y',
  'bullet_incoming',
  'bullet_distance',
  'bullet_angle',
  'hit',
  'hit_angle',
  'cover_visible',
  'cover_distance',
  'cover_angle',
  'wall_ahead',
  'wall_behind',
  'wall_left',
  'wall_right',
] as const;

/**
 * Shows what one robot's program can read at the displayed moment, under the
 * names used in RoboScript: the program's own variables, then the sensor values.
 */
export class WatchPanel {
  private readonly sensors: FieldList;
  private readonly variablesContainer = createElement('div', 'watch-variables');
  private variables: FieldList | null = null;
  private variableNames = '';

  /** `robotName` is the element that says whose values are shown. */
  constructor(
    container: HTMLElement,
    private readonly robotName: HTMLElement,
  ) {
    const sensorsContainer = createElement('div', 'watch-sensors');
    container.replaceChildren(this.variablesContainer, sensorsContainer);
    this.sensors = new FieldList(sensorsContainer, SENSOR_NAMES);
  }

  update(robot: RobotSnapshot, variables: Readonly<Record<string, number>>): void {
    if (this.robotName.textContent !== robot.id) this.robotName.textContent = robot.id;
    const { lastSeen, incomingBullet, cover } = robot;
    this.sensors.set([
      String(robot.enemyVisible),
      formatNumber(robot.enemyDistance),
      formatNumber(robot.enemyAngle),
      formatNumber(robot.aimAngle),
      formatNumber(robot.leadAngle),
      formatNumber(robot.gunAngle),
      String(robot.weaponRange),
      String(robot.blocked),
      String(robot.blockedBehind),
      String(robot.touchingEnemy),
      String(robot.hp),
      String(robot.ammo),
      String(robot.guards),
      robot.label,
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.x),
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.y),
      String(incomingBullet !== null),
      formatNumber(incomingBullet?.distance ?? 0),
      formatNumber(incomingBullet?.angle ?? 0),
      String(robot.hit),
      formatNumber(robot.hitAngle),
      String(cover !== null),
      formatNumber(cover?.distance ?? 0),
      formatNumber(cover?.angle ?? 0),
      formatNumber(robot.wallAhead),
      formatNumber(robot.wallBehind),
      formatNumber(robot.wallLeft),
      formatNumber(robot.wallRight),
    ]);
    this.showVariables(variables);
  }

  /** The rows are rebuilt only when the set of variables changes; otherwise only the values are refreshed. */
  private showVariables(variables: Readonly<Record<string, number>>): void {
    const names = Object.keys(variables).sort();
    const key = names.join(' ');
    if (key !== this.variableNames) {
      this.variableNames = key;
      this.variables = names.length === 0 ? null : new FieldList(this.variablesContainer, names);
      if (names.length === 0) this.variablesContainer.replaceChildren();
    }
    this.variables?.set(names.map((name) => formatVariable(variables[name])));
  }
}

/** Whole numbers as they are; others with a few decimals. */
function formatVariable(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}
