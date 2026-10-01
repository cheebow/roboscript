import { describe, expect, it } from 'vitest';
import type { IfNode } from '../src/ai/ast';
import { parse } from '../src/ai/parser';
import { formatError } from '../src/ai/script_error';
import { SAMPLE_AI } from '../src/data/sample_ai';

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

const VISIBLE = { kind: 'boolean_variable', name: 'enemy_visible' };
const comparison = (name: string, operator: string, value: number) => ({
  kind: 'comparison',
  operator,
  left: { kind: 'number_variable', name },
  right: { kind: 'number', value },
});

describe('parser: statements', () => {
  it('parses every command', () => {
    const source = [
      'move forward',
      'move backward',
      'turn left',
      'turn right',
      'turn enemy',
      'fire',
      'wait',
      'state EVADE',
    ].join('\n');
    expect(parseOk(source)).toEqual([
      { kind: 'move', line: 1, direction: 'forward' },
      { kind: 'move', line: 2, direction: 'backward' },
      { kind: 'turn', line: 3, direction: 'left' },
      { kind: 'turn', line: 4, direction: 'right' },
      { kind: 'turn', line: 5, direction: 'enemy' },
      { kind: 'fire', line: 6 },
      { kind: 'wait', line: 7 },
      { kind: 'state', line: 8, state: 'EVADE' },
    ]);
  });

  it('parses a plain if', () => {
    expect(parseOk('if enemy_visible\n    fire')).toEqual([
      {
        kind: 'if',
        line: 1,
        condition: VISIBLE,
        thenBody: [{ kind: 'fire', line: 2 }],
        elseLine: null,
        elseBody: [],
      },
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

  it('parses nested blocks and returns to the outer block after them', () => {
    const body = parseOk(SAMPLE_AI);
    expect(body.map((statement) => statement.kind)).toEqual(['if']);

    const outer = body[0] as IfNode;
    expect(outer.line).toBe(1);
    expect(outer.condition).toEqual({ kind: 'boolean_variable', name: 'blocked' });
    expect(outer.thenBody).toEqual([
      { kind: 'state', line: 2, state: 'SEARCH' },
      { kind: 'turn', line: 3, direction: 'left' },
    ]);
    expect(outer.elseLine).toBe(4);
    expect(outer.elseBody.map((statement) => statement.kind)).toEqual(['if']);

    const inSight = outer.elseBody[0] as IfNode;
    expect(inSight.line).toBe(5);
    expect(inSight.condition).toEqual(VISIBLE);
    expect(inSight.thenBody.map((statement) => statement.kind)).toEqual(['turn', 'if']);
    expect(inSight.elseLine).toBe(14);
    expect(inSight.elseBody).toEqual([
      { kind: 'state', line: 15, state: 'SEARCH' },
      { kind: 'move', line: 16, direction: 'forward' },
    ]);

    const inRange = inSight.thenBody[1] as IfNode;
    expect(inRange).toEqual({
      kind: 'if',
      line: 8,
      condition: comparison('enemy_distance', '<', 250),
      thenBody: [
        { kind: 'state', line: 9, state: 'ATTACK' },
        { kind: 'fire', line: 10 },
      ],
      elseLine: 11,
      elseBody: [
        { kind: 'state', line: 12, state: 'TRACK' },
        { kind: 'move', line: 13, direction: 'forward' },
      ],
    });
  });

  it('accepts any consistent indentation width', () => {
    const body = parseOk('if enemy_visible\n  fire\n  wait\nfire');
    expect((body[0] as IfNode).thenBody).toHaveLength(2);
    expect(body[1]).toEqual({ kind: 'fire', line: 4 });
  });

  it('accepts an empty program', () => {
    expect(parseOk('\n\n')).toEqual([]);
  });
});

describe('parser: conditions', () => {
  it('parses each comparison operator', () => {
    for (const operator of ['<', '>', '<=', '>=', '==', '!=']) {
      expect(conditionOf(`hp ${operator} 50`)).toEqual(comparison('hp', operator, 50));
    }
  });

  it('compares against negative numbers and other variables', () => {
    expect(conditionOf('enemy_angle > -10')).toEqual(comparison('enemy_angle', '>', -10));
    expect(conditionOf('hp < ammo')).toEqual({
      kind: 'comparison',
      operator: '<',
      left: { kind: 'number_variable', name: 'hp' },
      right: { kind: 'number_variable', name: 'ammo' },
    });
  });

  it('accepts every boolean variable on its own', () => {
    for (const name of ['enemy_visible', 'blocked']) {
      expect(conditionOf(name)).toEqual({ kind: 'boolean_variable', name });
    }
  });

  it('parses not', () => {
    expect(conditionOf('not enemy_visible')).toEqual({ kind: 'not', operand: VISIBLE });
  });

  it('binds and tighter than or', () => {
    expect(conditionOf('hp < 30 or enemy_visible and ammo > 0')).toEqual({
      kind: 'or',
      left: comparison('hp', '<', 30),
      right: { kind: 'and', left: VISIBLE, right: comparison('ammo', '>', 0) },
    });
  });

  it('binds not tighter than and', () => {
    expect(conditionOf('not enemy_visible and hp < 30')).toEqual({
      kind: 'and',
      left: { kind: 'not', operand: VISIBLE },
      right: comparison('hp', '<', 30),
    });
  });
});

describe('parser: errors', () => {
  it('reports an unknown command with its line', () => {
    expect(errorsOf('fire\n\nshoot')).toEqual(['Line 3: Unknown command "shoot"']);
  });

  it('has no loops', () => {
    expect(errorsOf('while enemy_visible\n    fire')[0]).toBe('Line 1: Unknown command "while"');
  });

  it('reports a missing condition', () => {
    expect(errorsOf('if\n    fire')).toEqual(['Line 1: Expected condition']);
  });

  it('reports an else without an if', () => {
    expect(errorsOf('fire\nelse\n    wait')).toEqual(['Line 2: Unexpected else']);
    expect(errorsOf('if enemy_visible\n    fire\nwait\nelse\n    wait')).toEqual(['Line 4: Unexpected else']);
  });

  it('reports a missing block after if and else', () => {
    expect(errorsOf('if enemy_visible\nfire')).toEqual(['Line 1: Expected indented block']);
    expect(errorsOf('if enemy_visible\n    fire\nelse\nfire')).toEqual(['Line 3: Expected indented block']);
    expect(errorsOf('if enemy_visible')).toEqual(['Line 1: Expected indented block']);
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
    expect(errorsOf('move')).toEqual(['Line 1: Expected direction after "move"']);
    expect(errorsOf('move up')).toEqual(['Line 1: Unknown direction "up"']);
    expect(errorsOf('move enemy')).toEqual(['Line 1: Unknown direction "enemy"']);
    expect(errorsOf('move left')).toEqual([
      'Line 1: Robots cannot move sideways: use "turn left" and "move forward"',
    ]);
    expect(errorsOf('fire\nmove right')).toEqual([
      'Line 2: Robots cannot move sideways: use "turn right" and "move forward"',
    ]);
    expect(errorsOf('turn around')).toEqual(['Line 1: Unknown direction "around"']);
    expect(errorsOf('state')).toEqual(['Line 1: Expected state name after "state"']);
    expect(errorsOf('state attack')).toEqual(['Line 1: Unknown state "attack"']);
    expect(errorsOf('fire now')).toEqual(['Line 1: Unexpected "now" after "fire"']);
    expect(errorsOf('move forward fast')).toEqual(['Line 1: Unexpected "fast" after "move forward"']);
  });

  it('reports set as not supported', () => {
    expect(errorsOf('set count 1')).toEqual(['Line 1: "set" is not supported yet']);
  });

  it('reports bad conditions', () => {
    const block = '\n    fire';
    expect(errorsOf(`if speed > 3${block}`)).toEqual(['Line 1: Unknown variable "speed"']);
    expect(errorsOf(`if enemy_visible < 3${block}`)).toEqual(['Line 1: enemy_visible is not a number']);
    expect(errorsOf(`if blocked == 1${block}`)).toEqual(['Line 1: blocked is not a number']);
    expect(errorsOf(`if hp < blocked${block}`)).toEqual(['Line 1: blocked is not a number']);
    expect(errorsOf(`if hp < enemy_visible${block}`)).toEqual(['Line 1: enemy_visible is not a number']);
    expect(errorsOf(`if hp${block}`)).toEqual(['Line 1: Expected comparison after "hp"']);
    expect(errorsOf(`if hp <${block}`)).toEqual(['Line 1: Expected value after "<"']);
    expect(errorsOf(`if enemy_visible and${block}`)).toEqual(['Line 1: Expected condition']);
    expect(errorsOf(`if < 3${block}`)).toEqual(['Line 1: Expected condition']);
    expect(errorsOf(`if enemy_visible hp${block}`)).toEqual(['Line 1: Unexpected "hp"']);
  });

  it('reports every faulty line, in order', () => {
    const source = 'shoot\nif enemy_visible\n    move up\nelse\n    jump';
    expect(errorsOf(source)).toEqual([
      'Line 1: Unknown command "shoot"',
      'Line 3: Unknown direction "up"',
      'Line 5: Unknown command "jump"',
    ]);
  });

  it('reports lexer errors before anything else', () => {
    expect(errorsOf('shoot\nfire!')).toEqual(['Line 2: Unexpected character "!"']);
  });
});
