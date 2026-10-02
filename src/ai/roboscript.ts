import { MATCH_DEFAULTS } from '../data/match_defaults';
import type { RobotBrain } from '../sim/ai_context';
import { usesCover } from './features';
import { parse } from './parser';
import { ScriptBrain } from './runtime';
import type { ScriptError } from './script_error';

export type CompileResult =
  /** `usesCover`: the program reads a cover sensor or turns towards cover. */
  { ok: true; brain: RobotBrain; usesCover: boolean } | { ok: false; errors: ScriptError[] };

/**
 * Turns RoboScript source into a brain, or lists why it cannot be run. The
 * brain keeps the program's place and variables, so each match needs a fresh one.
 */
export function compileScript(source: string, lineBudget: number = MATCH_DEFAULTS.lineBudget): CompileResult {
  const { program, errors } = parse(source);
  if (program === null) return { ok: false, errors };
  return { ok: true, brain: new ScriptBrain(program, lineBudget), usesCover: usesCover(program) };
}
