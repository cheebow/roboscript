import type { Program } from './ast';
import { walk } from './walk';

/**
 * Which function each line of the program belongs to: the line of its `def`
 * and every line of its body. Lines of the main program are not in the map.
 */
export function functionLines(program: Program): Map<number, string> {
  const owners = new Map<number, string>();
  for (const [name, definition] of program.functions) {
    owners.set(definition.line, name);
    walk(definition.body, {
      statement(statement) {
        owners.set(statement.line, name);
        if (statement.kind === 'if' && statement.elseLine !== null) owners.set(statement.elseLine, name);
      },
    });
  }
  return owners;
}
