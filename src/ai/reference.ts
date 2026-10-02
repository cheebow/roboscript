import { MATCH_DEFAULTS } from '../data/match_defaults';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { isReservedWord } from './script_variables';

/** What part a word plays in the language. */
export type WordKind = 'control' | 'command' | 'sensor' | 'direction' | 'variable' | 'label';

/** What a word of RoboScript means, as told to the player while writing. */
export interface WordReference {
  word: string;
  kind: WordKind;
  /** A few words, shown next to the word in a list. */
  hint: string;
  /** A full sentence or two. */
  summary: string;
}

const NO_TIME = 'Takes no time.';
const NOT_THE_ENEMY = 'The enemy does not count.';
const ANGLE = 'in degrees: 0 is straight ahead, positive is to the right';
const BULLET_STEP = Math.round(ROBOT_DEFAULTS.shotSpeed / MATCH_DEFAULTS.tickRate);
const GUARDED_SHARE = `${Math.round(ROBOT_DEFAULTS.guardDamageFactor * 100)}%`;
const GUARD_RECOVERY = `${ROBOT_DEFAULTS.guardRecovery} s`;

const LANGUAGE: readonly WordReference[] = [
  {
    word: 'if',
    kind: 'control',
    hint: 'run lines when a condition holds',
    summary: `Runs the indented lines below when the condition holds. ${NO_TIME}`,
  },
  {
    word: 'else',
    kind: 'control',
    hint: 'otherwise',
    summary: 'Runs the indented lines below when the condition of the "if" above does not hold.',
  },
  {
    word: 'loop',
    kind: 'control',
    hint: 'repeat forever',
    summary: 'Repeats the indented lines below forever. Without a loop, the program runs once and the robot stops.',
  },
  {
    word: 'while',
    kind: 'control',
    hint: 'repeat while a condition holds',
    summary: 'Repeats the indented lines below for as long as the condition holds.',
  },
  { word: 'and', kind: 'control', hint: 'both conditions', summary: 'Holds when the conditions on both sides hold.' },
  { word: 'or', kind: 'control', hint: 'either condition', summary: 'Holds when at least one of the two conditions holds.' },
  { word: 'not', kind: 'control', hint: 'the opposite', summary: 'Holds when the condition after it does not.' },
  {
    word: 'set',
    kind: 'command',
    hint: 'give a variable a value',
    summary: `Gives a variable a number: set name = value. A variable reads as 0 until it is set. ${NO_TIME}`,
  },
  {
    word: 'label',
    kind: 'command',
    hint: 'name what the robot is doing',
    summary: `Names what the robot is doing, with any word: label HIDING. The name is shown under the robot, and logged when it changes. It changes nothing else. ${NO_TIME}`,
  },
  {
    word: 'drive',
    kind: 'command',
    hint: 'set how the hull drives',
    summary: `Sets how the hull drives from now on: forward, backward or stop. It keeps driving while the program turns, aims and fires. ${NO_TIME}`,
  },
  {
    word: 'turn',
    kind: 'command',
    hint: 'turn the hull, 1 tick',
    summary: 'Turns the hull left, right, towards the enemy or towards cover for one tick. The turret turns with it.',
  },
  {
    word: 'aim',
    kind: 'command',
    hint: 'turn the turret, 1 tick',
    summary: 'Turns the turret for one tick: left, right, at the enemy, at where the enemy will be (lead) or back to the front of the hull (ahead).',
  },
  {
    word: 'fire',
    kind: 'command',
    hint: 'shoot, 1 tick',
    summary: 'Fires the gun the way the turret points. Takes one tick; nothing is fired while the gun cools down or when out of ammo.',
  },
  {
    word: 'guard',
    kind: 'command',
    hint: 'brace against hits, 1 tick',
    summary: `Braces for one tick: a bullet that hits during it does only ${GUARDED_SHARE} of its damage. A robot can guard for ${ROBOT_DEFAULTS.maxGuards} ticks in a match (see guards), and each of them puts off its own next shot by ${GUARD_RECOVERY}: guard on the tick the bullet hits, not before.`,
  },
  { word: 'wait', kind: 'command', hint: 'do nothing, 1 tick', summary: 'Does nothing for one tick.' },
  { word: 'forward', kind: 'direction', hint: 'the way the hull faces', summary: 'The way the hull is facing.' },
  { word: 'backward', kind: 'direction', hint: 'away from where it faces', summary: 'Opposite to the way the hull is facing.' },
  { word: 'stop', kind: 'direction', hint: 'stand still', summary: 'Stops driving.' },
  { word: 'left', kind: 'direction', hint: 'counterclockwise', summary: 'Counterclockwise, as seen on the screen.' },
  { word: 'right', kind: 'direction', hint: 'clockwise', summary: 'Clockwise, as seen on the screen.' },
  {
    word: 'enemy',
    kind: 'direction',
    hint: 'towards the enemy',
    summary: 'Towards the enemy, or towards where it was last seen.',
  },
  {
    word: 'lead',
    kind: 'direction',
    hint: 'where the enemy will be',
    summary: 'Where the enemy will be when a bullet fired now gets there, if it keeps moving as it does. A shot aimed there misses an enemy that changes its way.',
  },
  { word: 'ahead', kind: 'direction', hint: 'the front of the hull', summary: 'Straight ahead of the hull.' },
  {
    word: 'cover',
    kind: 'direction',
    hint: 'towards the hiding place',
    summary: 'Towards the nearest place hidden from the enemy (see cover_visible).',
  },
  {
    word: 'enemy_visible',
    kind: 'sensor',
    hint: 'the enemy is in sight',
    summary: 'True when the enemy is in sensor range and not hidden behind an obstacle. A visible enemy can be driven to and shot at in a straight line.',
  },
  {
    word: 'blocked',
    kind: 'sensor',
    hint: 'wall or obstacle right ahead',
    summary: `True when a wall or an obstacle is right ahead, so the robot cannot drive forward. ${NOT_THE_ENEMY}`,
  },
  {
    word: 'blocked_behind',
    kind: 'sensor',
    hint: 'wall or obstacle right behind',
    summary: `True when a wall or an obstacle is right behind, so the robot cannot drive backward. ${NOT_THE_ENEMY}`,
  },
  {
    word: 'bullet_incoming',
    kind: 'sensor',
    hint: 'a bullet is about to hit',
    summary: 'True when an enemy bullet is on course to hit the robot where it stands. Moving out of its path avoids it; guarding on the tick it arrives halves the damage.',
  },
  {
    word: 'cover_visible',
    kind: 'sensor',
    hint: 'a hiding place is in reach',
    summary: 'True when a place hidden from the enemy (or from where it was last seen) can be driven to in a straight line. False until the enemy has been seen.',
  },
  {
    word: 'enemy_distance',
    kind: 'sensor',
    hint: 'distance to the enemy',
    summary: 'Distance to the enemy, or to where it was last seen. 0 if it has never been seen.',
  },
  {
    word: 'enemy_angle',
    kind: 'sensor',
    hint: 'angle to the enemy, -180..180',
    summary: `Angle from the way the hull faces to the enemy, ${ANGLE}.`,
  },
  { word: 'hp', kind: 'sensor', hint: 'own hit points', summary: 'The hit points this robot has left.' },
  { word: 'ammo', kind: 'sensor', hint: 'shots left', summary: 'The shots this robot has left.' },
  {
    word: 'guards',
    kind: 'sensor',
    hint: 'guards left',
    summary: `The ticks of guarding this robot has left, out of ${ROBOT_DEFAULTS.maxGuards} per match. With none left, guard does nothing.`,
  },
  {
    word: 'bullet_distance',
    kind: 'sensor',
    hint: 'distance to the incoming bullet',
    summary: `Distance to the nearest bullet on course to hit the robot; 0 if there is none. A bullet covers about ${BULLET_STEP} per tick.`,
  },
  {
    word: 'bullet_angle',
    kind: 'sensor',
    hint: 'angle to the incoming bullet',
    summary: `Angle from the way the hull faces to the nearest incoming bullet, ${ANGLE}. 0 if there is none.`,
  },
  {
    word: 'cover_distance',
    kind: 'sensor',
    hint: 'distance to the hiding place',
    summary: 'Distance to the nearest hiding place. 0 when the robot is already hidden, or when there is none.',
  },
  {
    word: 'cover_angle',
    kind: 'sensor',
    hint: 'angle to the hiding place',
    summary: `Angle from the way the hull faces to the next point on the way to the hiding place, ${ANGLE}. 0 if there is none.`,
  },
  {
    word: 'wall_ahead',
    kind: 'sensor',
    hint: 'free distance ahead',
    summary: `Distance from the robot's edge to the nearest wall or obstacle straight ahead. ${NOT_THE_ENEMY}`,
  },
  {
    word: 'wall_behind',
    kind: 'sensor',
    hint: 'free distance behind',
    summary: `Distance from the robot's edge to the nearest wall or obstacle straight behind. ${NOT_THE_ENEMY}`,
  },
  {
    word: 'wall_left',
    kind: 'sensor',
    hint: 'free distance to the left',
    summary: `Distance from the robot's edge to the nearest wall or obstacle straight to its left. ${NOT_THE_ENEMY}`,
  },
  {
    word: 'wall_right',
    kind: 'sensor',
    hint: 'free distance to the right',
    summary: `Distance from the robot's edge to the nearest wall or obstacle straight to its right. ${NOT_THE_ENEMY}`,
  },
  {
    word: 'aim_angle',
    kind: 'sensor',
    hint: 'gun to enemy, 0 = on target',
    summary: `Angle from the way the gun points to the enemy, or to where it was last seen, ${ANGLE}. 0 means "aim enemy" has the gun on it.`,
  },
  {
    word: 'lead_angle',
    kind: 'sensor',
    hint: 'gun to lead point, 0 = on target',
    summary: `Angle from the way the gun points to where the enemy will be when a bullet gets there, ${ANGLE}. 0 means "aim lead" has the gun on it.`,
  },
  {
    word: 'gun_angle',
    kind: 'sensor',
    hint: 'the turret on the hull',
    summary: `Angle of the gun on the hull, ${ANGLE}.`,
  },
];

const BY_WORD = new Map(LANGUAGE.map((reference) => [reference.word, reference]));

/** What a word of the language means; undefined for anything else, such as a program's own variables. */
export function describeWord(word: string): WordReference | undefined {
  return BY_WORD.get(word);
}

/** A variable of the program's own, with the 1-based line that first sets it. */
export interface ProgramVariable {
  name: string;
  line: number;
}

const SET_STATEMENT = /^\s*set\s+([A-Za-z_][A-Za-z0-9_]*)/;
const LABEL_STATEMENT = /^\s*label\s+([A-Za-z_][A-Za-z0-9_]*)/;

/** The variables a program sets, in the order they first appear. */
export function programVariables(source: string): ProgramVariable[] {
  const variables = new Map<string, ProgramVariable>();
  source.split(/\r?\n/).forEach((text, index) => {
    const name = SET_STATEMENT.exec(withoutComment(text))?.[1];
    if (name !== undefined && !isReservedWord(name) && !variables.has(name)) variables.set(name, { name, line: index + 1 });
  });
  return [...variables.values()];
}

/** The names a program gives with `label`, each once, in the order they first appear. */
export function programLabels(source: string): string[] {
  const labels = new Set<string>();
  for (const text of source.split(/\r?\n/)) {
    const label = LABEL_STATEMENT.exec(withoutComment(text))?.[1];
    if (label !== undefined) labels.add(label);
  }
  return [...labels];
}

export function describeLabel(label: string): WordReference {
  return { word: label, kind: 'label', hint: 'label', summary: 'A label this program uses elsewhere.' };
}

export function describeVariable(variable: ProgramVariable): WordReference {
  return {
    word: variable.name,
    kind: 'variable',
    hint: 'variable',
    summary: `A variable of this program, first set on line ${variable.line}.`,
  };
}

/** A word in the source and what it means. */
export interface Description extends WordReference {
  /** Where the word starts and ends in the source. */
  from: number;
  to: number;
}

const WORD_CHARACTER = /[A-Za-z0-9_]/;

/** Describes the word at the given position of the source, if it is one the language or the program defines. */
export function describeAt(source: string, position: number): Description | null {
  const lineStart = source.lastIndexOf('\n', position - 1) + 1;
  const nextBreak = source.indexOf('\n', position);
  const code = withoutComment(source.slice(lineStart, nextBreak < 0 ? source.length : nextBreak));

  let from = position - lineStart;
  let to = from;
  while (from > 0 && WORD_CHARACTER.test(code[from - 1] ?? '')) from--;
  while (to < code.length && WORD_CHARACTER.test(code[to])) to++;
  if (from === to) return null;

  const word = code.slice(from, to);
  const variable = programVariables(source).find((candidate) => candidate.name === word);
  const reference = describeWord(word) ?? (variable === undefined ? undefined : describeVariable(variable));
  if (reference === undefined) return null;
  return { ...reference, from: lineStart + from, to: lineStart + to };
}

/** The line up to its comment, if it has one. */
export function withoutComment(text: string): string {
  const start = text.indexOf('#');
  return start < 0 ? text : text.slice(0, start);
}
