import type { Arena } from '../../sim/types';
import { CENTER_BLOCK } from './center_block';
import { LONG_WALL } from './long_wall';
import { OPEN_FIELD } from './open_field';

export interface ArenaDefinition {
  /** Stable identifier, used when saving the player's choice. */
  id: string;
  /** Name shown to the player. */
  name: string;
  arena: Arena;
}

export const ARENAS: readonly ArenaDefinition[] = [
  { id: 'center_block', name: 'Center Block', arena: CENTER_BLOCK },
  { id: 'open_field', name: 'Open Field', arena: OPEN_FIELD },
  { id: 'long_wall', name: 'Long Wall', arena: LONG_WALL },
];

export const DEFAULT_ARENA_DEFINITION = ARENAS[0];
/** The arena a new player starts in. */
export const DEFAULT_ARENA = DEFAULT_ARENA_DEFINITION.arena;

/** The arena with the given id, or the default arena if there is none. */
export function findArena(id: string | null): ArenaDefinition {
  return ARENAS.find((arena) => arena.id === id) ?? DEFAULT_ARENA_DEFINITION;
}
