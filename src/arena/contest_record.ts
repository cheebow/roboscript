import { ARENAS, type ArenaDefinition, DEFAULT_ARENA_DEFINITION } from '../data/arenas';
import { readLoadout } from '../data/parts';
import type { SavedRobot } from '../project/garage';
import type { MatchEndReason } from '../sim/simulation';
import type { LeagueMatch, Standing } from './league';
import type { Bracket, Tie, TieMatch } from './tournament';

/**
 * A finished contest as it is written to a file: the robots as they fought
 * (under the names they fought under), and every match by the id of its
 * arena, its seed and how it went. Enough to draw its board as it was, and to
 * play any of its matches again.
 */
export type ContestRecord =
  | { format: 'league'; robots: SavedRobot[]; matches: RecordedLeagueMatch[]; standings: Standing[] }
  | { format: 'tournament'; robots: SavedRobot[]; rounds: RecordedTie[][]; champion: number; places: (number | null)[] };

type RecordedLeagueMatch = Omit<LeagueMatch, 'arena'> & { arena: string };
type RecordedTieMatch = Omit<TieMatch, 'arena'> & { arena: string };
type RecordedTie = Omit<Tie, 'matches'> & { matches: RecordedTieMatch[] };

export function recordLeague(robots: readonly SavedRobot[], matches: readonly LeagueMatch[], standings: readonly Standing[]): ContestRecord {
  return {
    format: 'league',
    robots: robots.map(copyRobot),
    matches: matches.map((match) => ({ ...match, hpLeft: [...match.hpLeft] as [number, number], arena: match.arena.id })),
    standings: standings.map((line) => ({ ...line })),
  };
}

export function recordTournament(robots: readonly SavedRobot[], bracket: Bracket): ContestRecord {
  return {
    format: 'tournament',
    robots: robots.map(copyRobot),
    rounds: bracket.rounds.map((round) =>
      round.map((tie) => ({
        ...tie,
        score: [...tie.score] as [number, number],
        matches: tie.matches.map((match) => ({ ...match, hpLeft: [...match.hpLeft] as [number, number], arena: match.arena.id })),
      })),
    ),
    champion: bracket.champion,
    places: [...bracket.places],
  };
}

/** What a record holds, with each arena looked up by its id; an arena that is not here any more is the default one. */
export type ReadRecord =
  | { format: 'league'; robots: SavedRobot[]; matches: LeagueMatch[]; standings: Standing[]; unknownArenas: string[] }
  | { format: 'tournament'; robots: SavedRobot[]; bracket: Bracket; unknownArenas: string[] };

/** The record checked and turned back into what the boards draw; null when it is not one. */
export function readRecord(value: unknown): ReadRecord | null {
  if (!isRecord(value) || !Array.isArray(value.robots)) return null;
  const robots = value.robots.map(readRobot);
  if (robots.length < 2 || robots.some((robot) => robot === null)) return null;
  const seats = robots.length;
  const unknown = new Set<string>();
  const arenaOf = (id: unknown): ArenaDefinition | null => {
    if (typeof id !== 'string') return null;
    const found = ARENAS.find((arena) => arena.id === id);
    if (found === undefined) unknown.add(id);
    return found ?? DEFAULT_ARENA_DEFINITION;
  };
  const seat = (index: unknown): index is number => Number.isInteger(index) && (index as number) >= 0 && (index as number) < seats;
  const readMatch = (match: unknown): TieMatch | null => {
    if (!isRecord(match) || !seat(match.first) || !seat(match.second) || !Number.isInteger(match.seed)) return null;
    const arena = arenaOf(match.arena);
    if (arena === null) return null;
    if (match.winner !== null && !seat(match.winner)) return null;
    const hpLeft = Array.isArray(match.hpLeft) && match.hpLeft.length === 2 ? (match.hpLeft as [number, number]) : ([0, 0] as [number, number]);
    return {
      first: match.first,
      second: match.second,
      arena,
      seed: match.seed as number,
      winner: match.winner as number | null,
      reason: (typeof match.reason === 'string' ? match.reason : 'destroyed') as MatchEndReason,
      hpLeft: [Number(hpLeft[0]) || 0, Number(hpLeft[1]) || 0],
    };
  };
  const ok = robots as SavedRobot[];

  if (value.format === 'league') {
    if (!Array.isArray(value.matches) || !Array.isArray(value.standings)) return null;
    const matches: LeagueMatch[] = [];
    for (const each of value.matches) {
      const match = readMatch(each);
      if (match === null) return null;
      matches.push({ ...match, ticks: isRecord(each) && typeof each.ticks === 'number' ? each.ticks : 0 });
    }
    const standings = value.standings.filter((line): line is Standing => isRecord(line) && seat(line.entrant));
    if (standings.length !== seats) return null;
    return { format: 'league', robots: ok, matches, standings, unknownArenas: [...unknown] };
  }
  if (value.format === 'tournament') {
    if (!Array.isArray(value.rounds) || !seat(value.champion) || !Array.isArray(value.places)) return null;
    const rounds: Tie[][] = [];
    for (const round of value.rounds) {
      if (!Array.isArray(round)) return null;
      const ties: Tie[] = [];
      for (const tie of round) {
        if (!isRecord(tie) || !seat(tie.a) || (tie.b !== null && !seat(tie.b)) || !seat(tie.winner) || !Array.isArray(tie.matches)) return null;
        const matches = tie.matches.map(readMatch);
        if (matches.some((match) => match === null)) return null;
        const score = Array.isArray(tie.score) ? (tie.score as [number, number]) : ([0, 0] as [number, number]);
        ties.push({ a: tie.a, b: tie.b as number | null, winner: tie.winner, score: [Number(score[0]) || 0, Number(score[1]) || 0], matches: matches as TieMatch[] });
      }
      rounds.push(ties);
    }
    if (rounds.length === 0) return null;
    const places = value.places.map((place) => (Number.isInteger(place) ? (place as number) : null));
    if (places.length !== seats) return null;
    return { format: 'tournament', robots: ok, bracket: { rounds, champion: value.champion, places }, unknownArenas: [...unknown] };
  }
  return null;
}

function copyRobot(robot: SavedRobot): SavedRobot {
  return { name: robot.name, source: robot.source, loadout: { ...robot.loadout } };
}

function readRobot(value: unknown): SavedRobot | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.source !== 'string') return null;
  return { name: value.name, source: value.source, loadout: readLoadout(value.loadout) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
