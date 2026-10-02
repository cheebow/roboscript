import type { Side } from './side';

/**
 * Closes in to weapon range, then keeps its hull side-on to the enemy and
 * drives to and fro across the enemy's line of fire while the turret tracks
 * where the enemy will be. A shot aimed at where it is now passes behind it.
 * It turns back at walls, and when an obstacle comes between it and the enemy.
 */
export function strafeBot(avoid: Side): string {
  return `# Drives across the enemy's line of fire, and shoots where the enemy will be.
set forward = 1   # which way it is crossing: 1 forward, 0 backward
set crossing = 0  # 1 once it is close enough to cross and shoot
set lost = 0      # ticks since it lost sight of the enemy while crossing
loop
    # Turn back at the walls.
    if forward == 1 and wall_ahead < 20
        set forward = 0
    if forward == 0 and wall_behind < 20
        set forward = 1

    if enemy_visible
        set lost = 0
        if enemy_distance < 340
            set crossing = 1
        if enemy_distance > 390
            set crossing = 0

        if crossing == 0
            # Too far to shoot: close in.
            state TRACK
            drive forward
            turn enemy
        else
            state ATTACK
            if forward == 1
                drive forward
            else
                drive backward

            # Turn the hull until the enemy is on its left or right side.
            if enemy_angle >= 0 and enemy_angle < 75 or enemy_angle < -105
                turn left
            else
                if enemy_angle > 105 or enemy_angle < 0 and enemy_angle > -75
                    turn right
                else
                    if lead_angle > 3 or lead_angle < -3
                        aim lead
                    else
                        fire
    else
        if crossing == 1
            # Something came between them: go back the way it came, for a while.
            if lost == 0
                set forward = 1 - forward
            set lost = lost + 1
            if lost > 60
                set crossing = 0

            if forward == 1
                drive forward
            else
                drive backward
            aim lead
        else
            state SEARCH
            drive forward

            if blocked
                turn ${avoid}
            else
                wait
`;
}
