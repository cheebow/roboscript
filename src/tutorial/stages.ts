import type { Arena } from '../sim/types';
import type { Stage } from './types';

// The training grounds of the tutorial. Each puts ALPHA and the training
// robot where the step needs them; the matches start exactly there.

const WIDTH = 1000;
const HEIGHT = 600;

function field(spawns: Arena['spawns'], obstacles: Arena['obstacles'] = []): Arena {
  return { width: WIDTH, height: HEIGHT, obstacles, spawns };
}

/** Does nothing at all: something to aim at. */
export const TARGET_BOT = `# The target: it stays where it is and never shoots.
loop
    wait
`;

/** Drives about, turning at walls: something moving to aim at. */
export const MOVER_BOT = `# The moving target: it drives about and never shoots.
loop
    drive forward
    if blocked
        turn left
    wait
`;

/** Looks for ALPHA and shoots at it, slowly: a first opponent. */
export const SPARRING_BOT = `# The sparring partner: it aims and shoots, but slowly.
loop
    if enemy_visible
        aim enemy
        wait
        fire
    else
        turn left
    wait
`;

/** The target straight ahead of ALPHA, within the reach of its gun. */
export const RANGE: Stage = {
  arena: field([
    { x: 650, y: 300, rotation: 180 },
    { x: 300, y: 300, rotation: 0 },
  ]),
  bot: TARGET_BOT,
  seed: 11,
};

/** A goal straight ahead across open ground; the target is out of the way. */
export const TRACK: Stage = {
  arena: field([
    { x: 150, y: 300, rotation: 0 },
    { x: 920, y: 540, rotation: 180 },
  ]),
  bot: TARGET_BOT,
  goal: { x: 820, y: 300, radius: 50 },
  seed: 13,
};

/** A goal up and to the right of ALPHA, at 30 degrees: five turns of 6 degrees, then straight on. */
export const ANGLE: Stage = {
  arena: field([
    { x: 150, y: 450, rotation: 0 },
    { x: 920, y: 540, rotation: 180 },
  ]),
  bot: TARGET_BOT,
  goal: { x: 670, y: 150, radius: 60 },
  seed: 19,
};

/** ALPHA facing the top wall; the goal in the top right corner: turn along the wall to get there. */
export const CORNER: Stage = {
  arena: field([
    { x: 150, y: 480, rotation: 270 },
    { x: 880, y: 520, rotation: 180 },
  ]),
  bot: TARGET_BOT,
  goal: { x: 860, y: 70, radius: 70 },
  seed: 14,
};

/** The target behind ALPHA: ALPHA has to turn round to it. */
export const BEHIND: Stage = {
  arena: field([
    { x: 600, y: 300, rotation: 0 },
    { x: 300, y: 300, rotation: 0 },
  ]),
  bot: TARGET_BOT,
  seed: 15,
};

/** A target that drives about. */
export const MOVING: Stage = {
  arena: field([
    { x: 750, y: 300, rotation: 180 },
    { x: 350, y: 120, rotation: 90 },
  ]),
  bot: MOVER_BOT,
  seed: 16,
};

/** The target hidden behind a block: ALPHA has to drive along it until it can see the target. */
export const HIDDEN: Stage = {
  arena: field(
    [
      { x: 880, y: 480, rotation: 180 },
      { x: 250, y: 200, rotation: 0 },
    ],
    [{ x: 450, y: 100, width: 200, height: 300 }],
  ),
  bot: TARGET_BOT,
  seed: 17,
};

/**
 * A first real match, against the sparring partner with a short-range Pistol: close
 * enough for the guns to reach, a block between them to look round.
 */
export const DUEL: Stage = {
  arena: field(
    [
      { x: 720, y: 300, rotation: 180 },
      { x: 280, y: 300, rotation: 0 },
    ],
    [{ x: 450, y: 210, width: 100, height: 180 }],
  ),
  bot: SPARRING_BOT,
  botLoadout: { gun: 'pistol' },
  seed: 18,
};

/** Stands where it is and shoots at ALPHA whenever it can see it: something that shoots back. */
export const SHOOTER_BOT = `# The shooter: it stays where it is, aims and shoots.
loop
    if enemy_visible
        aim enemy
        fire
    else
        wait
`;

/** The target far off straight ahead: out of reach of the gun until ALPHA drives closer. */
export const FAR: Stage = {
  arena: field([
    { x: 850, y: 300, rotation: 180 },
    { x: 150, y: 300, rotation: 0 },
  ]),
  bot: TARGET_BOT,
  seed: 21,
};

/** A goal straight up from ALPHA, which faces right: a quarter turn to the left, then straight on. */
export const QUARTER: Stage = {
  arena: field([
    { x: 500, y: 520, rotation: 0 },
    { x: 900, y: 80, rotation: 180 },
  ]),
  bot: TARGET_BOT,
  goal: { x: 500, y: 110, radius: 60 },
  seed: 22,
};

/** The target hidden behind a block and far off: seen long before it is in reach. */
export const FAR_HIDDEN: Stage = {
  arena: field(
    [
      { x: 880, y: 480, rotation: 180 },
      { x: 120, y: 150, rotation: 0 },
    ],
    [{ x: 420, y: 100, width: 200, height: 300 }],
  ),
  bot: TARGET_BOT,
  seed: 23,
};

/** The shooter close by: bullets to guard against. */
export const SHOT_AT: Stage = {
  arena: field([
    { x: 650, y: 300, rotation: 180 },
    { x: 300, y: 300, rotation: 0 },
  ]),
  bot: SHOOTER_BOT,
  seed: 24,
};

/** The shooter in reach across open ground, a block near ALPHA to hide behind. */
export const SHELTER: Stage = {
  arena: field(
    [
      { x: 700, y: 300, rotation: 180 },
      { x: 360, y: 300, rotation: 0 },
    ],
    [{ x: 760, y: 380, width: 80, height: 80 }],
  ),
  bot: SHOOTER_BOT,
  seed: 25,
};

/** The shooter 480 away: out of reach of a standard gun, and of its own; in reach of a Cannon. */
export const SNIPE: Stage = {
  arena: field([
    { x: 760, y: 300, rotation: 180 },
    { x: 280, y: 300, rotation: 0 },
  ]),
  bot: SHOOTER_BOT,
  seed: 26,
};
