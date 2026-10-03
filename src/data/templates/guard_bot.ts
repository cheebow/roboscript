/**
 * DumbBot with a defence: it braces when a bullet is about to hit, and when
 * it is shot from somewhere it cannot see, it turns to face the shooter. A
 * robot has only a few ticks of guarding per match, so it wastes none: it
 * looks for the bullet before every action, and only braces on the tick of
 * the hit. The check is a function, so that it is written once and asked twice.
 */
export const GUARD_BOT = `# guard halves the damage of a bullet that hits on that tick.
# There are only a few guards per match, and each puts off the next shot:
# use them on the very tick of the hit.
def about_to_be_hit()
    if bullet_incoming and bullet_distance < 36 and guards > 0
        return 1
    return 0

# Two robots that go round obstacles the same way can chase each other for good.
set other_way = 0  # 1 while it goes round obstacles on the other side
set lost = 0       # ticks since it last saw the enemy
loop
    if enemy_visible
        set lost = 0
    else
        # Ten seconds without a sight of the enemy: try going round the other way.
        set lost = lost + 1
        if lost > 300
            set lost = 0
            set other_way = 1 - other_way
    if about_to_be_hit() == 1
        guard
    else
        if hit and not enemy_visible
            # Shot from somewhere it cannot see: turn until it faces the shooter, then head that way.
            label SEARCH
            face hit
            drive forward
        else
            if blocked
                label SEARCH
                if other_way == 1
                    turn right
                else
                    turn left
            else
                if enemy_visible
                    turn enemy

                    # A tick has passed: look for the bullet again.
                    if about_to_be_hit() == 1
                        guard
                    else
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
