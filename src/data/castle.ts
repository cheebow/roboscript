// The numbers of the castle match (3 vs 3), gathered here for tuning.

/** Robots per team in a castle match. */
export const TEAM_SIZE = 3;

/**
 * A castle's HP: three robots' worth, 30 standard shots. One robot alone
 * needs about 24 s of uninterrupted fire to bring it down; three focused
 * robots about 8 s.
 */
export const CASTLE_HP = 600;

/**
 * What a team's three loadouts may cost together. Loadouts cost 9 to 14, so
 * one maxed-out build leaves only the two cheapest for its teammates, and
 * three duel-legal 12-point builds (36) are out of reach: kitting one robot
 * out richly starves the others.
 */
export const TEAM_COST_LIMIT = 32;
