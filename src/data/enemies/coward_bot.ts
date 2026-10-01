/** Backs away when the enemy gets close, and shoots while keeping its distance (SPEC §30). */
export const COWARD_BOT = `state SEARCH

if enemy_visible
    turn enemy

    if enemy_distance < 300
        state EVADE
        move backward
        fire
    else
        state ATTACK

        if enemy_distance < 400
            fire
        else
            move forward
else
    turn right
`;
