import { describe, expect, it } from 'vitest';
import { ARENAS, DEFAULT_ARENA } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { findTemplate } from '../src/data/templates';
import { type AIContext, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { brainFor, mirrorAction, mirrorContext, mirrored, readStartSide } from '../src/sim/mirror';
import type { Simulation } from '../src/sim/simulation';
import { FixedBrain, NO_SPREAD_STATS, QUIET_CONTEXT, compileBrain, createSimulation, runTicks, runToEnd } from './helpers';

const SENSED: AIContext = {
  ...QUIET_CONTEXT,
  enemyVisible: true,
  enemyDistance: 240,
  enemyAngle: 30,
  bulletAngle: -12,
  coverAngle: 75,
  aimAngle: 8,
  leadAngle: -3,
  gunAngle: 45,
  hitAngle: 170,
  wallLeft: 20,
  wallRight: 310,
  wallAhead: 55,
  wallBehind: 66,
};

function sourceOf(templateId: string, avoid: 'left' | 'right'): string {
  return findTemplate(templateId)?.build(avoid) ?? '';
}

/** What happened in a match, tick by tick. */
function traceOf(simulation: Simulation): string[] {
  const trace: string[] = [];
  while (simulation.result === null) {
    simulation.step();
    trace.push(JSON.stringify(simulation.robots.map((robot) => [robot.position, robot.rotation, robot.gunRotation, robot.hp])));
  }
  return trace;
}

describe('mirrorContext', () => {
  const seen = mirrorContext(SENSED);

  it('turns every angle to the other side', () => {
    expect(seen).toMatchObject({
      enemyAngle: -30,
      bulletAngle: 12,
      coverAngle: -75,
      aimAngle: -8,
      leadAngle: 3,
      gunAngle: -45,
      hitAngle: -170,
    });
  });

  it('swaps what is to the left and to the right', () => {
    expect(seen.wallLeft).toBe(310);
    expect(seen.wallRight).toBe(20);
  });

  it('leaves everything else as it is', () => {
    const { enemyVisible, enemyDistance, hp, ammo, guards, wallAhead, wallBehind, weaponRange, blocked } = seen;
    expect({ enemyVisible, enemyDistance, hp, ammo, guards, wallAhead, wallBehind, weaponRange, blocked }).toEqual({
      enemyVisible: true,
      enemyDistance: 240,
      hp: SENSED.hp,
      ammo: SENSED.ammo,
      guards: SENSED.guards,
      wallAhead: 55,
      wallBehind: 66,
      weaponRange: SENSED.weaponRange,
      blocked: false,
    });
  });

  it('keeps an angle of 0 at 0', () => {
    expect(Object.is(mirrorContext(QUIET_CONTEXT).enemyAngle, 0)).toBe(true);
  });

  it('reads the original only when asked: nothing is used up or worked out for a brain that does not look', () => {
    const read: string[] = [];
    const watched: AIContext = {
      ...QUIET_CONTEXT,
      get hit() {
        read.push('hit');
        return true;
      },
      get coverAngle() {
        read.push('coverAngle');
        return 40;
      },
    };
    const seenLazily = mirrorContext(watched);
    expect(seenLazily.enemyAngle).toBe(0);
    expect(read).toEqual([]);
    expect(seenLazily.hit).toBe(true);
    expect(seenLazily.coverAngle).toBe(-40);
    expect(read).toEqual(['hit', 'coverAngle']);
  });
});

describe('mirrorAction', () => {
  it('swaps turns to the left and to the right, of the hull and of the turret', () => {
    expect(mirrorAction({ ...createIdleAction(), turn: 'left', aim: 'right' })).toMatchObject({ turn: 'right', aim: 'left' });
    expect(mirrorAction({ ...createIdleAction(), turn: 'right', aim: 'left' })).toMatchObject({ turn: 'left', aim: 'right' });
  });

  it('leaves the other turns, and everything else, as they are', () => {
    for (const turn of ['enemy', 'cover', 'hit', null] as const) {
      for (const aim of ['enemy', 'lead', 'ahead', null] as const) {
        const action = { ...createIdleAction(), turn, aim, fire: true, drive: 'forward' as const, label: 'HUNT' };
        expect(mirrorAction(action)).toEqual(action);
      }
    }
  });
});

describe('mirrored', () => {
  it('has a robot turn right where its program says left', () => {
    const turning = (brain: RobotBrain) => {
      const simulation = createSimulation([brain, new FixedBrain()]);
      runTicks(simulation, 3);
      return simulation.robots[0].rotation;
    };
    const start = createSimulation([new FixedBrain(), new FixedBrain()]).robots[0].rotation;
    expect(turning(compileBrain('loop\n    turn left'))).toBeLessThan(start);
    expect(turning(mirrored(compileBrain('loop\n    turn left')))).toBeGreaterThan(start);
  });

  it('tells a program of the enemy on the other side than it is', () => {
    // BRAVO stands to the right of ALPHA, which faces up the field.
    const told: number[] = [];
    const listening: RobotBrain = {
      decide: (context) => {
        told.push(context.enemyAngle);
        return createIdleAction();
      },
    };
    const arena = { ...DEFAULT_ARENA, obstacles: [], spawns: [{ x: 400, y: 300, rotation: -90 }, { x: 600, y: 300, rotation: 180 }] };
    createSimulation([listening, new FixedBrain()], { arena }).step();
    createSimulation([mirrored(listening), new FixedBrain()], { arena }).step();
    expect(told[0]).toBeCloseTo(90);
    expect(told[1]).toBeCloseTo(-90);
  });

  it('still uses up a hit only when the program looks at it', () => {
    const program = ['set hits = 0', 'loop', '    if hit', '        set hits = hits + 1', '    wait', '    wait'].join('\n');
    const brains: [RobotBrain, RobotBrain] = [mirrored(compileBrain(program)), new FixedBrain({ fire: true })];
    const simulation = createSimulation(brains, {
      robots: [
        { id: 'ALPHA', brain: brains[0], stats: NO_SPREAD_STATS },
        { id: 'BRAVO', brain: brains[1], stats: { ...NO_SPREAD_STATS, maxAmmo: 2 } },
      ],
    });
    runTicks(simulation, 90);
    expect(simulation.robots[0].hp).toBe(NO_SPREAD_STATS.maxHp - 2 * NO_SPREAD_STATS.shotDamage);
    expect(simulation.robots[0].variables.get('hits')).toBe(2);
  });

  it('makes the program for one side fight from the other exactly as the program for that side', () => {
    // Sample differs between the sides only in which way it goes round obstacles.
    for (const { name, arena } of ARENAS) {
      const fight = (second: RobotBrain) =>
        traceOf(createSimulation([compileBrain(sourceOf('dumb_bot', 'left')), second], { arena, stats: ROBOT_DEFAULTS, seed: 3 }));
      const inMirror = fight(mirrored(compileBrain(sourceOf('sample', 'left'))));
      const written = fight(compileBrain(sourceOf('sample', 'right')));
      expect(inMirror, name).toEqual(written);
    }
  });
});

describe('brainFor', () => {
  const turnsLeft = () => compileBrain('loop\n    turn left');
  const turnOf = (brain: RobotBrain) => brain.decide(QUIET_CONTEXT).turn;

  it('runs a program as written on the side it was written for', () => {
    expect(turnOf(brainFor(turnsLeft(), 0, 0))).toBe('left');
    expect(turnOf(brainFor(turnsLeft(), 1, 1))).toBe('left');
  });

  it('runs it in a mirror on the other side', () => {
    expect(turnOf(brainFor(turnsLeft(), 0, 1))).toBe('right');
    expect(turnOf(brainFor(turnsLeft(), 1, 0))).toBe('right');
  });
});

describe('readStartSide', () => {
  it('is the first side unless told the second', () => {
    expect(readStartSide(1)).toBe(1);
    for (const value of [0, 2, -1, '1', null, undefined, {}]) expect(readStartSide(value)).toBe(0);
  });
});

describe('two robots written for the same side', () => {
  const blocked = ['center_block', 'long_wall', 'pillars', 'cross'];

  it('never meet in the arenas with something in the middle, as long as both go round it the same way', () => {
    const arena = ARENAS.find((candidate) => candidate.id === 'center_block')?.arena ?? DEFAULT_ARENA;
    const simulation = createSimulation(
      [compileBrain(sourceOf('dumb_bot', 'left')), compileBrain(sourceOf('dumb_bot', 'left'))],
      { arena, stats: ROBOT_DEFAULTS },
    );
    runToEnd(simulation);
    expect(simulation.result?.reason).toBe('timeout');
  });

  it('meet and fight it out once the one on the other side runs in a mirror', () => {
    for (const id of blocked) {
      const arena = ARENAS.find((candidate) => candidate.id === id)?.arena ?? DEFAULT_ARENA;
      for (const templateId of ['sample', 'dumb_bot', 'aggressive_bot']) {
        const simulation = createSimulation(
          [compileBrain(sourceOf(templateId, 'left')), brainFor(compileBrain(sourceOf(templateId, 'left')), 0, 1)],
          { arena, stats: ROBOT_DEFAULTS },
        );
        runToEnd(simulation);
        expect(simulation.result?.reason, `${templateId} in ${id}`).not.toBe('timeout');
      }
    }
  });
});
