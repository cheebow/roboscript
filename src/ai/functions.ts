import type { ConditionNode, Expression, FunctionNode, Program, StatementNode } from './ast';
import type { ScriptError } from './script_error';

// Checks on a parsed program that concern its functions as a whole: that none
// calls itself, and that those used for their value can be worked out on the spot.

/** What a function does, as far as its own lines go. */
interface Facts {
  /** Line of its first action (turn, aim, fire, guard, wait), or null. */
  timeLine: number | null;
  /** Line of its first loop or while, or null. */
  loopLine: number | null;
  /** The functions it calls, with the line of the call. */
  calls: { name: string; line: number }[];
  /** Those of them it calls for their value. */
  valueCalls: { name: string; line: number }[];
}

const ACTIONS: readonly string[] = ['turn', 'aim', 'fire', 'guard', 'wait'];

/** The errors in how the program's functions call each other. Empty for a program without functions. */
export function checkFunctions(program: Pick<Program, 'body' | 'functions'>): ScriptError[] {
  const facts = new Map<string, Facts>();
  for (const [name, definition] of program.functions) facts.set(name, factsOf(definition.body));

  const recursion = recursionErrors(program.functions, facts);
  // With a function calling itself, "what it takes to run" has no answer.
  if (recursion.length > 0) return recursion;

  const errors: ScriptError[] = [];
  const check = ({ valueCalls }: Facts) => {
    for (const { name, line } of valueCalls) {
      const reason = whyNotAValue(name, facts);
      if (reason !== null) errors.push({ line, message: `"${name}" cannot be used as a value: ${reason}` });
    }
  };
  check(factsOf(program.body));
  for (const own of facts.values()) check(own);
  return errors;
}

/** Why the function cannot be called inside a condition or a value, or null if it can. */
function whyNotAValue(name: string, facts: ReadonlyMap<string, Facts>): string | null {
  const own = facts.get(name);
  if (own === undefined) return null;
  if (own.timeLine !== null) return `it takes time (line ${own.timeLine})`;
  if (own.loopLine !== null) return `it loops (line ${own.loopLine})`;
  for (const call of own.calls) {
    const reason = whyNotAValue(call.name, facts);
    if (reason !== null) return reason;
  }
  return null;
}

function recursionErrors(functions: ReadonlyMap<string, FunctionNode>, facts: ReadonlyMap<string, Facts>): ScriptError[] {
  const errors: ScriptError[] = [];
  for (const [name, definition] of functions) {
    const through = wayBackTo(name, name, facts, new Set());
    if (through === null) continue;
    const message = through.length === 0 ? `"${name}" calls itself` : `"${name}" calls itself through "${through[0]}"`;
    errors.push({ line: definition.line, message });
  }
  return errors;
}

/**
 * The functions on a chain of calls from `from` back to `target`, not
 * counting the two ends; null when there is no such chain.
 */
function wayBackTo(target: string, from: string, facts: ReadonlyMap<string, Facts>, seen: Set<string>): string[] | null {
  for (const { name } of facts.get(from)?.calls ?? []) {
    if (name === target) return [];
    if (seen.has(name)) continue;
    seen.add(name);
    const rest = wayBackTo(target, name, facts, seen);
    if (rest !== null) return [name, ...rest];
  }
  return null;
}

function factsOf(body: readonly StatementNode[]): Facts {
  const facts: Facts = { timeLine: null, loopLine: null, calls: [], valueCalls: [] };
  for (const statement of body) noteStatement(statement, facts);
  return facts;
}

function noteStatement(statement: StatementNode, facts: Facts): void {
  const { line } = statement;
  if (ACTIONS.includes(statement.kind)) facts.timeLine ??= line;

  switch (statement.kind) {
    case 'if':
      noteCondition(statement.condition, line, facts);
      for (const inner of [...statement.thenBody, ...statement.elseBody]) noteStatement(inner, facts);
      return;
    case 'while':
      facts.loopLine ??= line;
      noteCondition(statement.condition, line, facts);
      for (const inner of statement.body) noteStatement(inner, facts);
      return;
    case 'loop':
      facts.loopLine ??= line;
      for (const inner of statement.body) noteStatement(inner, facts);
      return;
    case 'set':
      noteExpression(statement.value, line, facts);
      return;
    case 'call':
      facts.calls.push({ name: statement.name, line });
      for (const argument of statement.args) noteExpression(argument, line, facts);
      return;
    case 'return':
      if (statement.value !== null) noteExpression(statement.value, line, facts);
      return;
    default:
      return;
  }
}

function noteCondition(condition: ConditionNode, line: number, facts: Facts): void {
  switch (condition.kind) {
    case 'comparison':
      noteExpression(condition.left, line, facts);
      noteExpression(condition.right, line, facts);
      return;
    case 'not':
      noteCondition(condition.operand, line, facts);
      return;
    case 'and':
    case 'or':
      noteCondition(condition.left, line, facts);
      noteCondition(condition.right, line, facts);
      return;
    default:
      return;
  }
}

function noteExpression(expression: Expression, line: number, facts: Facts): void {
  switch (expression.kind) {
    case 'call':
      facts.calls.push({ name: expression.name, line });
      facts.valueCalls.push({ name: expression.name, line });
      for (const argument of expression.args) noteExpression(argument, line, facts);
      return;
    case 'negate':
      noteExpression(expression.operand, line, facts);
      return;
    case 'arithmetic':
      noteExpression(expression.left, line, facts);
      noteExpression(expression.right, line, facts);
      return;
    default:
      return;
  }
}
