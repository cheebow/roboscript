/** Drives up to the enemy and shoots once close; goes looking for it when it is hidden (SPEC §30). */
export const DUMB_BOT = `if blocked
    state SEARCH
    turn left
else
    if enemy_visible
        turn enemy

        if enemy_distance < 300
            state ATTACK
            fire
        else
            state TRACK
            move forward
    else
        state SEARCH
        move forward
`;
