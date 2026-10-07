import type { Loadout } from './parts';

// The numbers of the castle match, gathered here for tuning. A side fields
// `teamSize` robots (1 to MAX_TEAM_SIZE, the same on both sides), and the
// castle and cost numbers scale with it.

/** The most robots a team may field in a castle match: futsal-sized, the most the field and the radio stay readable at. */
export const MAX_TEAM_SIZE = 5;

/**
 * A castle's HP: one robot's worth (200), whatever the team size. Low enough
 * that storming the castle is usually faster than grinding the team down —
 * the castle is the goal, and the bracket report shows racing for it and
 * intercepting the racers in real tension at every size. Scaling it with the
 * team (an earlier 100 + 100 per robot) kept the race from ever mattering
 * past 1 a side.
 */
export function castleHpFor(_teamSize: number): number {
  return 200;
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
