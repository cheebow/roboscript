import { describe, expect, it } from 'vitest';
import type { IfNode, LoopNode, SetNode, WhileNode } from '../src/ai/ast';
import { parse } from '../src/ai/parser';
import { formatError } from '../src/ai/script_error';
import { SAMPLE_AI } from '../src/data/templates/sample';

function parseOk(source: string) {
  const { program, errors } = parse(source);
  expect(errors).toEqual([]);
  if (program === null) throw new Error('Expected a program');
  return program.body;
}

function errorsOf(source: string): string[] {
  const { program, errors } = parse(source);
  if (errors.length > 0) expect(program).toBeNull();
  return errors.map(formatError);
}

function conditionOf(expression: string) {
  const [statement] = parseOk(`if ${expression}\n    fire`);
  return (statement as IfNode).condition;
}

/** The value of `set x = <expression>`; `n` is available as a variable. */
function valueOf(expression: string) {
  const body = parseOk(`set n = 0\nset x = ${expression}`);
  return (body[1] as SetNode).value;
}

const VISIBLE = { kind: 'boolean_variable', name: 'enemy_visible' };
const number = (value: number) => ({ kind: 'number', value });
const sensor = (name: string) => ({ kind: 'sensor', name });
const variable = (name: string) => ({ kind: 'variable', name });
const arithmetic = (operator: string, left: unknown, right: unknown) => ({ kind: 'arithmetic', operator, left, right });
const comparison = (name: string, operator: string, value: number) => ({
  kind: 'comparison',
  operator,
  left: sensor(name),
  right: number(value),
});

describe('parser: statements', () => {
  it('parses every command', () => {
    const source = ['turn left', 'turn right', 'turn enemy', 'turn cover', 'fire', 'guard', 'wait', 'label EVADE'].join('\n');
    expect(parseOk(source)).toEqual([
      { kind: 'turn', line: 1, direction: 'left' },
      { kind: 'turn', line: 2, direction: 'right' },
      { kind: 'turn', line: 3, direction: 'enemy' },
      { kind: 'turn', line: 4, direction: 'cover' },
      { kind: 'fire', line: 5 },
      { kind: 'guard', line: 6 },
      { kind: 'wait', line: 7 },
      { kind: 'label', line: 8, label: 'EVADE' },
    ]);
  });

  it('parses the settings of the drive', () => {
    expect(parseOk('drive forward\ndrive backward\ndrive stop')).toEqual([
      { kind: 'drive', line: 1, setting: 'forward' },
      { kind: 'drive', line: 2, setting: 'backward' },
      { kind: 'drive', line: 3, setting: 'stop' },
    ]);
  });

  it('parses the directions of the turret', () => {
    const directions = ['left', 'right', 'enemy', 'lead', 'ahead'];
    expect(parseOk(directions.map((direction) => `aim ${direction}`).join('\n'))).toEqual(
      directions.map((direction, index) => ({ kind: 'aim', line: index + 1, direction })),
    );
  });

  it('parses a plain if', () => {
    expect(parseOk('if enemy_visible\n    fire')).toEqual([
      { kind: 'if', line: 1, condition: VISIBLE, thenBody: [{ kind: 'fire', line: 2 }], elseLine: null, elseBody: [] },
    ]);
  });

  it('parses if / else', () => {
    expect(parseOk('if enemy_visible\n    fire\nelse\n    turn right')).toEqual([
      {
        kind: 'if',
        line: 1,
        condition: VISIBLE,
        thenBody: [{ kind: 'fire', line: 2 }],
        elseLine: 3,
        elseBody: [{ kind: 'turn', line: 4, direction: 'right' }],
      },
    ]);
  });

  it('parses loop', () => {
    expect(parseOk('loop\n    fire\n    wait')).toEqual([
      {
        kind: 'loop',
        line: 1,
        body: [
          { kind: 'fire', line: 2 },
          { kind: 'wait', line: 3 },
        ],
      },
    ]);
  });

  it('parses while with its condition', () => {
    expect(parseOk('while hp > 50 and enemy_visible\n    fire\nwait')).toEqual([
      {
        kind: 'while',
        line: 1,
        condition: { kind: 'and', left: comparison('hp', '>', 50), right: VISIBLE },
        body: [{ kind: 'fire', line: 2 }],
      },
      { kind: 'wait', line: 3 },
    ]);
  });

  it('parses set', () => {
    expect(parseOk('set count = 3')).toEqual([{ kind: 'set', line: 1, name: 'count', value: number(3) }]);
  });

  it('parses the sample AI: three functions and a loop that chooses between them', () => {
    const { program, errors } = parse(SAMPLE_AI);
    expect(errors).toEqual([]);
    if (program === null) throw new Error('Expected the sample to parse');

    expect([...program.functions.keys()]).toEqual(['avoid', 'attack', 'search']);
    expect(program.functions.get('avoid')).toEqual({
      name: 'avoid',
      line: 4,
      params: [],
      body: [
        { kind: 'label', line: 5, label: 'SEARCH' },
        { kind: 'turn', line: 6, direction: 'left' },
      ],
    });
    const attack = program.functions.get('attack');
    expect(attack).toMatchObject({ line: 9, params: ['distance'] });
    expect(attack?.body).toEqual([
      { kind: 'turn', line: 10, direction: 'enemy' },
      {
        kind: 'if',
        line: 12,
        condition: {
          kind: 'comparison',
          operator: '<',
          left: { kind: 'sensor', name: 'enemy_distance' },
          right: { kind: 'variable', name: 'attack.distance' },
        },
        thenBody: [
          { kind: 'label', line: 13, label: 'ATTACK' },
          { kind: 'drive', line: 14, setting: 'stop' },
          { kind: 'fire', line: 15 },
        ],
        elseLine: 16,
        elseBody: [
          { kind: 'label', line: 17, label: 'TRACK' },
          { kind: 'drive', line: 18, setting: 'forward' },
        ],
      },
    ]);

    expect(program.body.map((statement) => statement.kind)).toEqual(['loop']);
    const loop = program.body[0] as LoopNode;
    expect(loop.line).toBe(25);
    const blocked = loop.body[0] as IfNode;
    expect(blocked).toMatchObject({ line: 26, condition: { kind: 'boolean_variable', name: 'blocked' }, elseLine: 28 });
    expect(blocked.thenBody).toEqual([{ kind: 'call', line: 27, name: 'avoid', args: [] }]);

    const inSight = blocked.elseBody[0] as IfNode;
    expect(inSight).toMatchObject({ line: 29, condition: VISIBLE, elseLine: 31 });
    expect(inSight.thenBody).toEqual([{ kind: 'call', line: 30, name: 'attack', args: [number(250)] }]);
    expect(inSight.elseBody).toEqual([{ kind: 'call', line: 32, name: 'search', args: [] }]);
  });

  it('nests loops, whiles and ifs, and returns to the outer block after them', () => {
    const body = parseOk('loop\n  while enemy_visible\n    fire\n  if blocked\n    turn left\n  wait\nfire');
    const loop = body[0] as LoopNode;
    expect(loop.body.map((statement) => statement.kind)).toEqual(['while', 'if', 'wait']);
    expect((loop.body[0] as WhileNode).body).toEqual([{ kind: 'fire', line: 3 }]);
    expect(body[1]).toEqual({ kind: 'fire', line: 7 });
  });

  it('accepts an empty program', () => {
    expect(parseOk('\n# nothing here\n')).toEqual([]);
  });
});

describe('parser: conditions', () => {
  it('parses each comparison operator', () => {
    for (const operator of ['<', '>', '<=', '>=', '==', '!=']) {
      expect(conditionOf(`hp ${operator} 50`)).toEqual(comparison('hp', operator, 50));
    }
  });

  it('accepts every true/false value on its own', () => {
    for (const name of ['enemy_visible', 'blocked', 'blocked_behind']) {
      expect(conditionOf(name)).toEqual({ kind: 'boolean_variable', name });
    }
  });

  it('compares against negative numbers, other values and arithmetic', () => {
    expect(conditionOf('enemy_angle > -10')).toEqual(comparison('enemy_angle', '>', -10));
    expect(conditionOf('hp < ammo')).toEqual({ kind: 'comparison', operator: '<', left: sensor('hp'), right: sensor('ammo') });
    expect(conditionOf('hp + 10 < ammo * 2')).toEqual({
      kind: 'comparison',
      operator: '<',
      left: arithmetic('+', sensor('hp'), number(10)),
      right: arithmetic('*', sensor('ammo'), number(2)),
    });
  });

  it('parses not', () => {
    expect(conditionOf('not enemy_visible')).toEqual({ kind: 'not', operand: VISIBLE });
  });

  it('binds and tighter than or, and not tighter than and', () => {
    expect(conditionOf('hp < 30 or enemy_visible and ammo > 0')).toEqual({
      kind: 'or',
      left: comparison('hp', '<', 30),
      right: { kind: 'and', left: VISIBLE, right: comparison('ammo', '>', 0) },
    });
    expect(conditionOf('not enemy_visible and hp < 30')).toEqual({
      kind: 'and',
      left: { kind: 'not', operand: VISIBLE },
      right: comparison('hp', '<', 30),
    });
  });

  it('groups conditions with parentheses', () => {
    expect(conditionOf('(hp < 30 or enemy_visible) and ammo > 0')).toEqual({
      kind: 'and',
      left: { kind: 'or', left: comparison('hp', '<', 30), right: VISIBLE },
      right: comparison('ammo', '>', 0),
    });
    expect(conditionOf('not (enemy_visible and blocked)')).toEqual({
      kind: 'not',
      operand: { kind: 'and', left: VISIBLE, right: { kind: 'boolean_variable', name: 'blocked' } },
    });
  });

  it('tells arithmetic in parentheses from a condition in parentheses', () => {
    expect(conditionOf('(hp + 10) * 2 > 100')).toEqual({
      kind: 'comparison',
      operator: '>',
      left: arithmetic('*', arithmetic('+', sensor('hp'), number(10)), number(2)),
      right: number(100),
    });
  });
});

describe('parser: arithmetic', () => {
  it('multiplies and divides before it adds and subtracts, left to right', () => {
    expect(valueOf('1 + 2 * 3')).toEqual(arithmetic('+', number(1), arithmetic('*', number(2), number(3))));
    expect(valueOf('10 - 4 - 3')).toEqual(arithmetic('-', arithmetic('-', number(10), number(4)), number(3)));
    expect(valueOf('8 / 4 / 2')).toEqual(arithmetic('/', arithmetic('/', number(8), number(4)), number(2)));
  });

  it('lets parentheses override that', () => {
    expect(valueOf('(1 + 2) * 3')).toEqual(arithmetic('*', arithmetic('+', number(1), number(2)), number(3)));
  });

  it('reads variables of the program and sensor values', () => {
    expect(valueOf('n + enemy_distance')).toEqual(arithmetic('+', variable('n'), sensor('enemy_distance')));
  });

  it('negates values', () => {
    expect(valueOf('-5')).toEqual(number(-5));
    expect(valueOf('-n')).toEqual({ kind: 'negate', operand: variable('n') });
    expect(valueOf('3 - -2')).toEqual(arithmetic('-', number(3), number(-2)));
  });
});

describe('parser: errors', () => {
  it('reports an unknown command with its line', () => {
    expect(errorsOf('fire\n\nshoot')).toEqual(['Line 3: Unknown command "shoot"']);
    expect(errorsOf('for hp < 3\n    fire')[0]).toBe('Line 1: Unknown command "for"');
  });

  it('reports a missing condition', () => {
    expect(errorsOf('if\n    fire')).toEqual(['Line 1: Expected condition']);
    expect(errorsOf('while\n    fire')).toEqual(['Line 1: Expected condition']);
  });

  it('reports an else without an if', () => {
    expect(errorsOf('fire\nelse\n    wait')).toEqual(['Line 2: Unexpected else']);
    expect(errorsOf('loop\n    fire\nelse\n    wait')).toEqual(['Line 3: Unexpected else']);
  });

  it('reports a missing block after if, else, loop and while', () => {
    expect(errorsOf('if enemy_visible\nfire')).toEqual(['Line 1: Expected indented block']);
    expect(errorsOf('if enemy_visible\n    fire\nelse\nfire')).toEqual(['Line 3: Expected indented block']);
    expect(errorsOf('loop')).toEqual(['Line 1: Expected indented block']);
    expect(errorsOf('while enemy_visible\nfire')).toEqual(['Line 1: Expected indented block']);
  });

  it('reports indentation that opens no block', () => {
    expect(errorsOf('fire\n    wait')).toEqual(['Line 2: Unexpected indent']);
    expect(errorsOf('    fire')).toEqual(['Line 1: Unexpected indent']);
  });

  it('reports a dedent that matches no outer block', () => {
    expect(errorsOf('if enemy_visible\n        fire\n    wait')).toEqual([
      'Line 3: Indent does not match any outer block',
    ]);
  });

  it('reports bad command arguments', () => {
    expect(errorsOf('drive')).toEqual(['Line 1: Expected "forward", "backward" or "stop" after "drive"']);
    expect(errorsOf('drive up')).toEqual(['Line 1: Unknown direction "up"']);
    expect(errorsOf('face')).toEqual(['Line 1: Expected what to face after "face": enemy, cover or hit']);
    expect(errorsOf('face left')).toEqual([
      'Line 1: "face left" is not a thing to face: use face enemy, face cover or face hit (or "turn left")',
    ]);
    expect(errorsOf('loop\n    face hit')).toEqual([]);
    expect(errorsOf('drive enemy')).toEqual(['Line 1: Unknown direction "enemy"']);
    expect(errorsOf('drive left')).toEqual(['Line 1: Robots cannot drive sideways: use "turn left" and "drive forward"']);
    expect(errorsOf('drive forward fast')).toEqual(['Line 1: Unexpected "fast" after "drive forward"']);
    expect(errorsOf('turn around')).toEqual(['Line 1: Unknown direction "around"']);
    expect(errorsOf('turn lead')).toEqual(['Line 1: Unknown direction "lead"']);
    expect(errorsOf('aim')).toEqual(['Line 1: Expected direction after "aim"']);
    expect(errorsOf('aim cover')).toEqual(['Line 1: Unknown direction "cover"']);
    expect(errorsOf('label')).toEqual(['Line 1: Expected a name after "label"']);
    expect(errorsOf('label 3')).toEqual(['Line 1: A label is a single word, such as HIDING: "3" is not']);
    expect(errorsOf('label LOW HP')).toEqual(['Line 1: Unexpected "HP" after "label LOW"']);
    expect(errorsOf('fire now')).toEqual(['Line 1: Unexpected "now" after "fire"']);
    expect(errorsOf('loop forever\n    fire')).toEqual(['Line 1: Unexpected "forever" after "loop"']);
  });

  it('reports a faulty set', () => {
    expect(errorsOf('set')).toEqual(['Line 1: Expected variable name after "set"']);
    expect(errorsOf('set count 1')).toEqual(['Line 1: Expected "=" after "count"']);
    expect(errorsOf('set count =')).toEqual(['Line 1: Expected value after "="']);
    expect(errorsOf('set count = 1 2')).toEqual(['Line 1: Unexpected "2"']);
    expect(errorsOf('set hp = 1')).toEqual(['Line 1: "hp" cannot be used as a variable name']);
    expect(errorsOf('set loop = 1')).toEqual(['Line 1: "loop" cannot be used as a variable name']);
  });

  it('reports a variable that is never set, but allows one set further down', () => {
    expect(errorsOf('if speed > 3\n    fire')).toEqual(['Line 1: Unknown variable "speed"']);
    expect(errorsOf('set total = count + 1')).toEqual(['Line 1: Unknown variable "count"']);
    expect(errorsOf('loop\n    if count > 3\n        fire\n    set count = count + 1\n    wait')).toEqual([]);
  });

  it('reports bad conditions', () => {
    const block = '\n    fire';
    expect(errorsOf(`if enemy_visible < 3${block}`)).toEqual(['Line 1: enemy_visible is not a number']);
    expect(errorsOf(`if hp < blocked${block}`)).toEqual(['Line 1: blocked is not a number']);
    expect(errorsOf(`if hp${block}`)).toEqual(['Line 1: Expected comparison after "hp"']);
    expect(errorsOf(`if 1${block}`)).toEqual(['Line 1: Expected comparison after "1"']);
    expect(errorsOf(`if hp <${block}`)).toEqual(['Line 1: Expected value after "<"']);
    expect(errorsOf(`if enemy_visible and${block}`)).toEqual(['Line 1: Expected condition']);
    expect(errorsOf(`if < 3${block}`)).toEqual(['Line 1: Expected condition']);
    expect(errorsOf(`if enemy_visible hp${block}`)).toEqual(['Line 1: Unexpected "hp"']);
    expect(errorsOf(`if (hp > 3${block}`)).toEqual(['Line 1: Expected ")"']);
  });

  it('takes any word as a label, also one that means something elsewhere in the language', () => {
    expect(parseOk('label HIDING\nlabel wait_for_ammo\nlabel fire\nlabel x2')).toEqual([
      { kind: 'label', line: 1, label: 'HIDING' },
      { kind: 'label', line: 2, label: 'wait_for_ammo' },
      { kind: 'label', line: 3, label: 'fire' },
      { kind: 'label', line: 4, label: 'x2' },
    ]);
  });

  it('points a program that still says "state" to "label"', () => {
    expect(errorsOf('state ATTACK')).toEqual([
      'Line 1: "state" is now "label": use "label ATTACK" (any name will do)',
    ]);
    expect(errorsOf('state')).toEqual(['Line 1: "state" is now "label": use "label NAME" (any name will do)']);
  });

  it('points a program that still says "move" to "drive"', () => {
    const hint = 'Line 1: "move" is now "drive": use "drive forward" (the robot keeps driving until "drive stop")';
    expect(errorsOf('move forward')).toEqual([hint]);
    expect(errorsOf('move')).toEqual([hint]);
  });

  it('reports every faulty line, in order', () => {
    const source = 'shoot\nloop\n    drive up\n    set hp = 2\n    jump';
    expect(errorsOf(source)).toEqual([
      'Line 1: Unknown command "shoot"',
      'Line 3: Unknown direction "up"',
      'Line 4: "hp" cannot be used as a variable name',
      'Line 5: Unknown command "jump"',
    ]);
  });

  it('reports lexer errors before anything else', () => {
    expect(errorsOf('shoot\nfire!')).toEqual(['Line 2: Unexpected character "!"']);
  });
});

describe('parser: true, false and conditions that stand on their own', () => {
  const body = '\n    fire';

  it('reads true and false as the numbers 1 and 0', () => {
    const { program } = parse('set yes = true\nset no = false\nloop\n    wait');
    expect(program?.body.slice(0, 2)).toEqual([
      { kind: 'set', line: 1, name: 'yes', value: { kind: 'number', value: 1 } },
      { kind: 'set', line: 2, name: 'no', value: { kind: 'number', value: 0 } },
    ]);
  });

  it("lets a function's result or a variable stand as a condition", () => {
    const source = `def hurt()\n    if hp < 100\n        return true\n    return false\nset ready = 1\nif hurt()${body}\nif ready${body}\nif not hurt() and ready${body}`;
    expect(errorsOf(source)).toEqual([]);
    const { program } = parse(source);
    // Functions are kept apart from the body: the body is the set and the three ifs.
    expect(program?.body[1]).toMatchObject({ kind: 'if', condition: { kind: 'truthy', value: { kind: 'call', name: 'hurt' } } });
    expect(program?.body[2]).toMatchObject({ kind: 'if', condition: { kind: 'truthy', value: { kind: 'variable' } } });
  });

  it('keeps asking for a comparison after a sensor or a number', () => {
    expect(errorsOf(`if hp${body}`)).toEqual(['Line 1: Expected comparison after "hp"']);
  });

  it('does not let true or false be a variable or function name', () => {
    expect(errorsOf('set true = 1')).toEqual(['Line 1: "true" cannot be used as a variable name']);
    expect(errorsOf('def false()\n    return 0')).toEqual(['Line 1: "false" cannot be used as a function name']);
  });
});
