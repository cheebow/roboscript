import { describe, expect, it } from 'vitest';
import { lex } from '../src/ai/lexer';

describe('lexer', () => {
  it('splits a line into words, numbers and operators', () => {
    const { lines, errors } = lex('if enemy_distance <= 250');
    expect(errors).toEqual([]);
    expect(lines).toEqual([
      {
        line: 1,
        indent: 0,
        tokens: [
          { type: 'word', text: 'if' },
          { type: 'word', text: 'enemy_distance' },
          { type: 'operator', text: '<=' },
          { type: 'number', text: '250', value: 250 },
        ],
      },
    ]);
  });

  it('reads every comparison operator', () => {
    const { lines } = lex('< > <= >= == !=');
    expect(lines[0].tokens.map((token) => token.text)).toEqual(['<', '>', '<=', '>=', '==', '!=']);
  });

  it('reads negative and decimal numbers', () => {
    const { lines } = lex('if enemy_angle>-12.5');
    expect(lines[0].tokens.at(-1)).toEqual({ type: 'number', text: '-12.5', value: -12.5 });
  });

  it('measures indentation and keeps original line numbers across blank lines', () => {
    const { lines } = lex('fire\n\n    wait\n   \n        fire');
    expect(lines.map(({ line, indent }) => ({ line, indent }))).toEqual([
      { line: 1, indent: 0 },
      { line: 3, indent: 4 },
      { line: 5, indent: 8 },
    ]);
  });

  it('accepts Windows line endings', () => {
    const { lines, errors } = lex('fire\r\nwait\r\n');
    expect(errors).toEqual([]);
    expect(lines.map((line) => line.tokens[0].text)).toEqual(['fire', 'wait']);
  });

  it('rejects tabs used for indentation', () => {
    expect(lex('if enemy_visible\n\tfire').errors).toEqual([
      { line: 2, message: 'Tabs are not allowed for indentation' },
    ]);
  });

  it('rejects characters outside the language', () => {
    expect(lex('fire\nmove forward;').errors).toEqual([{ line: 2, message: 'Unexpected character ";"' }]);
  });
});
