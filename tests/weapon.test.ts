import { describe, expect, it } from 'vitest';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { type Bullet, stepBullet } from '../src/sim/bullet';
import { MatchRng } from '../src/sim/rng';
import type { Arena } from '../src/sim/types';
import { Gun } from '../src/sim/weapon';
import { FixedBrain, NO_SPREAD_STATS, createSimulation, runTicks } from './helpers';

const { tickRate } = MATCH_DEFAULTS;
const TICK = 1 / tickRate;
const COOLDOWN_TICKS = Math.round(NO_SPREAD_STATS.shotCooldown * tickRate);
const ORIGIN = { x: 100, y: 100 };

function createGun(stats = NO_SPREAD_STATS) {
  const gun = new Gun(stats, tickRate);
  const rng = new MatchRng(MATCH_DEFAULTS.seed);
  return { gun, fire: () => gun.fire('ALPHA', ORIGIN, 0, rng, false) };
}

function createBullet(overrides: Partial<Bullet> = {}): Bullet {
  return {
    id: 0,
    ownerId: 'ALPHA',
    position: { x: 100, y: 100 },
    direction: { x: 1, y: 0 },
    speed: NO_SPREAD_STATS.shotSpeed,
    damage: NO_SPREAD_STATS.shotDamage,
    remainingRange: NO_SPREAD_STATS.weaponRange,
    radius: NO_SPREAD_STATS.bulletRadius,
    ...overrides,
  };
}

const EMPTY_ARENA: Arena = { width: 1000, height: 600, obstacles: [], spawns: [] };

describe('Gun', () => {
  it('fires a bullet along the heading from the muzzle', () => {
    const bullet = createGun().fire();
    expect(bullet).not.toBeNull();
    expect(bullet?.direction.x).toBeCloseTo(1);
    expect(bullet?.direction.y).toBeCloseTo(0);
    expect(bullet?.position.x).toBeCloseTo(ORIGIN.x + NO_SPREAD_STATS.radius + NO_SPREAD_STATS.bulletRadius);
    expect(bullet?.damage).toBe(NO_SPREAD_STATS.shotDamage);
  });

  it('cannot fire again until the cooldown has passed', () => {
    const { gun, fire } = createGun();
    expect(fire()).not.toBeNull();
    expect(fire()).toBeNull();

    for (let i = 0; i < COOLDOWN_TICKS - 1; i++) gun.tick();
    expect(fire()).toBeNull();

    gun.tick();
    expect(fire()).not.toBeNull();
  });

  it('uses one round per shot and stops when empty', () => {
    const { gun, fire } = createGun({ ...NO_SPREAD_STATS, maxAmmo: 2 });
    for (let shot = 0; shot < 2; shot++) {
      expect(fire()).not.toBeNull();
      for (let i = 0; i < COOLDOWN_TICKS; i++) gun.tick();
    }
    expect(gun.ammo).toBe(0);
    expect(fire()).toBeNull();
  });

  it('scatters a shot fired on the move more, by the moving spread', () => {
    const stats = { ...NO_SPREAD_STATS, shotSpread: 2, movingShotSpread: 10, shotCooldown: 0, maxAmmo: 1000 };
    const gun = new Gun(stats, tickRate);
    const rng = new MatchRng(MATCH_DEFAULTS.seed);
    const deviations = (moving: boolean) =>
      Array.from({ length: 200 }, () => gun.fire('ALPHA', ORIGIN, 0, rng, moving)?.direction.y ?? 0).map(Math.abs);
    const still = deviations(false);
    const onTheMove = deviations(true);
    expect(Math.max(...still)).toBeLessThanOrEqual(Math.sin((2 * Math.PI) / 180) + 1e-9);
    expect(Math.max(...onTheMove)).toBeGreaterThan(Math.sin((2 * Math.PI) / 180));
    expect(Math.max(...onTheMove)).toBeLessThanOrEqual(Math.sin((10 * Math.PI) / 180) + 1e-9);
  });

  it('keeps shots within the spread', () => {
    const stats = { ...NO_SPREAD_STATS, shotSpread: 2, shotCooldown: 0 };
    const { fire } = createGun(stats);
    const maxDeviation = Math.sin((stats.shotSpread * Math.PI) / 180);
    for (let i = 0; i < stats.maxAmmo; i++) {
      expect(Math.abs(fire()?.direction.y ?? Infinity)).toBeLessThanOrEqual(maxDeviation);
    }
  });
});

describe('stepBullet', () => {
  const target = { id: 'BRAVO', position: { x: 110, y: 100 }, radius: NO_SPREAD_STATS.radius };

  it('moves by speed per tick while nothing is in the way', () => {
    const bullet = createBullet();
    const outcome = stepBullet(bullet, TICK, EMPTY_ARENA, []);
    expect(outcome.kind).toBe('flying');
    expect(bullet.position.x).toBeCloseTo(100 + NO_SPREAD_STATS.shotSpeed * TICK);
  });

  it('hits a robot in its path', () => {
    const outcome = stepBullet(createBullet(), TICK, EMPTY_ARENA, [target]);
    expect(outcome).toEqual({ kind: 'hit', targetId: 'BRAVO' });
  });

  it('does not hit its owner', () => {
    const owner = { ...target, id: 'ALPHA' };
    const outcome = stepBullet(createBullet(), TICK, EMPTY_ARENA, [owner]);
    expect(outcome.kind).toBe('flying');
  });

  it('is stopped by an obstacle before reaching a robot behind it', () => {
    const arena: Arena = { ...EMPTY_ARENA, obstacles: [{ x: 102, y: 90, width: 2, height: 20 }] };
    const behind = { ...target, position: { x: 125, y: 100 } };
    const bullet = createBullet({ speed: 1200 });
    const outcome = stepBullet(bullet, TICK, arena, [behind]);
    expect(outcome.kind).toBe('wall');
    expect(bullet.position.x).toBeCloseTo(102);
  });

  it('is stopped by the arena wall', () => {
    const bullet = createBullet({ position: { x: 995, y: 100 } });
    expect(stepBullet(bullet, TICK, EMPTY_ARENA, []).kind).toBe('wall');
  });

  it('expires after travelling the weapon range', () => {
    const bullet = createBullet();
    let ticks = 0;
    while (stepBullet(bullet, TICK, EMPTY_ARENA, []).kind === 'flying') ticks++;
    expect(bullet.position.x).toBeCloseTo(100 + NO_SPREAD_STATS.weaponRange);
    expect(ticks).toBeLessThanOrEqual(Math.ceil(NO_SPREAD_STATS.weaponRange / (NO_SPREAD_STATS.shotSpeed * TICK)));
  });
});

describe('damage', () => {
  it('reduces the target HP by the shot damage on each hit', () => {
    const simulation = createSimulation([new FixedBrain({ fire: true }), new FixedBrain()]);
    const [, target] = simulation.robots;

    while (target.hp === NO_SPREAD_STATS.maxHp) simulation.step();
    expect(target.hp).toBe(NO_SPREAD_STATS.maxHp - NO_SPREAD_STATS.shotDamage);

    runTicks(simulation, COOLDOWN_TICKS);
    expect(target.hp).toBe(NO_SPREAD_STATS.maxHp - NO_SPREAD_STATS.shotDamage * 2);
  });
});
