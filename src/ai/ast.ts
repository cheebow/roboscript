import type { MoveDirection, RobotState, TurnDirection } from '../sim/ai_context';
import type { BooleanVariableName, NumberVariableName } from './script_variables';

export type ComparisonOperator = '<' | '>' | '<=' | '>=' | '==' | '!=';

export type NumberOperand =
  | { kind: 'number'; value: number }
  | { kind: 'number_variable'; name: NumberVariableName };

export type ConditionNode =
  | { kind: 'boolean_variable'; name: BooleanVariableName }
  | { kind: 'comparison'; operator: ComparisonOperator; left: NumberOperand; right: NumberOperand }
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

export type ActionNode =
  | { kind: 'move'; line: number; direction: MoveDirection }
  | { kind: 'turn'; line: number; direction: TurnDirection }
  | { kind: 'fire'; line: number }
  | { kind: 'wait'; line: number };

export interface StateNode {
  kind: 'state';
  line: number;
  state: RobotState;
}

export type StatementNode = IfNode | ActionNode | StateNode;

export interface Program {
  body: StatementNode[];
}
