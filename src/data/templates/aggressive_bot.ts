/** Never stops closing in on the enemy, and shoots whenever it is within weapon range (SPEC §30). */
export const AGGRESSIVE_BOT = `if blocked
    state SEARCH
    turn left
else
    move forward

    if enemy_visible
        state ATTACK
        turn enemy

        if enemy_distance < 400
            fire
    else
        state SEARCH
`;
