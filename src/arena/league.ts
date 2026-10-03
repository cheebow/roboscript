import { ARENAS, type ArenaDefinition } from '../data/arenas';
import type { MatchEndReason } from '../sim/simulation';
import { Simulation } from '../sim/simulation';
import { MatchRng } from '../sim/rng';
import { type Entrant, type Refusal, prepareFight } from './match';

/** How many robots a league or a tournament takes. */
export const LEAGUE_MIN = 3;
export const LEAGUE_MAX = 8;
/** Points for a win and a draw; a loss is worth nothing. */
export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;

/** One match of a league: two of the entrants, by index, the first at the first spawn point. */
export interface LeagueFixture {
  first: number;
  second: number;
  arena: ArenaDefinition;
  seed: number;
}

/** How a match of a league went. */
export interface LeagueMatch extends LeagueFixture {
  /** The index of the entrant that won; null for a draw. */
  winner: number | null;
  reason: MatchEndReason;
  ticks: number;
  /** HP each of the two had left at the end, in the order first, second. */
  hpLeft: [number, number];
}

/** One line of the table. */
export interface Standing {
  /** The entrant's index. */
  entrant: number;
  /** 1 for the top; entrants that cannot be told apart share a place. */
  place: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  /** HP left over all its matches: the last tie-break. */
  hpLeft: number;
}

/**
 * Every pair of entrants twice, once from each side, in an order that mixes
 * the pairs up. Each match gets an arena and a seed of its own from the
 * league's seed, so the same seed makes the same league.
 */
export function leagueFixtures(count: number, seed: number): LeagueFixture[] {
  const rng = new MatchRng(seed);
  const fixtures: LeagueFixture[] = [];
  for (let leg = 0; leg < 2; leg++) {
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        const [first, second] = leg === 0 ? [a, b] : [b, a];
        const arena = ARENAS[Math.floor(rng.next() * ARENAS.length)];
        fixtures.push({ first, second, arena, seed: 1 + Math.floor(rng.next() * 0x7ffffffe) });
      }
    }
  }
  return fixtures;
}

/** Plays every match of a league. Refused, as a single match is, when a robot cannot fight. */
export function playLeague(
  entrants: readonly Entrant[],
  seed: number,
): { ok: true; matches: LeagueMatch[]; standings: Standing[] } | Refusal {
  const matches: LeagueMatch[] = [];
  for (const fixture of leagueFixtures(entrants.length, seed)) {
    const prepared = prepareFight([entrants[fixture.first], entrants[fixture.second]], fixture.arena.arena, fixture.seed);
    if (!prepared.ok) return prepared;
    const simulation = new Simulation(prepared.fight.config);
    while (simulation.result === null) simulation.step();
    const { winnerId, reason } = simulation.result;
    const [firstName] = prepared.fight.names;
    const winner = winnerId === null ? null : winnerId === firstName ? fixture.first : fixture.second;
    const [firstRobot, secondRobot] = simulation.robots;
    matches.push({ ...fixture, winner, reason, ticks: simulation.tick, hpLeft: [firstRobot.hp, secondRobot.hp] });
  }
  return { ok: true, matches, standings: standingsOf(entrants.length, matches) };
}

/**
 * The table: by points; tied entrants by the points they took off each
 * other, then by the HP they had left over all their matches.
 */
export function standingsOf(count: number, matches: readonly LeagueMatch[]): Standing[] {
  const lines: Standing[] = Array.from({ length: count }, (_, entrant) => ({
    entrant,
    place: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    hpLeft: 0,
  }));
  for (const match of matches) {
    [match.first, match.second].forEach((entrant, side) => {
      const line = lines[entrant];
      line.played++;
      line.hpLeft += match.hpLeft[side];
      if (match.winner === null) {
        line.drawn++;
        line.points += DRAW_POINTS;
      } else if (match.winner === entrant) {
        line.won++;
        line.points += WIN_POINTS;
      } else {
        line.lost++;
      }
    });
  }
  // Points each entrant took in its matches against the given others.
  const pointsAgainst = (entrant: number, others: ReadonlySet<number>) =>
    matches.reduce((sum, match) => {
      const opponent = match.first === entrant ? match.second : match.second === entrant ? match.first : null;
      if (opponent === null || !others.has(opponent)) return sum;
      if (match.winner === null) return sum + DRAW_POINTS;
      return match.winner === entrant ? sum + WIN_POINTS : sum;
    }, 0);
  const tied = (line: Standing) => new Set(lines.filter((other) => other.points === line.points).map((other) => other.entrant));
  const key = (line: Standing): [number, number, number] => [line.points, pointsAgainst(line.entrant, tied(line)), line.hpLeft];
  const compare = (a: Standing, b: Standing) => {
    const [ka, kb] = [key(a), key(b)];
    for (let index = 0; index < ka.length; index++) if (ka[index] !== kb[index]) return kb[index] - ka[index];
    return 0;
  };
  const sorted = [...lines].sort((a, b) => compare(a, b) || a.entrant - b.entrant);
  for (const line of sorted) line.place = 1 + sorted.filter((other) => compare(other, line) < 0).length;
  return sorted;
}
