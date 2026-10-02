import type { ConditionNode, Expression, Program, StatementNode } from './ast';

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
  for (const statement of bodies.flat()) noteStatement(statement, used);
  const usesAny = (words: readonly string[]) => words.some((word) => used.has(word));
  return {
    cover: usesAny([...COVER_SENSORS, 'turn cover']),
    bullets: usesAny(BULLET_SENSORS),
    lead: usesAny(['lead_angle', 'aim lead']),
  };
}

/** Adds the sensors the statement reads, and the ways it turns and aims (as "turn cover", "aim lead"), to `used`. */
function noteStatement(statement: StatementNode, used: Set<string>): void {
  switch (statement.kind) {
    case 'if':
      noteCondition(statement.condition, used);
      for (const inner of [...statement.thenBody, ...statement.elseBody]) noteStatement(inner, used);
      return;
    case 'while':
      noteCondition(statement.condition, used);
      for (const inner of statement.body) noteStatement(inner, used);
      return;
    case 'loop':
      for (const inner of statement.body) noteStatement(inner, used);
      return;
    case 'set':
      noteExpression(statement.value, used);
      return;
    case 'call':
      for (const argument of statement.args) noteExpression(argument, used);
      return;
    case 'return':
      if (statement.value !== null) noteExpression(statement.value, used);
      return;
    case 'turn':
    case 'aim':
      used.add(`${statement.kind} ${statement.direction}`);
      return;
    default:
      return;
  }
}

function noteCondition(condition: ConditionNode, used: Set<string>): void {
  switch (condition.kind) {
    case 'boolean_variable':
      used.add(condition.name);
      return;
    case 'comparison':
      noteExpression(condition.left, used);
      noteExpression(condition.right, used);
      return;
    case 'not':
      noteCondition(condition.operand, used);
      return;
    case 'and':
    case 'or':
      noteCondition(condition.left, used);
      noteCondition(condition.right, used);
      return;
  }
}

function noteExpression(expression: Expression, used: Set<string>): void {
  switch (expression.kind) {
    case 'sensor':
      used.add(expression.name);
      return;
    case 'negate':
      noteExpression(expression.operand, used);
      return;
    case 'arithmetic':
      noteExpression(expression.left, used);
      noteExpression(expression.right, used);
      return;
    case 'call':
      for (const argument of expression.args) noteExpression(argument, used);
      return;
    default:
      return;
  }
}
