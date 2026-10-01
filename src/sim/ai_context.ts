export const ROBOT_STATES = ['IDLE', 'SEARCH', 'TRACK', 'ATTACK', 'EVADE'] as const;
export type RobotState = (typeof ROBOT_STATES)[number];

/** Robots drive like tanks: along their heading only, never sideways. */
export type MoveDirection = 'forward' | 'backward';
export type TurnDirection = 'left' | 'right' | 'enemy' | 'cover';

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
  /** An obstacle or a wall is directly behind, so the robot cannot move backward. The other robot does not count. */
  readonly blockedBehind: boolean;
  /** Distance from the robot's edge to the nearest wall or obstacle straight ahead, behind, to the left and to the right. */
  readonly wallAhead: number;
  readonly wallBehind: number;
  readonly wallLeft: number;
  readonly wallRight: number;
  /** An enemy bullet is on course to hit the robot where it stands. */
  readonly bulletIncoming: boolean;
  /** Distance and relative angle (deg, positive = to the right) to the nearest such bullet. 0 if there is none. */
  readonly bulletDistance: number;
  readonly bulletAngle: number;
  /** A place hidden from the enemy (or from where it was last seen) can be driven to in a straight line. */
  readonly coverVisible: boolean;
  /** Distance and relative angle to that place. 0 if there is none, or if the robot is already hidden. */
  readonly coverDistance: number;
  readonly coverAngle: number;
}

/** What the AI wants the robot to do on this tick. A RoboScript program chooses one thing: move, turn, fire, guard or nothing. */
export interface AIAction {
  move: MoveDirection | null;
  turn: TurnDirection | null;
  fire: boolean;
  /** Brace for this tick: hits do less damage. */
  guard: boolean;
  /** null keeps the current state. */
  state: RobotState | null;
  /** Source lines the AI executed on this tick, in order. */
  executedLines: number[];
  /** The source line that decided each part of the action, where known. */
  sourceLines: ActionSourceLines;
  /** Values the AI assigned to its own variables on this tick, in order. */
  assignments: Assignment[];
  /** How the AI's program stands after this tick. */
  status: ProgramStatus;
}

export interface Assignment {
  /** How many of this tick's executed lines had run when the value was assigned. */
  afterLines: number;
  name: string;
  value: number;
}

/**
 * `finished`: the program ran off its end and does nothing any more.
 * `stalled`: it ran too many lines this tick without an action, so the tick passed without one.
 */
export type ProgramStatus = 'running' | 'finished' | 'stalled';

export interface ActionSourceLines {
  move: number | null;
  turn: number | null;
  fire: number | null;
  guard: number | null;
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
    guard: false,
    state: null,
    executedLines: [],
    sourceLines: { move: null, turn: null, fire: null, guard: null, state: null },
    assignments: [],
    status: 'running',
  };
}
