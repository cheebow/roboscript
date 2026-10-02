import type { RobotStats } from '../data/robot_defaults';
import type { RobotBrain } from './ai_context';
import { type MatchEndReason, type MatchResult, Simulation } from './simulation';
import type { Arena } from './types';

/** A robot entered in a series of matches. */
export interface Contender {
  id: string;
  stats: RobotStats;
  /**
   * Makes the robot's brain for a match it starts at the given spawn index.
   * Called for every match: a brain keeps the state of the match it played.
   */
  createBrain: (spawnIndex: number) => RobotBrain;
}

export interface SeriesConfig {
  contenders: [Contender, Contender];
  arenas: readonly Arena[];
  seeds: readonly number[];
  tickRate: number;
  /** sec */
  maxMatchTime: number;
}

export interface SeriesResult {
  matches: number;
  /** Matches won by each contender, in the order they were given. */
  wins: [number, number];
  draws: number;
  /** How many matches ended for each reason. */
  reasons: Record<MatchEndReason, number>;
}

/**
 * Plays the two contenders against each other in every arena with every seed,
 * once from each side: which side a robot starts on can decide a match.
 */
export function playSeries(config: SeriesConfig): SeriesResult {
  const [first, second] = config.contenders;
  if (first.id === second.id) throw new Error(`Both contenders are called "${first.id}"`);

  const series: SeriesResult = {
    matches: 0,
    wins: [0, 0],
    draws: 0,
    reasons: { destroyed: 0, timeout: 0, 'out of ammo': 0 },
  };
  const lineUps: [Contender, Contender][] = [
    [first, second],
    [second, first],
  ];
  for (const arena of config.arenas) {
    for (const seed of config.seeds) {
      for (const lineUp of lineUps) {
        const { winnerId, reason } = playMatch(config, arena, seed, lineUp);
        series.matches++;
        series.reasons[reason]++;
        if (winnerId === null) series.draws++;
        else series.wins[winnerId === first.id ? 0 : 1]++;
      }
    }
  }
  return series;
}

function playMatch(config: SeriesConfig, arena: Arena, seed: number, lineUp: [Contender, Contender]): MatchResult {
  const setUp = ({ id, stats, createBrain }: Contender, spawnIndex: number) => ({
    id,
    stats,
    brain: createBrain(spawnIndex),
  });
  const simulation = new Simulation({
    arena,
    tickRate: config.tickRate,
    maxMatchTime: config.maxMatchTime,
    seed,
    robots: [setUp(lineUp[0], 0), setUp(lineUp[1], 1)],
  });
  for (;;) {
    simulation.step();
    if (simulation.result !== null) return simulation.result;
  }
}
