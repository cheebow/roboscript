/** Keeps closing in on the enemy and shoots whenever it is within weapon range (SPEC §30). */
export const AGGRESSIVE_BOT = `state SEARCH

if enemy_visible
    state ATTACK
    turn enemy
    move forward

    if enemy_distance < 400
        fire
else
    turn right
`;
