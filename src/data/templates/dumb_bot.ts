import type { Side } from './side';

/** Drives up to the enemy and shoots once close; goes looking for it when it is hidden (SPEC §30). */
export function dumbBot(avoid: Side): string {
  return `loop
    if blocked
        state SEARCH
        turn ${avoid}
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 300
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
