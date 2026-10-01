import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import {
  isBooleanVariable,
  isMoveDirection,
  isNumberVariable,
  isRobotState,
  isTurnDirection,
} from '../ai/script_variables';

const CONTROL_WORDS = new Set(['if', 'else', 'loop', 'while', 'and', 'or', 'not']);
const COMMAND_WORDS = new Set(['move', 'turn', 'fire', 'guard', 'wait', 'state', 'set']);

const NUMBER = /^\d+(\.\d+)?/;
const OPERATOR = /^(<=|>=|==|!=|[<>=+\-*/()])/;
const WORD = /^[A-Za-z_][A-Za-z0-9_]*/;

const language = StreamLanguage.define({
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['('] },
    // Typing "else" moves the line back to its "if".
    indentOnInput: /^\s*else$/,
  },
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.peek() === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(NUMBER)) return 'number';
    if (stream.match(OPERATOR)) return 'operator';
    if (stream.match(WORD)) return classifyWord(stream.current());
    stream.next();
    return 'invalid';
  },
});

function classifyWord(word: string): string | null {
  if (CONTROL_WORDS.has(word)) return 'keyword';
  if (COMMAND_WORDS.has(word)) return 'typeName';
  if (isBooleanVariable(word) || isNumberVariable(word)) return 'variableName';
  if (isMoveDirection(word) || isTurnDirection(word) || isRobotState(word)) return 'atom';
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
