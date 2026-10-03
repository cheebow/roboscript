import type { Program } from './ast';
import { walk } from './walk';

/** What a program has to do with: the things worth showing on the battle view while it is debugged. */
export interface ProgramFeatures {
  /** It reads a cover sensor or turns towards cover. */
  cover: boolean;
  /** It reads a sensor for incoming bullets. */
  bullets: boolean;
  /** It aims at where the enemy will be, or reads how far its gun is off that point. */
  lead: boolean;
}

const COVER_SENSORS = ['cover_visible', 'cover_distance', 'cover_angle'];
const BULLET_SENSORS = ['bullet_incoming', 'bullet_distance', 'bullet_angle'];

export function featuresOf(program: Program): ProgramFeatures {
  const used = new Set<string>();
  const bodies = [program.body, ...[...program.functions.values()].map((definition) => definition.body)];
  // The sensors the program reads, and the ways it turns and aims (as "turn cover", "aim lead").
  walk(bodies.flat(), {
    statement(statement) {
      if (statement.kind === 'turn' || statement.kind === 'aim') used.add(`${statement.kind} ${statement.direction}`);
      // Facing cover is turning to it, as far as the marks are concerned.
      if (statement.kind === 'face') used.add(`turn ${statement.target}`);
    },
    condition(condition) {
      if (condition.kind === 'boolean_variable') used.add(condition.name);
    },
    expression(expression) {
      if (expression.kind === 'sensor') used.add(expression.name);
    },
  });
  const usesAny = (words: readonly string[]) => words.some((word) => used.has(word));
  return {
    cover: usesAny([...COVER_SENSORS, 'turn cover']),
    bullets: usesAny(BULLET_SENSORS),
    lead: usesAny(['lead_angle', 'aim lead']),
  };
}
