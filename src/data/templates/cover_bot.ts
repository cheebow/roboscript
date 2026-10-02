import { type Side, otherSide } from './side';

/**
 * Fights from a distance and, the first time it is badly hurt, drives behind
 * the nearest obstacle and waits there for the enemy to come round. Both the
 * drive and the wait are cut short after a while, so that it never hides for
 * good; and when it cannot find the enemy again, it changes the side on
 * which it goes round obstacles, so that the two do not chase each other's tail.
 */
export function coverBot(avoid: Side): string {
  return `# Once hurt, it hides behind an obstacle and waits for the enemy there.
set hidden = 0
set other_way = 0  # 1 while it goes round obstacles on the other side
set searching = 0  # ticks since it last saw the enemy
loop
    if hp < 60 and hidden == 0 and cover_visible
        set hidden = 1
        state EVADE

        # After hiding, go round obstacles the other way, to come at the enemy head-on.
        set other_way = 1

        # Drive to the hiding place.
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

        # Wait, facing where the enemy was last seen.
        set patience = 150
        while patience > 0 and not enemy_visible
            set patience = patience - 1
            turn enemy
    else
        if enemy_visible
            set searching = 0
        else
            # Still no enemy after ten seconds: it may be going round the same way. Try the other.
            set searching = searching + 1
            if searching > 300
                set searching = 0
                set other_way = 1 - other_way

        if blocked
            state SEARCH
            if other_way == 1
                turn ${otherSide(avoid)}
            else
                turn ${avoid}
        else
            if enemy_visible
                turn enemy

                if enemy_distance < 350
                    state ATTACK
                    drive stop
                    fire
                else
                    state TRACK
                    drive forward
            else
                state SEARCH
                drive forward
                wait
`;
}
