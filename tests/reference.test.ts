import { describe, expect, it } from 'vitest';
import { describeAt, describeWord, programLabels, programVariables } from '../src/ai/reference';
import {
  AIM_DIRECTIONS,
  BOOLEAN_VARIABLES,
  DRIVE_SETTINGS,
  KEYWORDS,
  NUMBER_VARIABLES,
  TURN_DIRECTIONS,
} from '../src/ai/script_variables';

describe('describeWord', () => {
  it('describes every word of the language', () => {
    const words = [
      ...KEYWORDS,
      ...Object.keys(BOOLEAN_VARIABLES),
      ...Object.keys(NUMBER_VARIABLES),
      ...DRIVE_SETTINGS,
      ...TURN_DIRECTIONS,
      ...AIM_DIRECTIONS,
    ];
    for (const word of words) {
      const reference = describeWord(word);
      expect(reference, word).toBeDefined();
      expect(reference?.hint.length, word).toBeGreaterThan(0);
      expect(reference?.hint.length, word).toBeLessThanOrEqual(34);
      expect(reference?.summary, word).toMatch(/\.$/);
    }
  });

  it('knows nothing about other words', () => {
    expect(describeWord('count')).toBeUndefined();
    expect(describeWord('idle')).toBeUndefined();
    // Labels are the player's own words now, not words of the language.
    expect(describeWord('ATTACK')).toBeUndefined();
    expect(describeWord('state')).toBeUndefined();
  });
});

describe('programVariables', () => {
  it('lists the variables a program sets, with the line that first sets each', () => {
    const source = 'set shots = 0\nloop\n    set shots = shots + 1\n    set  left = ammo # set later = 1\n    wait';
    expect(programVariables(source)).toEqual([
      { name: 'shots', line: 1 },
      { name: 'left', line: 4 },
    ]);
  });

  it('leaves out comments and names that are not allowed', () => {
    expect(programVariables('# set a = 1\nset hp = 1\nset loop = 2\nreset = 3')).toEqual([]);
  });
});

describe('programLabels', () => {
  it('lists the names a program gives with label, each once, in the order they first appear', () => {
    const source = 'label SEARCH\nloop\n    label hiding  # label LATER\n    label SEARCH\n    wait';
    expect(programLabels(source)).toEqual(['SEARCH', 'hiding']);
  });

  it('is empty for a program without labels', () => {
    expect(programLabels('loop\n    wait')).toEqual([]);
  });
});

describe('describeAt', () => {
  const source = 'set n = 0\nloop\n    if blocked_behind and n < 3   # turn here\n        turn left';
  const at = (text: string, offset = 1) => describeAt(source, source.indexOf(text) + offset);

  it('describes the word under the position, wherever in the word it is', () => {
    const start = source.indexOf('blocked_behind');
    for (const offset of [0, 7, 'blocked_behind'.length]) {
      expect(at('blocked_behind', offset)).toMatchObject({
        word: 'blocked_behind',
        kind: 'sensor',
        from: start,
        to: start + 'blocked_behind'.length,
      });
    }
    expect(at('loop')?.summary).toContain('forever');
    expect(at('left')?.kind).toBe('direction');
  });

  it('describes a variable of the program by where it is first set', () => {
    expect(at('n < 3', 0)).toMatchObject({ word: 'n', kind: 'variable' });
    expect(at('n < 3', 0)?.summary).toContain('line 1');
  });

  it('has nothing to say about numbers, symbols, blanks or comments', () => {
    expect(at('3   #', 0)).toBeNull();
    expect(at('< 3', 0)).toBeNull();
    expect(describeAt(source, source.indexOf('    if') + 1)).toBeNull();
    expect(at('turn here')).toBeNull();
  });
});
