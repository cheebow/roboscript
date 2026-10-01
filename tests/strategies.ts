import { SAMPLE_AI } from '../src/data/sample_ai';

// Four ways a player might write their AI (SPEC §32), used to check that the
// choice of strategy changes who wins. Those that move turn left around
// obstacles, like the sample AI, so they meet the enemy on the same side.

/** Drives up to the enemy and shoots from close by: the sample AI as shipped. */
export const APPROACH = SAMPLE_AI;

/** Shoots from the edge of weapon range and backs off when the enemy comes closer. */
export const KEEP_DISTANCE = `if blocked
    turn left
else
    if enemy_visible
        turn enemy

        if enemy_distance < 400
            fire

            if enemy_distance < 350
                move backward
        else
            move forward
    else
        move forward
`;

/** Never moves: turns to the enemy and shoots once it is in sight and in range. */
export const TURRET = `if enemy_visible
    turn enemy

    if enemy_distance < 400
        fire
`;

/** Never stops: keeps driving at the enemy and shoots from the edge of weapon range onwards. */
export const RUSH = `if blocked
    turn left
else
    move forward

    if enemy_visible
        turn enemy

        if enemy_distance < 400
            fire
`;

export const STRATEGIES = {
  approach: APPROACH,
  keep_distance: KEEP_DISTANCE,
  turret: TURRET,
  rush: RUSH,
} as const;
