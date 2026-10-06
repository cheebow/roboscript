import { describe, expect, it } from 'vitest';
import { parse } from '../src/ai/parser';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { type Loadout, STANDARD_LOADOUT, statsOf } from '../src/data/parts';
import type { AIAction } from '../src/sim/ai_context';
import { DUEL_ARENA, FixedBrain, QUIET_CONTEXT, compileBrain, createSimulation } from './helpers';

const { tickRate } = MATCH_DEFAULTS;

/** The robot's heading, or its turret on the hull, after each tick of the program. */
function track(source: string, ticks: number, what: 'rotation' | 'gunRotation', loadout: Partial<Loadout> = {}): number[] {
  const stats = statsOf({ ...STANDARD_LOADOUT, ...loadout });
  const simulation = createSimulation([compileBrain(source), new FixedBrain()], {
    stats,
    // Far apart, so that nothing but the program moves the robot.
    arena: { ...DUEL_ARENA, spawns: [{ x: 100, y: 300, rotation: 0 }, { x: 900, y: 500, rotation: 180 }] },
  });
  const seen: number[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    simulation.step();
    seen.push(simulation.robots[0][what]);
  }
  return seen;
}

/** The ticks it takes to turn by `angle` at `speed` degrees a second. */
function ticksFor(angle: number, speed: number): number {
  return Math.ceil(angle / (speed / tickRate));
}

describe('turn left / right by an angle', () => {
  it('is written as a number, or any calculation, after the side', () => {
    expect(parse('turn left 90').program?.body[0]).toEqual({ kind: 'turn', line: 1, direction: 'left', angle: { kind: 'number', value: 90 } });
    expect(parse('set n = 2\naim right n * 15').errors).toEqual([]);
    expect(parse('turn left -30').errors).toEqual([]);
  });

  it('takes an angle only after left and right', () => {
    expect(parse('turn enemy 30').errors.map((error) => error.message)).toEqual([
      'Only left and right take an angle: "turn enemy" turns as far as it can in a tick',
    ]);
    expect(parse('aim lead 10').errors.map((error) => error.message)).toEqual([
      'Only left and right take an angle: "aim lead" turns as far as it can in a tick',
    ]);
  });

  it.each([
    ['standard legs', {}, 180],
    ['Sprint legs', { legs: 'sprint' }, 150],
    ['Pivot legs', { legs: 'pivot' }, 260],
    ['Walker legs', { legs: 'walker' }, 150],
    ['Hover legs', { legs: 'hover' }, 180],
    ['a Light body on Pivot legs', { body: 'light', legs: 'pivot' }, 260 * 1.2],
  ] as const)('turns the hull exactly 90 degrees with %s, then goes on', (_, loadout, speed) => {
    const ticks = ticksFor(90, speed);
    const step = speed / tickRate;
    const rotations = track('turn left 90\nturn right', ticks + 1, 'rotation', loadout);
    expect(rotations[0]).toBeCloseTo(-step);
    expect(rotations[ticks - 1]).toBeCloseTo(-90);
    // The next line runs on the tick after: one plain turn to the right.
    expect(rotations[ticks]).toBeCloseTo(-90 + step);
  });

  it('turns right, and turns the other way for a negative angle', () => {
    expect(track('turn right 45', 10, 'rotation').at(-1)).toBeCloseTo(45);
    expect(track('turn left -45', 10, 'rotation').at(-1)).toBeCloseTo(45);
    expect(track('set a = 20\nturn right a * 2', 10, 'rotation').at(-1)).toBeCloseTo(40);
  });

  it('goes round more than once for an angle over 360', () => {
    // 720 degrees at 6 a tick: two whole rounds in 120 ticks, and no further.
    const rotations = track('turn left 720\nturn right', 121, 'rotation');
    expect(rotations[59]).toBeCloseTo(0);
    expect(rotations[119]).toBeCloseTo(0);
    expect(rotations[120]).toBeCloseTo(6);
  });

  it('takes no time for an angle of 0', () => {
    expect(track('turn left 0\nturn right', 1, 'rotation')[0]).toBeCloseTo(6);
  });

  it('turns the turret on the hull the same way', () => {
    const ticks = ticksFor(30, 270);
    const angles = track('aim left 30\naim right', ticks + 1, 'gunRotation');
    expect(angles[ticks - 1]).toBeCloseTo(-30);
    expect(angles[ticks]).toBeCloseTo(-30 + 270 / tickRate);
    expect(track('aim right 100', 20, 'gunRotation').at(-1)).toBeCloseTo(100);
  });

  it('runs its line on every tick of turning, and reports the plain turn from it', () => {
    const brain = compileBrain('wait\nturn left 12\nfire');
    const actions: AIAction[] = [];
    let heading = 0;
    for (let tick = 0; tick < 4; tick++) {
      const action = brain.decide({ ...QUIET_CONTEXT, heading });
      actions.push(action);
      if (action.turn === 'left') heading -= 6;
    }
    expect(actions.map((action) => action.turn)).toEqual([null, 'left', 'left', null]);
    expect(actions.map((action) => action.executedLines)).toEqual([[1], [2], [2], [2, 3]]);
    expect(actions[2].sourceLines.turn).toBe(2);
    expect(actions[3].fire).toBe(true);
  });
});
