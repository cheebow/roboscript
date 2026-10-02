import type { Side } from './side';

/** Never stops: keeps driving at the enemy and fires as soon as it is in weapon range (SPEC §30). */
export function aggressiveBot(avoid: Side): string {
  return `loop
    if blocked
        label SEARCH
        turn ${avoid}
    else
        drive forward

        if enemy_visible
            label ATTACK
            turn enemy

            if enemy_distance < 400
                fire
        else
            label SEARCH
            wait
`;
}
