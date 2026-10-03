// Base stats shared by every robot in the MVP (SPEC §9).
export interface RobotStats {
  maxHp: number;
  /** units/sec */
  moveSpeed: number;
  /** deg/sec */
  rotateSpeed: number;
  /** deg/sec, how fast the turret turns on the hull. */
  turretSpeed: number;
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
  /** deg, max deviation to either side of a shot fired on the move: the hull drove during the tick. */
  movingShotSpread: number;
  maxAmmo: number;
  radius: number;
  bulletRadius: number;
  /** Share of a hit's damage that a guarding robot takes. */
  guardDamageFactor: number;
  /** How many ticks of guarding a robot has for a whole match. */
  maxGuards: number;
  /** sec, how much later the weapon can fire again for each tick spent guarding. */
  guardRecovery: number;
  /** sec, how long the robot must stay still and out of the enemy's sight before it starts recovering hp. */
  recoveryDelay: number;
  /** hp/sec regained while still and out of the enemy's sight, once the delay is over. */
  recoveryRate: number;
}

export const ROBOT_DEFAULTS: RobotStats = {
  maxHp: 200,
  moveSpeed: 100,
  rotateSpeed: 180,
  turretSpeed: 270,
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
  // Five times the spread of a shot from standing still: a robot that shoots on the move hits far less.
  movingShotSpread: 10,
  maxAmmo: 50,
  radius: 16,
  bulletRadius: 3,
  guardDamageFactor: 0.5,
  maxGuards: 4,
  guardRecovery: 0.3,
  recoveryDelay: 0.5,
  recoveryRate: 20,
};
