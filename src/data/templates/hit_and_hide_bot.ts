/**
 * Shows itself only for one shot at a time: fires once, runs for cover,
 * rests there out of sight (getting hp back), facing where the enemy was, then comes out to find the
 * enemy again. With no cover to go to, or with the enemy right against it,
 * it stands and fights instead.
 */
export const HIT_AND_HIDE_BOT = `# HitAndHideBot: fires one shot, runs for cover and rests there out of sight, then comes out for the next one.
set rest = 0  # ticks left to rest in hiding; 0 means: go and find the enemy
loop
    # Hiding is no use with the enemy right against it: fight back.
    if enemy_visible and (rest == 0 or touching_enemy)
        label SHOOT
        drive stop
        if abs(aim_angle) > 2
            aim enemy
        else if reload > 0
            wait
        else
            fire
            set rest = 90  # 3 seconds
    else if rest == 0
        label SEEK
        drive forward
        if blocked
            turn left
        else
            turn enemy
    # Rest only once the whole hull is in cover (cover_distance 0): hidden alone can be true
    # with the hull still sticking out past a corner, where bullets still reach. Hit there: run on.
    else if hidden and cover_distance == 0 and not hit
        # Out of sight and still: hp comes back. Turning on the spot keeps it still, facing where the enemy was.
        label HIDE
        drive stop
        set rest = rest - 1
        turn enemy
    else if cover_visible
        label RUN
        drive forward
        if blocked
            turn left
        else
            turn cover
    else
        # Nowhere to hide: no rest, back to the fight.
        label NO_COVER
        set rest = 0
`;
