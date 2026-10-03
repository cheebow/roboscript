
/** Drives up to the enemy and shoots once close; goes looking for it when it is hidden (SPEC §30). */
export const DUMB_BOT = `loop
    if blocked
        label SEARCH
        turn left
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 300
                label ATTACK
                drive stop
                fire
            else
                label TRACK
                drive forward
        else
            label SEARCH
            drive forward
            wait
`;
