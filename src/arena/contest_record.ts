import { isRecord } from '../project/json';
import { ARENAS, type ArenaDefinition, DEFAULT_ARENA_DEFINITION } from '../data/arenas';
import { type SavedRobot, copyRobot, readSavedRobot } from '../project/garage';
import type { MatchEndReason } from '../sim/simulation';
import { type LeagueMatch, type Standing, standingsOf } from './league';
import { type Bracket, type Tie, type TieMatch, placesOf } from './tournament';

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

const REASONS: readonly MatchEndReason[] = ['destroyed', 'timeout', 'out of ammo'];

/**
 * The record checked and turned back into what the boards draw; null when it
 * is not one. The table and the places are worked out again from the matches,
 * so that a file cannot claim a result its matches do not give.
 */
export function readRecord(value: unknown): ReadRecord | null {
  if (!isRecord(value) || !Array.isArray(value.robots)) return null;
  const robots = value.robots.map(readSavedRobot);
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
      reason: REASONS.includes(match.reason as MatchEndReason) ? (match.reason as MatchEndReason) : 'destroyed',
      hpLeft: [Number(hpLeft[0]) || 0, Number(hpLeft[1]) || 0],
    };
  };
  const ok = robots as SavedRobot[];

  if (value.format === 'league') {
    if (!Array.isArray(value.matches)) return null;
    const matches: LeagueMatch[] = [];
    for (const each of value.matches) {
      const match = readMatch(each);
      if (match === null) return null;
      matches.push({ ...match, ticks: isRecord(each) && typeof each.ticks === 'number' ? each.ticks : 0 });
    }
    return { format: 'league', robots: ok, matches, standings: standingsOf(seats, matches), unknownArenas: [...unknown] };
  }
  if (value.format === 'tournament') {
    if (!Array.isArray(value.rounds)) return null;
    const rounds: Tie[][] = [];
    for (const round of value.rounds) {
      if (!Array.isArray(round)) return null;
      const ties: Tie[] = [];
      for (const tie of round) {
        if (!isRecord(tie) || !seat(tie.a) || (tie.b !== null && !seat(tie.b)) || !Array.isArray(tie.matches)) return null;
        if (tie.winner !== tie.a && tie.winner !== tie.b) return null;
        const matches = tie.matches.map(readMatch);
        if (matches.some((match) => match === null)) return null;
        const score = Array.isArray(tie.score) ? (tie.score as [number, number]) : ([0, 0] as [number, number]);
        ties.push({ a: tie.a, b: tie.b as number | null, winner: tie.winner as number, score: [Number(score[0]) || 0, Number(score[1]) || 0], matches: matches as TieMatch[] });
      }
      rounds.push(ties);
    }
    if (!isBracket(rounds)) return null;
    const champion = rounds[rounds.length - 1][0].winner;
    return { format: 'tournament', robots: ok, bracket: { rounds, champion, places: placesOf(seats, rounds) }, unknownArenas: [...unknown] };
  }
  return null;
}

/** Whether the rounds make a bracket: each round half the one before, met by its winners, down to one final. */
function isBracket(rounds: readonly Tie[][]): boolean {
  if (rounds.length === 0 || rounds[rounds.length - 1].length !== 1) return false;
  for (let index = 1; index < rounds.length; index++) {
    const before = rounds[index - 1];
    const round = rounds[index];
    if (round.length * 2 !== before.length) return false;
    const met = round.every((tie, at) => tie.a === before[at * 2].winner && tie.b === before[at * 2 + 1].winner);
    if (!met) return false;
  }
  return true;
}

