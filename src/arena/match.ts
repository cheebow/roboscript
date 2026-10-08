import type { ProgramFeatures } from '../ai/features';
import { t } from '../i18n/messages';
import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { COST_LIMIT, type Loadout, STANDARD_LOADOUT, costOf, statsOf } from '../data/parts';
import { TEMPLATES } from '../data/templates';
import type { SavedRobot } from '../project/garage';
import type { RobotBrain } from '../sim/ai_context';
import type { SeriesResult } from '../sim/series';
import { type MatchEndReason, Simulation, type SimulationConfig } from '../sim/simulation';
import type { Arena } from '../sim/types';
import { CORNER_SPAWNS } from '../data/arenas/common';
import { MatchRng } from '../sim/rng';
import { scatterSpawns } from './spawns';

/** Keeps the corners a battle royale starts in from following the same numbers as its shots. */
const CORNER_SALT = 0xc0e4;

/** A robot that can be sent into the arena. */
export interface Entrant {
  /** Tells the entrants apart: a built-in robot and a saved one may have the same name. */
  id: string;
  name: string;
  /** Where it comes from: the garage, the built-in robots, or the program screen's editors as they are now. */
  origin: 'editor' | 'garage' | 'built-in';
  loadout: Loadout;
  /** Its program, run as it is wherever it starts. */
  source: string;
}

/** The templates as robots of standard parts. */
export function builtInEntrants(): Entrant[] {
  return TEMPLATES.map((template) => ({
    id: `built-in:${template.id}`,
    name: template.name,
    origin: 'built-in',
    loadout: STANDARD_LOADOUT,
    source: template.source,
  }));
}

/** The saved robots. */
export function garageEntrants(robots: readonly SavedRobot[]): Entrant[] {
  return robots.map((robot) => ({
    id: `garage:${robot.name}`,
    name: robot.name,
    origin: 'garage',
    loadout: robot.loadout,
    source: robot.source,
  }));
}

/** A match between two entrants, ready to be played. */
export interface Fight {
  /** What the robots are called in the match, in spawn order. */
  names: string[];
  loadouts: Loadout[];
  /** What each program has to do with, in spawn order: which marks to draw for it. */
  features: ProgramFeatures[];
  config: Omit<SimulationConfig, 'logger'>;
}

/** What keeps the entrants from fighting, one line for each thing wrong. */
export interface Refusal {
  ok: false;
  problems: string[];
}

/** The most robots a battle royale takes: one in each corner. */
export const MAX_ENTRANTS = CORNER_SPAWNS.length;

/** The names the entrants fight under: entrants of the same name are numbered from the second on, "Striker (2)". */
export function fightNames(entrants: readonly Entrant[]): string[] {
  const seen = new Map<string, number>();
  return entrants.map(({ name }) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}

/**
 * The arena as a match of that many robots uses it: two start where the
 * arena puts them, moved by the seed (scatterSpawns); more start in corners,
 * which the seed picks and hands out.
 */
export function arenaFor(arena: Arena, seed: number, count: number): Arena {
  if (count <= 2) return scatterSpawns(arena, seed);
  const rng = new MatchRng(seed ^ CORNER_SALT);
  const corners = [...CORNER_SPAWNS];
  for (let index = corners.length - 1; index > 0; index--) {
    const other = Math.floor(rng.next() * (index + 1));
    [corners[index], corners[other]] = [corners[other], corners[index]];
  }
  return { ...arena, spawns: corners.slice(0, count) };
}

/**
 * Sets up a match between the entrants (two, or up to four for a battle
 * royale), the first at the first spawn point. Where in the arena they start
 * goes by the seed, so that matches with different seeds are different
 * matches. Refused when a program does not compile or a robot's parts cost
 * more than the limit.
 */
export function prepareFight(
  entrants: readonly Entrant[],
  arena: Arena,
  seed: number,
): { ok: true; fight: Fight } | Refusal {
  const names = fightNames(entrants);
  const problems: string[] = [];
  const brains: RobotBrain[] = [];
  const features: ProgramFeatures[] = [];
  entrants.forEach((entrant, spawnIndex) => {
    const cost = costOf(entrant.loadout);
    if (cost > COST_LIMIT) problems.push(t('arena.costOverLimit', { robot: names[spawnIndex], cost, limit: COST_LIMIT }));
    const compiled = compileScript(entrant.source);
    if (compiled.ok) {
      brains.push(compiled.brain);
      features.push(compiled.features);
    } else {
      problems.push(...compiled.errors.map((error) => t('arena.problem', { robot: names[spawnIndex], problem: formatError(error) })));
    }
  });
  if (problems.length > 0) return { ok: false, problems };

  const loadouts = entrants.map((entrant) => entrant.loadout);
  return {
    ok: true,
    fight: {
      names,
      loadouts,
      features,
      config: {
        arena: arenaFor(arena, seed, entrants.length),
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
        seed,
        robots: names.map((id, index) => ({ id, brain: brains[index], stats: statsOf(loadouts[index]) })),
      },
    },
  };
}

/** How a match between two entrants went, by their places in the list. */
export interface PlayedFixture {
  /** The index of the entrant that won; null for a draw. */
  winner: number | null;
  reason: MatchEndReason;
  ticks: number;
  /** HP each had left at the end, the one that started first first. */
  hpLeft: [number, number];
}

/** Plays one match, entrant `first` at the first spawn point. Refused when either cannot fight. */
export function playFixture(
  entrants: readonly Entrant[],
  first: number,
  second: number,
  arena: Arena,
  seed: number,
): { ok: true; played: PlayedFixture } | Refusal {
  const prepared = prepareFight([entrants[first], entrants[second]], arena, seed);
  if (!prepared.ok) return prepared;
  const simulation = new Simulation(prepared.fight.config);
  while (simulation.result === null) simulation.step();
  const { winnerId, reason } = simulation.result;
  // Named as they fight, "Striker (2)": the robot at the first spawn point is the entrant `first`.
  const winner = winnerId === null ? null : winnerId === prepared.fight.names[0] ? first : second;
  const [firstRobot, secondRobot] = simulation.robots;
  return { ok: true, played: { winner, reason, ticks: simulation.tick, hpLeft: [firstRobot.hp, secondRobot.hp] } };
}

/**
 * A long run of matches, played one step at a time, so a screen can breathe
 * (and say how far it is) between the steps. `result` may only be read once
 * every step came back ok.
 */
export interface SteppedPlay<Result> {
  /** How many steps there are. */
  readonly count: number;
  /** Plays step `index`; the refusal when it cannot be played. */
  step(index: number): { ok: true } | Refusal;
  /** The result of all the steps. */
  result(): Result;
}

/** Plays every step at once: for a caller that does not need to breathe. */
export function playAllSteps<Result>(play: SteppedPlay<Result>): ({ ok: true } & Result) | Refusal {
  for (let index = 0; index < play.count; index++) {
    const stepped = play.step(index);
    if (!stepped.ok) return stepped;
  }
  return { ok: true, ...play.result() };
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

/** The series between two entrants, one fixture a step. */
export function arenaSeriesSteps(
  entrants: readonly [Entrant, Entrant],
  fixtures: readonly SeriesFixture[],
): SteppedPlay<{ names: [string, string]; matches: SeriesMatch[]; result: SeriesResult }> {
  const matches: SeriesMatch[] = [];
  const result: SeriesResult = {
    matches: 0,
    wins: [0, 0],
    draws: 0,
    reasons: { destroyed: 0, timeout: 0, 'out of ammo': 0, 'base destroyed': 0 },
  };
  return {
    count: fixtures.length,
    step(index) {
      const { arena, seed, first } = fixtures[index];
      const fought = playFixture(entrants, first, other(first), arena, seed);
      if (!fought.ok) return fought;
      const { reason, ticks } = fought.played;
      const winner = fought.played.winner as 0 | 1 | null;
      matches.push({ winner, reason, ticks });
      result.matches++;
      result.reasons[reason]++;
      if (winner === null) result.draws++;
      else result.wins[winner]++;
      return { ok: true };
    },
    result() {
      const [firstName, secondName] = fightNames(entrants);
      return { names: [firstName, secondName], matches, result };
    },
  };
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
  return playAllSteps(arenaSeriesSteps(entrants, fixtures));
}

/** How a battle royale series went: each match's places by entrant, and how often each entrant came in each place. */
export interface RoyaleSeriesResult {
  names: string[];
  /** Per match: each entrant's place (1 the winner), by the entrant's index. */
  places: number[][];
  ticks: number[];
  /** Per entrant: how many times it came first, second, and so on. */
  counts: number[][];
}

/** The series of three or four entrants, one fixture a step. */
export function royaleSeriesSteps(
  entrants: readonly Entrant[],
  fixtures: readonly { arena: Arena; seed: number }[],
): SteppedPlay<RoyaleSeriesResult> {
  const names = fightNames(entrants);
  const places: number[][] = [];
  const ticks: number[] = [];
  const counts = entrants.map(() => entrants.map(() => 0));
  return {
    count: fixtures.length,
    step(index) {
      const { arena, seed } = fixtures[index];
      const prepared = prepareFight(entrants, arena, seed);
      if (!prepared.ok) return prepared;
      const simulation = new Simulation(prepared.fight.config);
      while (simulation.result === null) simulation.step();
      const { result } = simulation;
      const placed = prepared.fight.names.map((name) => result.places[name] ?? entrants.length);
      placed.forEach((place, entrant) => counts[entrant][place - 1]++);
      places.push(placed);
      ticks.push(simulation.tick);
      return { ok: true };
    },
    result() {
      return { names, places, ticks, counts };
    },
  };
}

/** Plays three or four entrants against each other match after match, in each fixture's arena with its seed. */
export function playRoyaleSeries(
  entrants: readonly Entrant[],
  fixtures: readonly { arena: Arena; seed: number }[],
): ({ ok: true } & RoyaleSeriesResult) | Refusal {
  return playAllSteps(royaleSeriesSteps(entrants, fixtures));
}

/** The two entrants with the given one first. */
export function inOrder(entrants: readonly [Entrant, Entrant], first: 0 | 1): [Entrant, Entrant] {
  return [entrants[first], entrants[other(first)]];
}

function other(index: 0 | 1): 0 | 1 {
  return index === 0 ? 1 : 0;
}
