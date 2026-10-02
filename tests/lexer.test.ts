import { describe, expect, it } from 'vitest';
import { lex } from '../src/ai/lexer';

function texts(source: string): string[] {
  return lex(source).lines[0].tokens.map((token) => token.text);
}

describe('lexer', () => {
  it('splits a line into words, numbers and symbols', () => {
    const { lines, errors } = lex('if enemy_distance <= 250');
    expect(errors).toEqual([]);
    expect(lines).toEqual([
      {
        line: 1,
        indent: 0,
        tokens: [
          { type: 'word', text: 'if' },
          { type: 'word', text: 'enemy_distance' },
          { type: 'symbol', text: '<=' },
          { type: 'number', text: '250', value: 250 },
        ],
      },
    ]);
  });

  it('reads every comparison operator', () => {
    expect(texts('< > <= >= == !=')).toEqual(['<', '>', '<=', '>=', '==', '!=']);
  });

  it('reads arithmetic, parentheses and assignment, with or without spaces', () => {
    expect(texts('set n = (n+1) * 2 - 3/4')).toEqual(['set', 'n', '=', '(', 'n', '+', '1', ')', '*', '2', '-', '3', '/', '4']);
    expect(texts('set n=n-1')).toEqual(['set', 'n', '=', 'n', '-', '1']);
  });

  it('reads decimal numbers, and a minus sign as a symbol of its own', () => {
    const { tokens } = lex('if enemy_angle > -12.5').lines[0];
    expect(tokens.slice(-2)).toEqual([
      { type: 'symbol', text: '-' },
      { type: 'number', text: '12.5', value: 12.5 },
    ]);
  });

  it('measures indentation and keeps original line numbers across blank lines', () => {
    const { lines } = lex('fire\n\n    wait\n   \n        fire');
    expect(lines.map(({ line, indent }) => ({ line, indent }))).toEqual([
      { line: 1, indent: 0 },
      { line: 3, indent: 4 },
      { line: 5, indent: 8 },
    ]);
  });

  it('ignores comments, whether they fill a line or follow code', () => {
    const { lines, errors } = lex('# a note\nfire   # shoot!\n    # indented note\nwait');
    expect(errors).toEqual([]);
    expect(lines.map(({ line, tokens }) => ({ line, text: tokens.map((token) => token.text).join(' ') }))).toEqual([
      { line: 2, text: 'fire' },
      { line: 4, text: 'wait' },
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
    expect(lex('fire\ndrive forward;').errors).toEqual([{ line: 2, message: 'Unexpected character ";"' }]);
  });
});
