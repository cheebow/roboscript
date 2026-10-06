/**
 * The functions that come with the language, used inside a value or a
 * condition: abs(x), min(a, b), max(a, b), sqrt(x) and random(a, b). A
 * function of the program's own with the same name comes first, so a program
 * that defined its own abs before there was one runs as it did.
 *
 * Every answer is a number, as in the rest of the language: the square root
 * of a negative number is 0, as dividing by 0 gives 0. There are no sin, cos,
 * exp or log: browsers may differ in their last digits, and a shared match
 * must play out the same everywhere.
 */
export interface Builtin {
  name: string;
  /** The names of its values, for the help and the editor's hints. */
  params: readonly string[];
  /** The answer; `random` gives numbers in [0, 1) from the robot's own stream. */
  apply(values: readonly number[], random: () => number): number;
}

const LIST: readonly Builtin[] = [
  { name: 'abs', params: ['x'], apply: ([x]) => Math.abs(x) },
  { name: 'min', params: ['a', 'b'], apply: ([a, b]) => Math.min(a, b) },
  { name: 'max', params: ['a', 'b'], apply: ([a, b]) => Math.max(a, b) },
  { name: 'sqrt', params: ['x'], apply: ([x]) => (x < 0 ? 0 : Math.sqrt(x)) },
  { name: 'random', params: ['a', 'b'], apply: ([a, b], random) => randomWhole(a, b, random()) },
];

export const BUILTINS: ReadonlyMap<string, Builtin> = new Map(LIST.map((builtin) => [builtin.name, builtin]));

export function isBuiltin(name: string): boolean {
  return BUILTINS.has(name);
}

/**
 * A whole number from a to b, both included, in either order: the ends are
 * rounded inwards, so random(0.5, 3.7) is 1, 2 or 3. With no whole number
 * between them, a rounded; with no end at all (an infinity), 0.
 */
function randomWhole(a: number, b: number, draw: number): number {
  const low = Math.ceil(Math.min(a, b));
  const high = Math.floor(Math.max(a, b));
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 0;
  if (high < low) return Math.round(a);
  return low + Math.floor(draw * (high - low + 1));
}
