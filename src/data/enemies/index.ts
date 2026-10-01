import { AGGRESSIVE_BOT } from './aggressive_bot';
import { COWARD_BOT } from './coward_bot';
import { DUMB_BOT } from './dumb_bot';

export interface EnemyDefinition {
  /** Stable identifier, used when saving the player's choice. */
  id: string;
  /** Name shown to the player. */
  name: string;
  /** RoboScript source. */
  source: string;
}

export const ENEMIES: readonly EnemyDefinition[] = [
  { id: 'dumb_bot', name: 'DumbBot', source: DUMB_BOT },
  { id: 'aggressive_bot', name: 'AggressiveBot', source: AGGRESSIVE_BOT },
  { id: 'coward_bot', name: 'CowardBot', source: COWARD_BOT },
];

export const DEFAULT_ENEMY = ENEMIES[0];

/** The enemy with the given id, or the default enemy if there is none. */
export function findEnemy(id: string | null): EnemyDefinition {
  return ENEMIES.find((enemy) => enemy.id === id) ?? DEFAULT_ENEMY;
}
