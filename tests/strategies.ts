import { SAMPLE_AI } from '../src/data/sample_ai';

// Four ways a player might write their AI (SPEC §32), used to check that the
// choice of strategy changes who wins.

/** Walks up to the enemy and shoots from close by: the sample AI as shipped. */
export const APPROACH = SAMPLE_AI;

/** Shoots from the edge of weapon range and backs off when the enemy comes closer. */
export const KEEP_DISTANCE = `if enemy_visible
    turn enemy

    if enemy_distance < 400
        fire

        if enemy_distance < 350
            move backward
    else
        move forward
else
    turn right
`;

/** Never moves: turns to find the enemy and shoots once it is in range. */
export const TURRET = `if enemy_visible
    turn enemy

    if enemy_distance < 400
        fire
else
    turn right
`;

/** Closes to weapon range, then sidesteps while shooting. */
export const DODGE = `if enemy_visible
    turn enemy

    if enemy_distance < 380
        fire
        move left
    else
        move forward
else
    turn right
`;

export const STRATEGIES = {
  approach: APPROACH,
  keep_distance: KEEP_DISTANCE,
  turret: TURRET,
  dodge: DODGE,
} as const;
