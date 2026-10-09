import { describe, expect, it } from 'vitest';
import { arenaFor } from '../src/arena/match';
import { ARENAS } from '../src/data/arenas';
import { CENTER_BLOCK } from '../src/data/arenas/center_block';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { STANDARD_LOADOUT, statsOf } from '../src/data/parts';
import { ROBOT_DEFAULTS, type RobotStats } from '../src/data/robot_defaults';
import { RECIPES } from '../src/help/recipes';
import type { RobotBrain } from '../src/sim/ai_context';
import type { Simulation } from '../src/sim/simulation';
import type { Arena, SpawnPoint } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, compileBrain, createSimulation, enemySource, runTicks } from './helpers';

// The recipes of the help do what their texts say.

const { tickRate } = MATCH_DEFAULTS;

function recipe(id: string): string {
  const found = RECIPES.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No recipe "${id}"`);
  return found.code;
}

/** The recipe against an enemy, in an open field unless an arena is given; ALPHA starts facing right. */
function match(
  source: string,
  enemy: RobotBrain,
  { alpha = { x: 200, y: 300, rotation: 0 }, bravo = { x: 800, y: 300, rotation: 180 }, arena = DUEL_ARENA, stats = ROBOT_DEFAULTS, enemyStats = ROBOT_DEFAULTS }: {
    alpha?: SpawnPoint;
    bravo?: SpawnPoint;
    arena?: Arena;
    stats?: RobotStats;
    enemyStats?: RobotStats;
  } = {},
): Simulation {
  const brain = compileBrain(source);
  return createSimulation([brain, enemy], {
    arena: { ...arena, spawns: [alpha, bravo] },
    robots: [
      { id: 'ALPHA', brain, stats },
      { id: 'BRAVO', brain: enemy, stats: enemyStats },
    ],
  });
}

function distance(simulation: Simulation): number {
  const [a, b] = simulation.robots;
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

/** A robot that stands still and shoots at whatever it sees. */
const SHOOTER = `loop
    if aim_angle > 2 or aim_angle < -2
        aim enemy
    else
        fire`;

interface Tally {
  shots: number;
  hits: number;
  hitsTaken: number;
  damageTaken: number;
}

/** How the program fares against some built-in robots over the maps. */
function tally(source: string, enemies: readonly string[], seeds: readonly number[] = [1, 2]): Tally {
  const total: Tally = { shots: 0, hits: 0, hitsTaken: 0, damageTaken: 0 };
  for (const enemy of enemies) {
    for (const { arena } of ARENAS) {
      for (const seed of seeds) {
        const simulation = createSimulation([compileBrain(source), compileBrain(enemySource(enemy))], {
          arena: arenaFor(arena, seed, 2),
          stats: ROBOT_DEFAULTS,
          seed,
        });
        const [a, b] = simulation.robots;
        while (simulation.result === null) {
          const ammo = a.weapon.ammo;
          const [hpA, hpB] = [a.hp, b.hp];
          simulation.step();
          if (a.weapon.ammo < ammo) total.shots++;
          if (b.hp < hpB) total.hits++;
          if (a.hp < hpA) total.hitsTaken++;
        }
        total.damageTaken += ROBOT_DEFAULTS.maxHp - a.hp;
      }
    }
  }
  return total;
}

const hitRate = ({ shots, hits }: Tally) => hits / shots;

describe('the recipes of the help: the flow of the program', () => {
  it('once: turns 90 degrees left at the start, and never again', () => {
    const simulation = match(recipe('once'), new FixedBrain(), { bravo: { x: 200, y: 100, rotation: 0 } });
    runTicks(simulation, 15);
    expect(simulation.robots[0].rotation).toBeCloseTo(-90);
    runTicks(simulation, 60);
    expect(simulation.robots[0].rotation).toBeCloseTo(-90);
  });

  it('wait-seconds: drives for 2 seconds, then stops', () => {
    const simulation = match(recipe('wait-seconds'), new FixedBrain(), { bravo: { x: 800, y: 100, rotation: 0 } });
    runTicks(simulation, 3 * tickRate);
    expect(simulation.robots[0].position.x).toBeCloseTo(200 + 2 * ROBOT_DEFAULTS.moveSpeed);
  });

  it('every: turns 90 degrees right every 90 ticks, and only then', () => {
    const simulation = match(recipe('every'), new FixedBrain(), { bravo: { x: 500, y: 550, rotation: 0 } });
    runTicks(simulation, 89);
    expect(simulation.robots[0].rotation).toBeCloseTo(0);
    runTicks(simulation, 15);
    expect(simulation.robots[0].rotation).toBeCloseTo(90);
  });

  it('search: turns while it sees nothing, and leaves the while to shoot the moment it sees the enemy', () => {
    const scope = { ...ROBOT_DEFAULTS, sensorAngle: 120 };
    const simulation = match(recipe('search'), new FixedBrain(), { stats: scope, alpha: { x: 500, y: 300, rotation: 0 }, bravo: { x: 200, y: 300, rotation: 0 } });
    const robot = simulation.robots[0];
    simulation.step();
    expect(robot.label).toBe('SEARCH');
    let shot = false;
    for (let tick = 0; tick < 3 * tickRate && !shot; tick++) {
      const ammo = robot.weapon.ammo;
      simulation.step();
      shot = robot.weapon.ammo < ammo;
    }
    expect(shot).toBe(true);
    expect(robot.label).toBe('FIGHT');
  });

  it('mode: charges in until the third hit, then keeps away for good', () => {
    const simulation = match(recipe('mode'), compileBrain(SHOOTER));
    const robot = simulation.robots[0];
    let hits = 0;
    for (let tick = 0; tick < 20 * tickRate && hits < 3; tick++) {
      const hp = robot.hp;
      simulation.step();
      if (robot.hp < hp) hits++;
      if (hits < 3) expect(robot.label).toBe('CHARGE');
    }
    expect(hits).toBe(3);
    for (let tick = 0; tick < 5 * tickRate && simulation.result === null; tick++) {
      simulation.step();
      expect(robot.label).toBe('KEEP_AWAY');
    }
  });
});

describe('the recipes of the help: random turns', () => {
  /** The robot's heading every 2 seconds, just before each turn, over a match on a seed. */
  function headings(seed: number): number[] {
    const simulation = createSimulation([compileBrain(recipe('random-turn')), new FixedBrain()], {
      seed,
      arena: { ...DUEL_ARENA, spawns: [{ x: 500, y: 300, rotation: 0 }, { x: 950, y: 560, rotation: 180 }] },
    });
    const seen: number[] = [];
    for (let tick = 1; tick <= 12 * tickRate; tick++) {
      simulation.step();
      if (tick % (2 * tickRate) === 0) seen.push(Math.round(simulation.robots[0].rotation));
    }
    return seen;
  }

  it('random-turn: turns a different way each time, and the same way in the same match', () => {
    const first = headings(5);
    expect(headings(5)).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(3);
    expect(headings(6)).not.toEqual(first);
  });
});

describe('the recipes of the help: moving', () => {
  it('distance: closes in on a far enemy, backs off from a near one, and stays between', () => {
    const far = match(recipe('distance'), new FixedBrain(), { bravo: { x: 900, y: 300, rotation: 180 } });
    runTicks(far, 10 * tickRate);
    expect(distance(far)).toBeLessThanOrEqual(ROBOT_DEFAULTS.weaponRange - 50);
    expect(distance(far)).toBeGreaterThanOrEqual(200);

    const near = match(recipe('distance'), new FixedBrain(), { alpha: { x: 450, y: 300, rotation: 0 }, bravo: { x: 550, y: 300, rotation: 180 } });
    runTicks(near, 10 * tickRate);
    expect(distance(near)).toBeGreaterThanOrEqual(200);
  });

  it('around: goes round the block to an enemy behind it, and gets it in range', () => {
    const simulation = match(recipe('around'), new FixedBrain(), {
      arena: CENTER_BLOCK,
      alpha: { x: 120, y: 300, rotation: 0 },
      bravo: { x: 880, y: 300, rotation: 180 },
    });
    let inRange = false;
    for (let tick = 0; tick < 20 * tickRate && !inRange; tick++) {
      simulation.step();
      inRange = simulation.robots[0].sensorReading.enemyVisible && distance(simulation) < ROBOT_DEFAULTS.weaponRange;
    }
    expect(inRange).toBe(true);
  });

  it('dodge: is hit much less often than the same robot standing still', () => {
    const enemies = ['sentry_bot', 'dumb_bot', 'strafe_bot'];
    expect(tally(recipe('dodge'), enemies).hitsTaken).toBeLessThan(0.7 * tally(SHOOTER, enemies).hitsTaken);
  });

  it('circle: goes round a standing enemy, shooting all the way', () => {
    const open: Arena = { width: 1000, height: 1000, obstacles: [], spawns: [] };
    const simulation = match(recipe('circle'), new FixedBrain(), { arena: open, alpha: { x: 200, y: 500, rotation: 0 }, bravo: { x: 500, y: 500, rotation: 0 } });
    const [self, other] = simulation.robots;
    const bearing = () => Math.atan2(self.position.y - other.position.y, self.position.x - other.position.x);
    let turned = 0;
    let shots = 0;
    for (let tick = 0; tick < 20 * tickRate; tick++) {
      const before = bearing();
      const ammo = self.weapon.ammo;
      simulation.step();
      let step = bearing() - before;
      if (step > Math.PI) step -= 2 * Math.PI;
      if (step < -Math.PI) step += 2 * Math.PI;
      turned += step;
      if (self.weapon.ammo < ammo) shots++;
      if (tick > 5 * tickRate) expect(distance(simulation)).toBeLessThan(ROBOT_DEFAULTS.weaponRange);
    }
    expect(Math.abs(turned)).toBeGreaterThan(1.5 * Math.PI);
    expect(shots).toBeGreaterThan(5);
  });

  it('walls: drives about for half a minute and never runs into a wall', () => {
    // The enemy stands in the middle, off the way round along the walls: a robot is not a wall to wall_ahead.
    const simulation = match(recipe('walls'), new FixedBrain(), { alpha: { x: 700, y: 300, rotation: 0 }, bravo: { x: 450, y: 300, rotation: 0 } });
    const robot = simulation.robots[0];
    let travelled = 0;
    for (let tick = 0; tick < 30 * tickRate; tick++) {
      const { x, y } = robot.position;
      simulation.step();
      travelled += Math.hypot(robot.position.x - x, robot.position.y - y);
      expect(robot.blocked).toBe(false);
    }
    expect(travelled).toBeGreaterThan(20 * ROBOT_DEFAULTS.moveSpeed);
  });

  it('stick: closes in until touching, then hardly ever misses', () => {
    const simulation = match(recipe('stick'), compileBrain(SHOOTER), { bravo: { x: 600, y: 300, rotation: 180 } });
    const [self, other] = simulation.robots;
    let shots = 0;
    let hits = 0;
    for (let tick = 0; tick < 15 * tickRate && simulation.result === null; tick++) {
      const ammo = self.weapon.ammo;
      const hp = other.hp;
      simulation.step();
      if (self.label !== 'STICK') continue;
      if (self.weapon.ammo < ammo) shots++;
      if (other.hp < hp) hits++;
    }
    expect(shots).toBeGreaterThan(3);
    expect(hits / shots).toBeGreaterThan(0.9);
  });
});

describe('the recipes of the help: the legs with a way of fighting of their own', () => {
  /** The recipe on the given legs, against some robots of standard parts, counting its shots and hits. */
  function runs(id: string, legs: string) {
    const stats = statsOf({ ...STANDARD_LOADOUT, legs });
    let shots = 0;
    let movingShots = 0;
    let hits = 0;
    for (const enemy of ['dumb_bot', 'sentry_bot']) {
      for (const { arena } of ARENAS) {
        for (const seed of [1, 2]) {
          const brain = compileBrain(recipe(id));
          const simulation = createSimulation([brain, compileBrain(enemySource(enemy))], {
            arena: arenaFor(arena, seed, 2),
            seed,
            robots: [
              { id: 'ALPHA', brain, stats },
              { id: 'BRAVO', brain: compileBrain(enemySource(enemy)), stats: ROBOT_DEFAULTS },
            ],
          });
          const [self, other] = simulation.robots;
          while (simulation.result === null) {
            const ammo = self.weapon.ammo;
            const hp = other.hp;
            simulation.step();
            if (self.weapon.ammo < ammo) {
              shots++;
              if (self.moved) movingShots++;
            }
            if (other.hp < hp) hits++;
          }
        }
      }
    }
    return { shots, movingShots, hitRate: hits / shots };
  }

  it('hover-run: shoots on the move, and hits more on the Hover than the same program on Standard legs', () => {
    const hover = runs('hover-run', 'hover');
    expect(hover.movingShots / hover.shots).toBeGreaterThan(0.9);
    expect(hover.hitRate).toBeGreaterThan(1.1 * runs('hover-run', 'standard').hitRate);
  });

  it('walker-march: fires on the way in, and hits more on the Walker than the same program on Standard legs', () => {
    const walker = runs('walker-march', 'walker');
    expect(walker.movingShots / walker.shots).toBeGreaterThan(0.55);
    expect(walker.hitRate).toBeGreaterThan(1.1 * runs('walker-march', 'standard').hitRate);
  });
});

describe('the recipes of the help: looking for the enemy', () => {
  it('last-seen: loses an enemy that runs out of its sight, drives to where it was, and finds it again', () => {
    const shortSighted = { ...ROBOT_DEFAULTS, sensorRange: 300 };
    // Runs right for 3 seconds, out of ALPHA's sight, and stops there.
    const runner = compileBrain('drive forward\nset n = 0\nwhile n < 90\n    wait\n    set n = n + 1\ndrive stop\nloop\n    wait');
    const simulation = match(recipe('last-seen'), runner, { stats: shortSighted, bravo: { x: 400, y: 300, rotation: 0 } });
    const labels: string[] = [];
    for (let tick = 0; tick < 15 * tickRate && labels.join() !== 'FIGHT,CHASE,FIGHT'; tick++) {
      simulation.step();
      if (simulation.robots[0].label !== labels.at(-1)) labels.push(simulation.robots[0].label);
    }
    expect(labels).toEqual(['FIGHT', 'CHASE', 'FIGHT']);
  });

  it('look-around: turns all the way round, then drives on and looks again', () => {
    const shortSighted = { ...ROBOT_DEFAULTS, sensorRange: 300 };
    const simulation = match(recipe('look-around'), new FixedBrain(), { stats: shortSighted, alpha: { x: 300, y: 300, rotation: 0 }, bravo: { x: 950, y: 560, rotation: 0 } });
    const robot = simulation.robots[0];
    const labels: string[] = [];
    for (let tick = 0; tick < 5 * tickRate; tick++) {
      simulation.step();
      if (robot.label !== labels.at(-1)) labels.push(robot.label);
    }
    expect(labels).toEqual(['LOOK', 'MOVE', 'LOOK']);
    expect(robot.position.x).toBeGreaterThan(300 + ROBOT_DEFAULTS.moveSpeed);

    // An enemy behind, out of a Scope's cone: the look round finds it.
    const scope = { ...ROBOT_DEFAULTS, sensorAngle: 120 };
    const behind = match(recipe('look-around'), new FixedBrain(), { stats: scope, alpha: { x: 500, y: 300, rotation: 0 }, bravo: { x: 200, y: 300, rotation: 0 } });
    runTicks(behind, 3 * tickRate);
    expect(behind.robots[0].label).toBe('FIGHT');
  });
});

describe('the recipes of the help: aiming and shooting', () => {
  it('aimed: hits far more often than shooting without waiting for the aim', () => {
    const plain = 'loop\n    aim enemy\n    fire';
    // Against robots that stop to fight. One that keeps driving across is for aiming ahead of it (lead).
    const enemies = ['dumb_bot', 'sentry_bot'];
    expect(hitRate(tally(recipe('aimed'), enemies))).toBeGreaterThan(1.5 * hitRate(tally(plain, enemies)));
  });

  it('stop-to-fire: never shoots on the move, and hits far more often than shooting on the move', () => {
    const simulation = match(recipe('stop-to-fire'), new FixedBrain(), { bravo: { x: 800, y: 500, rotation: 0 } });
    const robot = simulation.robots[0];
    let shots = 0;
    for (let tick = 0; tick < 20 * tickRate; tick++) {
      const ammo = robot.weapon.ammo;
      simulation.step();
      if (robot.weapon.ammo < ammo) {
        shots++;
        expect(robot.moved).toBe(false);
      }
    }
    expect(shots).toBeGreaterThan(5);

    const onTheMove = recipe('stop-to-fire').replace('        drive stop\n', '');
    const enemies = ['dumb_bot', 'sentry_bot'];
    expect(hitRate(tally(recipe('stop-to-fire'), enemies))).toBeGreaterThan(1.5 * hitRate(tally(onTheMove, enemies)));
  });

  it('lead: hits a robot driving across more often than aiming at it', () => {
    const enemies = ['strafe_bot'];
    expect(hitRate(tally(recipe('lead'), enemies, [1, 2, 3]))).toBeGreaterThan(hitRate(tally(recipe('aimed'), enemies, [1, 2, 3])));
  });

  it('low-ammo: with under 10 bullets, holds its fire until 150 away', () => {
    const fewBullets = { ...ROBOT_DEFAULTS, maxAmmo: 5 };
    const simulation = match(recipe('low-ammo'), new FixedBrain(), { stats: fewBullets });
    let firstShotFrom: number | null = null;
    for (let tick = 0; tick < 20 * tickRate && firstShotFrom === null; tick++) {
      const ammo = simulation.robots[0].weapon.ammo;
      simulation.step();
      if (simulation.robots[0].weapon.ammo < ammo) firstShotFrom = distance(simulation);
    }
    expect(firstShotFrom).not.toBeNull();
    expect(firstShotFrom!).toBeLessThan(150);

    const plenty = match(recipe('low-ammo'), new FixedBrain());
    runTicks(plenty, 5 * tickRate);
    expect(plenty.robots[0].weapon.ammo).toBeLessThan(ROBOT_DEFAULTS.maxAmmo);
  });

  it('in-range: never fires at an enemy out of reach, and fires once it is in reach', () => {
    const simulation = match(recipe('in-range'), new FixedBrain());
    const robot = simulation.robots[0];
    let shots = 0;
    for (let tick = 0; tick < 15 * tickRate && simulation.result === null; tick++) {
      const ammo = robot.weapon.ammo;
      simulation.step();
      if (robot.weapon.ammo < ammo) {
        shots++;
        expect(distance(simulation)).toBeLessThanOrEqual(ROBOT_DEFAULTS.weaponRange);
      }
    }
    expect(shots).toBeGreaterThan(3);
  });
});

describe('the recipes of the help: defending', () => {
  it('guard: guards only on the ticks a bullet hits', () => {
    const simulation = match(recipe('guard'), compileBrain(SHOOTER), { bravo: { x: 500, y: 300, rotation: 180 } });
    const robot = simulation.robots[0];
    let guarded = 0;
    while (simulation.result === null && robot.guardsLeft > 0) {
      const hp = robot.hp;
      simulation.step();
      if (robot.guarding) {
        guarded++;
        expect(robot.hp).toBeLessThan(hp);
      }
    }
    expect(guarded).toBe(ROBOT_DEFAULTS.maxGuards);
  });

  it('face-hit: a robot that sees only ahead, shot from behind, turns to the shooter and sees it', () => {
    const scope = { ...ROBOT_DEFAULTS, sensorAngle: 120 };
    // Without looking round (wait for turn left), only face hit can bring the shooter into sight.
    const seesTheShooter = (source: string) => {
      const simulation = match(source, compileBrain(SHOOTER), {
        stats: scope,
        alpha: { x: 600, y: 300, rotation: 0 },
        bravo: { x: 300, y: 300, rotation: 0 },
      });
      for (let tick = 0; tick < 5 * tickRate; tick++) {
        simulation.step();
        if (simulation.robots[0].sensorReading.enemyVisible) return true;
      }
      return false;
    };
    const notLookingRound = recipe('face-hit').replace('turn left', 'wait');
    expect(seesTheShooter(notLookingRound)).toBe(true);
    expect(seesTheShooter(notLookingRound.replace('    if hit\n        face hit\n', ''))).toBe(false);
  });

  it('peek: takes much less damage than the same robot without hiding', () => {
    // The recipe less its first two branches, the ones that hide while the gun gets ready.
    const lines = recipe('peek').split('\n');
    const noHiding = [lines[0], lines[8].replace('else if', 'if'), ...lines.slice(9)].join('\n');
    const enemies = ['dumb_bot', 'sentry_bot', 'strafe_bot'];
    expect(tally(recipe('peek'), enemies).damageTaken).toBeLessThan(0.7 * tally(noHiding, enemies).damageTaken);
  });

  it('flee: runs behind the block out of the enemy\'s sight, and in the open backs away facing it', () => {
    const behind = match(recipe('flee'), compileBrain(SHOOTER), {
      arena: CENTER_BLOCK,
      alpha: { x: 500, y: 120, rotation: 0 },
      bravo: { x: 500, y: 520, rotation: 180 },
    });
    let hid = false;
    for (let tick = 0; tick < 10 * tickRate && !hid; tick++) {
      behind.step();
      hid = behind.robots[0].hidden;
    }
    expect(hid).toBe(true);

    // Room to back into: the wall is 600 behind it.
    const open = match(recipe('flee'), compileBrain(SHOOTER), { alpha: { x: 600, y: 300, rotation: 0 }, bravo: { x: 800, y: 300, rotation: 180 } });
    const start = distance(open);
    runTicks(open, 2 * tickRate);
    expect(distance(open)).toBeGreaterThan(start + 100);
    expect(open.robots[0].label).toBe('BACK_OFF');
  });

  it('hide: hurt, goes into hiding and gets back to 180 HP', () => {
    const simulation = match(recipe('hide'), compileBrain(SHOOTER), {
      arena: CENTER_BLOCK,
      alpha: { x: 500, y: 120, rotation: 0 },
      bravo: { x: 500, y: 520, rotation: 180 },
    });
    const robot = simulation.robots[0];
    robot.hp = 100;
    let hid = false;
    for (let tick = 0; tick < 15 * tickRate && robot.hp < 180; tick++) {
      simulation.step();
      hid ||= robot.hidden;
    }
    expect(hid).toBe(true);
    expect(robot.hp).toBeGreaterThanOrEqual(180);
  });
});

describe('the recipes of the help: making it easy to follow', () => {
  it('label: names what the robot does, as it changes', () => {
    const simulation = match(recipe('label'), new FixedBrain(), {
      arena: CENTER_BLOCK,
      alpha: { x: 120, y: 300, rotation: 0 },
      bravo: { x: 880, y: 300, rotation: 180 },
    });
    const labels: string[] = [];
    for (let tick = 0; tick < 20 * tickRate && labels.at(-1) !== 'ATTACK'; tick++) {
      simulation.step();
      if (simulation.robots[0].label !== labels.at(-1)) labels.push(simulation.robots[0].label);
    }
    // Up to the block, round it, and on to the enemy.
    expect(labels[0]).toBe('APPROACH');
    expect(labels).toContain('AROUND');
    expect(labels.at(-1)).toBe('ATTACK');
  });
});

describe('the recipes of the help: as a team', () => {
  /** A 2 v 2 castle match: the recipe on both player machines, sitting ducks on the other side. */
  function castleMatch(source: string, stats: [RobotStats, RobotStats]): Simulation {
    const brainA = compileBrain(source);
    const brainB = compileBrain(source);
    const bases = [
      { team: 0, rect: { x: 960, y: 220, width: 40, height: 160 }, maxHp: 300 },
      { team: 1, rect: { x: 0, y: 220, width: 40, height: 160 }, maxHp: 300 },
    ];
    return createSimulation([brainA, new FixedBrain()], {
      arena: { ...DUEL_ARENA, spawns: [
        { x: 850, y: 200, rotation: 180 },
        { x: 850, y: 400, rotation: 180 },
        { x: 150, y: 200, rotation: 0 },
        { x: 150, y: 400, rotation: 0 },
      ] },
      robots: [
        { id: 'ALPHA-1', brain: brainA, stats: stats[0] },
        { id: 'ALPHA-2', brain: brainB, stats: stats[1] },
        { id: 'BRAVO-1', brain: new FixedBrain(), stats: ROBOT_DEFAULTS },
        { id: 'BRAVO-2', brain: new FixedBrain(), stats: ROBOT_DEFAULTS },
      ],
      teams: [0, 0, 1, 1],
      bases,
    });
  }

  it('call-team: the one that sees calls, and the one that does not answers the call', () => {
    // Machine 1 sees the enemies (standard sensor); machine 2 is short-sighted and sees nothing from the start line.
    const shortSighted: RobotStats = { ...ROBOT_DEFAULTS, sensorRange: 300 };
    const simulation = castleMatch(recipe('call-team'), [ROBOT_DEFAULTS, shortSighted]);
    runTicks(simulation, 3);
    const [seer, helper] = simulation.robots;
    expect(seer.teamSense.allySignal === 1 || seer.action?.signal === 1).toBe(true);
    expect(helper.teamSense.allySignal).toBe(1);
    // The helper heads for its teammate: after a while it has closed the gap between them.
    const apart = () => Math.hypot(seer.position.x - helper.position.x, seer.position.y - helper.position.y);
    const before = apart();
    runTicks(simulation, 60);
    expect(apart()).toBeLessThan(before);
  });

  it('equip-roles: the far-sighted machine stands watch while the short-sighted one marches', () => {
    const shortSighted: RobotStats = { ...ROBOT_DEFAULTS, sensorRange: 300 };
    const simulation = castleMatch(recipe('equip-roles'), [ROBOT_DEFAULTS, shortSighted]);
    const watcherStart = { ...simulation.robots[0].position };
    runTicks(simulation, 45);
    const [watcher, pusher] = simulation.robots;
    expect(watcher.label).toBe('WATCHER');
    expect(Math.hypot(watcher.position.x - watcherStart.x, watcher.position.y - watcherStart.y)).toBeLessThan(1);
    expect(pusher.label).toBe('MARCH');
    // The pusher marched west, towards the enemy castle.
    expect(pusher.position.x).toBeLessThan(800);
  });
  it('finish-base: keeps home while enemies are left, and takes the enemy base once they are all down', () => {
    const simulation = castleMatch(recipe('finish-base'), [ROBOT_DEFAULTS, ROBOT_DEFAULTS]);
    const [first] = simulation.robots;
    runTicks(simulation, 3 * tickRate);
    expect(first.label).toBe('GUARD');
    expect(simulation.bases[1].hp).toBe(simulation.bases[1].maxHp);
    // Every enemy down.
    simulation.robots[2].hp = 0;
    simulation.robots[3].hp = 0;
    runTicks(simulation, 2);
    expect(first.label).toBe('MARCH');
    runTicks(simulation, 15 * tickRate);
    expect(simulation.bases[1].hp).toBeLessThan(simulation.bases[1].maxHp);
  });

  it('last-one: attacks with company, and goes home to hold the base once alone', () => {
    const simulation = castleMatch(recipe('last-one'), [ROBOT_DEFAULTS, ROBOT_DEFAULTS]);
    const [first] = simulation.robots;
    runTicks(simulation, 2 * tickRate);
    expect(first.label).toBe('MARCH');
    simulation.robots[1].hp = 0;
    runTicks(simulation, 2);
    expect(first.label).toBe('GO_HOME');
    runTicks(simulation, 10 * tickRate);
    expect(first.label).toBe('HOLD');
    expect(first.teamSense.baseDistance).toBeLessThanOrEqual(150);
  });

  it('defend-base: marches while the base is untouched, and goes back to guard it once it is hit', () => {
    // Both machines, from mirrored places: turning on the spot, they go home side by side without meeting.
    const simulation = castleMatch(recipe('defend-base'), [ROBOT_DEFAULTS, ROBOT_DEFAULTS]);
    const team = simulation.robots.slice(0, 2);
    runTicks(simulation, 2 * tickRate);
    expect(team.map((robot) => robot.label)).toEqual(['MARCH', 'MARCH']);
    simulation.bases[0].hp -= 20;
    runTicks(simulation, 2);
    expect(team.map((robot) => robot.label)).toEqual(['RETURN', 'RETURN']);
    runTicks(simulation, 10 * tickRate);
    expect(team.map((robot) => robot.label)).toEqual(['DEFEND', 'DEFEND']);
    for (const robot of team) expect(robot.teamSense.baseDistance).toBeLessThanOrEqual(200);
  });

  it('call-by-name: the keeper calls machine 2 alone; machine 3 never hears it and marches on', () => {
    const brains = [0, 1, 2].map(() => compileBrain(recipe('call-by-name')));
    const simulation = createSimulation([brains[0], new FixedBrain()], {
      arena: { ...DUEL_ARENA, spawns: [
        { x: 850, y: 300, rotation: 180 },
        { x: 850, y: 120, rotation: 180 },
        { x: 850, y: 480, rotation: 180 },
        // One enemy within the keeper's reach, one far away.
        { x: 550, y: 300, rotation: 0 },
        { x: 100, y: 500, rotation: 0 },
      ] },
      robots: [
        { id: 'ALPHA-1', brain: brains[0], stats: ROBOT_DEFAULTS },
        { id: 'ALPHA-2', brain: brains[1], stats: ROBOT_DEFAULTS },
        { id: 'ALPHA-3', brain: brains[2], stats: ROBOT_DEFAULTS },
        { id: 'BRAVO-1', brain: new FixedBrain(), stats: ROBOT_DEFAULTS },
        { id: 'BRAVO-2', brain: new FixedBrain(), stats: ROBOT_DEFAULTS },
      ],
      teams: [0, 0, 0, 1, 1],
      bases: [
        { team: 0, rect: { x: 960, y: 220, width: 40, height: 160 }, maxHp: 300 },
        { team: 1, rect: { x: 0, y: 220, width: 40, height: 160 }, maxHp: 300 },
      ],
    });
    runTicks(simulation, tickRate);
    const [keeper, second, third] = simulation.robots;
    expect(keeper.label).toBe('KEEPER');
    expect(second.teamSense.allySignal).toBe(1);
    expect(second.teamSense.allySignalFrom).toBe(1);
    expect(second.label).toBe('HELP');
    expect(third.teamSense.allySignal).toBe(0);
    expect(third.label).toBe('MARCH');
    // Machine 2 settles by the base to guard it, not against it.
    runTicks(simulation, 8 * tickRate);
    expect(second.teamSense.baseDistance).toBeLessThanOrEqual(150);
    expect(second.blocked).toBe(false);
  });
});
