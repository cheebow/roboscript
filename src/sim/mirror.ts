import type { AIAction, AIContext, AimDirection, RobotBrain, TurnDirection } from './ai_context';

/** What a robot senses as an angle off its hull or its gun: these change sign when left and right are swapped. */
const ANGLES: ReadonlySet<string> = new Set<keyof AIContext>([
  'enemyAngle',
  'bulletAngle',
  'coverAngle',
  'aimAngle',
  'leadAngle',
  'gunAngle',
  'hitAngle',
]);
/** What a robot senses to one side: these change places. */
const OTHER_SIDE: Readonly<Record<string, keyof AIContext>> = { wallLeft: 'wallRight', wallRight: 'wallLeft' };

/** A side of the arena to start from, by the index of its spawn point: the robot on the right is 0, the one on the left 1. */
export type StartSide = 0 | 1;

/** The side out of saved data, or of a spawn index: 0 unless it is 1. */
export function readStartSide(value: unknown): StartSide {
  return value === 1 ? 1 : 0;
}

/**
 * The brain as a robot starting at the given spawn index is to run it, when
 * its program was written for a robot starting on `writtenFor`: as it is on
 * that side, in a mirror on the other.
 */
export function brainFor(brain: RobotBrain, writtenFor: StartSide, spawnIndex: number): RobotBrain {
  return writtenFor === readStartSide(spawnIndex) ? brain : mirrored(brain);
}

/**
 * The brain as it thinks in a mirror: it is told of the world with left and
 * right swapped, and what it decides is swapped back. A program written to
 * go round obstacles on the left then goes round them on the right, and all
 * else it does follows suit. This is how a robot written for one side of the
 * arena is sent in from the other.
 */
export function mirrored(brain: RobotBrain): RobotBrain {
  return { decide: (context) => mirrorAction(brain.decide(mirrorContext(context))) };
}

/**
 * The context with left and right swapped. Its values are read from the
 * original only when asked for: some of them are worked out on demand, and
 * looking at `hit` uses it up.
 */
export function mirrorContext(context: AIContext): AIContext {
  return new Proxy(context, {
    get(target, key) {
      const name = String(key);
      const value = target[OTHER_SIDE[name] ?? (name as keyof AIContext)];
      return ANGLES.has(name) && typeof value === 'number' ? reversed(value) : value;
    },
  });
}

/** The action with its turns to the left and to the right swapped. */
export function mirrorAction(action: AIAction): AIAction {
  return { ...action, turn: otherWay(action.turn), aim: otherWay(action.aim) };
}

function otherWay<Direction extends TurnDirection | AimDirection | null>(direction: Direction): Direction {
  if (direction === 'left') return 'right' as Direction;
  if (direction === 'right') return 'left' as Direction;
  return direction;
}

/** The angle to the other side. 0 stays 0, rather than becoming -0. */
function reversed(angle: number): number {
  return angle === 0 ? 0 : -angle;
}
