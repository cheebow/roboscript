import type { ConditionNode, Expression, Program, StatementNode } from './ast';

const COVER_SENSORS: readonly string[] = ['cover_visible', 'cover_distance', 'cover_angle'];

/** Whether the program has anything to do with cover: it reads a cover sensor or turns towards cover. */
export function usesCover(program: Program): boolean {
  return program.body.some(statementUsesCover);
}

function statementUsesCover(statement: StatementNode): boolean {
  switch (statement.kind) {
    case 'if':
      return (
        conditionUsesCover(statement.condition) ||
        statement.thenBody.some(statementUsesCover) ||
        statement.elseBody.some(statementUsesCover)
      );
    case 'while':
      return conditionUsesCover(statement.condition) || statement.body.some(statementUsesCover);
    case 'loop':
      return statement.body.some(statementUsesCover);
    case 'set':
      return expressionUsesCover(statement.value);
    case 'turn':
      return statement.direction === 'cover';
    default:
      return false;
  }
}

function conditionUsesCover(condition: ConditionNode): boolean {
  switch (condition.kind) {
    case 'boolean_variable':
      return COVER_SENSORS.includes(condition.name);
    case 'comparison':
      return expressionUsesCover(condition.left) || expressionUsesCover(condition.right);
    case 'not':
      return conditionUsesCover(condition.operand);
    case 'and':
    case 'or':
      return conditionUsesCover(condition.left) || conditionUsesCover(condition.right);
  }
}

function expressionUsesCover(expression: Expression): boolean {
  switch (expression.kind) {
    case 'sensor':
      return COVER_SENSORS.includes(expression.name);
    case 'negate':
      return expressionUsesCover(expression.operand);
    case 'arithmetic':
      return expressionUsesCover(expression.left) || expressionUsesCover(expression.right);
    default:
      return false;
  }
}
