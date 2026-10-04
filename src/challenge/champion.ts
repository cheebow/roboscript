import type { Loadout } from '../data/parts';

/**
 * The champion, the opponent of the last challenge: SentryBot's way of
 * fighting with everything that makes it stronger put together. With its
 * parts it beats every built-in robot in nine matches out of ten or more
 * (see IMPLEMENTATION_STATUS.md). Its Short sensor sees only 300 away: a
 * robot that shoots from further off, and keeps there, can beat it.
 */
export const CHAMPION = `# Champion: stands and shoots where the enemy will be, guards the moment a bullet hits,
# hunts down an enemy that hides, and closes in on one that drives across its fire.
set other_way = 0  # 1 while it goes round obstacles on the other side
set lost = 0       # ticks since it last saw the enemy
set strafing = 0   # ticks left of treating the enemy as one that drives across
def abs(value)
    if value < 0
        return -value
    return value
loop
    if enemy_visible
        set lost = 0
    else
        # Ten seconds without a sight of the enemy: try going round the other way.
        set lost = lost + 1
        if lost > 300
            set lost = 0
            set other_way = 1 - other_way
    if strafing > 0
        set strafing = strafing - 1
    # An enemy moving across the line between them, rather than to or from it, is one that strafes.
    if enemy_visible and enemy_speed > 40
        set across = enemy_heading - enemy_angle
        if across > 180
            set across = across - 360
        if across < -180
            set across = across + 360
        if abs(abs(across) - 90) < 40
            set strafing = 150
    if bullet_incoming and bullet_distance < 36 and guards > 0
        # Brace on the tick the bullet hits.
        guard
    else if enemy_visible
        # Against one that strafes, get closer first: a shot that flies less time misses less.
        set reach = weapon_range
        if strafing > 0
            set reach = weapon_range - 150
        if enemy_distance < reach
            label ATTACK
            drive stop
            if lead_angle > 2 or lead_angle < -2
                aim lead
            else
                fire
        else
            label TRACK
            drive forward
            turn enemy
    else if hit
        # Shot from somewhere it cannot see: head that way.
        label SEARCH
        face hit
        drive forward
    else if blocked
        if other_way == 1
            turn right
        else
            turn left
    else if enemy_distance > 60
        # Out of sight: go after where it was last seen, so that it cannot rest and recover.
        label CHASE
        face enemy
        drive forward
        wait
    else
        label SEARCH
        drive forward
        wait
`;

/** The champion's parts: more HP, a quick-firing gun, and a cheap short sensor to pay for them. */
export const CHAMPION_LOADOUT: Partial<Loadout> = { body: 'heavy', gun: 'rapid', sensor: 'short' };
