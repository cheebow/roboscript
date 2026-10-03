import { describe, expect, it } from 'vitest';
import { type LeagueMatch, leagueFixtures, playLeague, standingsOf } from '../src/arena/league';
import { builtInEntrants } from '../src/arena/match';
import { ARENAS } from '../src/data/arenas';

const ARENA = ARENAS[0];
function match(first: number, second: number, winner: number | null, hpLeft: [number, number] = [0, 0]): LeagueMatch {
  return { first, second, arena: ARENA, seed: 1, winner, reason: 'destroyed', ticks: 100, hpLeft };
}

describe('leagueFixtures', () => {
  it('pairs every entrant with every other twice, once from each side', () => {
    const fixtures = leagueFixtures(5, 1);
    expect(fixtures).toHaveLength(20);
    for (let a = 0; a < 5; a++) {
      for (let b = 0; b < 5; b++) {
        if (a === b) continue;
        expect(fixtures.filter((f) => f.first === a && f.second === b)).toHaveLength(1);
      }
    }
  });

  it('is the same for the same seed, and gives each match an arena and a seed', () => {
    expect(leagueFixtures(4, 9)).toEqual(leagueFixtures(4, 9));
    expect(leagueFixtures(4, 9)).not.toEqual(leagueFixtures(4, 10));
    expect(new Set(leagueFixtures(8, 3).map((f) => f.seed)).size).toBeGreaterThan(50);
  });
});

describe('standingsOf', () => {
  it('gives 3 points for a win and 1 for a draw, and counts the matches', () => {
    // 0: W W W D = 10, 1: L D W W = 7, 2: L L L L = 0.
    const [top, second, third] = standingsOf(3, [match(0, 1, 0), match(1, 0, null), match(0, 2, 0), match(2, 0, 0), match(1, 2, 1), match(2, 1, 1)]);
    expect(top).toMatchObject({ entrant: 0, place: 1, played: 4, won: 3, drawn: 1, lost: 0, points: 10 });
    expect(second).toMatchObject({ entrant: 1, place: 2, won: 2, drawn: 1, lost: 1, points: 7 });
    expect(third).toMatchObject({ entrant: 2, place: 3, won: 0, drawn: 0, lost: 4, points: 0 });
  });

  it('breaks a tie on points by the points the tied took off each other', () => {
    // 0 and 1 both end on 7; against each other 1 took 4 points, 0 took 1.
    const lines = standingsOf(3, [match(0, 1, 1), match(1, 0, null), match(0, 2, 0), match(2, 0, 0), match(1, 2, 1), match(2, 1, 2)]);
    expect(lines.map((line) => [line.entrant, line.points, line.place])).toEqual([
      [1, 7, 1],
      [0, 7, 2],
      [2, 3, 3],
    ]);
  });

  it('then by the HP left, and shares a place when nothing tells them apart', () => {
    const byHp = standingsOf(2, [match(0, 1, null, [50, 120]), match(1, 0, null, [10, 10])]);
    expect(byHp.map((line) => [line.entrant, line.place])).toEqual([[1, 1], [0, 2]]);
    const level = standingsOf(2, [match(0, 1, null, [10, 10]), match(1, 0, null, [10, 10])]);
    expect(level.map((line) => line.place)).toEqual([1, 1]);
  });
});

describe('playLeague', () => {
  it('plays a league of the templates to the end, the same for the same seed', () => {
    const entrants = builtInEntrants().slice(0, 4);
    const played = playLeague(entrants, 7);
    if (!played.ok) throw new Error(played.problems.join('\n'));
    expect(played.matches).toHaveLength(12);
    expect(played.standings.map((line) => line.played)).toEqual([6, 6, 6, 6]);
    const again = playLeague(entrants, 7);
    expect(again.ok && again.standings).toEqual(played.standings);
  }, 60_000);
});
