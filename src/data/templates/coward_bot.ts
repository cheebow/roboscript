/**
 * Backs away when the enemy gets close, and shoots while keeping its distance
 * (SPEC §30). With its back against an obstacle or a wall it stands and fights.
 */
export const COWARD_BOT = `if enemy_visible
    turn enemy

    if enemy_distance < 300
        fire

        if blocked_behind
            state ATTACK
        else
            state EVADE
            move backward
    else
        if enemy_distance < 400
            state ATTACK
            fire
        else
            state TRACK
            move forward
else
    state SEARCH

    if blocked
        turn left
    else
        move forward
`;
