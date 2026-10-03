/**
 * Stands its ground: it closes in until the enemy is in weapon range, then
 * stops and shoots at where the enemy will be, so that an enemy on the move is
 * hit as well as one that stands still. Shot from somewhere it cannot see, it
 * turns to face the shooter.
 */
export const SENTRY_BOT = `# Stops within weapon range and shoots at where the enemy will be.
loop
    if hit and not enemy_visible
        # Shot from somewhere it cannot see: turn until it faces the shooter, then head that way.
        # Each turn hit is one tick of turning; hit_angle follows the hull round.
        label SEARCH
        while hit_angle > 5 or hit_angle < -5
            turn hit
        drive forward
    else
        if enemy_visible
            if enemy_distance < weapon_range
                label ATTACK
                drive stop

                # lead_angle is how far the turret is from where the enemy will be when the shot gets there.
                if lead_angle > 2 or lead_angle < -2
                    aim lead
                else
                    fire
            else
                label TRACK
                drive forward
                turn enemy
        else
            label SEARCH
            drive forward

            if blocked
                turn left
            else
                wait
`;
