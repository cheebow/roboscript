
/**
 * Backs away when the enemy gets close, and shoots while keeping its distance
 * (the first spec (docs/SPEC_v0.1.md) §30). With its back against an obstacle or a wall it stands and fights.
 */
export const COWARD_BOT = `# CowardBot: keeps its distance, backing away from a close enemy while it shoots; with its back to a wall it stands and fights.
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
            if enemy_distance < weapon_range
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
            if other_way == 1
                turn right
            else
                turn left
        else
            wait
`;
