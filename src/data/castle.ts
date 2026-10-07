import type { Loadout } from './parts';

// The numbers of the castle match, gathered here for tuning. A side fields
// `teamSize` robots (1 to MAX_TEAM_SIZE, the same on both sides), and the
// castle and cost numbers scale with it.

/** The most robots a team may field in a castle match: futsal-sized, the most the field and the radio stay readable at. */
export const MAX_TEAM_SIZE = 5;

/**
 * A castle's HP: a base of 100 plus 100 per robot fielded. A lone robot
 * faces today's 200; a full team's castle (400) falls to one slipped-through
 * machine in about 13 s of pistol fire — playtesting wanted the castle to be
 * a real target before the robots have ground each other down.
 */
export function castleHpFor(teamSize: number): number {
  return 100 * teamSize + 100;
}

/**
 * What a team's loadouts may cost together. One robot gets 12, exactly the
 * single-robot cost limit; each further robot adds only 10, so loadouts cost
 * 9 to 14 each and kitting one robot out richly starves the others (three
 * duel-legal 12-point builds, 36, are out of reach of the 32 of a full team).
 */
export function teamCostLimitFor(teamSize: number): number {
  return 10 * teamSize + 2;
}

/**
 * What a team's machines carry until the player refits them: a light body
 * and a pistol keep a machine at cost 10, so even a full team of three (30)
 * starts inside its limit of 32, with room to upgrade one machine.
 */
export const TEAM_DEFAULT_LOADOUT: Loadout = { body: 'light', legs: 'standard', gun: 'pistol', sensor: 'standard' };
