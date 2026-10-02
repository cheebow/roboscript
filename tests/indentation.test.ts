import { describe, expect, it } from 'vitest';
import { indentFor } from '../src/ai/indentation';

/** The indentation the last line of the text should have. */
function indentOfLast(text: string): number {
  const lines = text.split('\n');
  return indentFor(lines, lines.length - 1, 4);
}

describe('indentFor', () => {
  it('starts at the left edge', () => {
    expect(indentOfLast('')).toBe(0);
    expect(indentOfLast('\n\n')).toBe(0);
  });

  it('goes one step deeper after a line that opens a block', () => {
    expect(indentOfLast('loop\n')).toBe(4);
    expect(indentOfLast('loop\n    if blocked\n')).toBe(8);
    expect(indentOfLast('loop\n    while hp > 50   # comment\n')).toBe(8);
    expect(indentOfLast('if blocked\n    fire\nelse\n')).toBe(4);
  });

  it('goes one step deeper after the first line of a function', () => {
    expect(indentOfLast('def approach(limit)\n')).toBe(4);
    expect(indentOfLast('def approach(limit)\n    drive forward\n')).toBe(4);
  });

  it('stays level after any other line', () => {
    expect(indentOfLast('loop\n    fire\n')).toBe(4);
    expect(indentOfLast('set n = 0\n')).toBe(0);
    // A variable whose name starts like a keyword does not open a block.
    expect(indentOfLast('loop\n    set iffy = 1\n    set iffy = 2\n')).toBe(4);
  });

  it('looks past blank lines and comment lines', () => {
    expect(indentOfLast('loop\n    fire\n\n        # note\n')).toBe(4);
  });

  it('lines an else up with its if', () => {
    expect(indentOfLast('if blocked\n    fire\n    else')).toBe(0);
    expect(indentOfLast('loop\n    if blocked\n        fire\n        else')).toBe(4);
    expect(indentOfLast('if blocked\nelse')).toBe(0);
  });

  it('picks the nearest if that has no else yet', () => {
    const nested = 'if a\n    if b\n        fire\n    else\n        wait\n        else';
    expect(indentOfLast(nested)).toBe(0);
    expect(indentOfLast('if a\n    fire\nelse\n    if b\n        fire\n        else')).toBe(4);
  });

  it('keeps an else at the if the player moved it back to', () => {
    expect(indentOfLast('if a\n    if b\n        fire\nelse')).toBe(0);
    expect(indentOfLast('if a\n    if b\n        fire\n    else')).toBe(4);
    // Between two levels, it goes to the one on its left.
    expect(indentOfLast('if a\n    if b\n        fire\n  else')).toBe(0);
  });

  it('leaves an else without an if where it would be otherwise', () => {
    expect(indentOfLast('loop\n    fire\n    else')).toBe(4);
  });
});
