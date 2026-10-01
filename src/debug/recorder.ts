import type { RobotStats } from '../data/robot_defaults';
import { Simulation, type SimulationConfig } from '../sim/simulation';
import type { Arena } from '../sim/types';
import type { DebugEvent } from './debug_event';
import { DebugLogger } from './debug_logger';
import { type EffectLifetimes, EffectTracker } from './effects';
import { type Snapshot, captureSnapshot } from './snapshot';

/** A whole match, played to its end and kept in memory for replay. */
export interface Recording {
  arena: Arena;
  stats: RobotStats;
  tickRate: number;
  seed: number;
  /** snapshots[n] is the state after n ticks; snapshots[0] is the starting position. */
  snapshots: Snapshot[];
  events: readonly DebugEvent[];
}

/** Plays a match from start to finish and records every tick of it. */
export function recordMatch(config: Omit<SimulationConfig, 'logger'>, effectLifetimes: EffectLifetimes): Recording {
  const logger = new DebugLogger();
  const simulation = new Simulation({ ...config, logger });
  const effects = new EffectTracker(effectLifetimes);
  const snapshots = [captureSnapshot(simulation)];
  while (simulation.result === null) {
    simulation.step();
    snapshots.push(captureSnapshot(simulation, effects.update(simulation.tick, simulation.tickEvents)));
  }
  return {
    arena: config.arena,
    stats: config.stats,
    tickRate: config.tickRate,
    seed: config.seed,
    snapshots,
    events: logger.events,
  };
}
