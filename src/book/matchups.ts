import { type Entrant, builtInEntrants, playFixture } from '../arena/match';
import { prepareCastleFight } from '../arena/castle_match';
import { CASTLE_ARENAS, findArena } from '../data/arenas';
import { TEAM_DEFAULT_LOADOUT } from '../data/castle';
import { STANDARD_LOADOUT } from '../data/parts';
import { TEAM_TEMPLATES } from '../data/team_templates';
import { Simulation } from '../sim/simulation';
import type { Matchup } from './types';

// The book's tables of results: a robot (or a team) against others, played
// when the reader asks, in the reader's browser, by the game itself. The same
// matches always come out the same (the seeds are fixed), so what the text
// says about them is checked by tests/book.test.ts.

export interface MatchupRecord {
  /** The opponent's template id. */
  opponent: string;
  wins: number;
  losses: number;
  draws: number;
}

/** One match of a matchup: against which opponent, on which arena, with which seed, and which of the two starts first. */
interface Fixture {
  opponent: string;
  arena: string;
  seed: number;
  robotFirst: boolean;
}

function fixturesOf(matchup: Matchup): Fixture[] {
  return matchup.opponents.flatMap((opponent) =>
    matchup.arenas.flatMap((arena) =>
      matchup.seeds.flatMap((seed) => [true, false].map((robotFirst) => ({ opponent, arena, seed, robotFirst }))),
    ),
  );
}

/** How many matches the matchup plays: each opponent, on each arena, with each seed, from both starting places. */
export function matchCount(matchup: Matchup): number {
  return fixturesOf(matchup).length;
}

/** A match of the matchup's robot, or team, against an opponent: 0 if the robot won, 1 if the opponent did, null for a draw. */
type Play = (fixture: Fixture) => 0 | 1 | null;

function oneOnOne(matchup: Matchup): Play {
  const entrants = builtInEntrants();
  const find = (id: string): Entrant => {
    const entrant = entrants.find((each) => each.id === `built-in:${id}`);
    if (entrant === undefined) throw new Error(`The book names a built-in robot there is not: ${id}`);
    return entrant;
  };
  const { robot } = matchup;
  const own: Entrant =
    typeof robot === 'string' ? find(robot) : { id: 'book', name: robot.name.en, origin: 'editor', loadout: STANDARD_LOADOUT, source: robot.source };
  return ({ opponent, arena, seed, robotFirst }) => {
    const played = playFixture([own, find(opponent)], robotFirst ? 0 : 1, robotFirst ? 1 : 0, findArena(arena).arena, seed);
    if (!played.ok) throw new Error(`A match of the book cannot be played: ${played.problems.join(' ')}`);
    return played.played.winner as 0 | 1 | null;
  };
}

function baseBattle(matchup: Matchup, teamSize: number): Play {
  const source = (id: string) => {
    const team = TEAM_TEMPLATES.find((each) => each.id === id);
    if (team === undefined) throw new Error(`The book names a team there is not: ${id}`);
    return team.source;
  };
  const own = typeof matchup.robot === 'string' ? source(matchup.robot) : matchup.robot.source;
  const kit = Array.from({ length: teamSize }, () => TEAM_DEFAULT_LOADOUT);
  return ({ opponent, arena, seed, robotFirst }) => {
    const definition = CASTLE_ARENAS.find((each) => each.id === arena);
    if (definition === undefined) throw new Error(`The book names a base battle map there is not: ${arena}`);
    const robot = { name: 'A', source: own, loadouts: kit };
    const other = { name: 'B', source: source(opponent), loadouts: kit };
    const prepared = prepareCastleFight(robotFirst ? [robot, other] : [other, robot], definition, teamSize, seed);
    if (!prepared.ok) throw new Error(`A match of the book cannot be played: ${prepared.problems.join(' ')}`);
    const simulation = new Simulation(prepared.fight.config);
    while (simulation.result === null) simulation.step();
    const { winnerTeam } = simulation.result;
    if (winnerTeam === null || winnerTeam === undefined) return null;
    return (winnerTeam === 0) === robotFirst ? 0 : 1;
  };
}

/**
 * Plays the matchup one match at a time: each step plays a match and gives
 * the records so far, so that a page can show how far it has got and stay
 * responsive in between.
 */
export function* playMatchup(matchup: Matchup): Generator<MatchupRecord[], MatchupRecord[]> {
  const play = matchup.teamSize === undefined ? oneOnOne(matchup) : baseBattle(matchup, matchup.teamSize);
  const records = matchup.opponents.map((opponent) => ({ opponent, wins: 0, losses: 0, draws: 0 }));
  for (const fixture of fixturesOf(matchup)) {
    const winner = play(fixture);
    const record = records[matchup.opponents.indexOf(fixture.opponent)];
    if (winner === null) record.draws++;
    else if (winner === 0) record.wins++;
    else record.losses++;
    yield records;
  }
  return records;
}

/** The whole matchup at once, for tests. */
export function matchupRecords(matchup: Matchup): MatchupRecord[] {
  const play = playMatchup(matchup);
  let step = play.next();
  while (!step.done) step = play.next();
  return step.value;
}
