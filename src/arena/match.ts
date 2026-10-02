import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { COST_LIMIT, type Loadout, STANDARD_LOADOUT, costOf, statsOf } from '../data/parts';
import { TEMPLATES, templateSource } from '../data/templates';
import type { SavedRobot } from '../project/garage';
import type { RobotBrain } from '../sim/ai_context';
import { type StartSide, brainFor, readStartSide } from '../sim/mirror';
import type { SeriesResult } from '../sim/series';
import { type MatchEndReason, Simulation, type SimulationConfig } from '../sim/simulation';
import type { Arena } from '../sim/types';
import { scatterSpawns } from './spawns';

/** A robot that can be sent into the arena. */
export interface Entrant {
  /** Tells the entrants apart: a built-in robot and a saved one may have the same name. */
  id: string;
  name: string;
  origin: 'garage' | 'built-in';
  loadout: Loadout;
  /**
   * The side its program was written for: starting on the other, it is run in
   * a mirror. Null when it has a program for either side.
   */
  side: StartSide | null;
  /** Its program for a match it starts at the given spawn index. */
  sourceFor(spawnIndex: number): string;
}

/** Whether the entrant is run in a mirror when it starts at the given spawn index. */
export function isMirrored(entrant: Entrant, spawnIndex: number): boolean {
  return entrant.side !== null && entrant.side !== readStartSide(spawnIndex);
}

/** The templates as robots of standard parts. Like the templates, they go round obstacles on the side that suits where they start. */
export function builtInEntrants(): Entrant[] {
  return TEMPLATES.map((template) => ({
    id: `built-in:${template.id}`,
    name: template.name,
    origin: 'built-in',
    loadout: STANDARD_LOADOUT,
    side: null,
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
    side: robot.side,
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
 * different seeds are different matches. An entrant that starts on the other
 * side than its program was written for is run in a mirror. Refused when a
 * program does not compile or a robot's parts cost more than the limit.
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
    if (compiled.ok) brains.push(entrant.side === null ? compiled.brain : brainFor(compiled.brain, entrant.side, spawnIndex));
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

/** One match of a series to be played. */
export interface SeriesFixture {
  arena: Arena;
  /** Decides where in the arena the robots start, as well as how their shots scatter. */
  seed: number;
  /** Which of the two entrants starts at the first spawn point. */
  first: 0 | 1;
}

/** How a match of a series went. */
export interface SeriesMatch {
  /** Which of the two entrants won; null for a draw. */
  winner: 0 | 1 | null;
  reason: MatchEndReason;
  /** How many ticks it lasted. */
  ticks: number;
}

/**
 * Plays the two entrants against each other match after match, and tells how
 * each match went, in the order of the fixtures, and who won how many.
 * Refused for the same reasons as a single match.
 */
export function playArenaSeries(
  entrants: readonly [Entrant, Entrant],
  fixtures: readonly SeriesFixture[],
): { ok: true; names: [string, string]; matches: SeriesMatch[]; result: SeriesResult } | Refusal {
  const matches: SeriesMatch[] = [];
  const result: SeriesResult = {
    matches: 0,
    wins: [0, 0],
    draws: 0,
    reasons: { destroyed: 0, timeout: 0, 'out of ammo': 0 },
  };
  for (const { arena, seed, first } of fixtures) {
    const prepared = prepareFight(inOrder(entrants, first), arena, seed);
    if (!prepared.ok) return prepared;
    const simulation = new Simulation(prepared.fight.config);
    while (simulation.result === null) simulation.step();

    const { winnerId, reason } = simulation.result;
    // The robot at the first spawn point is the entrant `first`; the other one is the other.
    const startedFirst = winnerId === prepared.fight.names[0];
    const winner = winnerId === null ? null : startedFirst ? first : other(first);
    matches.push({ winner, reason, ticks: simulation.tick });
    result.matches++;
    result.reasons[reason]++;
    if (winner === null) result.draws++;
    else result.wins[winner]++;
  }
  return { ok: true, names: fightNames(entrants), matches, result };
}

/** The two entrants with the given one first. */
export function inOrder(entrants: readonly [Entrant, Entrant], first: 0 | 1): [Entrant, Entrant] {
  return [entrants[first], entrants[other(first)]];
}

function other(index: 0 | 1): 0 | 1 {
  return index === 0 ? 1 : 0;
}
