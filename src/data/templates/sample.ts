/**
 * The program a new player starts with, and the first of the templates: look
 * for the enemy, drive up to it, and shoot from close by.
 */
export const SAMPLE_AI = `# Each move, turn or fire takes one tick.
loop
    if blocked
        state SEARCH
        turn left
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 250
                state ATTACK
                fire
            else
                state TRACK
                move forward
        else
            state SEARCH
            move forward
`;
