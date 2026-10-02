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
                label ATTACK
                drive stop
            else
                label EVADE
                drive backward
            fire
        else
            if enemy_distance < 400
                label ATTACK
                drive stop
                fire
            else
                label TRACK
                drive forward
    else
        label SEARCH
        drive forward

        if blocked
            turn ${avoid}
        else
            wait
`;
}
