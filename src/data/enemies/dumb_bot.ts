/** Turns until it sees the enemy, walks up to it, and shoots once close (SPEC §30). */
export const DUMB_BOT = `state SEARCH

if enemy_visible
    state ATTACK
    turn enemy

    if enemy_distance < 300
        fire
    else
        move forward
else
    turn right
`;
