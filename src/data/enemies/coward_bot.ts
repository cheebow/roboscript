/** Backs away when the enemy gets close, and shoots while keeping its distance (SPEC §30). */
export const COWARD_BOT = `if enemy_visible
    turn enemy

    if enemy_distance < 300
        state EVADE
        move backward
        fire
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
        turn right
    else
        move forward
`;
