import { describe, expect, it } from 'vitest';
import {
  describeAt,
  describeWord,
  enclosingFunction,
  programFunctions,
  programLabels,
  programVariables,
} from '../src/ai/reference';
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

describe('programFunctions', () => {
  const source = 'def approach(limit, slack)\n    wait\n\ndef stop()  # def later()\n    drive stop\nloop\n    def inner()\n    stop()';

  it('lists the functions a program defines, with what they take and where', () => {
    expect(programFunctions(source)).toEqual([
      { name: 'approach', params: ['limit', 'slack'], line: 1 },
      { name: 'stop', params: [], line: 4 },
    ]);
  });

  it('tells which function a position is inside of', () => {
    expect(enclosingFunction(source, source.indexOf('wait'))?.name).toBe('approach');
    expect(enclosingFunction(source, source.indexOf('drive stop'))?.name).toBe('stop');
    expect(enclosingFunction(source, source.indexOf('stop()', source.indexOf('loop')))).toBeNull();
    expect(enclosingFunction(source, 0)).toBeNull();
  });
});

describe('describeAt: functions', () => {
  const source = 'set limit = 9\ndef approach(limit)\n    if enemy_distance > limit\n        drive forward\nloop\n    approach(limit)\n    wait';

  it('describes a function by what it takes and where it is defined', () => {
    const description = describeAt(source, source.lastIndexOf('approach') + 2);
    expect(description).toMatchObject({ word: 'approach', kind: 'function' });
    expect(description?.summary).toBe('Function approach(limit) of this program, defined on line 2.');
  });

  it('describes a name as a parameter inside its function, and as a variable outside', () => {
    expect(describeAt(source, source.indexOf('> limit') + 3)?.summary).toBe('A value passed to approach(limit).');
    expect(describeAt(source, source.lastIndexOf('limit') + 1)?.summary).toContain('first set on line 1');
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

  it('describes a word after turn, aim or face as a direction, not as the sensor of that name', () => {
    for (const command of ['turn', 'face']) {
      const line = `${command} hit`;
      expect(describeAt(line, line.length - 1)?.kind).toBe('direction');
    }
    expect(describeAt('if hit', 4)?.kind).toBe('sensor');
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
