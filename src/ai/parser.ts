import {
  type ArithmeticOperator,
  type ComparisonOperator,
  type ConditionNode,
  type Expression,
  type FunctionNode,
  type IfNode,
  type Program,
  type StatementNode,
  parameterVariable,
} from './ast';
import { t } from '../i18n/messages';
import { checkFunctions } from './functions';
import { type LexedLine, type Token, lex } from './lexer';
import type { ScriptError } from './script_error';
import {
  isAimDirection,
  isBooleanVariable,
  isDriveSetting,
  isNumberVariable,
  isFaceTarget,
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

  try {
    const parser = new Parser(lexed.lines);
    const program: Program = { body: parser.parseBlock(0), functions: parser.functions };
    // How the functions call each other is only worth checking once every line is right by itself.
    const errors = firstErrorPerLine(parser.errors.length > 0 ? parser.errors : checkFunctions(program));
    return { program: errors.length === 0 ? program : null, errors };
  } catch (error) {
    // Nesting within the limits, but so much of it at once that the browser runs out of room.
    if (!(error instanceof RangeError)) throw error;
    return { program: null, errors: [{ line: 1, message: t('parse.tooDeepOverall') }] };
  }
}

function firstErrorPerLine(errors: ScriptError[]): ScriptError[] {
  const byLine = new Map<number, ScriptError>();
  for (const error of errors) {
    if (!byLine.has(error.line)) byLine.set(error.line, error);
  }
  return [...byLine.values()].sort((a, b) => a.line - b.line);
}

/**
 * How deep things may nest: blocks inside blocks (each `else if` counting as
 * one more), and within a line brackets, `not`, minus signs, the values of a
 * call and the steps of a calculation. Far beyond any program written by
 * hand; it keeps a crafted one from running the browser out of room.
 */
export const MAX_NESTING = 100;

/** Raised while parsing a single line; reported against that line. */
class LineError extends Error {}

const COMPARISONS: readonly string[] = ['<', '>', '<=', '>=', '==', '!='] satisfies ComparisonOperator[];

/** The first line of a function: its name and the names of its parameters. */
interface Header {
  name: string;
  params: string[];
}

/** What the names on a line can refer to. */
interface Scope {
  /** Every name the program assigns with `set`; only these may be read. */
  variables: ReadonlySet<string>;
  /** Every function the program defines, by name, with the line of its `def`. */
  functions: ReadonlyMap<string, Header & { line: number }>;
  /** The function the line belongs to, if any: its parameters come before the variables. */
  owner: Header | null;
}

class Parser {
  readonly errors: ScriptError[] = [];
  readonly functions = new Map<string, FunctionNode>();
  private readonly variables = new Set<string>();
  private readonly signatures = new Map<string, Header & { line: number }>();
  /** The function whose body is being parsed. */
  private owner: Header | null = null;
  /** How many loops and whiles the line being parsed is in, within its function: where `break` may go. */
  private loopDepth = 0;
  /** How many blocks (and else ifs) the parser is inside. */
  private nesting = 0;
  private index = 0;
  private previousIndent = 0;

  /** Looks through all the lines first for what they define, so that a name can be used above the line that defines it. */
  constructor(private readonly lines: LexedLine[]) {
    let params: readonly string[] = [];
    for (const line of lines) {
      if (line.indent === 0) {
        const header = isWord(line.tokens[0], 'def') ? headerOrNull(line.tokens) : null;
        if (header !== null && !this.signatures.has(header.name)) this.signatures.set(header.name, { ...header, line: line.line });
        params = header?.params ?? [];
      }
      // Assigning to a parameter does not make a variable of the program.
      const [first, name] = line.tokens;
      if (isWord(first, 'set') && name?.type === 'word' && !params.includes(name.text)) this.variables.add(name.text);
    }
  }

  private get scope(): Scope {
    return { variables: this.variables, functions: this.signatures, owner: this.owner };
  }

  /** Parses consecutive lines at exactly `indent`, stopping at the first shallower line. */
  parseBlock(indent: number): StatementNode[] {
    const body: StatementNode[] = [];
    if (this.nesting >= MAX_NESTING) {
      this.report(this.lines[this.index], t('parse.tooDeep', { limit: MAX_NESTING }));
      this.skipWhile((line) => line.indent >= indent);
      return body;
    }
    this.nesting++;
    try {
      this.parseLinesAt(indent, body);
    } finally {
      this.nesting--;
    }
    return body;
  }

  private parseLinesAt(indent: number, body: StatementNode[]): void {
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line.indent < indent) break;
      if (line.indent > indent) {
        const dedented = this.previousIndent > line.indent;
        this.report(line, dedented ? t('parse.indentMismatch') : t('parse.unexpectedIndent'));
        // Parsed only to report errors inside it and to move past it.
        this.parseBlock(line.indent);
        continue;
      }

      this.consume(line);
      const statement = this.parseStatement(line);
      if (statement !== null) body.push(statement);
    }
  }

  /** Moves past the lines for which `skipped` holds, without parsing them. */
  private skipWhile(skipped: (line: LexedLine) => boolean): void {
    while (this.index < this.lines.length && skipped(this.lines[this.index])) this.index++;
  }

  private parseStatement(line: LexedLine): StatementNode | null {
    const head = line.tokens[0];
    if (isWord(head, 'if')) return this.parseIf(line);
    if (isWord(head, 'while')) return this.parseWhile(line);
    if (isWord(head, 'loop')) return this.parseLoop(line);
    if (isWord(head, 'def')) {
      this.parseDefinition(line);
      return null;
    }
    if (isWord(head, 'else')) {
      this.report(line, t('parse.unexpectedElse'));
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
    let elseIf = false;
    const next = this.lines[this.index];
    if (next !== undefined && next.indent === line.indent && isWord(next.tokens[0], 'else')) {
      this.consume(next);
      elseLine = next.line;
      if (isWord(next.tokens[1], 'if')) {
        // `else if`: an if of its own in the else branch, with any else of its own after it.
        elseIf = true;
        if (this.nesting >= MAX_NESTING) {
          this.report(next, t('parse.tooDeep', { limit: MAX_NESTING }));
          // The rest of the chain: the blocks below, and the elses that follow.
          this.skipWhile((later) => later.indent > line.indent || (later.indent === line.indent && isWord(later.tokens[0], 'else')));
        } else {
          this.nesting++;
          try {
            const chained = this.parseIf({ ...next, tokens: next.tokens.slice(1) });
            elseBody = chained === null ? [] : [chained];
          } finally {
            this.nesting--;
          }
        }
      } else {
        if (next.tokens.length > 1) this.report(next, t('parse.unexpectedAfter', { text: next.tokens[1].text, command: 'else' }));
        elseBody = this.parseChildBlock(next);
      }
    }

    if (condition === null) return null;
    return { kind: 'if', line: line.line, condition, thenBody, elseLine, elseBody, elseIf };
  }

  /** The block of a loop or a while, in which `break` may be used. */
  private parseLoopBody(line: LexedLine): StatementNode[] {
    this.loopDepth++;
    try {
      return this.parseChildBlock(line);
    } finally {
      this.loopDepth--;
    }
  }

  private parseWhile(line: LexedLine): StatementNode | null {
    const condition = this.attempt(line, () => this.conditionOf(line));
    const body = this.parseLoopBody(line);
    if (condition === null) return null;
    return { kind: 'while', line: line.line, condition, body };
  }

  private parseLoop(line: LexedLine): StatementNode | null {
    if (line.tokens.length > 1) this.report(line, t('parse.unexpectedAfter', { text: line.tokens[1].text, command: 'loop' }));
    const body = this.parseLoopBody(line);
    return { kind: 'loop', line: line.line, body };
  }

  /** A function: its `def` line and the block below it. It is kept apart from the statements, to be run when called. */
  private parseDefinition(line: LexedLine): void {
    if (line.indent > 0) {
      this.report(line, t('parse.functionNotTopLevel'));
      // Parsed only to report errors inside it and to move past it.
      this.parseChildBlock(line);
      return;
    }

    const header = this.attempt(line, () => this.checkedHeader(line));
    this.owner = header ?? { name: '', params: [] };
    // A break in a function cannot leave a loop of whoever called it.
    const outerLoops = this.loopDepth;
    this.loopDepth = 0;
    const body = this.parseChildBlock(line);
    this.loopDepth = outerLoops;
    this.owner = null;
    if (header !== null) this.functions.set(header.name, { ...header, line: line.line, body });
  }

  private checkedHeader(line: LexedLine): Header {
    const header = parseHeader(line.tokens);
    const first = this.signatures.get(header.name);
    if (first !== undefined && first.line !== line.line) {
      throw new LineError(t('parse.alreadyDefined', { name: header.name, line: first.line }));
    }
    if (this.variables.has(header.name)) throw new LineError(t('parse.alreadyVariable', { name: header.name }));
    return header;
  }

  /** The condition that follows the first word of an `if` or `while` line. */
  private conditionOf(line: LexedLine): ConditionNode {
    return new ExpressionParser(line.tokens.slice(1), this.scope).parseWholeCondition();
  }

  /** Parses the indented block that must follow an `if`, `else`, `loop` or `while` line. */
  private parseChildBlock(header: LexedLine): StatementNode[] {
    const next = this.lines[this.index];
    if (next === undefined || next.indent <= header.indent) {
      this.report(header, t('parse.expectIndentedBlock'));
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
        if (argument === undefined) throw new LineError(t('parse.expectDriveSetting'));
        if (isSideways(argument.text)) {
          throw new LineError(t('parse.noSideways', { direction: argument.text }));
        }
        if (!isDriveSetting(argument.text)) throw new LineError(t('parse.unknownDirection', { direction: argument.text }));
        expectEnd(rest, `drive ${argument.text}`);
        return { kind: 'drive', line: lineNumber, setting: argument.text };
      }
      case 'move':
        // The command of earlier versions, which drove for one tick only.
        throw new LineError(t('parse.moveIsDrive'));
      case 'aim': {
        if (argument === undefined) throw new LineError(t('parse.expectDirectionAfter', { command: 'aim' }));
        if (!isAimDirection(argument.text)) throw new LineError(t('parse.unknownDirection', { direction: argument.text }));
        return { kind: 'aim', line: lineNumber, direction: argument.text, angle: this.parseAngle(rest, 'aim', argument.text) };
      }
      case 'turn': {
        if (argument === undefined) throw new LineError(t('parse.expectDirectionAfter', { command: 'turn' }));
        if (argument.text === 'back') throw new LineError(t('parse.turnBackIsFace'));
        if (!isTurnDirection(argument.text)) throw new LineError(t('parse.unknownDirection', { direction: argument.text }));
        return { kind: 'turn', line: lineNumber, direction: argument.text, angle: this.parseAngle(rest, 'turn', argument.text) };
      }
      case 'face': {
        if (argument === undefined) throw new LineError(t('parse.expectFaceTarget'));
        if (!isFaceTarget(argument.text)) {
          throw new LineError(t('parse.notAFaceTarget', { direction: argument.text }));
        }
        expectEnd(rest, `face ${argument.text}`);
        return { kind: 'face', line: lineNumber, target: argument.text };
      }
      case 'label': {
        if (argument === undefined) throw new LineError(t('parse.expectNameAfter', { command: 'label' }));
        if (argument.type !== 'word') throw new LineError(t('parse.labelOneWord', { text: argument.text }));
        expectEnd(rest, `label ${argument.text}`);
        return { kind: 'label', line: lineNumber, label: argument.text };
      }
      case 'state':
        // The command of earlier versions, which only knew five names.
        throw new LineError(t('parse.stateIsLabel', { name: argument?.text ?? 'NAME' }));
      case 'fire':
      case 'guard':
      case 'wait':
        expectEnd(line.tokens.slice(1), head.text);
        return { kind: head.text, line: lineNumber };
      case 'set':
        return this.parseSet(line);
      case 'break':
        if (this.loopDepth === 0) throw new LineError(t('parse.breakOutside'));
        expectEnd(line.tokens.slice(1), 'break');
        return { kind: 'break', line: lineNumber };
      case 'return': {
        if (this.owner === null) throw new LineError(t('parse.returnOutside'));
        const value = line.tokens.slice(1);
        return {
          kind: 'return',
          line: lineNumber,
          value: value.length === 0 ? null : new ExpressionParser(value, this.scope).parseWholeExpression(),
        };
      }
      default:
        return this.parseCall(line);
    }
  }

  /** The angle after `turn left`, `aim right` and so on: only a side takes one, and none is needed. */
  private parseAngle(rest: Token[], command: string, direction: string): Expression | null {
    if (rest.length === 0) return null;
    if (!isSide(direction)) throw new LineError(t('parse.angleOnlySides', { command, direction }));
    return new ExpressionParser(rest, this.scope).parseWholeExpression();
  }

  /** A line that calls a function, such as `approach(350)`. */
  private parseCall(line: LexedLine): StatementNode {
    const [head, next] = line.tokens;
    if (head.type !== 'word') throw new LineError(t('parse.unexpected', { text: head.text }));
    if (!isSymbol(next, '(')) {
      if (this.signatures.has(head.text)) throw new LineError(t('parse.expectParenAfter', { name: head.text }));
      throw new LineError(t('parse.unknownCommand', { name: head.text }));
    }
    const call = new ExpressionParser(line.tokens, this.scope).parseWholeExpression();
    // Something like `approach(350) + 1`: a calculation whose result goes nowhere.
    if (call.kind !== 'call') throw new LineError(t('parse.onlyCallAlone'));
    return { kind: 'call', line: line.line, name: call.name, args: call.args };
  }

  private parseSet(line: LexedLine): StatementNode {
    const [, name, equals, ...value] = line.tokens;
    if (name === undefined || name.type !== 'word') throw new LineError(t('parse.expectVariableName'));
    if (isReservedWord(name.text)) throw new LineError(t('parse.reservedVariable', { name: name.text }));
    if (this.signatures.has(name.text)) throw new LineError(t('parse.isFunction', { name: name.text }));
    if (equals === undefined || equals.text !== '=') throw new LineError(t('parse.expectEquals', { name: name.text }));
    if (value.length === 0) throw new LineError(t('parse.expectValueAfterEquals'));
    return {
      kind: 'set',
      line: line.line,
      name: variableIn(this.scope, name.text),
      value: new ExpressionParser(value, this.scope).parseWholeExpression(),
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

/** The name under which a variable is kept: a parameter of the function in scope is kept apart from the program's variables. */
function variableIn(scope: Scope, name: string): string {
  const { owner } = scope;
  return owner?.params.includes(name) ? parameterVariable(owner.name, name) : name;
}

/** Reads a `def` line: `def name(first, second)`. */
function parseHeader(tokens: Token[]): Header {
  const [, name, open, ...rest] = tokens;
  if (name === undefined || name.type !== 'word') throw new LineError(t('parse.expectNameAfter', { command: 'def' }));
  if (isReservedWord(name.text)) throw new LineError(t('parse.reservedFunction', { name: name.text }));
  if (!isSymbol(open, '(')) throw new LineError(t('parse.expectParenAfter', { name: name.text }));

  const params: string[] = [];
  let position = 0;
  while (!isSymbol(rest[position], ')')) {
    const param = rest[position];
    if (param === undefined) throw new LineError(t('parse.expectCloseParen'));
    if (param.type !== 'word') throw new LineError(t('parse.unexpected', { text: param.text }));
    if (isReservedWord(param.text)) throw new LineError(t('parse.reservedParameter', { name: param.text }));
    if (params.includes(param.text)) throw new LineError(t('parse.listedTwice', { name: param.text }));
    params.push(param.text);
    position++;

    const separator = rest[position];
    if (isSymbol(separator, ',')) position++;
    else if (!isSymbol(separator, ')')) throw new LineError(separator === undefined ? t('parse.expectCloseParen') : t('parse.unexpected', { text: separator.text }));
  }
  const after = rest[position + 1];
  if (after !== undefined) throw new LineError(t('parse.unexpected', { text: after.text }));
  return { name: name.text, params };
}

function headerOrNull(tokens: Token[]): Header | null {
  try {
    return parseHeader(tokens);
  } catch (error) {
    if (!(error instanceof LineError)) throw error;
    return null;
  }
}

/** How many values a function takes, against how many a call gives it. */
function takesMessage(name: string, count: number, given: number): string {
  if (count === 0) return t('parse.takesNone', { name, given });
  if (count === 1) return t('parse.takesOne', { name, given });
  return t('parse.takesMany', { name, count, given });
}

function isWord(token: Token | undefined, text: string): boolean {
  return token !== undefined && token.type === 'word' && token.text === text;
}

function isSymbol(token: Token | undefined, text: string): boolean {
  return token !== undefined && token.type === 'symbol' && token.text === text;
}

function isSide(direction: string): boolean {
  return direction === 'left' || direction === 'right';
}

/** `drive left` / `drive right` are valid English but not valid here: robots drive like tanks. */
function isSideways(direction: string): boolean {
  return isSide(direction);
}

function expectEnd(rest: Token[], command: string): void {
  if (rest.length > 0) throw new LineError(t('parse.unexpectedAfter', { text: rest[0].text, command }));
}

/**
 * Parses the conditions and arithmetic found on one line.
 *
 * Conditions, loosest first: or, and, not, then a comparison, a true/false
 * variable or a condition in parentheses. Arithmetic, loosest first: + -, then
 * * /, then a leading minus, then a number, a variable, a call or parentheses.
 */
class ExpressionParser {
  private position = 0;
  /** How many brackets, nots, minus signs and calls the parser is inside. */
  private nesting = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly scope: Scope,
  ) {}

  parseWholeCondition(): ConditionNode {
    if (this.tokens.length === 0) throw new LineError(t('parse.expectCondition'));
    const condition = this.parseOr();
    this.expectEnd();
    checkDepth(condition);
    return condition;
  }

  parseWholeExpression(): Expression {
    const expression = this.parseSum();
    this.expectEnd();
    checkDepth(expression);
    return expression;
  }

  /** Parses something nested one level deeper, within MAX_NESTING. */
  private deeper<T>(parse: () => T): T {
    if (this.nesting >= MAX_NESTING) throw new LineError(t('parse.tooDeep', { limit: MAX_NESTING }));
    this.nesting++;
    try {
      return parse();
    } finally {
      this.nesting--;
    }
  }

  private expectEnd(): void {
    const token = this.peek();
    if (token !== undefined) throw new LineError(t('parse.unexpected', { text: token.text }));
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
      return { kind: 'not', operand: this.deeper(() => this.parseNot()) };
    }
    return this.parseTruth();
  }

  /** A true/false variable, a comparison, or a condition in parentheses. */
  private parseTruth(): ConditionNode {
    const first = this.peek();
    if (first === undefined || isLogicalWord(first) || isSymbol(first, ')') || isComparison(first)) {
      throw new LineError(t('parse.expectCondition'));
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
      const condition = this.deeper(() => this.parseOr());
      if (!isSymbol(this.peek(), ')')) throw new LineError(t('parse.expectCloseParen'));
      this.position++;
      return condition;
    }
  }

  private parseComparison(): ConditionNode {
    const start = this.peek();
    const left = this.parseSum();
    const operator = this.peek();
    if (operator === undefined || !isComparison(operator)) {
      // A function's result or a variable stands as a condition on its own: it holds when it is not 0.
      const standsAlone = operator === undefined || isLogicalWord(operator) || isSymbol(operator, ')');
      if (standsAlone && (left.kind === 'call' || left.kind === 'variable')) return { kind: 'truthy', value: left };
      throw new LineError(t('parse.expectComparison', { text: describeEnd(this.tokens, this.position, start) }));
    }
    this.position++;
    const next = this.peek();
    if (next === undefined || isLogicalWord(next) || isComparison(next) || isSymbol(next, ')')) {
      throw new LineError(t('parse.expectValueAfter', { text: operator.text }));
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
      const operand = this.deeper(() => this.parseSigned());
      // Fold the sign into a literal, so `-10` is simply the number -10.
      return operand.kind === 'number' ? { kind: 'number', value: -operand.value } : { kind: 'negate', operand };
    }
    return this.parseValue();
  }

  private parseValue(): Expression {
    const token = this.peek();
    if (token === undefined) throw new LineError(t('parse.expectValue'));
    this.position++;

    if (token.type === 'number') return { kind: 'number', value: token.value };
    if (isSymbol(token, '(')) {
      const inner = this.deeper(() => this.parseSum());
      if (!isSymbol(this.peek(), ')')) throw new LineError(t('parse.expectCloseParen'));
      this.position++;
      return inner;
    }
    if (token.type !== 'word') throw new LineError(t('parse.unexpected', { text: token.text }));
    // true and false are the numbers 1 and 0, so that a function can return a yes or a no.
    if (token.text === 'true') return { kind: 'number', value: 1 };
    if (token.text === 'false') return { kind: 'number', value: 0 };
    if (isSymbol(this.peek(), '(')) return this.parseCall(token.text);
    if (isNumberVariable(token.text)) return { kind: 'sensor', name: token.text };
    if (isBooleanVariable(token.text)) throw new LineError(t('parse.notANumber', { name: token.text }));

    const { variables, functions, owner } = this.scope;
    if (owner?.params.includes(token.text) || variables.has(token.text)) {
      return { kind: 'variable', name: variableIn(this.scope, token.text) };
    }
    if (functions.has(token.text)) throw new LineError(t('parse.expectParenAfter', { name: token.text }));
    throw new LineError(t('parse.unknownVariable', { name: token.text }));
  }

  /** The values in parentheses after the name of a function, which has just been read. */
  private parseCall(name: string): Expression {
    const signature = this.scope.functions.get(name);
    if (signature === undefined) throw new LineError(t('parse.unknownFunction', { name }));
    this.position++;

    const args: Expression[] = [];
    while (!isSymbol(this.peek(), ')')) {
      if (this.peek() === undefined) throw new LineError(t('parse.expectCloseParen'));
      args.push(this.deeper(() => this.parseSum()));
      if (isSymbol(this.peek(), ',')) {
        this.position++;
        // A comma is between two values: none may end the list.
        if (isSymbol(this.peek(), ')')) throw new LineError(t('parse.valueAfterComma'));
      } else if (!isSymbol(this.peek(), ')')) throw new LineError(t('parse.expectCloseParen'));
    }
    this.position++;

    if (args.length !== signature.params.length) {
      throw new LineError(takesMessage(name, signature.params.length, args.length));
    }
    return { kind: 'call', name, args };
  }
}

/**
 * Refuses a condition or a value whose tree is deeper than MAX_NESTING: a
 * long calculation such as 1 + 1 + 1 + … nests one level per step. Counted
 * without recursion, so that the count itself cannot run out of room.
 */
function checkDepth(root: ConditionNode | Expression): void {
  const stack: [ConditionNode | Expression, number][] = [[root, 1]];
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    const [node, depth] = entry;
    if (depth > MAX_NESTING) throw new LineError(t('parse.tooDeep', { limit: MAX_NESTING }));
    for (const child of childrenOf(node)) stack.push([child, depth + 1]);
  }
}

function childrenOf(node: ConditionNode | Expression): (ConditionNode | Expression)[] {
  switch (node.kind) {
    case 'and':
    case 'or':
    case 'comparison':
    case 'arithmetic':
      return [node.left, node.right];
    case 'not':
    case 'negate':
      return [node.operand];
    case 'truthy':
      return [node.value];
    case 'call':
      return node.args;
    default:
      return [];
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
