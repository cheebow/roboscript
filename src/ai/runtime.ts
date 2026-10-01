import { type AIAction, type AIContext, type RobotBrain, createIdleAction } from '../sim/ai_context';
import type { ComparisonOperator, ConditionNode, NumberOperand, Program, StatementNode } from './ast';
import { BOOLEAN_VARIABLES, NUMBER_VARIABLES } from './script_variables';

/**
 * Runs a parsed RoboScript program. The whole program is evaluated from the
 * top on every tick; nothing carries over between ticks.
 */
export class ScriptBrain implements RobotBrain {
  constructor(private readonly program: Program) {}

  decide(context: AIContext): AIAction {
    const action = createIdleAction();
    runBlock(this.program.body, context, action);
    return action;
  }
}

/** Returns false once a `wait` has ended this tick's evaluation. */
function runBlock(body: StatementNode[], context: AIContext, action: AIAction): boolean {
  for (const statement of body) {
    action.executedLines.push(statement.line);
    switch (statement.kind) {
      case 'if': {
        let branch = statement.thenBody;
        if (!evaluate(statement.condition, context)) {
          if (statement.elseLine === null) break;
          action.executedLines.push(statement.elseLine);
          branch = statement.elseBody;
        }
        if (!runBlock(branch, context, action)) return false;
        break;
      }
      case 'move':
        action.move = statement.direction;
        action.sourceLines.move = statement.line;
        break;
      case 'turn':
        action.turn = statement.direction;
        action.sourceLines.turn = statement.line;
        break;
      case 'fire':
        action.fire = true;
        action.sourceLines.fire = statement.line;
        break;
      case 'state':
        action.state = statement.state;
        action.sourceLines.state = statement.line;
        break;
      case 'wait':
        action.move = null;
        action.turn = null;
        action.fire = false;
        action.sourceLines.move = null;
        action.sourceLines.turn = null;
        action.sourceLines.fire = null;
        return false;
    }
  }
  return true;
}

function evaluate(condition: ConditionNode, context: AIContext): boolean {
  switch (condition.kind) {
    case 'boolean_variable':
      return BOOLEAN_VARIABLES[condition.name](context);
    case 'comparison':
      return compare(condition.operator, readNumber(condition.left, context), readNumber(condition.right, context));
    case 'not':
      return !evaluate(condition.operand, context);
    case 'and':
      return evaluate(condition.left, context) && evaluate(condition.right, context);
    case 'or':
      return evaluate(condition.left, context) || evaluate(condition.right, context);
  }
}

function readNumber(operand: NumberOperand, context: AIContext): number {
  return operand.kind === 'number' ? operand.value : NUMBER_VARIABLES[operand.name](context);
}

function compare(operator: ComparisonOperator, left: number, right: number): boolean {
  switch (operator) {
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '<=':
      return left <= right;
    case '>=':
      return left >= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
  }
}
