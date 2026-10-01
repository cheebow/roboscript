/**
 * DumbBot with a defence: it braces when a bullet is about to hit. Guarding
 * puts off its own next shot, so it guards for as short as it can: it looks
 * for the bullet before every action, and only braces on the tick of the hit.
 */
export const GUARD_BOT = `# guard halves the damage of a bullet that hits on that tick,
# but every tick of it puts off the next shot: guard as late as possible.
loop
    if bullet_incoming and bullet_distance < 36
        guard
    else
        if blocked
            state SEARCH
            turn left
        else
            if enemy_visible
                turn enemy

                # A tick has passed: look for the bullet again.
                if bullet_incoming and bullet_distance < 36
                    guard
                else
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
