import { BUILTINS } from './builtins';
import { type Token, lex, withoutComment } from './lexer';
import {
  type ProgramVariable,
  type WordReference,
  describeDirection,
  describeFunction,
  describeLabel,
  describeParameter,
  describeVariable,
  describeWord,
  enclosingFunction,
  programFunctions,
  programLabels,
  programVariables,
} from './reference';
import {
  AIM_DIRECTIONS,
  BOOLEAN_VARIABLES,
  DRIVE_SETTINGS,
  FACE_TARGETS,
  NUMBER_VARIABLES,
  TURN_DIRECTIONS,
} from './script_variables';

/** One word offered to the player. */
export interface Suggestion extends WordReference {
  /**
   * What to put in for the word: the word itself, followed by a space when
   * something has to follow it on the same line, or by a parenthesis for a function.
   */
  insert: string;
}

export interface Suggestions {
  /** Where the word being typed starts: the suggestions replace the text from here to the cursor. */
  from: number;
  options: Suggestion[];
}

const STATEMENTS = ['if', 'else', 'loop', 'while', 'break', 'def', 'return', 'set', 'label', 'drive', 'turn', 'face', 'aim', 'fire', 'guard', 'wait'];
const BOOLEAN_SENSORS = Object.keys(BOOLEAN_VARIABLES);
const NUMBER_SENSORS = Object.keys(NUMBER_VARIABLES);
/** Words that are always followed by something on the same line. */
const TAKES_MORE = new Set(['if', 'while', 'def', 'set', 'label', 'drive', 'turn', 'face', 'aim', 'and', 'or', 'not']);

const WORD_BEING_TYPED = /[A-Za-z_][A-Za-z0-9_]*$/;
const COMPARISONS = new Set(['<', '>', '<=', '>=', '==', '!=']);

/** What can come at the cursor, and whether to offer it before the player has typed any of it. */
interface Expectation {
  words: readonly string[];
  /** Offer the program's own variables as well, and the parameters of the function the line is in. */
  variables: boolean;
  /** Offer the program's own functions as well. */
  functions?: boolean;
  /** Offer the labels the program uses on other lines. */
  labels?: boolean;
  /** The words are directions: they are described as what they mean after "turn" or "aim". */
  directions?: boolean;
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

  const owner = enclosingFunction(source, position);
  const functions = expectation.functions ? programFunctions(withoutLine(source, lineStart)) : [];
  const suggestions: Suggestion[] = [
    ...expectation.words
      .map((word) => (expectation.directions ? describeDirection(word) : describeWord(word)))
      .filter((reference) => reference !== undefined)
      // A function of the language gives way to one of the program's own with its name.
      .filter((reference) => reference.kind !== 'builtin' || !functions.some((definition) => definition.name === reference.word))
      .map((reference) => ({ ...reference, insert: insertOf(reference) })),
    ...(expectation.variables && owner !== null ? owner.params.map((param) => plain(describeParameter(param, owner))) : []),
    ...(expectation.variables ? variablesFor(source, lineStart, tokens).map((variable) => plain(describeVariable(variable))) : []),
    // A function is put in up to its opening parenthesis, and closed at once when it takes nothing.
    ...functions.map((definition) => ({
      ...describeFunction(definition),
      insert: definition.params.length === 0 ? `${definition.name}()` : `${definition.name}(`,
    })),
    ...(expectation.labels ? programLabels(withoutLine(source, lineStart)).map((label) => plain(describeLabel(label))) : []),
  ];
  const prefix = typed.toLowerCase();
  const options = suggestions.filter((suggestion) => suggestion.word.toLowerCase().startsWith(prefix));

  // Nothing to add to a word that is already complete; a list would only get in the way of Enter.
  if (options.length === 0 || options.some((option) => option.word === typed)) return null;
  return { from: position - typed.length, options };
}

/** A suggestion that is put in just as it is. */
function plain(reference: WordReference): Suggestion {
  return { ...reference, insert: reference.word };
}

/** The program's variables to offer on the line starting at `lineStart`, whose tokens before the cursor are given. */
function variablesFor(source: string, lineStart: number, tokens: readonly Token[]): ProgramVariable[] {
  const naming = tokens.length === 1 && tokens[0].text === 'set';
  if (!naming) return programVariables(source);
  // In "set na|", the name being typed is not yet a variable to suggest: leave this line out.
  return programVariables(withoutLine(source, lineStart));
}

/** The source with the line that starts at `lineStart` emptied. */
function withoutLine(source: string, lineStart: number): string {
  const lineEnd = source.indexOf('\n', lineStart);
  return source.slice(0, lineStart) + (lineEnd < 0 ? '' : source.slice(lineEnd));
}

/** What fits after the given tokens of a line. */
function expectationAfter(tokens: readonly Token[]): Expectation | null {
  const [first] = tokens;
  if (first === undefined) return { words: STATEMENTS, variables: false, functions: true, eager: false };
  if (first.type !== 'word') return null;
  const argument = tokens.length === 1;

  switch (first.text) {
    case 'drive':
      return argument ? { words: DRIVE_SETTINGS, variables: false, eager: true } : null;
    case 'aim':
      return argument ? { words: AIM_DIRECTIONS, variables: false, directions: true, eager: true } : null;
    case 'turn':
      return argument ? { words: TURN_DIRECTIONS, variables: false, directions: true, eager: true } : null;
    case 'face':
      return argument ? { words: FACE_TARGETS, variables: false, directions: true, eager: true } : null;
    case 'label':
      // Any word will do; the ones already in use are the likely ones.
      return argument ? { words: [], variables: false, labels: true, eager: true } : null;
    case 'set':
      // The name, then "=", then the value.
      if (argument) return { words: [], variables: true, eager: false };
      return tokens.length === 2 ? null : valueAfter(tokens, false);
    case 'if':
    case 'while':
      return valueAfter(tokens, true);
    case 'return':
      return argument ? VALUE : valueAfter(tokens, false);
    case 'def':
      return null;
    default:
      // The values of a call on a line of its own, as in "approach(".
      return tokens[1]?.text === '(' ? valueAfter(tokens, false) : null;
  }
}

/** What to put in for a word of the language: a function up to its opening parenthesis, a word that needs more with a space after it. */
function insertOf(reference: WordReference): string {
  if (reference.kind === 'builtin') return `${reference.word}(`;
  return TAKES_MORE.has(reference.word) ? `${reference.word} ` : reference.word;
}

/** A number is expected: a sensor that gives one, a variable or a function. Not offered until a letter is typed. */
const VALUE: Expectation = { words: ['true', 'false', ...NUMBER_SENSORS, ...BUILTINS.keys()], variables: true, functions: true, eager: false };

/** What fits next in a condition (`if`, `while`) or, when not `inCondition`, in the value of a `set`. */
function valueAfter(tokens: readonly Token[], inCondition: boolean): Expectation | null {
  const last = tokens[tokens.length - 1];
  const afterValue = last.type === 'number' || last.text === ')' || (last.type === 'word' && isOperand(last.text));
  if (afterValue) return inCondition ? { words: ['and', 'or'], variables: false, eager: false } : null;

  const numbersOnly = !inCondition || COMPARISONS.has(last.text) || ['+', '-', '*', '/', ','].includes(last.text);
  if (numbersOnly) return VALUE;
  // The start of a condition: after "if", "while", "and", "or", "not" or "(".
  const eager = last.type === 'word';
  return { words: [...BOOLEAN_SENSORS, ...NUMBER_SENSORS, ...BUILTINS.keys(), 'not'], variables: true, functions: true, eager };
}

/** Whether the word stands for a value: anything but the words that join or open conditions. */
function isOperand(word: string): boolean {
  return !['if', 'while', 'and', 'or', 'not'].includes(word);
}
