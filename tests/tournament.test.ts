import { describe, expect, it } from 'vitest';
import { builtInEntrants } from '../src/arena/match';
import { MOST_MATCHES, WINS_NEEDED, bracketSize, firstRound, playTournament } from '../src/arena/tournament';

describe('the bracket', () => {
  it('is the smallest power of two that seats everyone', () => {
    expect([3, 4, 5, 6, 8].map(bracketSize)).toEqual([4, 4, 8, 8, 8]);
  });

  it('seats every entrant once, with byes for the places left over, never two byes together', () => {
    for (const count of [3, 4, 5, 6, 7, 8]) {
      const pairs = firstRound(count, 11);
      const seated = pairs.flat().filter((entrant) => entrant !== null);
      expect([...seated].sort((x, y) => (x as number) - (y as number))).toEqual(Array.from({ length: count }, (_, index) => index));
      expect(pairs.filter(([, b]) => b === null)).toHaveLength(bracketSize(count) - count);
      expect(pairs.every(([a]) => a !== null)).toBe(true);
    }
  });

  it('is drawn by the seed', () => {
    expect(firstRound(8, 3)).toEqual(firstRound(8, 3));
    const draws = new Set(Array.from({ length: 10 }, (_, seed) => JSON.stringify(firstRound(8, seed))));
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe('playTournament', () => {
  it('plays round by round to a champion, every tie to two wins at most five matches', () => {
    const entrants = builtInEntrants().slice(0, 6);
    const played = playTournament(entrants, 5);
    if (!played.ok) throw new Error(played.problems.join('\n'));
    const { rounds, champion, places } = played.bracket;
    expect(rounds.map((round) => round.length)).toEqual([4, 2, 1]);
    for (const round of rounds) {
      for (const tie of round) {
        if (tie.b === null) {
          expect(tie.matches).toEqual([]);
          continue;
        }
        expect(tie.matches.length).toBeLessThanOrEqual(MOST_MATCHES);
        const settled = Math.max(...tie.score) === WINS_NEEDED;
        expect(settled || tie.matches.length === MOST_MATCHES).toBe(true);
        expect([tie.a, tie.b]).toContain(tie.winner);
        // Sides change every match.
        tie.matches.forEach((match, index) => expect(match.first).toBe(index % 2 === 0 ? tie.a : tie.b));
      }
    }
    expect(places[champion]).toBe(1);
    expect(places.filter((place) => place === 2)).toHaveLength(1);
    expect(places.filter((place) => place === 3).length).toBeLessThanOrEqual(2);
    // The winners of a round meet in the next.
    expect([rounds[1][0].a, rounds[1][0].b]).toEqual([rounds[0][0].winner, rounds[0][1].winner]);
  }, 60_000);

  it('is the same for the same seed', () => {
    const entrants = builtInEntrants().slice(0, 4);
    const first = playTournament(entrants, 9);
    const second = playTournament(entrants, 9);
    expect(first.ok && second.ok && first.bracket.champion === second.bracket.champion).toBe(true);
  }, 60_000);
});
