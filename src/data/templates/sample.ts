/**
 * The program a new player starts with, and the first of the templates. Based on SPEC §31, extended for robots
 * that drive like tanks: turn away when the way ahead is blocked, fight the
 * enemy while it is in sight, and drive on to find it when it is hidden.
 */
export const SAMPLE_AI = `if blocked
    state SEARCH
    turn left
else
    if enemy_visible
        turn enemy

        if enemy_distance < 250
            state ATTACK
            fire
        else
            state TRACK
            move forward
    else
        state SEARCH
        move forward
`;
