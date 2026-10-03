import { t } from '../i18n/messages';
import type { FunctionNode, Program, StatementNode } from './ast';
import { walk } from './walk';
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
      if (reason !== null) errors.push({ line, message: t('functions.notAValue', { name, reason }) });
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
  if (own.timeLine !== null) return t('functions.takesTime', { line: own.timeLine });
  if (own.loopLine !== null) return t('functions.loops', { line: own.loopLine });
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
    const message = through.length === 0 ? t('functions.callsItself', { name }) : t('functions.callsItselfThrough', { name, through: through[0] });
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
  walk(body, {
    statement(statement) {
      const { line } = statement;
      if (ACTIONS.includes(statement.kind)) facts.timeLine ??= line;
      if (statement.kind === 'while' || statement.kind === 'loop') facts.loopLine ??= line;
      if (statement.kind === 'call') facts.calls.push({ name: statement.name, line });
    },
    expression(expression, line) {
      if (expression.kind !== 'call') return;
      facts.calls.push({ name: expression.name, line });
      facts.valueCalls.push({ name: expression.name, line });
    },
  });
  return facts;
}
