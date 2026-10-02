import type { Side } from './side';

/**
 * DumbBot with a defence: it braces when a bullet is about to hit. A robot has
 * only a few ticks of guarding per match, so it wastes none: it looks for the
 * bullet before every action, and only braces on the tick of the hit.
 */
export function guardBot(avoid: Side): string {
  return `# guard halves the damage of a bullet that hits on that tick.
# There are only a few guards per match, and each puts off the next shot:
# use them on the very tick of the hit.
loop
    if bullet_incoming and bullet_distance < 36 and guards > 0
        guard
    else
        if blocked
            label SEARCH
            turn ${avoid}
        else
            if enemy_visible
                turn enemy

                # A tick has passed: look for the bullet again.
                if bullet_incoming and bullet_distance < 36 and guards > 0
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
}
