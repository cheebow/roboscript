import type { ArenaDefinition } from '../data/arenas';
import type { MatchEndReason } from '../sim/simulation';
import { MatchRng } from '../sim/rng';
import { type Entrant, type Refusal, type SteppedPlay, playAllSteps, playFixture } from './match';
import { drawArena, drawSeed } from './seed';

/** Wins that take a robot through a tie. */
export const WINS_NEEDED = 2;
/** The most matches a tie runs to; draws do not count, so it can take more than three. */
export const MOST_MATCHES = 5;

/** One match of a tie: the entrants by index, the first at the first spawn point. */
export interface TieMatch {
  first: number;
  second: number;
  arena: ArenaDefinition;
  seed: number;
  /** The index of the entrant that won; null for a draw. */
  winner: number | null;
  reason: MatchEndReason;
  hpLeft: [number, number];
}

/** Two entrants who meet; a robot with nobody to meet goes through on a bye. */
export interface Tie {
  a: number;
  /** Null for a bye. */
  b: number | null;
  matches: TieMatch[];
  /** Wins of a and of b. */
  score: [number, number];
  winner: number;
}

/** Every round, the first first; the last holds the final alone. */
export interface Bracket {
  rounds: Tie[][];
  champion: number;
  /** Each entrant's place: 1 the champion, 2 the runner-up, 3 for the losing semi-finalists; null for the rest. */
  places: (number | null)[];
}

/** The size of the bracket: the smallest power of two that seats every entrant. */
export function bracketSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

/**
 * The first round: the entrants in an order the seed gives, paired off. When
 * they do not fill the bracket, the first ones drawn go through on a bye,
 * spread over the bracket; a bye is never paired with another.
 */
export function firstRound(count: number, seed: number): [number, number | null][] {
  const rng = new MatchRng(seed);
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(rng.next() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  const ties = bracketSize(count) / 2;
  const byes = ties * 2 - count;
  const pairs: [number, number | null][] = [];
  let next = 0;
  const byeAt = new Set(spreadPositions(ties, byes));
  for (let tie = 0; tie < ties; tie++) {
    if (byeAt.has(tie)) pairs.push([order[next++], null]);
    else {
      pairs.push([order[next], order[next + 1]]);
      next += 2;
    }
  }
  return pairs;
}

/** `count` positions out of `slots`, as far apart as they can be. */
function spreadPositions(slots: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => Math.floor((index * slots) / count));
}

/**
 * The tournament, one tie a step. A single-elimination bracket of N seats
 * always holds N - 1 ties, byes among them, whoever wins what.
 */
export function tournamentSteps(entrants: readonly Entrant[], seed: number): SteppedPlay<{ bracket: Bracket }> {
  const rng = new MatchRng(seed ^ 0x70e7);
  const rounds: Tie[][] = [];
  let pairs = firstRound(entrants.length, seed);
  let round: Tie[] = [];
  return {
    count: bracketSize(entrants.length) - 1,
    step() {
      const [a, b] = pairs[round.length];
      if (b === null) {
        round.push({ a, b, matches: [], score: [0, 0], winner: a });
      } else {
        const tie = playTie(entrants, a, b, rng);
        if (!tie.ok) return tie;
        round.push(tie.tie);
      }
      if (round.length === pairs.length) {
        rounds.push(round);
        pairs = [];
        for (let index = 0; index < round.length; index += 2) {
          if (index + 1 < round.length) pairs.push([round[index].winner, round[index + 1].winner]);
        }
        round = [];
      }
      return { ok: true };
    },
    result() {
      const champion = rounds[rounds.length - 1][0].winner;
      return { bracket: { rounds, champion, places: placesOf(entrants.length, rounds) } };
    },
  };
}

/** Plays a whole tournament. Refused, as a single match is, when a robot cannot fight. */
export function playTournament(entrants: readonly Entrant[], seed: number): { ok: true; bracket: Bracket } | Refusal {
  return playAllSteps(tournamentSteps(entrants, seed));
}

/** Two entrants play until one has won twice; the first robot changes sides every match. */
function playTie(entrants: readonly Entrant[], a: number, b: number, rng: MatchRng): { ok: true; tie: Tie } | Refusal {
  const matches: TieMatch[] = [];
  const score: [number, number] = [0, 0];
  const hp: [number, number] = [0, 0];
  while (score[0] < WINS_NEEDED && score[1] < WINS_NEEDED && matches.length < MOST_MATCHES) {
    const [first, second] = matches.length % 2 === 0 ? [a, b] : [b, a];
    const arena = drawArena(rng);
    const seed = drawSeed(rng);
    const fought = playFixture(entrants, first, second, arena.arena, seed);
    if (!fought.ok) return fought;
    const { winner, reason, hpLeft } = fought.played;
    matches.push({ first, second, arena, seed, winner, reason, hpLeft });
    if (winner === a) score[0]++;
    if (winner === b) score[1]++;
    hp[first === a ? 0 : 1] += hpLeft[0];
    hp[first === a ? 1 : 0] += hpLeft[1];
  }
  // Not settled in the most matches: more wins, then more HP left, then the one drawn first.
  const winner = score[0] !== score[1] ? (score[0] > score[1] ? a : b) : hp[0] >= hp[1] ? a : b;
  return { ok: true, tie: { a, b, matches, score, winner } };
}

/** Each entrant's place from the rounds: 1 and 2 from the final, 3 for the losers of the semi-finals. */
export function placesOf(count: number, rounds: readonly Tie[][]): (number | null)[] {
  const places: (number | null)[] = Array.from({ length: count }, () => null);
  const final = rounds[rounds.length - 1][0];
  places[final.winner] = 1;
  const runnerUp = final.winner === final.a ? final.b : final.a;
  if (runnerUp !== null) places[runnerUp] = 2;
  if (rounds.length >= 2) {
    for (const semi of rounds[rounds.length - 2]) {
      const loser = semi.winner === semi.a ? semi.b : semi.a;
      if (loser !== null) places[loser] = 3;
    }
  }
  return places;
}
