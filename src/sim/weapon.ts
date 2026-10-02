import type { RobotStats } from '../data/robot_defaults';
import type { Bullet } from './bullet';
import { headingVector } from './math';
import type { MatchRng } from './rng';
import type { Vec2 } from './types';

export type NewBullet = Omit<Bullet, 'id'>;

export interface Weapon {
  readonly ammo: number;
  /** Ticks until the weapon can fire again. */
  readonly cooldownTicks: number;
  /** Advances the cooldown by one tick. */
  tick(): void;
  /** Puts off the moment the weapon can fire again by the given number of ticks. */
  delay(ticks: number): void;
  /** Returns the fired bullet, or null while cooling down or out of ammo. */
  fire(ownerId: string, position: Vec2, rotation: number, rng: MatchRng): NewBullet | null;
}

export class Gun implements Weapon {
  private remainingAmmo: number;
  private remainingCooldown = 0;
  private readonly cooldownLength: number;

  constructor(
    private readonly stats: RobotStats,
    tickRate: number,
  ) {
    this.remainingAmmo = stats.maxAmmo;
    this.cooldownLength = Math.round(stats.shotCooldown * tickRate);
  }

  get ammo(): number {
    return this.remainingAmmo;
  }

  get cooldownTicks(): number {
    return this.remainingCooldown;
  }

  tick(): void {
    if (this.remainingCooldown > 0) this.remainingCooldown--;
  }

  delay(ticks: number): void {
    this.remainingCooldown += ticks;
  }

  fire(ownerId: string, position: Vec2, rotation: number, rng: MatchRng): NewBullet | null {
    if (this.remainingCooldown > 0 || this.remainingAmmo <= 0) return null;
    this.remainingAmmo--;
    this.remainingCooldown = this.cooldownLength;

    const { shotSpread, radius, bulletRadius } = this.stats;
    const direction = headingVector(rotation + rng.range(-shotSpread, shotSpread));
    const muzzleOffset = radius + bulletRadius;
    return {
      ownerId,
      position: {
        x: position.x + direction.x * muzzleOffset,
        y: position.y + direction.y * muzzleOffset,
      },
      direction,
      speed: this.stats.shotSpeed,
      damage: this.stats.shotDamage,
      remainingRange: this.stats.weaponRange,
      radius: bulletRadius,
    };
  }
}
