import type { ConditionNode, Expression, StatementNode } from './ast';

/** What to do at each part of a program; every part is optional. */
export interface Visitor {
  statement?(statement: StatementNode): void;
  /** Every condition, and every condition inside one, with the line of its statement. */
  condition?(condition: ConditionNode, line: number): void;
  /** Every expression, and every expression inside one, with the line of its statement. */
  expression?(expression: Expression, line: number): void;
}

/** Visits every statement of the body, nested ones too, and every condition and expression in them. */
export function walk(body: readonly StatementNode[], visitor: Visitor): void {
  for (const statement of body) walkStatement(statement, visitor);
}

function walkStatement(statement: StatementNode, visitor: Visitor): void {
  visitor.statement?.(statement);
  const { line } = statement;
  switch (statement.kind) {
    case 'if':
      walkCondition(statement.condition, line, visitor);
      walk(statement.thenBody, visitor);
      walk(statement.elseBody, visitor);
      return;
    case 'while':
      walkCondition(statement.condition, line, visitor);
      walk(statement.body, visitor);
      return;
    case 'loop':
      walk(statement.body, visitor);
      return;
    case 'set':
      walkExpression(statement.value, line, visitor);
      return;
    case 'call':
      for (const argument of statement.args) walkExpression(argument, line, visitor);
      return;
    case 'return':
      if (statement.value !== null) walkExpression(statement.value, line, visitor);
      return;
    case 'turn':
    case 'aim':
      if (statement.angle !== null) walkExpression(statement.angle, line, visitor);
      return;
    default:
      // Actions and settings: nothing inside them to visit.
      return;
  }
}

function walkCondition(condition: ConditionNode, line: number, visitor: Visitor): void {
  visitor.condition?.(condition, line);
  switch (condition.kind) {
    case 'boolean_variable':
      return;
    case 'truthy':
      walkExpression(condition.value, line, visitor);
      return;
    case 'comparison':
      walkExpression(condition.left, line, visitor);
      walkExpression(condition.right, line, visitor);
      return;
    case 'not':
      walkCondition(condition.operand, line, visitor);
      return;
    case 'and':
    case 'or':
      walkCondition(condition.left, line, visitor);
      walkCondition(condition.right, line, visitor);
      return;
    default:
      return unreachable(condition);
  }
}

function walkExpression(expression: Expression, line: number, visitor: Visitor): void {
  visitor.expression?.(expression, line);
  switch (expression.kind) {
    case 'number':
    case 'sensor':
    case 'variable':
      return;
    case 'negate':
      walkExpression(expression.operand, line, visitor);
      return;
    case 'arithmetic':
      walkExpression(expression.left, line, visitor);
      walkExpression(expression.right, line, visitor);
      return;
    case 'call':
      for (const argument of expression.args) walkExpression(argument, line, visitor);
      return;
    default:
      return unreachable(expression);
  }
}

/** A kind of node this file does not know: the compiler points here when one is added. */
function unreachable(node: never): void {
  void node;
}
