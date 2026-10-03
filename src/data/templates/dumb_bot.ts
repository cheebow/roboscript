
/** Drives up to the enemy and shoots once close; goes looking for it when it is hidden (the first spec (docs/SPEC_v0.1.md) §30). */
export const DUMB_BOT = `# DumbBot: drives up to the enemy and shoots from close by; goes round the other way when the enemy stays out of sight.
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
    if blocked
        label SEARCH
        if other_way == 1
            turn right
        else
            turn left
    else
        if enemy_visible
            turn enemy

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
