import type { ProgramFeatures } from '../ai/features';
import { compileScript } from '../ai/roboscript';
import type { ScriptError } from '../ai/script_error';
import { robotIdOf } from '../arena/castle_match';
import { MATCH_DEFAULTS, ROBOT_IDS } from '../data/match_defaults';
import { type Loadout, STANDARD_LOADOUT, statsOf } from '../data/parts';
import type { SimulationConfig } from '../sim/simulation';
import { type Stage, stageTeams } from './types';

/** sec: long enough for any step, short enough not to wait long for a program that does not get there. */
export const TUTORIAL_MATCH_TIME = 60;

/** A step's match, ready to record: the player's program as ALPHA, the training robot as BRAVO, where the stage puts them. */
export interface TutorialMatch {
  config: Omit<SimulationConfig, 'logger'>;
  loadouts: Loadout[];
  features: ProgramFeatures[];
}

/** The match of a stage with the player's program; the errors of the program when it has any. */
export function tutorialMatch(
  stage: Stage,
  source: string,
  loadout: Loadout = STANDARD_LOADOUT,
  matchTime: number = TUTORIAL_MATCH_TIME,
): { ok: true; match: TutorialMatch } | { ok: false; errors: ScriptError[] } {
  const player = compileScript(source);
  if (!player.ok) return { ok: false, errors: player.errors };
  const bot = compileScript(stage.bot);
  if (!bot.ok) throw new Error(`The training robot does not compile: ${bot.errors[0]?.message}`);
  if (stage.teamSize !== undefined) return { ok: true, match: teamMatch(stage, stage.teamSize, source, loadout, player.features, bot.features, matchTime) };
  const loadouts = [loadout, { ...STANDARD_LOADOUT, ...stage.botLoadout }];
  return {
    ok: true,
    match: {
      config: {
        // Exactly where the stage puts them: the step is written for those places.
        arena: stage.arena,
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: matchTime,
        seed: stage.seed,
        robots: [
          { id: ROBOT_IDS[0], brain: player.brain, stats: statsOf(loadouts[0]) },
          { id: ROBOT_IDS[1], brain: bot.brain, stats: statsOf(loadouts[1]) },
        ],
      },
      loadouts,
      features: [player.features, bot.features],
    },
  };
}

/**
 * A castle-match stage: the player's program on every machine of team 0, the
 * bot's on every machine of team 1. Each machine gets its own copy of its
 * program, and every machine of a side carries that side's parts.
 */
function teamMatch(
  stage: Stage,
  teamSize: number,
  source: string,
  loadout: Loadout,
  playerFeatures: ProgramFeatures,
  botFeatures: ProgramFeatures,
  matchTime: number,
): TutorialMatch {
  const botLoadout = { ...STANDARD_LOADOUT, ...stage.botLoadout };
  const loadouts = [...Array.from({ length: teamSize }, () => loadout), ...Array.from({ length: teamSize }, () => botLoadout)];
  const robots = loadouts.map((machineLoadout, index) => {
    const team = Math.floor(index / teamSize);
    const compiled = compileScript(team === 0 ? source : stage.bot);
    if (!compiled.ok) throw new Error('A program that compiled once does not compile again');
    return {
      id: robotIdOf(ROBOT_IDS[team], teamSize, (index % teamSize) + 1),
      brain: compiled.brain,
      stats: statsOf(machineLoadout),
    };
  });
  return {
    config: {
      arena: stage.arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: matchTime,
      seed: stage.seed,
      robots,
      teams: stageTeams(stage),
      bases: stage.bases,
    },
    loadouts,
    features: loadouts.map((_, index) => (index < teamSize ? playerFeatures : botFeatures)),
  };
}
