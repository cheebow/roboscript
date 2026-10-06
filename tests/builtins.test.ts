import { describe, expect, it } from 'vitest';
import { parse } from '../src/ai/parser';
import { recordMatch } from '../src/debug/recorder';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import type { AIAction, AIContext, RobotBrain } from '../src/sim/ai_context';
import { DUEL_ARENA, QUIET_CONTEXT, compileBrain, createSimulation } from './helpers';

/** The value the program gives `x` on its first tick; `draw` is what the robot's random numbers come out as. */
function valueOf(expression: string, draw = 0, before = ''): number {
  const brain = compileBrain(`${before}set x = ${expression}\nwait`);
  const action = brain.decide({ ...QUIET_CONTEXT, random: () => draw });
  return action.assignments.at(-1)!.value;
}

function messagesOf(source: string): string[] {
  return parse(source).errors.map((error) => error.message);
}

describe('abs, min, max and sqrt', () => {
  it('work out their values', () => {
    expect(valueOf('abs(-30)')).toBe(30);
    expect(valueOf('abs(4)')).toBe(4);
    expect(valueOf('min(3, -2)')).toBe(-2);
    expect(valueOf('max(3, -2)')).toBe(3);
    expect(valueOf('sqrt(30 * 30 + 40 * 40)')).toBe(50);
  });

  it('give 0 for the square root of a negative number, so that every value stays a number', () => {
    expect(valueOf('sqrt(-4)')).toBe(0);
  });

  it('go in conditions as they are, and inside the values of other calls', () => {
    const brain = compileBrain('loop\n    if abs(aim_angle) > 2\n        aim enemy\n    else\n        fire');
    expect(brain.decide({ ...QUIET_CONTEXT, aimAngle: -10 }).aim).toBe('enemy');
    expect(brain.decide({ ...QUIET_CONTEXT, aimAngle: 1 }).fire).toBe(true);
    expect(valueOf('max(abs(-5), min(2, 9))')).toBe(5);
  });

  it('can be used in a function called for its value', () => {
    expect(valueOf('far(-7)', 0, 'def far(d)\n    return abs(d)\n')).toBe(7);
  });
});

describe('random', () => {
  it('gives a whole number from a to b, both included', () => {
    expect(valueOf('random(1, 6)', 0)).toBe(1);
    expect(valueOf('random(1, 6)', 0.5)).toBe(4);
    expect(valueOf('random(1, 6)', 0.9999)).toBe(6);
    expect(valueOf('random(-30, 30)', 0)).toBe(-30);
  });

  it('takes its ends in either order, rounds them inwards, and gives a rounded when no whole number lies between', () => {
    expect(valueOf('random(6, 1)', 0)).toBe(1);
    expect(valueOf('random(0.5, 3.7)', 0)).toBe(1);
    expect(valueOf('random(0.5, 3.7)', 0.9999)).toBe(3);
    expect(valueOf('random(4, 4)', 0.7)).toBe(4);
    expect(valueOf('random(0.2, 0.4)', 0.7)).toBe(0);
  });

  /** The values a robot's program gives `x` over the ticks of a match. */
  function draws(seed: number, ticks: number): [number[], number[]] {
    const seen: [number[], number[]] = [[], []];
    const watching = (index: 0 | 1): RobotBrain => {
      const brain = compileBrain('loop\n    set x = random(1, 1000000)\n    wait');
      return {
        decide(context: AIContext): AIAction {
          const action = brain.decide(context);
          seen[index].push(action.assignments.at(-1)!.value);
          return action;
        },
      };
    };
    const simulation = createSimulation([watching(0), watching(1)], { seed });
    for (let tick = 0; tick < ticks; tick++) simulation.step();
    return seen;
  }

  it("draws from the robot's own numbers, made from the match's seed: the same match, the same numbers", () => {
    const [first, second] = draws(7, 20);
    expect(draws(7, 20)).toEqual([first, second]);
    expect(first).not.toEqual(second);
    expect(draws(8, 20)[0]).not.toEqual(first);
    for (const value of first) expect(Number.isInteger(value) && value >= 1 && value <= 1_000_000).toBe(true);
  });

  it('leaves the match itself as it was: drawing changes neither where the shots go nor anything else', () => {
    const shooter = 'loop\n    aim enemy\n    fire';
    const drawingShooter = 'loop\n    set x = random(1, 6)\n    aim enemy\n    fire';
    const record = (source: string) =>
      recordMatch(
        {
          arena: DUEL_ARENA,
          tickRate: MATCH_DEFAULTS.tickRate,
          maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
          seed: 3,
          robots: [
            { id: 'ALPHA', brain: compileBrain(source), stats: ROBOT_DEFAULTS },
            { id: 'BRAVO', brain: compileBrain(shooter), stats: ROBOT_DEFAULTS },
          ],
        },
        EFFECT_LIFETIMES,
      );
    const hpOf = (source: string) => record(source).snapshots.map((snapshot) => snapshot.robots.map((robot) => robot.hp).join('/'));
    expect(hpOf(drawingShooter)).toEqual(hpOf(shooter));
    // And a match with random numbers plays out the same every time.
    expect(hpOf(drawingShooter)).toEqual(hpOf(drawingShooter));
  });
});

describe("the program's own function with the name of one of the language's", () => {
  it('comes first, so programs written before these functions run as they did', () => {
    expect(valueOf('abs(-3)', 0, 'def abs(v)\n    return 7\n')).toBe(7);
    expect(parse('def random()\n    return 4\nset x = random()\nwait').errors).toEqual([]);
  });

  it('leaves the names free for variables too', () => {
    expect(valueOf('max + 1', 0, 'set max = 9\n')).toBe(10);
  });
});

describe('mistakes', () => {
  it('a function of the language on a line of its own: it would do nothing', () => {
    expect(messagesOf('abs(3)')).toEqual(['"abs" only works out a value, so on a line of its own it does nothing: use it in a value or a condition, as in set x = abs(…)']);
  });

  it('the wrong number of values, or no parentheses', () => {
    expect(messagesOf('set x = abs(1, 2)\nwait')).toEqual(['"abs" takes 1 value, not 2']);
    expect(messagesOf('set x = random(1)\nwait')).toEqual(['"random" takes 2 values, not 1']);
    expect(messagesOf('set x = sqrt\nwait')).toEqual(['Expected "(" after "sqrt"']);
  });
});
