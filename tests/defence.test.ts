import { describe, expect, it } from 'vitest';
import { parse } from '../src/ai/parser';
import { OPEN_FIELD } from '../src/data/arenas/open_field';
import { DebugLogger } from '../src/debug/debug_logger';
import { captureSnapshot } from '../src/debug/snapshot';
import type { AIContext, RobotBrain } from '../src/sim/ai_context';
import { createIdleAction } from '../src/sim/ai_context';
import type { Bullet } from '../src/sim/bullet';
import { type CoverRoute, coverMapOf, findCover, isHiddenFrom } from '../src/sim/cover';
import { circleIntersectsRect, distance, normalizeAngle, pointRectDistance, segmentRectDistance } from '../src/sim/math';
import { wallDistance } from '../src/sim/range_finder';
import { findIncomingBullet } from '../src/sim/threats';
import type { Arena, Rect, Vec2 } from '../src/sim/types';
import { ARENAS, DEFAULT_ARENA } from '../src/data/arenas';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import {
  DUEL_ARENA,
  FixedBrain,
  NO_SPREAD_STATS,
  QUIET_CONTEXT,
  TIRELESS_GUARD_STATS,
  compileBrain,
  createSimulation,
  runTicks,
} from './helpers';
import { SIDESTEP } from './strategies';

const { radius, bulletRadius, shotDamage, shotSpeed, weaponRange, guardDamageFactor, maxGuards } = NO_SPREAD_STATS;
const HIT_RADIUS = radius + bulletRadius;
const BULLET_STEP = shotSpeed / MATCH_DEFAULTS.tickRate;

function arenaWith(obstacles: Rect[] = []): Arena {
  return { ...DUEL_ARENA, obstacles };
}

/** Remembers what its robot sensed on each tick, and does nothing. */
class Probe implements RobotBrain {
  readonly contexts: AIContext[] = [];

  decide(context: AIContext) {
    this.contexts.push(context);
    return createIdleAction();
  }
}

describe('findIncomingBullet', () => {
  const robot = { x: 300, y: 300 };
  const bullet = (overrides: Partial<Bullet> = {}): Bullet => ({
    id: 0,
    ownerId: 'BRAVO',
    position: { x: 100, y: 300 },
    direction: { x: 1, y: 0 },
    speed: shotSpeed,
    damage: shotDamage,
    remainingRange: weaponRange,
    ...overrides,
  });
  const incoming = (bullets: Bullet[], arena = arenaWith()) =>
    findIncomingBullet(bullets, 'ALPHA', robot, HIT_RADIUS, arena);

  it('finds a bullet flying straight at the robot', () => {
    const shot = bullet();
    expect(incoming([shot])).toBe(shot);
  });

  it('counts a bullet that will graze the robot, but not one that passes it', () => {
    expect(incoming([bullet({ position: { x: 100, y: 300 + HIT_RADIUS - 1 } })])).not.toBeNull();
    expect(incoming([bullet({ position: { x: 100, y: 300 + HIT_RADIUS + 1 } })])).toBeNull();
  });

  it('ignores a bullet flying away', () => {
    expect(incoming([bullet({ direction: { x: -1, y: 0 } })])).toBeNull();
  });

  it('ignores a bullet that an obstacle will stop first', () => {
    const between: Rect = { x: 180, y: 280, width: 40, height: 40 };
    const beyond: Rect = { x: 400, y: 280, width: 40, height: 40 };
    expect(incoming([bullet()], arenaWith([between]))).toBeNull();
    expect(incoming([bullet()], arenaWith([beyond]))).not.toBeNull();
  });

  it('ignores a bullet that runs out of range before it arrives', () => {
    const gap = robot.x - 100 - HIT_RADIUS;
    expect(incoming([bullet({ remainingRange: gap - 1 })])).toBeNull();
    expect(incoming([bullet({ remainingRange: gap + 1 })])).not.toBeNull();
  });

  it('ignores the bullets of the robot itself', () => {
    expect(incoming([bullet({ ownerId: 'ALPHA' })])).toBeNull();
  });

  it('picks the nearest of several', () => {
    const far = bullet({ id: 1 });
    const near = bullet({ id: 2, position: { x: 200, y: 300 } });
    const passing = bullet({ id: 3, position: { x: 250, y: 400 } });
    expect(incoming([far, near, passing])).toBe(near);
  });
});

describe('bullet sensors', () => {
  it('tell a robot the distance and direction of the bullet coming at it', () => {
    const probe = new Probe();
    const simulation = createSimulation([probe, new FixedBrain({ fire: true })]);
    runTicks(simulation, 2);

    // Fired on the first tick from the muzzle, and flown for that one tick.
    const [alpha, bravo] = DUEL_ARENA.spawns;
    const bulletX = bravo.x - HIT_RADIUS - BULLET_STEP;
    expect(probe.contexts[0]).toMatchObject({ bulletIncoming: false, bulletDistance: 0, bulletAngle: 0 });
    expect(probe.contexts[1].bulletIncoming).toBe(true);
    expect(probe.contexts[1].bulletDistance).toBeCloseTo(bulletX - alpha.x);
    expect(probe.contexts[1].bulletAngle).toBeCloseTo(0);
    expect(simulation.robots[0].surroundings.incomingBullet?.position.x).toBeCloseTo(bulletX);
  });

  it('give the direction relative to the way the robot faces', () => {
    const probe = new Probe();
    const arena: Arena = { ...DUEL_ARENA, spawns: [{ ...DUEL_ARENA.spawns[0], rotation: -90 }, DUEL_ARENA.spawns[1]] };
    const simulation = createSimulation([probe, new FixedBrain({ fire: true })], { arena });
    runTicks(simulation, 2);
    // Facing up the screen, a bullet from the right-hand side of the screen comes from the right.
    expect(probe.contexts[1].bulletAngle).toBeCloseTo(90);
  });

  it('do not report the robot its own bullets', () => {
    const probe = new Probe();
    const simulation = createSimulation([new FixedBrain({ fire: true }), probe]);
    runTicks(simulation, 3);
    expect(simulation.bullets).toHaveLength(1);
    expect(simulation.robots[0].surroundings.incomingBullet).toBeNull();
    expect(probe.contexts[2].bulletIncoming).toBe(true);
  });
});

describe('wallDistance', () => {
  const arena = arenaWith();
  const position = { x: 300, y: 200 };

  it('measures from the edge of the robot to the arena wall', () => {
    expect(wallDistance(arena, position, 0, radius)).toBeCloseTo(arena.width - position.x - radius);
    expect(wallDistance(arena, position, 180, radius)).toBeCloseTo(position.x - radius);
    expect(wallDistance(arena, position, -90, radius)).toBeCloseTo(position.y - radius);
    expect(wallDistance(arena, position, 90, radius)).toBeCloseTo(arena.height - position.y - radius);
  });

  it('measures along the heading, also at an angle', () => {
    expect(wallDistance(arena, position, 45, radius)).toBeCloseTo((arena.height - position.y) * Math.SQRT2 - radius);
  });

  it('stops at the nearest obstacle in the way', () => {
    const near: Rect = { x: 400, y: 150, width: 50, height: 100 };
    const far: Rect = { x: 600, y: 150, width: 50, height: 100 };
    const aside: Rect = { x: 350, y: 300, width: 50, height: 100 };
    expect(wallDistance(arenaWith([far, near, aside]), position, 0, radius)).toBeCloseTo(near.x - position.x - radius);
  });

  it('is 0 for a robot that touches the wall', () => {
    expect(wallDistance(arena, { x: arena.width - radius, y: 200 }, 0, radius)).toBeCloseTo(0);
    expect(wallDistance(arena, { x: arena.width - radius + 0.5, y: 200 }, 0, radius)).toBe(0);
  });
});

describe('wall sensors', () => {
  it('give the free distance ahead, behind, to the left and to the right of the robot', () => {
    // Facing down the screen: the left hand points to the right-hand side of the screen.
    const spawn = { x: 300, y: 200, rotation: 90 };
    const arena: Arena = { ...DUEL_ARENA, spawns: [spawn, { x: 900, y: 500, rotation: 180 }] };
    const probe = new Probe();
    createSimulation([probe, new FixedBrain()], { arena }).step();

    const [context] = probe.contexts;
    expect(context.wallAhead).toBeCloseTo(arena.height - spawn.y - radius);
    expect(context.wallBehind).toBeCloseTo(spawn.y - radius);
    expect(context.wallLeft).toBeCloseTo(arena.width - spawn.x - radius);
    expect(context.wallRight).toBeCloseTo(spawn.x - radius);
  });

  it('do not count the other robot', () => {
    const probe = new Probe();
    createSimulation([probe, new FixedBrain()]).step();
    expect(probe.contexts[0].wallAhead).toBeCloseTo(DUEL_ARENA.width - DUEL_ARENA.spawns[0].x - radius);
  });
});

describe('coverMapOf', () => {
  it('has hiding places just outside the obstacles, where a robot fits', () => {
    for (const arena of [DEFAULT_ARENA, OPEN_FIELD]) {
      const { spots } = coverMapOf(arena, radius);
      expect(spots.length).toBeGreaterThan(0);
      for (const spot of spots) {
        expect(arena.obstacles.some((obstacle) => circleIntersectsRect(spot, radius, obstacle))).toBe(false);
        const nearest = Math.min(...arena.obstacles.map((obstacle) => pointRectDistance(spot, obstacle)));
        expect(nearest).toBeGreaterThanOrEqual(radius);
        expect(nearest).toBeLessThan(radius * 2);
      }
    }
  });

  it('has a point off every corner of every obstacle, linked to those in straight reach', () => {
    const block: Rect = { x: 450, y: 250, width: 100, height: 100 };
    const { corners, cornerLinks } = coverMapOf(arenaWith([block]), radius);
    expect(corners).toHaveLength(4);
    // Each corner point reaches its two neighbours along the sides, but not the one across the block.
    expect(cornerLinks.map((links) => links.length)).toEqual([2, 2, 2, 2]);
  });

  it('leaves out the places where the robot would stick out of the arena', () => {
    const atTheEdge: Rect = { x: 0, y: 200, width: 60, height: 100 };
    const { spots, corners } = coverMapOf(arenaWith([atTheEdge]), radius);
    expect(spots.length).toBeGreaterThan(0);
    expect([...spots, ...corners].every((point) => point.x >= radius)).toBe(true);
  });

  it('is empty without obstacles', () => {
    expect(coverMapOf(arenaWith(), radius)).toMatchObject({ spots: [], corners: [] });
  });

  it('is worked out once per arena', () => {
    expect(coverMapOf(DEFAULT_ARENA, radius)).toBe(coverMapOf(DEFAULT_ARENA, radius));
  });
});

describe('findCover', () => {
  const block: Rect = { x: 450, y: 250, width: 100, height: 100 };
  const arena = arenaWith([block]);
  const threat = { x: 800, y: 300 };
  const coverFor = (position: Vec2) => {
    const cover = findCover(arena, radius, position, threat);
    if (cover === null) throw new Error('Expected cover');
    return cover;
  };
  const canDrive = (from: Vec2, to: Vec2) => segmentRectDistance(from, to, block) >= radius - 1e-6;
  /** Checks that the route can be driven and is as long as it says. */
  function expectDrivable(position: Vec2, cover: CoverRoute): void {
    const points = [position, ...cover.route];
    let length = 0;
    for (let leg = 1; leg < points.length; leg++) {
      expect(canDrive(points[leg - 1], points[leg])).toBe(true);
      length += distance(points[leg - 1], points[leg]);
    }
    expect(cover.distance).toBeCloseTo(length);
    expect(cover.route.at(-1)).toEqual(cover.position);
  }

  it('finds a place behind the obstacle, straight ahead when the way is free', () => {
    const position = { x: 400, y: 150 };
    const cover = coverFor(position);
    expect(isHiddenFrom(arena, threat, cover.position)).toBe(true);
    expect(cover.route).toHaveLength(1);
    expectDrivable(position, cover);
    // No other hiding place in straight reach is nearer.
    const others = coverMapOf(arena, radius).spots.filter(
      (spot) => isHiddenFrom(arena, threat, spot) && canDrive(position, spot),
    );
    expect(Math.min(...others.map((spot) => distance(position, spot)))).toBeCloseTo(cover.distance);
  });

  it('leads around the corners of the obstacle when the hiding place is behind it', () => {
    // Between the threat and the block: every hiding place is on the far side.
    const position = { x: 700, y: 300 };
    const cover = coverFor(position);
    expect(isHiddenFrom(arena, threat, cover.position)).toBe(true);
    expect(cover.route.length).toBeGreaterThan(1);
    expectDrivable(position, cover);
    expect(cover.distance).toBeGreaterThan(distance(position, cover.position));
  });

  it('is where the robot stands when it is hidden already', () => {
    const position = { x: 300, y: 300 };
    expect(coverFor(position)).toEqual({ position, distance: 0, route: [] });
  });

  it('is nowhere without obstacles', () => {
    expect(findCover(arenaWith(), radius, { x: 300, y: 300 }, threat)).toBeNull();
  });
});

describe('cover sensors', () => {
  /** Drives to cover and stays there. */
  const HIDE = `loop
    if cover_distance > 0
        if cover_angle > 2 or cover_angle < -2
            drive stop
            turn cover
        else
            drive forward
            wait
    else
        drive stop
        wait
`;

  it('report nothing until the enemy has been seen', () => {
    const probe = new Probe();
    const simulation = createSimulation([probe, new FixedBrain()], { arena: DEFAULT_ARENA });
    simulation.step();
    expect(probe.contexts[0]).toMatchObject({ enemyVisible: false, coverVisible: false, coverDistance: 0, coverAngle: 0 });
    expect(simulation.robots[0].surroundings.cover).toBeNull();
  });

  it('give the length of the way to a hiding place and the direction of its first stretch', () => {
    const probe = new Probe();
    const simulation = createSimulation([probe, new FixedBrain()], { arena: OPEN_FIELD });
    simulation.step();

    const [alpha, bravo] = simulation.robots;
    const cover = alpha.surroundings.cover;
    if (cover === null) throw new Error('Expected cover');
    expect(isHiddenFrom(OPEN_FIELD, bravo.position, cover.position)).toBe(true);
    expect(probe.contexts[0].coverVisible).toBe(true);
    expect(probe.contexts[0].coverDistance).toBe(cover.distance);
    expect(cover.distance).toBeGreaterThanOrEqual(distance(alpha.position, cover.position) - 1e-9);

    const [next] = cover.route;
    const bearing = (Math.atan2(next.y - alpha.position.y, next.x - alpha.position.x) * 180) / Math.PI;
    expect(normalizeAngle(bearing - alpha.rotation)).toBeCloseTo(probe.contexts[0].coverAngle);
  });

  it('take a robot that follows them out of the sight of the enemy, on every map with cover', () => {
    // Bare Ground has nothing to hide behind; in Zigzag a wall stands between the two places used here.
    const withCover = ARENAS.filter(({ id }) => id !== 'bare_ground' && id !== 'zigzag');
    for (const { name, arena } of withCover) {
      // The enemy stands in plain view of the robot, which then goes into hiding.
      const inView: Arena = { ...arena, spawns: [{ x: 640, y: 520, rotation: 180 }, { x: 360, y: 520, rotation: 0 }] };
      const simulation = createSimulation([compileBrain(HIDE), new FixedBrain()], { arena: inView, maxMatchTime: 30 });
      const [alpha, bravo] = simulation.robots;
      simulation.step();
      expect(alpha.sensorReading.enemyVisible, name).toBe(true);

      runTicks(simulation, 30 * MATCH_DEFAULTS.tickRate - 2);
      expect(alpha.sensorReading.enemyVisible, name).toBe(false);
      expect(isHiddenFrom(inView, bravo.position, alpha.position), name).toBe(true);
      expect(alpha.surroundings.cover, name).toMatchObject({ distance: 0, angle: 0, route: [] });
    }
  });
});

describe('guard', () => {
  /** HP of a robot running the given program after the enemy's first shot has hit it. */
  function hpAfterFirstHit(program: string, stats = TIRELESS_GUARD_STATS): number {
    const simulation = createSimulation([compileBrain(program), new FixedBrain({ fire: true })], { stats });
    const [alpha] = simulation.robots;
    while (alpha.hp === NO_SPREAD_STATS.maxHp) simulation.step();
    return alpha.hp;
  }

  const full = NO_SPREAD_STATS.maxHp - shotDamage;
  const guarded = NO_SPREAD_STATS.maxHp - shotDamage * guardDamageFactor;

  it('halves the damage of a hit taken while guarding', () => {
    expect(guardDamageFactor).toBe(0.5);
    expect(hpAfterFirstHit('loop\n    wait')).toBe(full);
    expect(hpAfterFirstHit('loop\n    guard')).toBe(guarded);
  });

  it('only counts on the tick the bullet hits', () => {
    expect(hpAfterFirstHit('guard\nguard\nguard\nloop\n    wait')).toBe(full);
    const timed = `loop\n    if bullet_incoming and bullet_distance < ${HIT_RADIUS + BULLET_STEP}\n        guard\n    else\n        wait`;
    expect(hpAfterFirstHit(timed)).toBe(guarded);
  });

  it('can be used for a few ticks per match only; after that it does nothing', () => {
    expect(maxGuards).toBe(4);
    // Guarding all the time, the guards are gone long before the first bullet arrives.
    expect(hpAfterFirstHit('loop\n    guard', NO_SPREAD_STATS)).toBe(full);

    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain('loop\n    guard'), new FixedBrain()], { logger, maxMatchTime: 1 });
    const left: number[] = [];
    for (let tick = 0; tick < maxGuards + 2; tick++) {
      simulation.step();
      left.push(simulation.robots[0].guardsLeft);
    }
    expect(left).toEqual([3, 2, 1, 0, 0, 0]);
    expect(simulation.robots[0].guarding).toBe(false);
    // Said once, on the first guard that came to nothing.
    const warnings = logger.events.filter((event) => event.type === 'warning');
    expect(warnings).toMatchObject([{ robotId: 'ALPHA', message: 'out of guards', tick: maxGuards + 1, sourceLine: 2 }]);
  });

  it('tells the program how many guards are left', () => {
    const program = 'loop\n    if guards > 2\n        guard\n    else\n        wait';
    const simulation = createSimulation([compileBrain(program), new FixedBrain()], { maxMatchTime: 1 });
    runTicks(simulation, 10);
    expect(simulation.robots[0].guardsLeft).toBe(2);
    expect(captureSnapshot(simulation).robots[0].guards).toBe(2);
  });

  it('does not put off the next shot when there is no guard left to use', () => {
    const logger = new DebugLogger();
    const program = `${'guard\n'.repeat(maxGuards)}fire\nguard\nguard\nloop\n    fire`;
    const simulation = createSimulation([compileBrain(program), new FixedBrain()], { logger, maxMatchTime: 5 });
    runTicks(simulation, 5 * MATCH_DEFAULTS.tickRate - 1);
    const shots = logger.events.filter((event) => event.robotId === 'ALPHA' && event.message === 'fire');
    expect(shots[1].tick - shots[0].tick).toBe(Math.round(NO_SPREAD_STATS.shotCooldown * MATCH_DEFAULTS.tickRate));
  });

  it('puts off the next shot by the recovery time for every tick spent guarding', () => {
    const recoveryTicks = Math.round(NO_SPREAD_STATS.guardRecovery * MATCH_DEFAULTS.tickRate);
    expect(recoveryTicks).toBeGreaterThan(0);

    /** The tick of the robot's second shot when it spends the ticks after the first as given. */
    function secondShotAt(between: string[]): number {
      const logger = new DebugLogger();
      const program = ['fire', ...between, 'loop', '    fire'].join('\n');
      const simulation = createSimulation([compileBrain(program), new FixedBrain()], { logger, maxMatchTime: 5 });
      runTicks(simulation, 5 * MATCH_DEFAULTS.tickRate - 1);
      const shots = logger.events.filter((event) => event.robotId === 'ALPHA' && event.message === 'fire');
      return shots[1].tick;
    }

    const unhindered = secondShotAt(['wait', 'wait']);
    expect(secondShotAt(['guard', 'wait'])).toBe(unhindered + recoveryTicks);
    expect(secondShotAt(['guard', 'guard'])).toBe(unhindered + recoveryTicks * 2);
  });

  it('is an action of its own: the robot does not turn, aim or fire meanwhile', () => {
    const brain = compileBrain('guard\nfire');
    expect(brain.decide(QUIET_CONTEXT)).toMatchObject({
      guard: true,
      drive: null,
      turn: null,
      aim: null,
      fire: false,
      executedLines: [1],
      sourceLines: { guard: 1 },
    });
    expect(brain.decide(QUIET_CONTEXT)).toMatchObject({ guard: false, fire: true });
  });

  it('is recorded with the ticks since the robot last guarded, so that it can be shown fading out', () => {
    const simulation = createSimulation([compileBrain('wait\nguard\nguard\nloop\n    wait'), new FixedBrain()]);
    const ages: (number | null)[] = [];
    for (let tick = 0; tick < 6; tick++) {
      simulation.step();
      ages.push(captureSnapshot(simulation).robots[0].guardAge);
    }
    expect(ages).toEqual([null, 0, 0, 1, 2, 3]);
    expect(captureSnapshot(simulation).robots[1].guardAge).toBeNull();
  });

  it('is logged as an action, and marks the hits it softened', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain('loop\n    guard'), new FixedBrain({ fire: true })], {
      logger,
      stats: TIRELESS_GUARD_STATS,
    });
    while (simulation.robots[0].hp === NO_SPREAD_STATS.maxHp) simulation.step();

    const messages = logger.events.map((event) => `${event.robotId} ${event.type} ${event.message}`);
    expect(messages).toContain('ALPHA action guard');
    expect(messages).toContain(`BRAVO hit ALPHA damage=${shotDamage * guardDamageFactor} hp=${guarded} (guarded)`);
  });
});

describe('dodging', () => {
  /** HP left after 20 seconds in front of an enemy that keeps aiming and firing from the given distance. */
  function hpUnderFire(program: string, gap: number): number {
    const spawns: Arena['spawns'] = [
      { x: 300 + gap, y: 300, rotation: 180 },
      { x: 300, y: 300, rotation: 0 },
    ];
    const simulation = createSimulation([compileBrain(program), new FixedBrain({ turn: 'enemy', fire: true })], {
      arena: { ...DUEL_ARENA, spawns },
      maxMatchTime: 20,
    });
    runTicks(simulation, 20 * MATCH_DEFAULTS.tickRate - 1);
    return simulation.robots[0].hp;
  }

  it('a robot that stays put is destroyed', () => {
    expect(hpUnderFire('loop\n    wait', 300)).toBe(0);
  });

  it('a robot that drives out of the path of each bullet is never hit from the edge of weapon range', () => {
    expect(hpUnderFire(SIDESTEP, 380)).toBe(NO_SPREAD_STATS.maxHp);
  });

  it('from closer by there is less time: it takes a hit or two before it is side-on, then none', () => {
    for (const gap of [300, 200]) {
      const hp = hpUnderFire(SIDESTEP, gap);
      expect(hp).toBeGreaterThanOrEqual(NO_SPREAD_STATS.maxHp - shotDamage * 3);
      expect(hp).toBeLessThan(NO_SPREAD_STATS.maxHp);
    }
  });
});

describe('language: guard, turn cover and the new sensors', () => {
  const errorsOf = (source: string) => parse(source).errors;

  it('parses guard and turn cover', () => {
    expect(parse('guard\nturn cover').program?.body).toEqual([
      { kind: 'guard', line: 1 },
      { kind: 'turn', line: 2, direction: 'cover' },
    ]);
    expect(errorsOf('guard now')).toHaveLength(1);
  });

  it('reads the new sensors in conditions and values', () => {
    const program = `loop
    if bullet_incoming and bullet_distance < 40 and bullet_angle > -90
        guard
    if cover_visible and cover_distance > 5 and cover_angle != 0
        turn cover
    set room = wall_ahead + wall_behind + wall_left + wall_right
    wait
`;
    expect(errorsOf(program)).toEqual([]);

    const brain = compileBrain(program);
    const guarding = brain.decide({ ...QUIET_CONTEXT, bulletIncoming: true, bulletDistance: 30 });
    expect(guarding.guard).toBe(true);
    const turning = brain.decide({ ...QUIET_CONTEXT, coverVisible: true, coverDistance: 50, coverAngle: 20 });
    expect(turning.turn).toBe('cover');
    const waiting = brain.decide({ ...QUIET_CONTEXT, wallAhead: 1, wallBehind: 2, wallLeft: 3, wallRight: 4 });
    expect(waiting.assignments).toMatchObject([{ name: 'room', value: 10 }]);
  });

  it('keeps the new words from being used as variable names', () => {
    for (const name of ['guard', 'bullet_incoming', 'cover_distance', 'wall_left']) {
      expect(errorsOf(`set ${name} = 1`)).toEqual([{ line: 1, message: `"${name}" cannot be used as a variable name` }]);
    }
  });
});

describe('turn cover', () => {
  it('turns the robot towards its cover, and not at all without one', () => {
    const simulation = createSimulation([new FixedBrain({ turn: 'cover' }), new FixedBrain()], { arena: OPEN_FIELD });
    const [alpha] = simulation.robots;
    simulation.step();
    const cover = alpha.surroundings.cover;
    if (cover === null) throw new Error('Expected cover');
    const before = Math.abs(cover.angle);
    simulation.step();
    expect(Math.abs(alpha.surroundings.cover?.angle ?? 0)).toBeLessThan(before);

    const hidden = createSimulation([new FixedBrain({ turn: 'cover' }), new FixedBrain()], { arena: DEFAULT_ARENA });
    const rotation = hidden.robots[0].rotation;
    runTicks(hidden, 5);
    expect(hidden.robots[0].rotation).toBe(rotation);
  });
});
