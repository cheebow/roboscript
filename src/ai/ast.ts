import type { AimDirection, DriveSetting, TurnDirection } from '../sim/ai_context';
import type { BooleanVariableName, FaceTarget, NumberVariableName } from './script_variables';

export type ComparisonOperator = '<' | '>' | '<=' | '>=' | '==' | '!=';
export type ArithmeticOperator = '+' | '-' | '*' | '/';

/** Something that evaluates to a number. */
export type Expression =
  | { kind: 'number'; value: number }
  /** A value the robot senses, e.g. `enemy_distance`. */
  | { kind: 'sensor'; name: NumberVariableName }
  /** A variable the program itself assigns with `set`. */
  | { kind: 'variable'; name: string }
  | { kind: 'negate'; operand: Expression }
  | { kind: 'arithmetic'; operator: ArithmeticOperator; left: Expression; right: Expression }
  /** A call of one of the program's functions for the value it returns. */
  | { kind: 'call'; name: string; args: Expression[] };

export type ConditionNode =
  | { kind: 'boolean_variable'; name: BooleanVariableName }
  /** A function's result or a variable standing for itself: holds when it is not 0. */
  | { kind: 'truthy'; value: Expression }
  | { kind: 'comparison'; operator: ComparisonOperator; left: Expression; right: Expression }
  | { kind: 'not'; operand: ConditionNode }
  | { kind: 'and' | 'or'; left: ConditionNode; right: ConditionNode };

export interface IfNode {
  kind: 'if';
  line: number;
  condition: ConditionNode;
  thenBody: StatementNode[];
  /** Line of the `else` keyword, or null when there is no else branch. */
  elseLine: number | null;
  elseBody: StatementNode[];
}

/** Repeats its body forever. */
export interface LoopNode {
  kind: 'loop';
  line: number;
  body: StatementNode[];
}

/** Repeats its body for as long as the condition holds. */
export interface WhileNode {
  kind: 'while';
  line: number;
  condition: ConditionNode;
  body: StatementNode[];
}

export interface SetNode {
  kind: 'set';
  line: number;
  name: string;
  value: Expression;
}

/** A statement that makes the robot do something, and takes one tick. */
export type ActionNode =
  | { kind: 'turn'; line: number; direction: TurnDirection }
  | { kind: 'aim'; line: number; direction: AimDirection }
  | { kind: 'fire'; line: number }
  | { kind: 'guard'; line: number }
  | { kind: 'wait'; line: number };

/** Turns the hull, a tick at a time, until it faces the target; takes no time once it does, or when there is no target. */
export interface FaceNode {
  kind: 'face';
  line: number;
  target: FaceTarget;
}

/** Names what the robot is doing, for show: under the robot, and in the log when it changes. Takes no time. */
export interface LabelNode {
  kind: 'label';
  line: number;
  label: string;
}

/** Sets how the hull drives from now on. Takes no time: the driving goes on alongside the actions. */
export interface DriveNode {
  kind: 'drive';
  line: number;
  setting: DriveSetting;
}

/** A call of one of the program's functions on a line of its own; what it returns is dropped. */
export interface CallNode {
  kind: 'call';
  line: number;
  name: string;
  args: Expression[];
}

/** Ends the function it is in, with the value it returns (0 when none is given). */
export interface ReturnNode {
  kind: 'return';
  line: number;
  value: Expression | null;
}

export type StatementNode =
  | IfNode
  | LoopNode
  | WhileNode
  | SetNode
  | ActionNode
  | FaceNode
  | LabelNode
  | DriveNode
  | CallNode
  | ReturnNode;

/** A named piece of program, run when it is called. */
export interface FunctionNode {
  name: string;
  /** Line of its `def`. */
  line: number;
  /** The variables its arguments go into: local to the function, and stored under `parameterVariable(...)`. */
  params: string[];
  body: StatementNode[];
}

/** The name under which a function's parameter is kept among the program's variables, e.g. `approach.limit`. */
export function parameterVariable(functionName: string, param: string): string {
  return `${functionName}.${param}`;
}

export interface Program {
  body: StatementNode[];
  functions: ReadonlyMap<string, FunctionNode>;
}
