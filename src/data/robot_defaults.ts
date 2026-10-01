// Base stats shared by every robot in the MVP (SPEC §9).
export interface RobotStats {
  maxHp: number;
  /** units/sec */
  moveSpeed: number;
  /** deg/sec */
  rotateSpeed: number;
  sensorRange: number;
  /** deg, full width of the cone */
  sensorAngle: number;
  weaponRange: number;
  shotDamage: number;
  /** units/sec */
  shotSpeed: number;
  /** sec */
  shotCooldown: number;
  /** deg, max deviation to either side */
  shotSpread: number;
  maxAmmo: number;
  radius: number;
  bulletRadius: number;
  /** Share of a hit's damage that a guarding robot takes. */
  guardDamageFactor: number;
  /** sec, how much later the weapon can fire again for each tick spent guarding. */
  guardRecovery: number;
}

export const ROBOT_DEFAULTS: RobotStats = {
  maxHp: 100,
  moveSpeed: 100,
  rotateSpeed: 180,
  // SPEC §9 says 300, but that is shorter than the spawn distance, so robots
  // that search by turning on the spot would never find each other.
  sensorRange: 1200,
  // SPEC §9 says 90, but robots drive like tanks: one that turns away to get
  // around an obstacle would lose the enemy. The sensor sees all around
  // instead, and obstacles hide what is behind them.
  sensorAngle: 360,
  weaponRange: 400,
  shotDamage: 20,
  shotSpeed: 400,
  shotCooldown: 0.8,
  shotSpread: 2,
  maxAmmo: 50,
  radius: 16,
  bulletRadius: 3,
  guardDamageFactor: 0.5,
  guardRecovery: 0.3,
};
