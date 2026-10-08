import { MAX_ENTRANTS } from '../arena/match';
import { MAX_TEAM_SIZE } from '../data/castle';
import { t } from '../i18n/messages';
import { type SavedRobot, type SavedTeam, readSavedRobot, readSavedTeam } from '../project/garage';

// What a shared match holds, read the same way out of a share code and out
// of a file: both carry the same fields under the same names.

/** A match as it is shared: its robots in the order they start, its arena by id, and its seed. */
export interface SharedMatchBody {
  robots: SavedRobot[];
  arenaId: string;
  seed: number;
}

/** A castle match as it is shared: both teams (team 0 first), the arena by id, the robots a side, and the seed. */
export interface SharedCastleBody {
  teams: [SavedTeam, SavedTeam];
  arenaId: string;
  teamSize: number;
  seed: number;
}

/** The match in the decoded JSON of a code or a file, or what is wrong with it. */
export function readMatchBody(json: Record<string, unknown>): { ok: true; match: SharedMatchBody } | { ok: false; problem: string } {
  const robots = Array.isArray(json.robots) ? json.robots.map(readSavedRobot) : [];
  // A duel, or a battle royale of up to MAX_ENTRANTS.
  if (robots.length < 2 || robots.length > MAX_ENTRANTS || robots.some((robot) => robot === null)) {
    return { ok: false, problem: t('share.notTwoRobots') };
  }
  if (typeof json.arena !== 'string' || !Number.isInteger(json.seed)) return { ok: false, problem: t('share.noArenaOrSeed') };
  return { ok: true, match: { robots: robots as SavedRobot[], arenaId: json.arena, seed: json.seed as number } };
}

/** The castle match in the decoded JSON of a code or a file, or what is wrong with it. */
export function readCastleBody(json: Record<string, unknown>): { ok: true; match: SharedCastleBody } | { ok: false; problem: string } {
  const teams = Array.isArray(json.teams) ? json.teams.map(readSavedTeam) : [];
  const size = json.size;
  if (teams.length !== 2 || teams.some((team) => team === null)) return { ok: false, problem: t('share.notTwoTeams') };
  if (!Number.isInteger(size) || (size as number) < 1 || (size as number) > MAX_TEAM_SIZE) return { ok: false, problem: t('share.notTwoTeams') };
  if ((teams as SavedTeam[]).some((team) => team.loadouts.length < (size as number))) return { ok: false, problem: t('share.notTwoTeams') };
  if (typeof json.arena !== 'string' || !Number.isInteger(json.seed)) return { ok: false, problem: t('share.noArenaOrSeed') };
  return {
    ok: true,
    match: { teams: teams as [SavedTeam, SavedTeam], arenaId: json.arena, teamSize: size as number, seed: json.seed as number },
  };
}
