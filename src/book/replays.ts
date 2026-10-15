import type { ProgramFeatures } from '../ai/features';
import { compileScript } from '../ai/roboscript';
import { type MatchAnalysis, analyze } from '../arena/analysis';
import { scatterSpawns } from '../arena/spawns';
import { ARENAS } from '../data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, ROBOT_IDS } from '../data/match_defaults';
import { STANDARD_LOADOUT, statsOf } from '../data/parts';
import { findTemplate } from '../data/templates';
import { type Recording, recordMatch } from '../debug/recorder';
import type { Replay } from './types';

// The book's whole matches, played as the program screen plays them: the
// same arena with the robots started where the seed puts them, ALPHA's
// program against a built-in robot, standard parts. So the reader who plays
// the match in the game, with that seed, sees what the book shows.

export interface ReplayedMatch {
  recording: Recording;
  /** What each robot's program has to do with, for the marks the debugger draws. */
  features: readonly ProgramFeatures[];
}

const played = new Map<string, ReplayedMatch>();

/** The program of BRAVO, a built-in robot. */
function bravoSource(replay: Replay): string {
  const template = findTemplate(replay.bravo);
  if (template === undefined) throw new Error(`The book names a built-in robot there is not: ${replay.bravo}`);
  return template.source;
}

/** Plays the match, once: the book shows one match in several places. */
export function playReplay(replay: Replay): ReplayedMatch {
  const key = JSON.stringify(replay);
  const known = played.get(key);
  if (known !== undefined) return known;
  const arena = ARENAS.find((each) => each.id === replay.arena);
  if (arena === undefined) throw new Error(`The book names a map there is not: ${replay.arena}`);
  const compiled = [replay.program, bravoSource(replay)].map((source) => {
    const result = compileScript(source);
    if (!result.ok) throw new Error(`A program of the book does not compile: ${result.errors[0]?.message}`);
    return result;
  });
  const recording = recordMatch(
    {
      arena: scatterSpawns(arena.arena, replay.seed),
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: replay.seed,
      robots: ROBOT_IDS.map((id, index) => ({ id, brain: compiled[index].brain, stats: statsOf(STANDARD_LOADOUT) })),
    },
    EFFECT_LIFETIMES,
  );
  const match = { recording, features: compiled.map((result) => result.features) };
  played.set(key, match);
  return match;
}

/** The game's analysis of the match, the robots named as the program screen names them. */
export function analyzeReplay(replay: Replay): MatchAnalysis {
  return analyze(playReplay(replay).recording, [...ROBOT_IDS]);
}
