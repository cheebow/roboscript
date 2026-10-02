import type { ScriptError } from './script_error';

/** Punctuation the language knows: comparisons, arithmetic, grouping, assignment and the comma between values. */
export const SYMBOLS = ['<=', '>=', '==', '!=', '<', '>', '+', '-', '*', '/', '(', ')', '=', ','] as const;
export type SymbolText = (typeof SYMBOLS)[number];

export type Token =
  | { type: 'word'; text: string }
  | { type: 'number'; text: string; value: number }
  | { type: 'symbol'; text: SymbolText };

export interface LexedLine {
  /** 1-based source line. */
  line: number;
  /** Number of leading spaces. */
  indent: number;
  tokens: Token[];
}

export interface LexResult {
  /** Lines that hold code; blank lines and comment lines are left out. */
  lines: LexedLine[];
  errors: ScriptError[];
}

const COMMENT_START = '#';
const LEADING_WHITESPACE = /^[ \t]*/;
const TOKEN = /\s+|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[<>+\-*/()=,])/y;

export function lex(source: string): LexResult {
  const lines: LexedLine[] = [];
  const errors: ScriptError[] = [];

  source.split(/\r?\n/).forEach((rawText, index) => {
    const text = stripComment(rawText);
    if (text.trim() === '') return;
    const line = index + 1;
    const leading = LEADING_WHITESPACE.exec(text)?.[0] ?? '';
    if (leading.includes('\t')) {
      errors.push({ line, message: 'Tabs are not allowed for indentation' });
      return;
    }
    try {
      lines.push({ line, indent: leading.length, tokens: lexTokens(text) });
    } catch (error) {
      if (!(error instanceof UnexpectedCharacter)) throw error;
      errors.push({ line, message: error.message });
    }
  });

  return { lines, errors };
}

/** Everything from `#` to the end of the line is a comment. */
function stripComment(text: string): string {
  const start = text.indexOf(COMMENT_START);
  return start < 0 ? text : text.slice(0, start);
}

class UnexpectedCharacter extends Error {}

function lexTokens(text: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < text.length) {
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(text);
    if (match === null) throw new UnexpectedCharacter(`Unexpected character "${text[position]}"`);
    position = TOKEN.lastIndex;

    const [, number, word, symbol] = match;
    if (number !== undefined) tokens.push({ type: 'number', text: number, value: Number(number) });
    else if (word !== undefined) tokens.push({ type: 'word', text: word });
    else if (symbol !== undefined) tokens.push({ type: 'symbol', text: symbol as SymbolText });
  }
  return tokens;
}
