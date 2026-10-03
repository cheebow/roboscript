/**
 * Never stops: keeps driving at the enemy and fires as soon as it is in weapon
 * range (SPEC §30). Once it has driven right up against the enemy it stops
 * pushing and just shoots.
 */
export const AGGRESSIVE_BOT = `loop
    if blocked
        label SEARCH
        turn left
    else
        if touching_enemy
            # Right up against the enemy: no point in pushing.
            drive stop
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
