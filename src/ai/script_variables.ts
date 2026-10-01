import { type AIContext, type MoveDirection, ROBOT_STATES, type RobotState, type TurnDirection } from '../sim/ai_context';

// The names a RoboScript program may use, and how each maps onto the AIContext.

export const BOOLEAN_VARIABLES = {
  enemy_visible: (context: AIContext) => context.enemyVisible,
  blocked: (context: AIContext) => context.blocked,
  blocked_behind: (context: AIContext) => context.blockedBehind,
};

export const NUMBER_VARIABLES = {
  enemy_distance: (context: AIContext) => context.enemyDistance,
  enemy_angle: (context: AIContext) => context.enemyAngle,
  hp: (context: AIContext) => context.hp,
  ammo: (context: AIContext) => context.ammo,
};

export type BooleanVariableName = keyof typeof BOOLEAN_VARIABLES;
export type NumberVariableName = keyof typeof NUMBER_VARIABLES;

const MOVE_DIRECTIONS: readonly string[] = ['forward', 'backward'] satisfies MoveDirection[];
const TURN_DIRECTIONS: readonly string[] = ['left', 'right', 'enemy'] satisfies TurnDirection[];
const STATES: readonly string[] = ROBOT_STATES;

/** Words with a meaning of their own, which a program may not use as a variable name. */
const KEYWORDS: readonly string[] = [
  'if',
  'else',
  'loop',
  'while',
  'set',
  'move',
  'turn',
  'fire',
  'wait',
  'state',
  'and',
  'or',
  'not',
];

/** Whether the word already means something in the language: a keyword or a sensor value. */
export function isReservedWord(name: string): boolean {
  return KEYWORDS.includes(name) || isBooleanVariable(name) || isNumberVariable(name);
}

export function isBooleanVariable(name: string): name is BooleanVariableName {
  return Object.hasOwn(BOOLEAN_VARIABLES, name);
}

export function isNumberVariable(name: string): name is NumberVariableName {
  return Object.hasOwn(NUMBER_VARIABLES, name);
}

export function isMoveDirection(name: string): name is MoveDirection {
  return MOVE_DIRECTIONS.includes(name);
}

export function isTurnDirection(name: string): name is TurnDirection {
  return TURN_DIRECTIONS.includes(name);
}

export function isRobotState(name: string): name is RobotState {
  return STATES.includes(name);
}
