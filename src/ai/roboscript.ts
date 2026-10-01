import { MATCH_DEFAULTS } from '../data/match_defaults';
import type { RobotBrain } from '../sim/ai_context';
import { parse } from './parser';
import { ScriptBrain } from './runtime';
import type { ScriptError } from './script_error';

export type CompileResult = { ok: true; brain: RobotBrain } | { ok: false; errors: ScriptError[] };

/**
 * Turns RoboScript source into a brain, or lists why it cannot be run. The
 * brain keeps the program's place and variables, so each match needs a fresh one.
 */
export function compileScript(source: string, lineBudget: number = MATCH_DEFAULTS.lineBudget): CompileResult {
  const { program, errors } = parse(source);
  if (program === null) return { ok: false, errors };
  return { ok: true, brain: new ScriptBrain(program, lineBudget) };
}
