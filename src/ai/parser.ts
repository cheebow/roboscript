import type { ConditionNode, IfNode, NumberOperand, Program, StatementNode } from './ast';
import { type LexedLine, type Token, lex } from './lexer';
import type { ScriptError } from './script_error';
import {
  isBooleanVariable,
  isMoveDirection,
  isNumberVariable,
  isRobotState,
  isTurnDirection,
} from './script_variables';

export interface ParseResult {
  /** null when the source has errors. */
  program: Program | null;
  errors: ScriptError[];
}

export function parse(source: string): ParseResult {
  const lexed = lex(source);
  // A line the lexer rejected is missing from the block structure, so parsing
  // on would only report follow-on errors.
  if (lexed.errors.length > 0) return { program: null, errors: lexed.errors };

  const parser = new Parser(lexed.lines);
  const body = parser.parseBlock(0);
  const errors = firstErrorPerLine(parser.errors);
  return { program: errors.length === 0 ? { body } : null, errors };
}

function firstErrorPerLine(errors: ScriptError[]): ScriptError[] {
  const byLine = new Map<number, ScriptError>();
  for (const error of errors) {
    if (!byLine.has(error.line)) byLine.set(error.line, error);
  }
  return [...byLine.values()].sort((a, b) => a.line - b.line);
}

/** Raised while parsing a single line; reported against that line. */
class LineError extends Error {}

class Parser {
  readonly errors: ScriptError[] = [];
  private index = 0;
  private previousIndent = 0;

  constructor(private readonly lines: LexedLine[]) {}

  /** Parses consecutive lines at exactly `indent`, stopping at the first shallower line. */
  parseBlock(indent: number): StatementNode[] {
    const body: StatementNode[] = [];
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line.indent < indent) break;
      if (line.indent > indent) {
        const dedented = this.previousIndent > line.indent;
        this.report(line, dedented ? 'Indent does not match any outer block' : 'Unexpected indent');
        // Parsed only to report errors inside it and to move past it.
        this.parseBlock(line.indent);
        continue;
      }

      this.consume(line);
      const statement = this.parseStatement(line);
      if (statement !== null) body.push(statement);
    }
    return body;
  }

  private parseStatement(line: LexedLine): StatementNode | null {
    if (isWord(line.tokens[0], 'if')) return this.parseIf(line);
    if (isWord(line.tokens[0], 'else')) {
      this.report(line, 'Unexpected else');
      this.parseChildBlock(line);
      return null;
    }
    return this.attempt(line, () => parseCommand(line));
  }

  private parseIf(line: LexedLine): IfNode | null {
    const condition = this.attempt(line, () => parseCondition(line.tokens.slice(1)));
    const thenBody = this.parseChildBlock(line);

    let elseLine: number | null = null;
    let elseBody: StatementNode[] = [];
    const next = this.lines[this.index];
    if (next !== undefined && next.indent === line.indent && isWord(next.tokens[0], 'else')) {
      this.consume(next);
      if (next.tokens.length > 1) this.report(next, `Unexpected "${next.tokens[1].text}" after "else"`);
      elseLine = next.line;
      elseBody = this.parseChildBlock(next);
    }

    if (condition === null) return null;
    return { kind: 'if', line: line.line, condition, thenBody, elseLine, elseBody };
  }

  /** Parses the indented block that must follow an `if` or `else` line. */
  private parseChildBlock(header: LexedLine): StatementNode[] {
    const next = this.lines[this.index];
    if (next === undefined || next.indent <= header.indent) {
      this.report(header, 'Expected indented block');
      return [];
    }
    return this.parseBlock(next.indent);
  }

  private consume(line: LexedLine): void {
    this.index++;
    this.previousIndent = line.indent;
  }

  private attempt<T>(line: LexedLine, parseLine: () => T): T | null {
    try {
      return parseLine();
    } catch (error) {
      if (!(error instanceof LineError)) throw error;
      this.report(line, error.message);
      return null;
    }
  }

  private report(line: LexedLine, message: string): void {
    this.errors.push({ line: line.line, message });
  }
}

function isWord(token: Token | undefined, text: string): boolean {
  return token !== undefined && token.type === 'word' && token.text === text;
}

function parseCommand(line: LexedLine): StatementNode {
  const [head, argument, ...rest] = line.tokens;
  const lineNumber = line.line;

  switch (head.text) {
    case 'move': {
      if (argument === undefined) throw new LineError('Expected direction after "move"');
      if (!isMoveDirection(argument.text)) throw new LineError(`Unknown direction "${argument.text}"`);
      expectEnd(rest, `move ${argument.text}`);
      return { kind: 'move', line: lineNumber, direction: argument.text };
    }
    case 'turn': {
      if (argument === undefined) throw new LineError('Expected direction after "turn"');
      if (!isTurnDirection(argument.text)) throw new LineError(`Unknown direction "${argument.text}"`);
      expectEnd(rest, `turn ${argument.text}`);
      return { kind: 'turn', line: lineNumber, direction: argument.text };
    }
    case 'state': {
      if (argument === undefined) throw new LineError('Expected state name after "state"');
      if (!isRobotState(argument.text)) throw new LineError(`Unknown state "${argument.text}"`);
      expectEnd(rest, `state ${argument.text}`);
      return { kind: 'state', line: lineNumber, state: argument.text };
    }
    case 'fire':
    case 'wait':
      expectEnd(line.tokens.slice(1), head.text);
      return { kind: head.text, line: lineNumber };
    case 'set':
      throw new LineError('"set" is not supported yet');
    default:
      throw new LineError(`Unknown command "${head.text}"`);
  }
}

function expectEnd(rest: Token[], command: string): void {
  if (rest.length > 0) throw new LineError(`Unexpected "${rest[0].text}" after "${command}"`);
}

/** Precedence, loosest first: or, and, not, comparison. */
function parseCondition(tokens: Token[]): ConditionNode {
  let position = 0;

  const parseOr = (): ConditionNode => {
    let left = parseAnd();
    while (isWord(tokens[position], 'or')) {
      position++;
      left = { kind: 'or', left, right: parseAnd() };
    }
    return left;
  };

  const parseAnd = (): ConditionNode => {
    let left = parseNot();
    while (isWord(tokens[position], 'and')) {
      position++;
      left = { kind: 'and', left, right: parseNot() };
    }
    return left;
  };

  const parseNot = (): ConditionNode => {
    if (isWord(tokens[position], 'not')) {
      position++;
      return { kind: 'not', operand: parseNot() };
    }
    return parseTerm();
  };

  const parseTerm = (): ConditionNode => {
    const first = tokens[position];
    if (first === undefined || first.type === 'operator' || isLogicalWord(first)) {
      throw new LineError('Expected condition');
    }
    if (first.type === 'word' && isBooleanVariable(first.text) && tokens[position + 1]?.type !== 'operator') {
      position++;
      return { kind: 'boolean_variable', name: first.text };
    }

    const left = parseOperand(first);
    position++;
    const operator = tokens[position];
    if (operator === undefined || operator.type !== 'operator') {
      throw new LineError(`Expected comparison after "${first.text}"`);
    }
    position++;
    const second = tokens[position];
    if (second === undefined || second.type === 'operator' || isLogicalWord(second)) {
      throw new LineError(`Expected value after "${operator.text}"`);
    }
    const right = parseOperand(second);
    position++;
    return { kind: 'comparison', operator: operator.text, left, right };
  };

  const condition = parseOr();
  if (position < tokens.length) throw new LineError(`Unexpected "${tokens[position].text}"`);
  return condition;
}

function isLogicalWord(token: Token): boolean {
  return token.type === 'word' && (token.text === 'and' || token.text === 'or' || token.text === 'not');
}

function parseOperand(token: Token): NumberOperand {
  if (token.type === 'number') return { kind: 'number', value: token.value };
  if (isNumberVariable(token.text)) return { kind: 'number_variable', name: token.text };
  if (isBooleanVariable(token.text)) throw new LineError(`${token.text} is not a number`);
  throw new LineError(`Unknown variable "${token.text}"`);
}
