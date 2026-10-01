import type { RobotBrain } from '../sim/ai_context';
import { parse } from './parser';
import { ScriptBrain } from './runtime';
import type { ScriptError } from './script_error';

export type CompileResult = { ok: true; brain: RobotBrain } | { ok: false; errors: ScriptError[] };

/** Turns RoboScript source into a brain, or lists why it cannot be run. */
export function compileScript(source: string): CompileResult {
  const { program, errors } = parse(source);
  if (program === null) return { ok: false, errors };
  return { ok: true, brain: new ScriptBrain(program) };
}
