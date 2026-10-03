/** The label every robot carries until its program gives it one. */
export const INITIAL_LABEL = 'IDLE';

/** Robots drive like tanks: along their heading only, never sideways. */
export type DriveDirection = 'forward' | 'backward';
/** What the hull is set to do until told otherwise. */
export type DriveSetting = DriveDirection | 'stop';
/** Which way the hull turns: `cover` is towards the hiding place, `hit` towards where the bullet that last hit the robot came from. */
export type TurnDirection = 'left' | 'right' | 'enemy' | 'cover' | 'hit';
/** Which way the turret turns: `lead` is where the enemy will be when a bullet gets there, `ahead` the front of the hull. */
export type AimDirection = 'left' | 'right' | 'enemy' | 'lead' | 'ahead';

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
  /** How many more ticks the robot can guard in this match. */
  readonly guards: number;
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
  /** Angle from the gun to the enemy, or to where it was last seen (deg, positive = to the right). 0 if never seen. */
  readonly aimAngle: number;
  /** Angle from the gun to where the enemy will be when a bullet fired now gets there. 0 if never seen. */
  readonly leadAngle: number;
  /** Angle of the gun on the hull (deg, 0 = straight ahead, positive = to the right). */
  readonly gunAngle: number;
  /** How far the robot's own gun shoots. */
  readonly weaponRange: number;
  /**
   * An enemy bullet has hit the robot since its AI last looked at this. Looking
   * uses it up: it is false again from the next tick, until the next hit.
   */
  readonly hit: boolean;
  /** Where the bullet that last hit the robot came from, relative to the hull (deg, positive = to the right). 0 before the first hit. */
  readonly hitAngle: number;
  /** The robot and the enemy stand against each other: neither can drive any closer. */
  readonly touchingEnemy: boolean;
  /** The enemy's sensor does not see the robot: too far, outside its cone, or behind an obstacle. */
  readonly hidden: boolean;
}

/**
 * What the AI wants the robot to do on this tick. A RoboScript program
 * chooses one thing (turn the hull, turn the turret, fire, guard or nothing),
 * and may change how the hull drives besides.
 */
export interface AIAction {
  /** null keeps driving as before. */
  drive: DriveSetting | null;
  turn: TurnDirection | null;
  aim: AimDirection | null;
  fire: boolean;
  /** Brace for this tick: hits do less damage. */
  guard: boolean;
  /** A name for what the robot is doing, to show and to log. It changes nothing else; null keeps the current one. */
  label: string | null;
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
  drive: number | null;
  turn: number | null;
  aim: number | null;
  fire: number | null;
  guard: number | null;
  label: number | null;
}

export interface RobotBrain {
  decide(context: AIContext): AIAction;
}

export function createIdleAction(): AIAction {
  return {
    drive: null,
    turn: null,
    aim: null,
    fire: false,
    guard: false,
    label: null,
    executedLines: [],
    sourceLines: { drive: null, turn: null, aim: null, fire: null, guard: null, label: null },
    assignments: [],
    status: 'running',
  };
}
