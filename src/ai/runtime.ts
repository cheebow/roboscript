import { normalizeAngle } from '../sim/math';
import { type AIAction, type AIContext, type RobotBrain, createIdleAction } from '../sim/ai_context';
import {
  type ArithmeticOperator,
  type ComparisonOperator,
  type ConditionNode,
  type Expression,
  type FunctionNode,
  type Program,
  type StatementNode,
  parameterVariable,
} from './ast';
import { BOOLEAN_VARIABLES, type FaceTarget, NUMBER_VARIABLES } from './script_variables';

/** How a stretch of program ended: by a `return`, with its value, by a `break`, or (null) by running to its end. */
type Completion = { value: number } | { break: true } | null;

/** Execution that hands control back whenever a tick is over. */
type Execution = Generator<void, Completion, void>;

/** deg: `face` is done when the target is this close to straight ahead; the last tick of turning lands exactly on it. */
const FACED_WITHIN = 0.5;

/**
 * Runs a parsed RoboScript program the way an ordinary program runs: from the
 * top, one statement after another. An action statement (turn, aim, fire,
 * guard, wait) is what the robot does for one tick; execution then stops and
 * picks up from the next statement on the following tick. Everything else,
 * including setting how the hull drives, takes no time.
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
    private readonly program: Program,
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

  /** Runs the statements one after another; stops early, with its value, at a `return`. */
  private *runBlock(body: StatementNode[]): Execution {
    for (const statement of body) {
      const completion = yield* this.runStatement(statement);
      if (completion !== null) return completion;
    }
    return null;
  }

  private *runStatement(statement: StatementNode): Execution {
    yield* this.enter(statement.line);
    const { action } = this;
    switch (statement.kind) {
      case 'if':
        if (this.holds(statement.condition)) return yield* this.runBlock(statement.thenBody);
        if (statement.elseLine === null) return null;
        // An `else if` notes its line itself, as the if it is.
        if (!statement.elseIf) yield* this.enter(statement.elseLine);
        return yield* this.runBlock(statement.elseBody);
      case 'loop':
        for (;;) {
          const completion = yield* this.runBlock(statement.body);
          if (completion !== null) return 'break' in completion ? null : completion;
          yield* this.enter(statement.line);
        }
      case 'while':
        while (this.holds(statement.condition)) {
          const completion = yield* this.runBlock(statement.body);
          if (completion !== null) return 'break' in completion ? null : completion;
          yield* this.enter(statement.line);
        }
        return null;
      case 'face': {
        // One tick of turning at a time, until the hull faces the target. Facing it already, or with
        // nothing to face (the angle is 0 then), it takes no time at all.
        // Back is the way opposite to where the hull faces now: kept, as the hull turns towards it.
        const back = statement.target === 'back' ? normalizeAngle(this.context.heading + 180) : null;
        while (Math.abs(back === null ? this.angleTo(statement.target) : normalizeAngle(back - this.context.heading)) > FACED_WITHIN) {
          this.action.turn = statement.target;
          this.action.heading = back;
          this.action.sourceLines.turn = statement.line;
          yield;
          yield* this.enter(statement.line);
        }
        return null;
      }
      case 'call': {
        const body = this.prepareCall(statement.name, statement.args);
        // What the function returns is of no use to a call on a line of its own.
        yield* this.runBlock(body);
        return null;
      }
      case 'turn':
        action.turn = statement.direction;
        action.sourceLines.turn = statement.line;
        break;
      case 'aim':
        action.aim = statement.direction;
        action.sourceLines.aim = statement.line;
        break;
      case 'fire':
        action.fire = true;
        action.sourceLines.fire = statement.line;
        break;
      case 'guard':
        action.guard = true;
        action.sourceLines.guard = statement.line;
        break;
      case 'wait':
        break;
      default:
        return this.runInstantly(statement);
    }
    // An action was chosen: the tick is over.
    yield;
    return null;
  }

  /** deg, how far the hull is from facing the target: positive to the right. 0 when there is nothing to face. */
  private angleTo(target: FaceTarget): number {
    switch (target) {
      case 'enemy':
        return this.context.enemyAngle;
      case 'cover':
        return this.context.coverAngle;
      case 'hit':
        return this.context.hitAngle;
      case 'back':
        return 0;
    }
  }

  /** The statements that take no time and have no block: they work the same wherever they are run from. */
  private runInstantly(statement: StatementNode): Completion {
    const { action } = this;
    switch (statement.kind) {
      case 'set':
        this.assign(statement.name, this.valueOf(statement.value));
        return null;
      case 'label':
        action.label = statement.label;
        action.sourceLines.label = statement.line;
        return null;
      case 'drive':
        // A setting, not an action: the hull keeps driving while the program goes on.
        action.drive = statement.setting;
        action.sourceLines.drive = statement.line;
        return null;
      case 'return':
        return { value: statement.value === null ? 0 : this.valueOf(statement.value) };
      case 'break':
        return { break: true };
      default:
        throw new Error(`"${statement.kind}" on line ${statement.line} cannot be run without taking time`);
    }
  }

  /**
   * Notes that the line is being executed. When the tick's line budget is
   * used up, the tick ends here without an action and the line runs next tick.
   */
  private *enter(line: number): Generator<void, void, void> {
    if (this.action.executedLines.length >= this.lineBudget) {
      this.action.status = 'stalled';
      yield;
    }
    this.action.executedLines.push(line);
  }

  /** Works out the values passed to a function and puts them in its parameters. Returns the body to run. */
  private prepareCall(name: string, args: Expression[]): StatementNode[] {
    const definition = this.functionNamed(name);
    // All the values first: one of them may be a call that uses the same parameters.
    const values = args.map((argument) => this.valueOf(argument));
    definition.params.forEach((param, index) => this.assign(parameterVariable(name, param), values[index]));
    return definition.body;
  }

  private functionNamed(name: string): FunctionNode {
    const definition = this.program.functions.get(name);
    if (definition === undefined) throw new Error(`No function "${name}"`);
    return definition;
  }

  private assign(name: string, value: number): void {
    this.variables.set(name, value);
    this.action.assignments.push({ afterLines: this.action.executedLines.length, name, value });
  }

  /**
   * Runs a function in the middle of a condition or a value, and gives what
   * it returns. Such a function has no actions and no loops (the parser sees
   * to that), so it runs through without a break.
   */
  private call(name: string, args: Expression[]): number {
    const completion = this.runWithoutBreak(this.prepareCall(name, args));
    return completion !== null && 'value' in completion ? completion.value : 0;
  }

  private runWithoutBreak(body: StatementNode[]): Completion {
    for (const statement of body) {
      this.action.executedLines.push(statement.line);
      const completion = this.runStatementWithoutBreak(statement);
      if (completion !== null) return completion;
    }
    return null;
  }

  private runStatementWithoutBreak(statement: StatementNode): Completion {
    switch (statement.kind) {
      case 'if':
        if (this.holds(statement.condition)) return this.runWithoutBreak(statement.thenBody);
        if (statement.elseLine === null) return null;
        if (!statement.elseIf) this.action.executedLines.push(statement.elseLine);
        return this.runWithoutBreak(statement.elseBody);
      case 'call':
        this.runWithoutBreak(this.prepareCall(statement.name, statement.args));
        return null;
      default:
        return this.runInstantly(statement);
    }
  }

  private holds(condition: ConditionNode): boolean {
    switch (condition.kind) {
      case 'boolean_variable':
        return BOOLEAN_VARIABLES[condition.name](this.context);
      case 'truthy':
        return this.valueOf(condition.value) !== 0;
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
      case 'call':
        return this.call(expression.name, expression.args);
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
