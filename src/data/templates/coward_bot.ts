import type { Side } from './side';

/**
 * Backs away when the enemy gets close, and shoots while keeping its distance
 * (SPEC §30). With its back against an obstacle or a wall it stands and fights.
 */
export function cowardBot(avoid: Side): string {
  return `loop
    if enemy_visible
        turn enemy

        if enemy_distance < 300
            if blocked_behind
                state ATTACK
                drive stop
            else
                state EVADE
                drive backward
            fire
        else
            if enemy_distance < 400
                state ATTACK
                drive stop
                fire
            else
                state TRACK
                drive forward
    else
        state SEARCH
        drive forward

        if blocked
            turn ${avoid}
        else
            wait
`;
}
