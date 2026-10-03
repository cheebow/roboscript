import type { ProgramFeatures } from '../ai/features';
import { compileScript } from '../ai/roboscript';
import type { ScriptError } from '../ai/script_error';
import { MATCH_DEFAULTS, ROBOT_IDS } from '../data/match_defaults';
import { type Loadout, STANDARD_LOADOUT, statsOf } from '../data/parts';
import type { SimulationConfig } from '../sim/simulation';
import type { Stage } from './types';

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
): { ok: true; match: TutorialMatch } | { ok: false; errors: ScriptError[] } {
  const player = compileScript(source);
  if (!player.ok) return { ok: false, errors: player.errors };
  const bot = compileScript(stage.bot);
  if (!bot.ok) throw new Error(`The training robot does not compile: ${bot.errors[0]?.message}`);
  const loadouts = [loadout, { ...STANDARD_LOADOUT, ...stage.botLoadout }];
  return {
    ok: true,
    match: {
      config: {
        // Exactly where the stage puts them: the step is written for those places.
        arena: stage.arena,
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: TUTORIAL_MATCH_TIME,
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
