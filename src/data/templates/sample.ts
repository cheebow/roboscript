import type { Side } from './side';

/**
 * The player's starting program: drives up to the enemy and shoots from close
 * by. It leaves the turret where it is, pointing straight ahead, and turns the
 * whole hull at the enemy; and it has to get closer than DumbBot before it
 * fires, which is why it loses to it as shipped.
 */
export function sampleAi(avoid: Side): string {
  return `# "drive" keeps the hull going. Each turn, aim or fire takes one tick.
loop
    if blocked
        label SEARCH
        turn ${avoid}
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 250
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

export const SAMPLE_AI = sampleAi('left');
