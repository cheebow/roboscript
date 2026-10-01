/**
 * Fights from a distance and, the first time it is badly hurt, drives behind
 * the nearest obstacle and waits there for the enemy to come round. Both the
 * drive and the wait are cut short after a while, so that it never hides for
 * good.
 */
export const COVER_BOT = `# Once hurt, it hides behind an obstacle and waits for the enemy there.
set hidden = 0
loop
    if hp < 60 and hidden == 0 and cover_visible
        set hidden = 1
        state EVADE

        # Drive to the hiding place.
        set patience = 150
        while cover_distance > 0 and patience > 0
            set patience = patience - 1
            if cover_angle > 5 or cover_angle < -5
                turn cover
            else
                move forward

        # Wait, facing where the enemy was last seen.
        set patience = 150
        while patience > 0 and not enemy_visible
            set patience = patience - 1
            turn enemy
    else
        if blocked
            state SEARCH

            # After hiding, go round obstacles the other way, to come at the enemy head-on.
            if hidden == 1
                turn right
            else
                turn left
        else
            if enemy_visible
                turn enemy

                if enemy_distance < 350
                    state ATTACK
                    fire
                else
                    state TRACK
                    move forward
            else
                state SEARCH
                move forward
`;
