import { describe, expect, it } from 'vitest';
import { completionsAt } from '../src/ai/completion';

/** The words offered at the `|` in the text; null when nothing is offered. */
function offered(textWithCursor: string, explicit = false): string[] | null {
  const position = textWithCursor.indexOf('|');
  const source = textWithCursor.replace('|', '');
  return completionsAt(source, position, explicit)?.options.map((option) => option.word) ?? null;
}

const STATEMENTS = ['if', 'else', 'loop', 'while', 'break', 'def', 'return', 'set', 'label', 'drive', 'turn', 'face', 'aim', 'fire', 'guard', 'wait'];
const NUMBERS = [
  'enemy_distance',
  'enemy_angle',
  'hp',
  'ammo',
  'guards',
  'bullet_distance',
  'bullet_angle',
  'cover_distance',
  'cover_angle',
  'wall_ahead',
  'wall_behind',
  'wall_left',
  'wall_right',
  'aim_angle',
  'lead_angle',
  'gun_angle',
  'weapon_range',
  'enemy_speed',
  'enemy_heading',
  'reload',
  'hit_angle',
];
const SENSORS = [
  'enemy_visible',
  'blocked',
  'blocked_behind',
  'bullet_incoming',
  'cover_visible',
  'hit',
  'touching_enemy',
  'hidden',
  ...NUMBERS,
];

describe('completionsAt: statements', () => {
  it('offers the statements that start with what is typed at the start of a line', () => {
    expect(offered('w|')).toEqual(['while', 'wait']);
    expect(offered('g|')).toEqual(['guard']);
    expect(offered('loop\n    l|')).toEqual(['loop', 'label']);
    expect(offered('dr|')).toEqual(['drive']);
    expect(offered('mo|')).toBeNull();
  });

  it('offers nothing on an empty line until asked', () => {
    expect(offered('loop\n    |')).toBeNull();
    expect(offered('loop\n    |', true)).toEqual(STATEMENTS);
  });

  it('replaces the word being typed', () => {
    expect(completionsAt('loop\n    tu', 11)).toMatchObject({ from: 9 });
    expect(completionsAt('drive ', 6)).toMatchObject({ from: 6 });
  });

  it('offers nothing once the word is complete, so that Enter starts a new line', () => {
    expect(offered('fire|')).toBeNull();
    expect(offered('else|')).toBeNull();
    expect(offered('if blocked|')).toBeNull();
    expect(offered('if blocked_|')).toEqual(['blocked_behind']);
  });

  it('offers nothing after a statement that takes nothing', () => {
    expect(offered('fire |', true)).toBeNull();
    expect(offered('loop |', true)).toBeNull();
    expect(offered('else w|')).toBeNull();
  });
});

describe('completionsAt: arguments', () => {
  it('offers the directions right after drive, turn and aim', () => {
    expect(offered('drive |')).toEqual(['forward', 'backward', 'stop']);
    expect(offered('drive b|')).toEqual(['backward']);
    expect(offered('aim |')).toEqual(['left', 'right', 'enemy', 'lead', 'ahead']);
    expect(offered('aim l|')).toEqual(['left', 'lead']);
    expect(offered('turn |')).toEqual(['left', 'right', 'enemy', 'cover', 'hit']);
    expect(offered('face |')).toEqual(['enemy', 'cover', 'hit', 'back']);
    expect(offered('turn left |', true)).toBeNull();
  });

  it('offers the labels the program uses elsewhere after label, whatever the case typed', () => {
    const program = 'loop\n    label HUNTING\n    wait\n    label hiding\n    label HUNTING\n    ';
    expect(offered(`${program}label |`)).toEqual(['HUNTING', 'hiding']);
    expect(offered(`${program}label hu|`)).toEqual(['HUNTING']);
    // Any word will do as a label, so there is nothing to offer in a program without one.
    expect(offered('label |')).toBeNull();
    expect(offered('label ATT|')).toBeNull();
  });

  it('marks the words that need something after them', () => {
    const options = completionsAt('', 0, true)?.options ?? [];
    const needingMore = options.filter((option) => option.insert === `${option.word} `).map((option) => option.word);
    expect(needingMore).toEqual(['if', 'while', 'def', 'set', 'label', 'drive', 'turn', 'face', 'aim']);
    expect(options.filter((option) => option.insert === option.word).map((option) => option.word)).toEqual([
      'else',
      'loop',
      'break',
      'return',
      'fire',
      'guard',
      'wait',
    ]);
  });

  it('carries a hint and a summary for each word', () => {
    expect(completionsAt('turn ', 5)?.options[2]).toMatchObject({
      word: 'enemy',
      kind: 'direction',
      hint: 'towards the enemy',
    });
  });
});

describe('completionsAt: conditions', () => {
  it('offers the sensors, the variables of the program and "not" at the start of a condition', () => {
    expect(offered('if |')).toEqual([...SENSORS, 'not']);
    expect(offered('set shots = 0\nwhile |')).toEqual([...SENSORS, 'not', 'shots']);
    expect(offered('if blocked and |')).toEqual([...SENSORS, 'not']);
    expect(offered('if not e|')).toEqual(['enemy_visible', 'enemy_distance', 'enemy_angle', 'enemy_speed', 'enemy_heading']);
  });

  it('waits for a letter after an opening parenthesis', () => {
    expect(offered('if (|')).toBeNull();
    expect(offered('if (bl|')).toEqual(['blocked', 'blocked_behind']);
  });

  it('offers numbers only after a comparison or arithmetic, once a letter is typed', () => {
    expect(offered('if enemy_distance < |')).toBeNull();
    expect(offered('if enemy_distance < |', true)).toEqual(['true', 'false', ...NUMBERS]);
    expect(offered('set limit = 1\nif enemy_distance < li|')).toEqual(['limit']);
    expect(offered('if hp + am|')).toEqual(['ammo']);
  });

  it('offers "and" and "or" after a value', () => {
    expect(offered('if blocked a|')).toEqual(['and']);
    expect(offered('if hp < 50 o|')).toEqual(['or']);
    expect(offered('if (hp < 50) |', true)).toEqual(['and', 'or']);
    expect(offered('if blocked |')).toBeNull();
  });
});

describe('completionsAt: set', () => {
  it('offers the variables the program already has as the name', () => {
    expect(offered('set count = 0\nset other = 1\nloop\n    set c|')).toEqual(['count']);
    expect(offered('set count = 0\nset |', true)).toEqual(['count']);
  });

  it('does not offer the name being typed itself', () => {
    expect(offered('set count = 0\nset co| = 2')).toEqual(['count']);
    expect(offered('set co|')).toBeNull();
  });

  it('offers nothing between the name and the equals sign', () => {
    expect(offered('set count |', true)).toBeNull();
  });

  it('offers number sensors and variables in the value', () => {
    expect(offered('set left = am|')).toEqual(['ammo']);
    expect(offered('set n = 0\nset m = n + |', true)).toEqual(['true', 'false', ...NUMBERS, 'n', 'm']);
    expect(offered('set left = ammo |', true)).toBeNull();
  });
});

describe('completionsAt: where nothing fits', () => {
  it('offers nothing in a comment', () => {
    expect(offered('# mo|')).toBeNull();
    expect(offered('fire  # then tu|')).toBeNull();
  });

  it('offers nothing on a line it cannot read', () => {
    expect(offered('if hp ; b|')).toBeNull();
    expect(offered('if hp < 12a|')).toBeNull();
    expect(offered('250 |', true)).toBeNull();
  });
});

describe('completionsAt: functions', () => {
  const program = 'def approach(limit)\n    drive forward\ndef abs(v)\n    return v\ndef stop()\n    drive stop\n';
  const inserts = (textWithCursor: string, explicit = false) => {
    const position = textWithCursor.indexOf('|');
    const options = completionsAt(textWithCursor.replace('|', ''), position, explicit)?.options ?? [];
    return options.map((option) => option.insert);
  };

  it('offers the functions of the program at the start of a line, with their parenthesis', () => {
    expect(offered(`${program}loop\n    a|`)).toEqual(['aim', 'approach', 'abs']);
    expect(inserts(`${program}loop\n    ap|`)).toEqual(['approach(']);
    // A function that takes nothing is closed at once.
    expect(inserts(`${program}loop\n    st|`)).toEqual(['stop()']);
  });

  it('offers them in conditions and values, with what they take as the hint', () => {
    expect(offered(`${program}loop\n    if ab|`)).toEqual(['abs']);
    expect(offered(`${program}loop\n    set n = 1 + ap|`)).toEqual(['approach']);
    const position = `${program}loop\n    if ab`.length;
    expect(completionsAt(`${program}loop\n    if ab`, position)?.options[0]).toMatchObject({
      word: 'abs',
      kind: 'function',
      hint: 'abs(v)',
    });
  });

  it('offers values between the parentheses of a call, after each comma too', () => {
    expect(offered(`${program}loop\n    approach(|`, true)).toEqual(['true', 'false', ...NUMBERS, 'approach', 'abs', 'stop']);
    expect(offered(`${program}loop\n    approach(e|`)).toEqual(['enemy_distance', 'enemy_angle', 'enemy_speed', 'enemy_heading']);
    expect(offered(`${program}loop\n    if abs(1, h|`)).toEqual(['hp', 'hit_angle']);
  });

  it('offers the parameters of a function inside it, and nowhere else', () => {
    expect(offered('def approach(limit)\n    if enemy_distance > li|')).toEqual(['limit']);
    expect(offered('def approach(limit)\n    wait\nloop\n    if enemy_distance > li|')).toBeNull();
  });

  it('offers values after return', () => {
    expect(offered('def f(first)\n    return fi|')).toEqual(['first']);
    expect(offered('def f(first)\n    return |')).toBeNull();
  });

  it('offers nothing while a function is being named', () => {
    expect(offered('def a|')).toBeNull();
    expect(offered('def f(a|', true)).toBeNull();
  });
});
