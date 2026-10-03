/**
 * Never stops: keeps driving at the enemy and fires as soon as it is in weapon
 * range. Once it has driven right up against the enemy it stops
 * pushing and just shoots.
 */
export const AGGRESSIVE_BOT = `# AggressiveBot: never stops; drives at the enemy and fires on the move, stopping only when right up against it.
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
        if touching_enemy
            # Right up against the enemy: no point in pushing.
            drive stop
        else
            drive forward

        if enemy_visible
            label ATTACK
            turn enemy

            if enemy_distance < weapon_range
                fire
        else
            label SEARCH
            wait
`;
