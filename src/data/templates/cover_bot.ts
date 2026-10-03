
/**
 * Fights from a distance and, whenever it is badly hurt, drives behind the
 * nearest obstacle and recovers there, out of the enemy's sight, until it is
 * nearly whole or the enemy comes round. When it cannot find the enemy again,
 * it changes the side on which it goes round obstacles, so that the two do
 * not chase each other's tail.
 */
export const COVER_BOT = `# CoverBot: fights from a distance and, whenever it is hurt, hides behind an obstacle and recovers there until the enemy comes.
set other_way = 0  # 1 while it goes round obstacles on the other side
set searching = 0  # ticks since it last saw the enemy
loop
    if hp < 120 and cover_visible
        label EVADE

        # After hiding, go round obstacles the other way, to come at the enemy head-on.
        set other_way = 1

        # Drive to the hiding place; give up after five seconds if it cannot be reached.
        set patience = 150
        while cover_distance > 0 and patience > 0
            set patience = patience - 1
            if cover_angle > 5 or cover_angle < -5
                drive stop
                turn cover
            else
                drive forward
                wait
        drive stop

        # Recover out of the enemy's sight, facing where it was last seen, until nearly whole.
        while hidden and hp < 180
            turn enemy
    else
        if enemy_visible
            set searching = 0
        else
            # Still no enemy after eight seconds: it may be going round the same way. Try the other.
            # (Sooner than the other templates, so that the two do not switch in step and stay apart.)
            set searching = searching + 1
            if searching > 240
                set searching = 0
                set other_way = 1 - other_way

        if blocked
            label SEARCH
            if other_way == 1
                turn right
            else
                turn left
        else
            if enemy_visible
                turn enemy

                if enemy_distance < weapon_range - 50
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
