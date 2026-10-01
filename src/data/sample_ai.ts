/** The program a new player starts with (SPEC §31). */
export const SAMPLE_AI = `state SEARCH

if enemy_visible
    state ATTACK

    turn enemy

    if enemy_distance < 250
        fire
    else
        move forward
else
    turn right
`;
