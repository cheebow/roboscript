import type {
  ArithmeticOperator,
  ComparisonOperator,
  ConditionNode,
  Expression,
  IfNode,
  Program,
  StatementNode,
} from './ast';
import { type LexedLine, type Token, lex } from './lexer';
import type { ScriptError } from './script_error';
import {
  isAimDirection,
  isBooleanVariable,
  isDriveSetting,
  isNumberVariable,
  isReservedWord,
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

const COMPARISONS: readonly string[] = ['<', '>', '<=', '>=', '==', '!='] satisfies ComparisonOperator[];

class Parser {
  readonly errors: ScriptError[] = [];
  /** Every name the program assigns with `set`; only these may be read. */
  private readonly variables: ReadonlySet<string>;
  private index = 0;
  private previousIndent = 0;

  constructor(private readonly lines: LexedLine[]) {
    this.variables = new Set(
      lines.filter((line) => isWord(line.tokens[0], 'set') && line.tokens[1]?.type === 'word').map((line) => line.tokens[1].text),
    );
  }

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
    const head = line.tokens[0];
    if (isWord(head, 'if')) return this.parseIf(line);
    if (isWord(head, 'while')) return this.parseWhile(line);
    if (isWord(head, 'loop')) return this.parseLoop(line);
    if (isWord(head, 'else')) {
      this.report(line, 'Unexpected else');
      this.parseChildBlock(line);
      return null;
    }
    return this.attempt(line, () => this.parseSimple(line));
  }

  private parseIf(line: LexedLine): IfNode | null {
    const condition = this.attempt(line, () => this.conditionOf(line));
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

  private parseWhile(line: LexedLine): StatementNode | null {
    const condition = this.attempt(line, () => this.conditionOf(line));
    const body = this.parseChildBlock(line);
    if (condition === null) return null;
    return { kind: 'while', line: line.line, condition, body };
  }

  private parseLoop(line: LexedLine): StatementNode | null {
    if (line.tokens.length > 1) this.report(line, `Unexpected "${line.tokens[1].text}" after "loop"`);
    const body = this.parseChildBlock(line);
    return { kind: 'loop', line: line.line, body };
  }

  /** The condition that follows the first word of an `if` or `while` line. */
  private conditionOf(line: LexedLine): ConditionNode {
    return new ExpressionParser(line.tokens.slice(1), this.variables).parseWholeCondition();
  }

  /** Parses the indented block that must follow an `if`, `else`, `loop` or `while` line. */
  private parseChildBlock(header: LexedLine): StatementNode[] {
    const next = this.lines[this.index];
    if (next === undefined || next.indent <= header.indent) {
      this.report(header, 'Expected indented block');
      return [];
    }
    return this.parseBlock(next.indent);
  }

  /** A statement that fits on one line and has no block. */
  private parseSimple(line: LexedLine): StatementNode {
    const [head, argument, ...rest] = line.tokens;
    const lineNumber = line.line;

    switch (head.text) {
      case 'drive': {
        if (argument === undefined) throw new LineError('Expected "forward", "backward" or "stop" after "drive"');
        if (isSideways(argument.text)) {
          throw new LineError(`Robots cannot drive sideways: use "turn ${argument.text}" and "drive forward"`);
        }
        if (!isDriveSetting(argument.text)) throw new LineError(`Unknown direction "${argument.text}"`);
        expectEnd(rest, `drive ${argument.text}`);
        return { kind: 'drive', line: lineNumber, setting: argument.text };
      }
      case 'move':
        // The command of earlier versions, which drove for one tick only.
        throw new LineError('"move" is now "drive": use "drive forward" (the robot keeps driving until "drive stop")');
      case 'aim': {
        if (argument === undefined) throw new LineError('Expected direction after "aim"');
        if (!isAimDirection(argument.text)) throw new LineError(`Unknown direction "${argument.text}"`);
        expectEnd(rest, `aim ${argument.text}`);
        return { kind: 'aim', line: lineNumber, direction: argument.text };
      }
      case 'turn': {
        if (argument === undefined) throw new LineError('Expected direction after "turn"');
        if (!isTurnDirection(argument.text)) throw new LineError(`Unknown direction "${argument.text}"`);
        expectEnd(rest, `turn ${argument.text}`);
        return { kind: 'turn', line: lineNumber, direction: argument.text };
      }
      case 'label': {
        if (argument === undefined) throw new LineError('Expected a name after "label"');
        if (argument.type !== 'word') throw new LineError(`A label is a single word, such as HIDING: "${argument.text}" is not`);
        expectEnd(rest, `label ${argument.text}`);
        return { kind: 'label', line: lineNumber, label: argument.text };
      }
      case 'state':
        // The command of earlier versions, which only knew five names.
        throw new LineError(`"state" is now "label": use "label ${argument?.text ?? 'NAME'}" (any name will do)`);
      case 'fire':
      case 'guard':
      case 'wait':
        expectEnd(line.tokens.slice(1), head.text);
        return { kind: head.text, line: lineNumber };
      case 'set':
        return this.parseSet(line);
      default:
        throw new LineError(`Unknown command "${head.text}"`);
    }
  }

  private parseSet(line: LexedLine): StatementNode {
    const [, name, equals, ...value] = line.tokens;
    if (name === undefined || name.type !== 'word') throw new LineError('Expected variable name after "set"');
    if (isReservedWord(name.text)) throw new LineError(`"${name.text}" cannot be used as a variable name`);
    if (equals === undefined || equals.text !== '=') throw new LineError(`Expected "=" after "${name.text}"`);
    if (value.length === 0) throw new LineError('Expected value after "="');
    return {
      kind: 'set',
      line: line.line,
      name: name.text,
      value: new ExpressionParser(value, this.variables).parseWholeExpression(),
    };
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

function isSymbol(token: Token | undefined, text: string): boolean {
  return token !== undefined && token.type === 'symbol' && token.text === text;
}

/** `drive left` / `drive right` are valid English but not valid here: robots drive like tanks. */
function isSideways(direction: string): boolean {
  return direction === 'left' || direction === 'right';
}

function expectEnd(rest: Token[], command: string): void {
  if (rest.length > 0) throw new LineError(`Unexpected "${rest[0].text}" after "${command}"`);
}

/**
 * Parses the conditions and arithmetic found on one line.
 *
 * Conditions, loosest first: or, and, not, then a comparison, a true/false
 * variable or a condition in parentheses. Arithmetic, loosest first: + -, then
 * * /, then a leading minus, then a number, a variable or parentheses.
 */
class ExpressionParser {
  private position = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly variables: ReadonlySet<string>,
  ) {}

  parseWholeCondition(): ConditionNode {
    if (this.tokens.length === 0) throw new LineError('Expected condition');
    const condition = this.parseOr();
    this.expectEnd();
    return condition;
  }

  parseWholeExpression(): Expression {
    const expression = this.parseSum();
    this.expectEnd();
    return expression;
  }

  private expectEnd(): void {
    const token = this.peek();
    if (token !== undefined) throw new LineError(`Unexpected "${token.text}"`);
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private parseOr(): ConditionNode {
    let left = this.parseAnd();
    while (isWord(this.peek(), 'or')) {
      this.position++;
      left = { kind: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): ConditionNode {
    let left = this.parseNot();
    while (isWord(this.peek(), 'and')) {
      this.position++;
      left = { kind: 'and', left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): ConditionNode {
    if (isWord(this.peek(), 'not')) {
      this.position++;
      return { kind: 'not', operand: this.parseNot() };
    }
    return this.parseTruth();
  }

  /** A true/false variable, a comparison, or a condition in parentheses. */
  private parseTruth(): ConditionNode {
    const first = this.peek();
    if (first === undefined || isLogicalWord(first) || isSymbol(first, ')') || isComparison(first)) {
      throw new LineError('Expected condition');
    }
    if (first.type === 'word' && isBooleanVariable(first.text) && !isComparison(this.tokens[this.position + 1])) {
      this.position++;
      return { kind: 'boolean_variable', name: first.text };
    }
    if (!isSymbol(first, '(')) return this.parseComparison();

    // "(" opens either arithmetic, as in `(a + 1) > 2`, or a condition, as in `(a > 1) and b`.
    const start = this.position;
    try {
      return this.parseComparison();
    } catch (error) {
      if (!(error instanceof LineError)) throw error;
      this.position = start + 1;
      const condition = this.parseOr();
      if (!isSymbol(this.peek(), ')')) throw new LineError('Expected ")"');
      this.position++;
      return condition;
    }
  }

  private parseComparison(): ConditionNode {
    const start = this.peek();
    const left = this.parseSum();
    const operator = this.peek();
    if (operator === undefined || !isComparison(operator)) {
      throw new LineError(`Expected comparison after "${describeEnd(this.tokens, this.position, start)}"`);
    }
    this.position++;
    const next = this.peek();
    if (next === undefined || isLogicalWord(next) || isComparison(next) || isSymbol(next, ')')) {
      throw new LineError(`Expected value after "${operator.text}"`);
    }
    const right = this.parseSum();
    return { kind: 'comparison', operator: operator.text as ComparisonOperator, left, right };
  }

  private parseSum(): Expression {
    let left = this.parseProduct();
    for (let token = this.peek(); isSymbol(token, '+') || isSymbol(token, '-'); token = this.peek()) {
      this.position++;
      left = { kind: 'arithmetic', operator: token?.text as ArithmeticOperator, left, right: this.parseProduct() };
    }
    return left;
  }

  private parseProduct(): Expression {
    let left = this.parseSigned();
    for (let token = this.peek(); isSymbol(token, '*') || isSymbol(token, '/'); token = this.peek()) {
      this.position++;
      left = { kind: 'arithmetic', operator: token?.text as ArithmeticOperator, left, right: this.parseSigned() };
    }
    return left;
  }

  private parseSigned(): Expression {
    if (isSymbol(this.peek(), '-')) {
      this.position++;
      const operand = this.parseSigned();
      // Fold the sign into a literal, so `-10` is simply the number -10.
      return operand.kind === 'number' ? { kind: 'number', value: -operand.value } : { kind: 'negate', operand };
    }
    return this.parseValue();
  }

  private parseValue(): Expression {
    const token = this.peek();
    if (token === undefined) throw new LineError('Expected value');
    this.position++;

    if (token.type === 'number') return { kind: 'number', value: token.value };
    if (isSymbol(token, '(')) {
      const inner = this.parseSum();
      if (!isSymbol(this.peek(), ')')) throw new LineError('Expected ")"');
      this.position++;
      return inner;
    }
    if (token.type !== 'word') throw new LineError(`Unexpected "${token.text}"`);
    if (isNumberVariable(token.text)) return { kind: 'sensor', name: token.text };
    if (isBooleanVariable(token.text)) throw new LineError(`${token.text} is not a number`);
    if (this.variables.has(token.text)) return { kind: 'variable', name: token.text };
    throw new LineError(`Unknown variable "${token.text}"`);
  }
}

function isLogicalWord(token: Token): boolean {
  return token.type === 'word' && (token.text === 'and' || token.text === 'or' || token.text === 'not');
}

function isComparison(token: Token | undefined): boolean {
  return token !== undefined && token.type === 'symbol' && COMPARISONS.includes(token.text);
}

/** The text of the token just before `position`, falling back to the one the value started with. */
function describeEnd(tokens: Token[], position: number, start: Token | undefined): string {
  return (tokens[position - 1] ?? start)?.text ?? '';
}
