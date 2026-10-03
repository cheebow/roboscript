
/** Never stops: keeps driving at the enemy and fires as soon as it is in weapon range (SPEC §30). */
export const AGGRESSIVE_BOT = `loop
    if blocked
        label SEARCH
        turn left
    else
        drive forward

        if enemy_visible
            label ATTACK
            turn enemy

            if enemy_distance < weapon_range
                fire
        else
            label SEARCH
            wait
`;
