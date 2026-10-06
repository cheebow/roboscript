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

/**
 * How deep functions may call functions: f calling g calling h is 3 deep. Far
 * beyond any program written by hand; it keeps a crafted one from running the
 * browser out of room.
 */
export const MAX_CALL_DEPTH = 50;

/** The errors in how the program's functions call each other. Empty for a program without functions. */
export function checkFunctions(program: Pick<Program, 'body' | 'functions'>): ScriptError[] {
  const facts = new Map<string, Facts>();
  for (const [name, definition] of program.functions) facts.set(name, factsOf(definition.body));

  const depths = callDepths(facts);
  for (const [name, definition] of program.functions) {
    if ((depths.get(name) ?? 0) > MAX_CALL_DEPTH) return [{ line: definition.line, message: t('functions.tooDeep', { name, limit: MAX_CALL_DEPTH }) }];
  }

  const recursion = recursionErrors(program.functions, facts);
  // With a function calling itself, "what it takes to run" has no answer.
  if (recursion.length > 0) return recursion;

  const errors: ScriptError[] = [];
  const reasons = new Map<string, string | null>();
  const check = ({ valueCalls }: Facts) => {
    for (const { name, line } of valueCalls) {
      const reason = whyNotAValue(name, facts, reasons);
      if (reason !== null) errors.push({ line, message: t('functions.notAValue', { name, reason }) });
    }
  };
  check(factsOf(program.body));
  for (const own of facts.values()) check(own);
  return errors;
}

/**
 * Why the function cannot be called inside a condition or a value, or null if
 * it can. Each answer is kept in `reasons`: a function called many times over
 * is looked into once.
 */
function whyNotAValue(name: string, facts: ReadonlyMap<string, Facts>, reasons: Map<string, string | null>): string | null {
  const known = reasons.get(name);
  if (known !== undefined) return known;
  const reason = reasonOf(name, facts, reasons);
  reasons.set(name, reason);
  return reason;
}

function reasonOf(name: string, facts: ReadonlyMap<string, Facts>, reasons: Map<string, string | null>): string | null {
  const own = facts.get(name);
  if (own === undefined) return null;
  if (own.timeLine !== null) return t('functions.takesTime', { line: own.timeLine });
  if (own.loopLine !== null) return t('functions.loops', { line: own.loopLine });
  for (const call of own.calls) {
    const reason = whyNotAValue(call.name, facts, reasons);
    if (reason !== null) return reason;
  }
  return null;
}

/**
 * How deep the calls from each function go: 1 for one that calls none.
 * Worked out without recursion, so that a long chain cannot run the browser
 * out of room; a call back into a function on the way (recursion, reported
 * apart) counts as none.
 */
function callDepths(facts: ReadonlyMap<string, Facts>): Map<string, number> {
  const depths = new Map<string, number>();
  const onTheWay = new Set<string>();
  for (const start of facts.keys()) {
    if (depths.has(start)) continue;
    const stack = [{ name: start, next: 0 }];
    onTheWay.add(start);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const calls = facts.get(top.name)?.calls ?? [];
      if (top.next < calls.length) {
        const callee = calls[top.next++].name;
        if (facts.has(callee) && !depths.has(callee) && !onTheWay.has(callee)) {
          onTheWay.add(callee);
          stack.push({ name: callee, next: 0 });
        }
        continue;
      }
      const deepest = calls.reduce((most, call) => Math.max(most, depths.get(call.name) ?? 0), 0);
      depths.set(top.name, deepest + 1);
      onTheWay.delete(top.name);
      stack.pop();
    }
  }
  return depths;
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
