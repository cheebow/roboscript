import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { COST_LIMIT, type Loadout, STANDARD_LOADOUT, costOf, statsOf } from '../data/parts';
import { TEMPLATES, templateSource } from '../data/templates';
import type { SavedRobot } from '../project/garage';
import type { RobotBrain } from '../sim/ai_context';
import { type SeriesResult, playSeries } from '../sim/series';
import type { SimulationConfig } from '../sim/simulation';
import type { Arena } from '../sim/types';
import { scatterSpawns } from './spawns';

/** A robot that can be sent into the arena. */
export interface Entrant {
  /** Tells the entrants apart: a built-in robot and a saved one may have the same name. */
  id: string;
  name: string;
  origin: 'garage' | 'built-in';
  loadout: Loadout;
  /** Its program for a match it starts at the given spawn index. */
  sourceFor(spawnIndex: number): string;
}

/** The templates as robots of standard parts. Like the templates, they go round obstacles on the side that suits where they start. */
export function builtInEntrants(): Entrant[] {
  return TEMPLATES.map((template) => ({
    id: `built-in:${template.id}`,
    name: template.name,
    origin: 'built-in',
    loadout: STANDARD_LOADOUT,
    sourceFor: (spawnIndex) => templateSource(template, spawnIndex),
  }));
}

/** The saved robots, each running its program as it was saved wherever it starts. */
export function garageEntrants(robots: readonly SavedRobot[]): Entrant[] {
  return robots.map((robot) => ({
    id: `garage:${robot.name}`,
    name: robot.name,
    origin: 'garage',
    loadout: robot.loadout,
    sourceFor: () => robot.source,
  }));
}

/** A match between two entrants, ready to be played. */
export interface Fight {
  /** What the robots are called in the match, in spawn order. */
  names: [string, string];
  loadouts: [Loadout, Loadout];
  config: Omit<SimulationConfig, 'logger'>;
}

/** What keeps the entrants from fighting, one line for each thing wrong. */
export interface Refusal {
  ok: false;
  problems: string[];
}

/** The names two entrants fight under: an entrant that meets itself is told apart from itself. */
export function fightNames([first, second]: readonly [Entrant, Entrant]): [string, string] {
  return [first.name, first.name === second.name ? `${second.name} (2)` : second.name];
}

/**
 * Sets up a match between the two entrants, the first at the first spawn
 * point. Where in the arena they start goes by the seed, so that matches with
 * different seeds are different matches. Refused when a program does not
 * compile or a robot's parts cost more than the limit.
 */
export function prepareFight(
  entrants: readonly [Entrant, Entrant],
  arena: Arena,
  seed: number,
): { ok: true; fight: Fight } | Refusal {
  const names = fightNames(entrants);
  const problems: string[] = [];
  const brains: RobotBrain[] = [];
  entrants.forEach((entrant, spawnIndex) => {
    const cost = costOf(entrant.loadout);
    if (cost > COST_LIMIT) problems.push(`${names[spawnIndex]}: parts cost ${cost}, over the limit of ${COST_LIMIT}`);
    const compiled = compileScript(entrant.sourceFor(spawnIndex));
    if (compiled.ok) brains.push(compiled.brain);
    else problems.push(...compiled.errors.map((error) => `${names[spawnIndex]}: ${formatError(error)}`));
  });
  if (problems.length > 0) return { ok: false, problems };

  const loadouts: [Loadout, Loadout] = [entrants[0].loadout, entrants[1].loadout];
  return {
    ok: true,
    fight: {
      names,
      loadouts,
      config: {
        arena: scatterSpawns(arena, seed),
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
        seed,
        robots: [
          { id: names[0], brain: brains[0], stats: statsOf(loadouts[0]) },
          { id: names[1], brain: brains[1], stats: statsOf(loadouts[1]) },
        ],
      },
    },
  };
}

/** One round of a series: two matches in an arena with a seed, one from each side. */
export interface SeriesRound {
  arena: Arena;
  seed: number;
}

/**
 * Plays the two entrants against each other round after round, and counts
 * who won. A round is two matches, one from each side, in the round's arena
 * and from the starting places its seed gives. Refused for the same reasons
 * as a single match.
 */
export function playArenaSeries(
  entrants: readonly [Entrant, Entrant],
  rounds: readonly SeriesRound[],
): { ok: true; names: [string, string]; result: SeriesResult } | Refusal {
  // Either way round: a built-in robot's program depends on where it starts.
  const ways: [Entrant, Entrant][] = [
    [entrants[0], entrants[1]],
    [entrants[1], entrants[0]],
  ];
  for (const way of ways) {
    // What keeps a robot from fighting has nothing to do with the arena or the seed.
    const prepared = prepareFight(way, rounds[0].arena, rounds[0].seed);
    if (!prepared.ok) return prepared;
  }

  const names = fightNames(entrants);
  const contenderOf = (index: number) => ({
    id: names[index],
    stats: statsOf(entrants[index].loadout),
    createBrain: (spawnIndex: number) => {
      const compiled = compileScript(entrants[index].sourceFor(spawnIndex));
      if (!compiled.ok) throw new Error(`${names[index]} does not compile`);
      return compiled.brain;
    },
  });
  const result: SeriesResult = {
    matches: 0,
    wins: [0, 0],
    draws: 0,
    reasons: { destroyed: 0, timeout: 0, 'out of ammo': 0 },
  };
  for (const { arena, seed } of rounds) {
    const played = playSeries({
      contenders: [contenderOf(0), contenderOf(1)],
      arenas: [scatterSpawns(arena, seed)],
      seeds: [seed],
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
    });
    result.matches += played.matches;
    result.wins[0] += played.wins[0];
    result.wins[1] += played.wins[1];
    result.draws += played.draws;
    for (const reason of Object.keys(result.reasons) as (keyof typeof result.reasons)[]) {
      result.reasons[reason] += played.reasons[reason];
    }
  }
  return { ok: true, names, result };
}
