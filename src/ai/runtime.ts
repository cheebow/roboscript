import { type AIAction, type AIContext, type RobotBrain, createIdleAction } from '../sim/ai_context';
import type { ArithmeticOperator, ComparisonOperator, ConditionNode, Expression, Program, StatementNode } from './ast';
import { BOOLEAN_VARIABLES, NUMBER_VARIABLES } from './script_variables';

/** Execution that hands control back whenever a tick is over. */
type Execution = Generator<void, void, void>;

/**
 * Runs a parsed RoboScript program the way an ordinary program runs: from the
 * top, one statement after another. An action statement (move, turn, fire,
 * wait) is what the robot does for one tick; execution then stops and picks up
 * from the next statement on the following tick. Everything else takes no time.
 */
export class ScriptBrain implements RobotBrain {
  private readonly variables = new Map<string, number>();
  private readonly execution: Execution;
  private finished = false;
  // The tick being decided: what the robot senses, and the action being built.
  private context!: AIContext;
  private action!: AIAction;

  /** `lineBudget` bounds the lines run in one tick, so a loop without an action cannot hang the match. */
  constructor(
    program: Program,
    private readonly lineBudget: number,
  ) {
    this.execution = this.runBlock(program.body);
  }

  decide(context: AIContext): AIAction {
    this.context = context;
    this.action = createIdleAction();
    if (!this.finished) this.finished = this.execution.next().done === true;
    if (this.finished) this.action.status = 'finished';
    return this.action;
  }

  private *runBlock(body: StatementNode[]): Execution {
    for (const statement of body) yield* this.runStatement(statement);
  }

  private *runStatement(statement: StatementNode): Execution {
    yield* this.enter(statement.line);
    const { action } = this;
    switch (statement.kind) {
      case 'if':
        if (this.holds(statement.condition)) {
          yield* this.runBlock(statement.thenBody);
        } else if (statement.elseLine !== null) {
          yield* this.enter(statement.elseLine);
          yield* this.runBlock(statement.elseBody);
        }
        return;
      case 'loop':
        for (;;) {
          yield* this.runBlock(statement.body);
          yield* this.enter(statement.line);
        }
      case 'while':
        while (this.holds(statement.condition)) {
          yield* this.runBlock(statement.body);
          yield* this.enter(statement.line);
        }
        return;
      case 'set': {
        const value = this.valueOf(statement.value);
        this.variables.set(statement.name, value);
        action.assignments.push({ afterLines: action.executedLines.length, name: statement.name, value });
        return;
      }
      case 'state':
        action.state = statement.state;
        action.sourceLines.state = statement.line;
        return;
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
      case 'wait':
        break;
    }
    // An action was chosen: the tick is over.
    yield;
  }

  /**
   * Notes that the line is being executed. When the tick's line budget is
   * used up, the tick ends here without an action and the line runs next tick.
   */
  private *enter(line: number): Execution {
    if (this.action.executedLines.length >= this.lineBudget) {
      this.action.status = 'stalled';
      yield;
    }
    this.action.executedLines.push(line);
  }

  private holds(condition: ConditionNode): boolean {
    switch (condition.kind) {
      case 'boolean_variable':
        return BOOLEAN_VARIABLES[condition.name](this.context);
      case 'comparison':
        return compare(condition.operator, this.valueOf(condition.left), this.valueOf(condition.right));
      case 'not':
        return !this.holds(condition.operand);
      case 'and':
        return this.holds(condition.left) && this.holds(condition.right);
      case 'or':
        return this.holds(condition.left) || this.holds(condition.right);
    }
  }

  private valueOf(expression: Expression): number {
    switch (expression.kind) {
      case 'number':
        return expression.value;
      case 'sensor':
        return NUMBER_VARIABLES[expression.name](this.context);
      case 'variable':
        // A variable reads as 0 until the program has assigned it.
        return this.variables.get(expression.name) ?? 0;
      case 'negate':
        return -this.valueOf(expression.operand);
      case 'arithmetic':
        return calculate(expression.operator, this.valueOf(expression.left), this.valueOf(expression.right));
    }
  }
}

function calculate(operator: ArithmeticOperator, left: number, right: number): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      // Dividing by zero gives 0, so a program can never produce a non-number.
      return right === 0 ? 0 : left / right;
  }
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
