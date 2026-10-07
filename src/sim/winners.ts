import type { MatchResult } from './simulation';

/** The ids of the robots that won: the winner, or in a team match the robots of the winning team. null for a draw. */
export function winnersOf(result: MatchResult): string[] | null {
  if (result.winnerTeam === undefined) return result.winnerId === null ? null : [result.winnerId];
  if (result.winnerTeam === null) return null;
  return Object.keys(result.places).filter((id) => result.places[id] === 1);
}
