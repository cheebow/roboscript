import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import type { AIAction, AIContext } from '../src/sim/ai_context';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { QUIET_CONTEXT, compileBrain } from './helpers';

const BASE_CONTEXT: AIContext = QUIET_CONTEXT;

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
  if (action.turn !== null) return `turn ${action.turn}`;
  if (action.aim !== null) return `aim ${action.aim}`;
  if (action.guard) return 'guard';
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
    const actions = runTicks('aim left\nturn left\nfire\nguard', 4);
    expect(actions.map(describe1)).toEqual(['aim left', 'turn left', 'fire', 'guard']);
    expect(actions.map((action) => action.executedLines)).toEqual([[1], [2], [3], [4]]);
  });

  it('notes which line decided each action', () => {
    const none = { drive: null, turn: null, aim: null, fire: null, guard: null, label: null };
    const [aim, turn, fire] = runTicks('aim lead\nturn enemy\nfire', 3);
    expect(aim.sourceLines).toEqual({ ...none, aim: 1 });
    expect(turn.sourceLines).toEqual({ ...none, turn: 2 });
    expect(fire.sourceLines).toEqual({ ...none, fire: 3 });
  });

  it('spends a tick on wait, doing nothing', () => {
    const [waiting, firing] = runTicks('wait\nfire', 2);
    expect(waiting).toMatchObject({ drive: null, turn: null, aim: null, fire: false, executedLines: [1] });
    expect(firing.fire).toBe(true);
  });

  it('spends no time on if, set, label and drive', () => {
    const [action] = runTicks('label TRACK\nset n = 1\ndrive forward\nif n == 1\n    fire', 1);
    expect(action).toMatchObject({ drive: 'forward', fire: true, label: 'TRACK', executedLines: [1, 2, 3, 4, 5] });
    expect(action.sourceLines).toMatchObject({ drive: 3, fire: 5, label: 1 });
  });

  it('carries a label set earlier in the same tick, and leaves it alone on later ticks', () => {
    const [first, second] = runTicks('label EVADE\naim left\nfire', 2);
    expect(first.label).toBe('EVADE');
    expect(second.label).toBeNull();
  });

  it('stops for good when the program runs off its end', () => {
    const actions = runTicks('fire\naim left', 4);
    expect(actions.map(describe1)).toEqual(['fire', 'aim left', 'nothing', 'nothing']);
    expect(actions.map((action) => action.status)).toEqual(['running', 'running', 'finished', 'finished']);
    expect(actions[3].executedLines).toEqual([]);
  });

  it('finishes at once when there is nothing to do', () => {
    expect(runTicks('', 1)[0]).toMatchObject({ status: 'finished', executedLines: [] });
  });
});

describe('runtime: driving', () => {
  it('sets how the hull drives without ending the tick; the last setting of a tick counts', () => {
    const [first, second] = runTicks('drive forward\ndrive backward\nwait\ndrive stop\nfire', 2);
    expect(first).toMatchObject({ drive: 'backward', fire: false, executedLines: [1, 2, 3] });
    expect(first.sourceLines.drive).toBe(2);
    expect(second).toMatchObject({ drive: 'stop', fire: true, executedLines: [4, 5] });
  });

  it('leaves the driving as it is on a tick that does not set it', () => {
    const [first, second] = runTicks('drive forward\nwait\nfire', 2);
    expect(first.drive).toBe('forward');
    expect(second.drive).toBeNull();
  });

  it('is not an action: a loop that only drives never ends its tick by itself', () => {
    const result = compileScript('loop\n    drive forward', 10);
    if (!result.ok) throw new Error('Expected the program to compile');
    expect(result.brain.decide(BASE_CONTEXT)).toMatchObject({ status: 'stalled', drive: 'forward' });
  });
});

describe('runtime: loops', () => {
  it('repeats a loop forever, passing its first line again on every round', () => {
    const actions = runTicks('loop\n    aim left\n    turn left', 5);
    expect(actions.map(describe1)).toEqual(['aim left', 'turn left', 'aim left', 'turn left', 'aim left']);
    expect(actions.map((action) => action.executedLines)).toEqual([[1, 2], [3], [1, 2], [3], [1, 2]]);
    expect(actions.every((action) => action.status === 'running')).toBe(true);
  });

  it('repeats a while as long as its condition holds, then goes on', () => {
    const actions = runTicks('set n = 0\nwhile n < 2\n    aim left\n    set n = n + 1\nfire', 4);
    expect(actions.map(describe1)).toEqual(['aim left', 'aim left', 'fire', 'nothing']);
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

    expect(first).toMatchObject({ status: 'stalled', drive: null, turn: null, aim: null, fire: false });
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
  // Lines of the sample: the loop (25-32) calls avoid (4-6), attack (9-18) and search (20-23).
  const SEARCH_ROUND = [25, 26, 28, 29, 31, 32, 21, 22, 23];
  const SIGHTED_ROUND = [25, 26, 28, 29, 30, 10];

  it('drives on while the enemy is hidden, round the loop once a tick', () => {
    const actions = runTicks(SAMPLE_AI, 2);
    expect(actions.map(describe1)).toEqual(['nothing', 'nothing']);
    expect(actions.map((action) => action.executedLines)).toEqual([SEARCH_ROUND, SEARCH_ROUND]);
    expect(actions[0]).toMatchObject({ drive: 'forward', label: 'SEARCH' });
  });

  it('turns away while the way ahead is blocked', () => {
    const [action] = runTicks(SAMPLE_AI, 1, { blocked: true });
    expect(action).toMatchObject({ turn: 'left', label: 'SEARCH', executedLines: [25, 26, 27, 5, 6] });
  });

  it('keeps its hull on a distant enemy while it drives up to it', () => {
    const far = runTicks(SAMPLE_AI, 3, { enemyVisible: true, enemyDistance: 400 });
    expect(far.map(describe1)).toEqual(['turn enemy', 'turn enemy', 'turn enemy']);
    // Setting the drive takes no time, so the function ends and the loop goes on to the next turn.
    expect(far.map((action) => action.executedLines)).toEqual([
      SIGHTED_ROUND,
      [12, 16, 17, 18, ...SIGHTED_ROUND],
      [12, 16, 17, 18, ...SIGHTED_ROUND],
    ]);
    expect(far[0].drive).toBeNull();
    expect(far[1]).toMatchObject({ drive: 'forward', label: 'TRACK' });
  });

  it('stops and takes two ticks per round on a close enemy: one to turn, one to fire', () => {
    const near = runTicks(SAMPLE_AI, 3, { enemyVisible: true, enemyDistance: 100 });
    expect(near.map(describe1)).toEqual(['turn enemy', 'fire', 'turn enemy']);
    expect(near[1]).toMatchObject({ drive: 'stop', label: 'ATTACK', executedLines: [12, 13, 14, 15] });
  });

  it('passes the distance to fire from to its attack', () => {
    const [action] = runTicks(SAMPLE_AI, 1, { enemyVisible: true, enemyDistance: 100 });
    expect(action.assignments).toEqual([{ afterLines: 5, name: 'attack.distance', value: 250 }]);
  });

  it('runs the same way every time', () => {
    const contexts = [{}, { blocked: true }, { enemyVisible: true, enemyDistance: 100 }, {}];
    expect(run(SAMPLE_AI, contexts)).toEqual(run(SAMPLE_AI, contexts));
  });
});
