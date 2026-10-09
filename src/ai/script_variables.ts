import {
  type AIContext,
  type AimDirection,
  type DriveSetting,
  type TurnDirection,
} from '../sim/ai_context';

// The names a RoboScript program may use, and how each maps onto the AIContext.

export const BOOLEAN_VARIABLES = {
  enemy_visible: (context: AIContext) => context.enemyVisible,
  blocked: (context: AIContext) => context.blocked,
  blocked_behind: (context: AIContext) => context.blockedBehind,
  bullet_incoming: (context: AIContext) => context.bulletIncoming,
  cover_visible: (context: AIContext) => context.coverVisible,
  hit: (context: AIContext) => context.hit,
  touching_enemy: (context: AIContext) => context.touchingEnemy,
  hidden: (context: AIContext) => context.hidden,
};

export const NUMBER_VARIABLES = {
  enemy_distance: (context: AIContext) => context.enemyDistance,
  enemy_angle: (context: AIContext) => context.enemyAngle,
  hp: (context: AIContext) => context.hp,
  ammo: (context: AIContext) => context.ammo,
  guards: (context: AIContext) => context.guards,
  bullet_distance: (context: AIContext) => context.bulletDistance,
  bullet_angle: (context: AIContext) => context.bulletAngle,
  cover_distance: (context: AIContext) => context.coverDistance,
  cover_angle: (context: AIContext) => context.coverAngle,
  wall_ahead: (context: AIContext) => context.wallAhead,
  wall_behind: (context: AIContext) => context.wallBehind,
  wall_left: (context: AIContext) => context.wallLeft,
  wall_right: (context: AIContext) => context.wallRight,
  aim_angle: (context: AIContext) => context.aimAngle,
  lead_angle: (context: AIContext) => context.leadAngle,
  gun_angle: (context: AIContext) => context.gunAngle,
  weapon_range: (context: AIContext) => context.weaponRange,
  sensor_range: (context: AIContext) => context.sensorRange,
  max_speed: (context: AIContext) => context.maxSpeed,
  max_hp: (context: AIContext) => context.maxHp,
  enemy_speed: (context: AIContext) => context.enemySpeed,
  enemy_heading: (context: AIContext) => context.enemyHeading,
  reload: (context: AIContext) => context.reload,
  hit_angle: (context: AIContext) => context.hitAngle,
  self_id: (context: AIContext) => context.selfId,
  allies_alive: (context: AIContext) => context.alliesAlive,
  enemies_alive: (context: AIContext) => context.enemiesAlive,
  ally_signal: (context: AIContext) => context.allySignal,
  ally_signal_from: (context: AIContext) => context.allySignalFrom,
  ally_distance: (context: AIContext) => context.allyDistance,
  ally_angle: (context: AIContext) => context.allyAngle,
  ally_hp: (context: AIContext) => context.allyHp,
  base_hp: (context: AIContext) => context.baseHp,
  base_distance: (context: AIContext) => context.baseDistance,
  base_angle: (context: AIContext) => context.baseAngle,
  enemy_base_hp: (context: AIContext) => context.enemyBaseHp,
  enemy_base_distance: (context: AIContext) => context.enemyBaseDistance,
  enemy_base_angle: (context: AIContext) => context.enemyBaseAngle,
};

export type BooleanVariableName = keyof typeof BOOLEAN_VARIABLES;
export type NumberVariableName = keyof typeof NUMBER_VARIABLES;

export const DRIVE_SETTINGS: readonly string[] = ['forward', 'backward', 'stop'] satisfies DriveSetting[];
export const TURN_DIRECTIONS: readonly string[] = ['left', 'right', 'enemy', 'cover', 'hit', 'ally', 'base', 'enemy_base'] satisfies TurnDirection[];
/** What the hull can be turned to face until it does: the turn directions that are a place, not a side. */
export type FaceTarget = Extract<TurnDirection, 'enemy' | 'cover' | 'hit' | 'back' | 'ally' | 'base' | 'enemy_base'>;
/** `back` is the way opposite to where the hull faced when the `face` began: there is no turning towards it a tick at a time. */
export const FACE_TARGETS: readonly string[] = ['enemy', 'cover', 'hit', 'back', 'ally', 'base', 'enemy_base'] satisfies FaceTarget[];
export const AIM_DIRECTIONS: readonly string[] = ['left', 'right', 'enemy', 'lead', 'ahead'] satisfies AimDirection[];

/** Words with a meaning of their own, which a program may not use as a variable name. */
export const KEYWORDS: readonly string[] = [
  'if',
  'else',
  'loop',
  'while',
  'break',
  'def',
  'return',
  'true',
  'false',
  'set',
  'drive',
  'turn',
  'face',
  'aim',
  'fire',
  'guard',
  'wait',
  'label',
  'signal',
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

export function isDriveSetting(name: string): name is DriveSetting {
  return DRIVE_SETTINGS.includes(name);
}

export function isAimDirection(name: string): name is AimDirection {
  return AIM_DIRECTIONS.includes(name);
}

export function isTurnDirection(name: string): name is TurnDirection {
  return TURN_DIRECTIONS.includes(name);
}

export function isFaceTarget(name: string): name is FaceTarget {
  return FACE_TARGETS.includes(name);
}

