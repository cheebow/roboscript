import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import {
  isAimDirection,
  isBooleanVariable,
  isDriveSetting,
  isNumberVariable,
  isTurnDirection,
} from '../ai/script_variables';

const CONTROL_WORDS = new Set(['if', 'else', 'loop', 'while', 'break', 'def', 'return', 'and', 'or', 'not', 'true', 'false']);
const COMMAND_WORDS = new Set(['drive', 'turn', 'aim', 'fire', 'guard', 'wait', 'label', 'set']);
/** The commands that are followed by a direction. */
const DIRECTED_WORDS = new Set(['drive', 'turn', 'aim']);

const NUMBER = /^\d+(\.\d+)?/;
const OPERATOR = /^(<=|>=|==|!=|[<>=+\-*/()])/;
const WORD = /^[A-Za-z_][A-Za-z0-9_]*/;

/** What the tokenizer remembers along a line. */
interface LineState {
  /** The next word is the name given by `label`. */
  naming: boolean;
  /** The next word is the direction of a `drive`, `turn` or `aim`. */
  directing: boolean;
}

const language = StreamLanguage.define<LineState>({
  startState: () => ({ naming: false, directing: false }),
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['('] },
    // Typing "else" moves the line back to its "if".
    indentOnInput: /^\s*else$/,
  },
  token(stream, state) {
    if (stream.sol()) {
      state.naming = false;
      state.directing = false;
    }
    if (stream.eatSpace()) return null;
    if (stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(NUMBER)) return 'number';
    if (stream.match(OPERATOR)) return 'operator';
    if (stream.match(WORD)) {
      const word = stream.current();
      // Whatever follows "label" is a name of the player's own, even if it is also a word of the language.
      if (state.naming) {
        state.naming = false;
        return 'atom';
      }
      // A direction may also be a sensor on its own, as "hit" is: after its command it is the direction.
      const directed = state.directing && isDirection(word);
      state.naming = word === 'label';
      state.directing = DIRECTED_WORDS.has(word);
      return directed ? 'atom' : classifyWord(word);
    }
    stream.next();
    return 'invalid';
  },
});

function classifyWord(word: string): string | null {
  if (CONTROL_WORDS.has(word)) return 'keyword';
  if (COMMAND_WORDS.has(word)) return 'typeName';
  if (isBooleanVariable(word) || isNumberVariable(word)) return 'variableName';
  if (isDirection(word)) return 'atom';
  // Any other word is a variable of the program's own.
  return 'name';
}

const style = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-control)' },
  { tag: tags.typeName, color: 'var(--syntax-command)' },
  { tag: tags.variableName, color: 'var(--syntax-variable)' },
  { tag: tags.name, color: 'var(--text)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.atom, color: 'var(--syntax-value)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.operator, color: 'var(--muted)' },
  { tag: tags.invalid, color: 'var(--error)' },
]);

/** Syntax highlighting for RoboScript. */
export function roboscriptHighlight(): Extension {
  return [language, syntaxHighlighting(style)];
}

function isDirection(word: string): boolean {
  return isDriveSetting(word) || isTurnDirection(word) || isAimDirection(word);
}
