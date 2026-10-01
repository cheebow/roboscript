export const ROBOT_STATES = ['IDLE', 'SEARCH', 'TRACK', 'ATTACK', 'EVADE'] as const;
export type RobotState = (typeof ROBOT_STATES)[number];

/** Robots drive like tanks: along their heading only, never sideways. */
export type MoveDirection = 'forward' | 'backward';
export type TurnDirection = 'left' | 'right' | 'enemy';

/**
 * Everything an AI is allowed to know on one tick. The AI never touches the
 * robot itself (SPEC §35).
 */
export interface AIContext {
  /** The enemy is in sensor range and not hidden behind an obstacle. */
  readonly enemyVisible: boolean;
  /** Distance to the enemy, or to its last seen position when not visible. 0 if never seen. */
  readonly enemyDistance: number;
  /** Relative angle in deg (-180..180, positive = to the right). 0 if never seen. */
  readonly enemyAngle: number;
  /** Last observed enemy position. 0 if never seen. */
  readonly enemyX: number;
  readonly enemyY: number;
  readonly hp: number;
  readonly ammo: number;
  /** An obstacle or a wall is directly ahead, so the robot cannot move forward. The other robot does not count. */
  readonly blocked: boolean;
}

/** What the AI wants the robot to do on this tick. */
export interface AIAction {
  move: MoveDirection | null;
  turn: TurnDirection | null;
  fire: boolean;
  /** null keeps the current state. */
  state: RobotState | null;
  /** Source lines the AI executed to reach this decision, in order. */
  executedLines: number[];
  /** The source line that decided each part of the action, where known. */
  sourceLines: ActionSourceLines;
}

export interface ActionSourceLines {
  move: number | null;
  turn: number | null;
  fire: number | null;
  state: number | null;
}

export interface RobotBrain {
  decide(context: AIContext): AIAction;
}

export function createIdleAction(): AIAction {
  return {
    move: null,
    turn: null,
    fire: false,
    state: null,
    executedLines: [],
    sourceLines: { move: null, turn: null, fire: null, state: null },
  };
}
