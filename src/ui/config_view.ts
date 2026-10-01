import type { RobotStats } from '../data/robot_defaults';
import { FieldList } from './field_list';

/** Fills the container with a read-only list of the robot's stats, named as in SPEC §9. */
export function renderConfig(container: HTMLElement, stats: RobotStats): void {
  const rows: [name: string, value: string][] = [
    ['HP', `${stats.maxHp}`],
    ['MOVE_SPEED', `${stats.moveSpeed} units/sec`],
    ['ROTATE_SPEED', `${stats.rotateSpeed} deg/sec`],
    ['SENSOR_RANGE', `${stats.sensorRange}`],
    ['SENSOR_ANGLE', `${stats.sensorAngle} deg`],
    ['WEAPON_RANGE', `${stats.weaponRange}`],
    ['SHOT_DAMAGE', `${stats.shotDamage}`],
    ['SHOT_SPEED', `${stats.shotSpeed} units/sec`],
    ['SHOT_COOLDOWN', `${stats.shotCooldown} sec`],
    ['SHOT_SPREAD', `±${stats.shotSpread} deg`],
    ['AMMO', `${stats.maxAmmo}`],
  ];
  new FieldList(
    container,
    rows.map(([name]) => name),
  ).set(rows.map(([, value]) => value));
}
