import { ROBOT_STATES } from '../sim/ai_context';
import { type Token, lex } from './lexer';
import {
  type ProgramVariable,
  type WordReference,
  describeVariable,
  describeWord,
  programVariables,
  withoutComment,
} from './reference';
import { AIM_DIRECTIONS, BOOLEAN_VARIABLES, DRIVE_SETTINGS, NUMBER_VARIABLES, TURN_DIRECTIONS } from './script_variables';

/** One word offered to the player. */
export interface Suggestion extends WordReference {
  /** Whether something has to follow the word on the same line, so a space is worth adding after it. */
  addSpace: boolean;
}

export interface Suggestions {
  /** Where the word being typed starts: the suggestions replace the text from here to the cursor. */
  from: number;
  options: Suggestion[];
}

const STATEMENTS = ['if', 'else', 'loop', 'while', 'set', 'state', 'drive', 'turn', 'aim', 'fire', 'guard', 'wait'];
const BOOLEAN_SENSORS = Object.keys(BOOLEAN_VARIABLES);
const NUMBER_SENSORS = Object.keys(NUMBER_VARIABLES);
/** Words that are always followed by something on the same line. */
const TAKES_MORE = new Set(['if', 'while', 'set', 'state', 'drive', 'turn', 'aim', 'and', 'or', 'not']);

const WORD_BEING_TYPED = /[A-Za-z_][A-Za-z0-9_]*$/;
const COMPARISONS = new Set(['<', '>', '<=', '>=', '==', '!=']);

/** What can come at the cursor, and whether to offer it before the player has typed any of it. */
interface Expectation {
  words: readonly string[];
  /** Offer the program's own variables as well. */
  variables: boolean;
  /** Offer the list as soon as the cursor gets here, rather than once a letter is typed. */
  eager: boolean;
}

/**
 * The words that fit at the given position of a program, narrowed to those
 * starting with what has been typed of the word so far. Null when there is
 * nothing to offer: in a comment, where no word fits, when the word is already
 * complete, or (unless `explicit`, i.e. asked for) before a letter is typed in
 * a place where a list popping up would be in the way.
 */
export function completionsAt(source: string, position: number, explicit = false): Suggestions | null {
  const lineStart = source.lastIndexOf('\n', position - 1) + 1;
  const before = source.slice(lineStart, position);
  if (withoutComment(before) !== before) return null;

  const typed = WORD_BEING_TYPED.exec(before)?.[0] ?? '';
  const head = before.slice(0, before.length - typed.length);
  // A word cannot start right after a digit, as in "12ab".
  if (typed !== '' && /[0-9.]$/.test(head)) return null;

  const { lines, errors } = lex(head);
  if (errors.length > 0) return null;
  const tokens = lines[0]?.tokens ?? [];
  const expectation = expectationAfter(tokens);
  if (expectation === null) return null;
  if (typed === '' && !expectation.eager && !explicit) return null;

  const references = [
    ...expectation.words.map((word) => describeWord(word)).filter((reference) => reference !== undefined),
    ...(expectation.variables ? variablesFor(source, lineStart, tokens).map(describeVariable) : []),
  ];
  const prefix = typed.toLowerCase();
  const options = references
    .filter((reference) => reference.word.toLowerCase().startsWith(prefix))
    .map((reference) => ({ ...reference, addSpace: TAKES_MORE.has(reference.word) }));

  // Nothing to add to a word that is already complete; a list would only get in the way of Enter.
  if (options.length === 0 || options.some((option) => option.word === typed)) return null;
  return { from: position - typed.length, options };
}

/** The program's variables to offer on the line starting at `lineStart`, whose tokens before the cursor are given. */
function variablesFor(source: string, lineStart: number, tokens: readonly Token[]): ProgramVariable[] {
  const naming = tokens.length === 1 && tokens[0].text === 'set';
  if (!naming) return programVariables(source);
  // In "set na|", the name being typed is not yet a variable to suggest: leave this line out.
  const lineEnd = source.indexOf('\n', lineStart);
  return programVariables(source.slice(0, lineStart) + (lineEnd < 0 ? '' : source.slice(lineEnd)));
}

/** What fits after the given tokens of a line. */
function expectationAfter(tokens: readonly Token[]): Expectation | null {
  const [first] = tokens;
  if (first === undefined) return { words: STATEMENTS, variables: false, eager: false };
  if (first.type !== 'word') return null;
  const argument = tokens.length === 1;

  switch (first.text) {
    case 'drive':
      return argument ? { words: DRIVE_SETTINGS, variables: false, eager: true } : null;
    case 'aim':
      return argument ? { words: AIM_DIRECTIONS, variables: false, eager: true } : null;
    case 'turn':
      return argument ? { words: TURN_DIRECTIONS, variables: false, eager: true } : null;
    case 'state':
      return argument ? { words: ROBOT_STATES, variables: false, eager: true } : null;
    case 'set':
      // The name, then "=", then the value.
      if (argument) return { words: [], variables: true, eager: false };
      return tokens.length === 2 ? null : valueAfter(tokens, false);
    case 'if':
    case 'while':
      return valueAfter(tokens, true);
    default:
      return null;
  }
}

/** What fits next in a condition (`if`, `while`) or, when not `inCondition`, in the value of a `set`. */
function valueAfter(tokens: readonly Token[], inCondition: boolean): Expectation | null {
  const last = tokens[tokens.length - 1];
  const afterValue = last.type === 'number' || last.text === ')' || (last.type === 'word' && isOperand(last.text));
  if (afterValue) return inCondition ? { words: ['and', 'or'], variables: false, eager: false } : null;

  const numbersOnly = !inCondition || COMPARISONS.has(last.text) || ['+', '-', '*', '/'].includes(last.text);
  if (numbersOnly) return { words: NUMBER_SENSORS, variables: true, eager: false };
  // The start of a condition: after "if", "while", "and", "or", "not" or "(".
  const eager = last.type === 'word';
  return { words: [...BOOLEAN_SENSORS, ...NUMBER_SENSORS, 'not'], variables: true, eager };
}

/** Whether the word stands for a value: anything but the words that join or open conditions. */
function isOperand(word: string): boolean {
  return !['if', 'while', 'and', 'or', 'not'].includes(word);
}
