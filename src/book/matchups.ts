import { builtInEntrants, playFixture } from '../arena/match';
import { findArena } from '../data/arenas';
import type { Matchup } from './types';

// The book's tables of results: a built-in robot against others, played when
// the reader asks, in the reader's browser, by the game itself. The same
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

/**
 * Plays the matchup one match at a time: each step plays a match and gives
 * the records so far, so that a page can show how far it has got and stay
 * responsive in between.
 */
export function* playMatchup(matchup: Matchup): Generator<MatchupRecord[], MatchupRecord[]> {
  const entrants = builtInEntrants();
  const indexOf = (id: string) => {
    const index = entrants.findIndex((entrant) => entrant.id === `built-in:${id}`);
    if (index < 0) throw new Error(`The book names a built-in robot there is not: ${id}`);
    return index;
  };
  const robot = indexOf(matchup.robot);
  const records = matchup.opponents.map((opponent) => ({ opponent, wins: 0, losses: 0, draws: 0 }));
  for (const fixture of fixturesOf(matchup)) {
    const opponent = indexOf(fixture.opponent);
    const [first, second] = fixture.robotFirst ? [robot, opponent] : [opponent, robot];
    const played = playFixture(entrants, first, second, findArena(fixture.arena).arena, fixture.seed);
    if (!played.ok) throw new Error(`A match of the book cannot be played: ${played.problems.join(' ')}`);
    const record = records[matchup.opponents.indexOf(fixture.opponent)];
    if (played.played.winner === null) record.draws++;
    else if (played.played.winner === robot) record.wins++;
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
