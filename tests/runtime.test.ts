import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import type { AIAction, AIContext } from '../src/sim/ai_context';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { compileBrain } from './helpers';

const BASE_CONTEXT: AIContext = {
  enemyVisible: false,
  enemyDistance: 0,
  enemyAngle: 0,
  enemyX: 0,
  enemyY: 0,
  hp: 100,
  ammo: 50,
  blocked: false,
  blockedBehind: false,
};

/** Runs the program for one tick per given context and returns what it did on each. */
function run(source: string, contexts: Partial<AIContext>[]): AIAction[] {
  const brain = compileBrain(source);
  return contexts.map((context) => brain.decide({ ...BASE_CONTEXT, ...context }));
}

/** Runs the program for a number of ticks in an unchanging situation. */
function runTicks(source: string, ticks: number, context: Partial<AIContext> = {}): AIAction[] {
  return run(source, Array.from({ length: ticks }, () => context));
}

/** A short name for what the robot does on a tick. */
function describe1(action: AIAction): string {
  if (action.move !== null) return `move ${action.move}`;
  if (action.turn !== null) return `turn ${action.turn}`;
  return action.fire ? 'fire' : 'nothing';
}

/** Whether `if <condition>` takes its then-branch. */
function holds(condition: string, context: Partial<AIContext> = {}): boolean {
  return runTicks(`if ${condition}\n    fire`, 1, context)[0].fire;
}

/** The value a program assigns to `x` on its first tick. */
function valueOf(expression: string, context: Partial<AIContext> = {}): number {
  const [action] = runTicks(`set n = 6\nset x = ${expression}\nwait`, 1, context);
  return action.assignments[1].value;
}

describe('runtime: one action per tick', () => {
  it('does one action per tick and picks up where it left off', () => {
    const actions = runTicks('move forward\nturn left\nfire\nmove backward', 4);
    expect(actions.map(describe1)).toEqual(['move forward', 'turn left', 'fire', 'move backward']);
    expect(actions.map((action) => action.executedLines)).toEqual([[1], [2], [3], [4]]);
  });

  it('notes which line decided each action', () => {
    const [move, turn, fire] = runTicks('move forward\nturn enemy\nfire', 3);
    expect(move.sourceLines).toEqual({ move: 1, turn: null, fire: null, state: null });
    expect(turn.sourceLines).toEqual({ move: null, turn: 2, fire: null, state: null });
    expect(fire.sourceLines).toEqual({ move: null, turn: null, fire: 3, state: null });
  });

  it('spends a tick on wait, doing nothing', () => {
    const [waiting, firing] = runTicks('wait\nfire', 2);
    expect(waiting).toMatchObject({ move: null, turn: null, fire: false, executedLines: [1] });
    expect(firing.fire).toBe(true);
  });

  it('spends no time on if, set and state', () => {
    const [action] = runTicks('state TRACK\nset n = 1\nif n == 1\n    move forward', 1);
    expect(action).toMatchObject({ move: 'forward', state: 'TRACK', executedLines: [1, 2, 3, 4] });
    expect(action.sourceLines).toMatchObject({ move: 4, state: 1 });
  });

  it('carries a state set earlier in the same tick, and leaves it alone on later ticks', () => {
    const [first, second] = runTicks('state EVADE\nmove backward\nfire', 2);
    expect(first.state).toBe('EVADE');
    expect(second.state).toBeNull();
  });

  it('stops for good when the program runs off its end', () => {
    const actions = runTicks('fire\nmove forward', 4);
    expect(actions.map(describe1)).toEqual(['fire', 'move forward', 'nothing', 'nothing']);
    expect(actions.map((action) => action.status)).toEqual(['running', 'running', 'finished', 'finished']);
    expect(actions[3].executedLines).toEqual([]);
  });

  it('finishes at once when there is nothing to do', () => {
    expect(runTicks('', 1)[0]).toMatchObject({ status: 'finished', executedLines: [] });
  });
});

describe('runtime: loops', () => {
  it('repeats a loop forever, passing its first line again on every round', () => {
    const actions = runTicks('loop\n    move forward\n    turn left', 5);
    expect(actions.map(describe1)).toEqual(['move forward', 'turn left', 'move forward', 'turn left', 'move forward']);
    expect(actions.map((action) => action.executedLines)).toEqual([[1, 2], [3], [1, 2], [3], [1, 2]]);
    expect(actions.every((action) => action.status === 'running')).toBe(true);
  });

  it('repeats a while as long as its condition holds, then goes on', () => {
    const actions = runTicks('set n = 0\nwhile n < 2\n    move forward\n    set n = n + 1\nfire', 4);
    expect(actions.map(describe1)).toEqual(['move forward', 'move forward', 'fire', 'nothing']);
    expect(actions.map((action) => action.executedLines)).toEqual([[1, 2, 3], [4, 2, 3], [4, 2, 5], []]);
  });

  it('skips a while whose condition does not hold to begin with', () => {
    expect(runTicks('while enemy_visible\n    fire\nwait', 1)[0].executedLines).toEqual([1, 3]);
  });

  it('sees the situation of the tick it is running on', () => {
    const actions = run('loop\n    if enemy_visible\n        fire\n    else\n        turn right', [
      { enemyVisible: false },
      { enemyVisible: true },
      { enemyVisible: false },
    ]);
    expect(actions.map(describe1)).toEqual(['turn right', 'fire', 'turn right']);
  });

  it('gives up for the tick when a loop takes no action, and carries on the next tick', () => {
    const brain = compileScript('loop\n    set n = n + 1', 10);
    if (!brain.ok) throw new Error('Expected the program to compile');
    const first = brain.brain.decide(BASE_CONTEXT);
    const second = brain.brain.decide(BASE_CONTEXT);

    expect(first).toMatchObject({ status: 'stalled', move: null, turn: null, fire: false });
    expect(first.executedLines).toHaveLength(10);
    expect(second.status).toBe('stalled');
    // The count goes on from where the first tick stopped.
    expect(second.assignments[0].value).toBe(first.assignments.at(-1)!.value + 1);
  });
});

describe('runtime: variables', () => {
  it('keeps variables from tick to tick', () => {
    const actions = runTicks('loop\n    set n = n + 1\n    if n >= 3\n        fire\n    else\n        wait', 4);
    expect(actions.map(describe1)).toEqual(['nothing', 'nothing', 'fire', 'fire']);
  });

  it('reads a variable as 0 until it is set', () => {
    expect(runTicks('if n == 0\n    fire\nset n = 5', 1)[0].fire).toBe(true);
  });

  it('records each assignment with the number of lines run by then', () => {
    const [action] = runTicks('set a = 2\nset b = a * 5\nwait', 1);
    expect(action.assignments).toEqual([
      { afterLines: 1, name: 'a', value: 2 },
      { afterLines: 2, name: 'b', value: 10 },
    ]);
  });

  it('calculates with the usual precedence', () => {
    expect(valueOf('1 + 2 * 3')).toBe(7);
    expect(valueOf('(1 + 2) * 3')).toBe(9);
    expect(valueOf('10 - 4 - 3')).toBe(3);
    expect(valueOf('n / 4')).toBe(1.5);
    expect(valueOf('-n + 1')).toBe(-5);
  });

  it('calculates with sensor values', () => {
    expect(valueOf('enemy_distance / 2 + hp', { enemyDistance: 300, hp: 40 })).toBe(190);
  });

  it('gives 0 when dividing by zero', () => {
    expect(valueOf('n / 0')).toBe(0);
  });
});

describe('runtime: conditions', () => {
  it('reads each sensor value from the context', () => {
    expect(holds('enemy_visible', { enemyVisible: true })).toBe(true);
    expect(holds('enemy_visible', { enemyVisible: false })).toBe(false);
    expect(holds('blocked', { blocked: true })).toBe(true);
    expect(holds('blocked_behind', { blockedBehind: true })).toBe(true);
    expect(holds('enemy_distance == 120', { enemyDistance: 120 })).toBe(true);
    expect(holds('enemy_angle == -30', { enemyAngle: -30 })).toBe(true);
    expect(holds('hp == 40', { hp: 40 })).toBe(true);
    expect(holds('ammo == 7', { ammo: 7 })).toBe(true);
  });

  it('evaluates each comparison operator', () => {
    const context = { hp: 50 };
    expect(holds('hp < 51', context)).toBe(true);
    expect(holds('hp < 50', context)).toBe(false);
    expect(holds('hp > 49', context)).toBe(true);
    expect(holds('hp > 50', context)).toBe(false);
    expect(holds('hp <= 50', context)).toBe(true);
    expect(holds('hp <= 49', context)).toBe(false);
    expect(holds('hp >= 50', context)).toBe(true);
    expect(holds('hp >= 51', context)).toBe(false);
    expect(holds('hp == 50', context)).toBe(true);
    expect(holds('hp != 50', context)).toBe(false);
  });

  it('evaluates and, or, not and parentheses', () => {
    expect(holds('not enemy_visible')).toBe(true);
    expect(holds('enemy_visible and hp > 0')).toBe(false);
    expect(holds('enemy_visible or hp > 0')).toBe(true);
    expect(holds('hp < 30 or enemy_visible and ammo > 0', { hp: 10 })).toBe(true);
    expect(holds('(hp < 30 or enemy_visible) and ammo > 60', { hp: 10 })).toBe(false);
    expect(holds('not (enemy_visible or blocked)')).toBe(true);
  });
});

describe('runtime: the sample AI', () => {
  it('drives on while the enemy is hidden, one step per tick, round the loop each time', () => {
    const actions = runTicks(SAMPLE_AI, 2);
    expect(actions.map(describe1)).toEqual(['move forward', 'move forward']);
    expect(actions.map((action) => action.executedLines)).toEqual([
      [2, 3, 6, 7, 16, 17, 18],
      [2, 3, 6, 7, 16, 17, 18],
    ]);
    expect(actions[0].state).toBe('SEARCH');
  });

  it('turns away while the way ahead is blocked', () => {
    const [action] = runTicks(SAMPLE_AI, 1, { blocked: true });
    expect(action).toMatchObject({ turn: 'left', state: 'SEARCH', executedLines: [2, 3, 4, 5] });
  });

  it('takes two ticks per round with the enemy in sight: one to turn, one to act', () => {
    const far = runTicks(SAMPLE_AI, 3, { enemyVisible: true, enemyDistance: 400 });
    expect(far.map(describe1)).toEqual(['turn enemy', 'move forward', 'turn enemy']);
    expect(far.map((action) => action.executedLines)).toEqual([[2, 3, 6, 7, 8], [10, 13, 14, 15], [2, 3, 6, 7, 8]]);
    expect(far[1].state).toBe('TRACK');

    const near = runTicks(SAMPLE_AI, 2, { enemyVisible: true, enemyDistance: 100 });
    expect(near.map(describe1)).toEqual(['turn enemy', 'fire']);
    expect(near[1]).toMatchObject({ state: 'ATTACK', executedLines: [10, 11, 12] });
  });

  it('runs the same way every time', () => {
    const contexts = [{}, { blocked: true }, { enemyVisible: true, enemyDistance: 100 }, {}];
    expect(run(SAMPLE_AI, contexts)).toEqual(run(SAMPLE_AI, contexts));
  });
});
