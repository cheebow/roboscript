import { describe, expect, it } from 'vitest';
import { parse } from '../src/ai/parser';
import { compileScript } from '../src/ai/roboscript';
import { formatError } from '../src/ai/script_error';
import type { AIAction, AIContext } from '../src/sim/ai_context';
import { QUIET_CONTEXT, compileBrain } from './helpers';

function errorsOf(source: string): string[] {
  return parse(source).errors.map(formatError);
}

/** Runs the program for one tick per given context and returns what it did on each. */
function run(source: string, contexts: Partial<AIContext>[]): AIAction[] {
  const brain = compileBrain(source);
  return contexts.map((context) => brain.decide({ ...QUIET_CONTEXT, ...context }));
}

function runTicks(source: string, ticks: number, context: Partial<AIContext> = {}): AIAction[] {
  return run(source, Array.from({ length: ticks }, () => context));
}

/** A short name for what the robot does on a tick. */
function done(action: AIAction): string {
  if (action.turn !== null) return `turn ${action.turn}`;
  if (action.aim !== null) return `aim ${action.aim}`;
  if (action.guard) return 'guard';
  return action.fire ? 'fire' : 'nothing';
}

/** The value a program assigns to `x` on its first tick, with the given functions defined. */
function valueOf(functions: string, expression: string, context: Partial<AIContext> = {}): number {
  const [action] = runTicks(`${functions}\nset x = ${expression}\nwait`, 1, context);
  return action.assignments.find((assignment) => assignment.name === 'x')!.value;
}

const ABS = 'def abs(v)\n    if v < 0\n        return -v\n    return v';

describe('functions: syntax', () => {
  it('keeps definitions apart from the statements of the program', () => {
    const { program, errors } = parse('def stop()\n    drive stop\n\nloop\n    stop()\n    wait');
    expect(errors).toEqual([]);
    expect(program?.body.map((statement) => statement.kind)).toEqual(['loop']);
    expect(program?.functions.get('stop')).toEqual({
      name: 'stop',
      line: 1,
      params: [],
      body: [{ kind: 'drive', line: 2, setting: 'stop' }],
    });
  });

  it('parses parameters, and reads them inside the function as variables of its own', () => {
    const { program } = parse('def approach(limit, slack)\n    if enemy_distance > limit + slack\n        drive forward');
    const approach = program?.functions.get('approach');
    expect(approach?.params).toEqual(['limit', 'slack']);
    expect(approach?.body[0]).toMatchObject({
      kind: 'if',
      condition: {
        right: {
          kind: 'arithmetic',
          left: { kind: 'variable', name: 'approach.limit' },
          right: { kind: 'variable', name: 'approach.slack' },
        },
      },
    });
  });

  it('parses a call on a line of its own, with its values', () => {
    const { program } = parse('def approach(limit, slack)\n    wait\napproach(350, hp / 2)');
    expect(program?.body).toEqual([
      {
        kind: 'call',
        line: 3,
        name: 'approach',
        args: [
          { kind: 'number', value: 350 },
          { kind: 'arithmetic', operator: '/', left: { kind: 'sensor', name: 'hp' }, right: { kind: 'number', value: 2 } },
        ],
      },
    ]);
  });

  it('parses calls inside conditions and values, also one inside another', () => {
    const source = `${ABS}\nloop\n    if abs(aim_angle) > 2 and abs(abs(hp) - 5) < 3\n        fire\n    set n = abs(-4) * 2\n    wait`;
    expect(errorsOf(source)).toEqual([]);
  });

  it('parses return with and without a value', () => {
    const { program } = parse('def f()\n    return\ndef g()\n    return hp + 1');
    expect(program?.functions.get('f')?.body).toEqual([{ kind: 'return', line: 2, value: null }]);
    expect(program?.functions.get('g')?.body[0]).toMatchObject({ kind: 'return', value: { kind: 'arithmetic' } });
  });

  it('lets a function be called above its definition', () => {
    expect(errorsOf('loop\n    stop()\n    wait\n\ndef stop()\n    drive stop')).toEqual([]);
  });

  it('lets a parameter have the name of a variable of the program', () => {
    expect(errorsOf('set limit = 1\ndef f(limit)\n    return limit\nloop\n    set limit = f(2)\n    wait')).toEqual([]);
  });
});

describe('functions: errors on the line', () => {
  it('reports a faulty definition', () => {
    expect(errorsOf('def\n    wait')).toEqual(['Line 1: Expected a name after "def"']);
    expect(errorsOf('def f\n    wait')).toEqual(['Line 1: Expected "(" after "f"']);
    expect(errorsOf('def f(a\n    wait')).toEqual(['Line 1: Expected ")"']);
    expect(errorsOf('def f(a b)\n    wait')).toEqual(['Line 1: Unexpected "b"']);
    expect(errorsOf('def f(a, a)\n    wait')).toEqual(['Line 1: "a" is listed twice']);
    expect(errorsOf('def f() now\n    wait')).toEqual(['Line 1: Unexpected "now"']);
    expect(errorsOf('def f()')).toEqual(['Line 1: Expected indented block']);
  });

  it('keeps the words of the language from being used as names', () => {
    expect(errorsOf('def fire()\n    wait')).toEqual(['Line 1: "fire" cannot be used as a function name']);
    expect(errorsOf('def f(hp)\n    wait')).toEqual(['Line 1: "hp" cannot be used as a parameter name']);
    expect(errorsOf('def f()\n    wait\nset def = 1')).toEqual(['Line 3: "def" cannot be used as a variable name']);
  });

  it('reports a name used for two things', () => {
    expect(errorsOf('def f()\n    wait\ndef f()\n    fire')).toEqual(['Line 3: "f" is already defined on line 1']);
    expect(errorsOf('set count = 0\ndef count()\n    wait')).toEqual([
      'Line 1: "count" is a function',
      'Line 2: "count" is already a variable',
    ]);
  });

  it('only allows definitions at the top level', () => {
    expect(errorsOf('loop\n    def f()\n        wait\n    wait')).toEqual([
      'Line 2: Functions can only be defined at the top level',
    ]);
  });

  it('reports a faulty call', () => {
    const f = 'def f(a)\n    wait\n';
    expect(errorsOf(`${f}g(1)`)).toEqual(['Line 3: Unknown function "g"']);
    expect(errorsOf(`${f}f()`)).toEqual(['Line 3: "f" takes 1 value, not 0']);
    expect(errorsOf(`${f}f(1, 2)`)).toEqual(['Line 3: "f" takes 1 value, not 2']);
    expect(errorsOf('def g()\n    wait\ng(1)')).toEqual(['Line 3: "g" takes no values, not 1']);
    expect(errorsOf('def h(a, b)\n    wait\nh(1)')).toEqual(['Line 3: "h" takes 2 values, not 1']);
    expect(errorsOf(`${f}f(1`)).toEqual(['Line 3: Expected ")"']);
    expect(errorsOf(`${f}f(1,)`)).toEqual(['Line 3: Expected a value after ","']);
    expect(errorsOf(`${f}f`)).toEqual(['Line 3: Expected "(" after "f"']);
    expect(errorsOf(`${f}set n = f + 1`)).toEqual(['Line 3: Expected "(" after "f"']);
    expect(errorsOf(`${f}f(1) + 2`)).toEqual(['Line 3: Only a call can stand on a line of its own']);
    expect(errorsOf('shoot(1)')).toEqual(['Line 1: Unknown function "shoot"']);
  });

  it('reports a return outside a function', () => {
    expect(errorsOf('loop\n    return')).toEqual(['Line 2: "return" only works inside a function']);
  });

  it('does not know a parameter outside its function', () => {
    expect(errorsOf('def f(a)\n    return a\nset n = a')).toEqual(['Line 3: Unknown variable "a"']);
    // Assigning to a parameter does not turn it into a variable of the program either.
    expect(errorsOf('def f(a)\n    set a = 1\n    return a\nset n = a')).toEqual(['Line 4: Unknown variable "a"']);
  });
});

describe('functions: errors in how they call each other', () => {
  it('reports a function that calls itself', () => {
    expect(errorsOf('def f()\n    f()')).toEqual(['Line 1: "f" calls itself']);
    expect(errorsOf('def f(n)\n    return f(n - 1)')).toEqual(['Line 1: "f" calls itself']);
  });

  it('reports functions that call each other in a circle, each at its definition', () => {
    expect(errorsOf('def a()\n    b()\ndef b()\n    c()\ndef c()\n    a()\na()')).toEqual([
      'Line 1: "a" calls itself through "b"',
      'Line 3: "b" calls itself through "c"',
      'Line 5: "c" calls itself through "a"',
    ]);
  });

  it('reports a function that takes time when it is called for its value', () => {
    const sweep = 'def sweep()\n    turn left\n    return 1\n';
    expect(errorsOf(`${sweep}loop\n    if sweep() > 0\n        fire`)).toEqual([
      'Line 5: "sweep" cannot be used as a value: it takes time (line 2)',
    ]);
    expect(errorsOf(`${sweep}set n = sweep()\nwait`)).toEqual([
      'Line 4: "sweep" cannot be used as a value: it takes time (line 2)',
    ]);
    // On a line of its own it may take all the time it needs.
    expect(errorsOf(`${sweep}loop\n    sweep()`)).toEqual([]);
  });

  it('checks a function called alone as a condition, as it does any other value', () => {
    expect(errorsOf('def f()\n    if f()\n        return 1\n    return 0\nloop\n    wait')).toEqual(['Line 1: "f" calls itself']);
    const sweep = 'def sweep()\n    turn left\n    return 1\n';
    expect(errorsOf(`${sweep}loop\n    if sweep()\n        fire`)).toEqual([
      'Line 5: "sweep" cannot be used as a value: it takes time (line 2)',
    ]);
    expect(errorsOf(`${sweep}loop\n    while not sweep()\n        wait`)).toEqual([
      'Line 5: "sweep" cannot be used as a value: it takes time (line 2)',
    ]);
  });

  it('reports a function that loops when it is called for its value', () => {
    const count = 'def count()\n    set n = 0\n    while n < 3\n        set n = n + 1\n    return n\n';
    expect(errorsOf(`${count}set m = count()\nwait`)).toEqual([
      'Line 6: "count" cannot be used as a value: it loops (line 3)',
    ]);
  });

  it('follows the calls a function makes: what it calls must not take time either', () => {
    const source = 'def shoot()\n    fire\ndef ready()\n    shoot()\n    return 1\nloop\n    if ready() == 1\n        wait';
    expect(errorsOf(source)).toEqual(['Line 7: "ready" cannot be used as a value: it takes time (line 2)']);
  });

  it('checks the values passed to a call on a line of its own, and those returned', () => {
    const sweep = 'def sweep()\n    turn left\n    return 1\ndef f(a)\n    return a\n';
    expect(errorsOf(`${sweep}loop\n    f(sweep())\n    wait`)).toEqual([
      'Line 7: "sweep" cannot be used as a value: it takes time (line 2)',
    ]);
    expect(errorsOf(`${sweep}def g()\n    return sweep()\nwait`)).toEqual([
      'Line 7: "sweep" cannot be used as a value: it takes time (line 2)',
    ]);
  });

  it('accepts ifs, sets, labels, drives and calls in a function called for its value', () => {
    const source = `${ABS}\ndef side(a)\n    label SIDE\n    drive stop\n    set last = abs(a)\n    if last > 90\n        return 1\n    else\n        return 0\nloop\n    if side(enemy_angle) == 1\n        fire\n    else\n        wait`;
    expect(errorsOf(source)).toEqual([]);
  });

  it('refuses to compile a program with such an error', () => {
    expect(compileScript('def f()\n    f()')).toEqual({ ok: false, errors: [{ line: 1, message: '"f" calls itself' }] });
  });
});

describe('functions: running', () => {
  it('runs the body when called, and carries on after the call', () => {
    const actions = runTicks('def shoot()\n    aim enemy\n    fire\n\nloop\n    shoot()\n    turn left', 6);
    expect(actions.map(done)).toEqual(['aim enemy', 'fire', 'turn left', 'aim enemy', 'fire', 'turn left']);
  });

  it('records the line of the call and then the lines of the body, tick by tick', () => {
    const actions = runTicks('def shoot()\n    aim enemy\n    fire\n\nloop\n    shoot()\n    turn left', 4);
    expect(actions.map((action) => action.executedLines)).toEqual([[5, 6, 2], [3], [7], [5, 6, 2]]);
  });

  it('does not run a definition by itself', () => {
    const [action] = runTicks('def shoot()\n    fire\nwait', 1);
    expect(action).toMatchObject({ fire: false, executedLines: [3] });
  });

  it('passes values in, and keeps them apart from the variables of the program', () => {
    const source = 'set limit = 1\ndef f(limit)\n    set seen = limit\n    set limit = limit * 2\n    set doubled = limit\nloop\n    f(21)\n    wait';
    const [action] = runTicks(source, 1);
    const values = Object.fromEntries(action.assignments.map(({ name, value }) => [name, value]));
    expect(values).toEqual({ limit: 1, 'f.limit': 42, seen: 21, doubled: 42 });
  });

  it('shares every other variable with the rest of the program', () => {
    const source = 'set count = 0\ndef bump()\n    set count = count + 1\nloop\n    bump()\n    bump()\n    if count == 4\n        fire\n    else\n        wait';
    expect(runTicks(source, 2).map(done)).toEqual(['nothing', 'fire']);
  });

  it('gives back the value of return, and 0 from a function that returns none', () => {
    expect(valueOf(ABS, 'abs(-5) + abs(3)')).toBe(8);
    expect(valueOf('def nothing()\n    return', 'nothing() + 1')).toBe(1);
    expect(valueOf('def nothing()\n    set y = 3', 'nothing() + 1')).toBe(1);
    expect(valueOf('def half(v)\n    return v / 2', 'half(enemy_distance)', { enemyDistance: 300 })).toBe(150);
  });

  it('stops at the first return it reaches', () => {
    const source = 'def sign(v)\n    if v < 0\n        return -1\n    if v > 0\n        return 1\n    return 0';
    expect(valueOf(source, 'sign(-7) * 100 + sign(7) * 10 + sign(0)')).toBe(-90);
  });

  it('leaves a function at return, also from inside a loop, and goes on after the call', () => {
    const source = 'def turn_until_seen()\n    loop\n        if enemy_visible\n            return\n        turn left\n\nturn_until_seen()\nloop\n    fire';
    const actions = run(source, [{}, {}, { enemyVisible: true }, { enemyVisible: true }]);
    expect(actions.map(done)).toEqual(['turn left', 'turn left', 'fire', 'fire']);
  });

  it('works out all the values of a call before it passes any on', () => {
    // The inner call uses the same parameter as the outer one.
    expect(valueOf('def add(a, b)\n    return a + b', 'add(add(1, 2), add(10, 20))')).toBe(33);
  });

  it('takes one function call inside another across ticks', () => {
    const source = 'def aim_at()\n    aim enemy\ndef shoot()\n    aim_at()\n    fire\nloop\n    shoot()';
    const actions = runTicks(source, 4);
    expect(actions.map(done)).toEqual(['aim enemy', 'fire', 'aim enemy', 'fire']);
    expect(actions.map((action) => action.executedLines)).toEqual([[6, 7, 4, 2], [5], [6, 7, 4, 2], [5]]);
  });

  it('records the lines a function runs in the middle of a condition', () => {
    const [action] = runTicks(`${ABS}\nloop\n    if abs(aim_angle) > 2\n        aim enemy\n    else\n        fire`, 1, { aimAngle: -30 });
    // The if, then the function it calls (taking the first return), then the branch.
    expect(action.executedLines).toEqual([5, 6, 2, 3, 7]);
    expect(done(action)).toBe('aim enemy');
  });

  it('records each value passed in as an assignment to the parameter, at the line of the call', () => {
    const [action] = runTicks('def f(a, b)\n    wait\nloop\n    f(1, hp)', 1, { hp: 70 });
    expect(action.assignments).toEqual([
      { afterLines: 2, name: 'f.a', value: 1 },
      { afterLines: 2, name: 'f.b', value: 70 },
    ]);
  });

  it('counts the lines of functions towards the limit of lines per tick', () => {
    const result = compileScript('def idle()\n    set n = n + 1\nloop\n    idle()', 10);
    if (!result.ok) throw new Error('Expected the program to compile');
    const action = result.brain.decide(QUIET_CONTEXT);
    expect(action.status).toBe('stalled');
    expect(action.executedLines).toHaveLength(10);
  });

  it('finishes when the program ends, whatever functions it has', () => {
    const actions = runTicks('def shoot()\n    fire\nshoot()', 2);
    expect(actions.map((action) => action.status)).toEqual(['running', 'finished']);
  });
});
