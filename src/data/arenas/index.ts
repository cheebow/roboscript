import type { Arena, Base } from '../../sim/types';
import { BARE_GROUND } from './bare_ground';
import { BUNKERS } from './bunkers';
import { CASTLE_BASTION } from './castle_bastion';
import { castleBasesFor } from './castle_common';
import { CASTLE_LANES } from './castle_lanes';
import { CASTLE_PLAIN } from './castle_plain';
import { CENTER_BLOCK } from './center_block';
import { CORRIDOR } from './corridor';
import { CROSS } from './cross';
import { LONG_WALL } from './long_wall';
import { OPEN_FIELD } from './open_field';
import { PILLARS } from './pillars';
import { ZIGZAG } from './zigzag';

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
  { id: 'bare_ground', name: 'Bare Ground', arena: BARE_GROUND },
  { id: 'pillars', name: 'Pillars', arena: PILLARS },
  { id: 'corridor', name: 'Corridor', arena: CORRIDOR },
  { id: 'bunkers', name: 'Bunkers', arena: BUNKERS },
  { id: 'cross', name: 'Cross', arena: CROSS },
  { id: 'zigzag', name: 'Zigzag', arena: ZIGZAG },
];

/**
 * An arena for the castle match. The castles scale with the team size, so
 * they are asked for rather than carried. Kept apart from ARENAS: the duel
 * and battle royale pickers never offer these.
 */
export interface CastleArenaDefinition extends ArenaDefinition {
  basesFor: (teamSize: number) => Base[];
}

export const CASTLE_ARENAS: readonly CastleArenaDefinition[] = [
  { id: 'castle_plain', name: 'Castle Plain', arena: CASTLE_PLAIN, basesFor: castleBasesFor },
  { id: 'castle_lanes', name: 'Castle Lanes', arena: CASTLE_LANES, basesFor: castleBasesFor },
  { id: 'castle_bastion', name: 'Castle Bastion', arena: CASTLE_BASTION, basesFor: castleBasesFor },
];

export const DEFAULT_ARENA_DEFINITION = ARENAS[0];
/** The arena a new player starts in. */
export const DEFAULT_ARENA = DEFAULT_ARENA_DEFINITION.arena;

/** The arena with the given id, or the default arena if there is none. */
export function findArena(id: string | null): ArenaDefinition {
  return ARENAS.find((arena) => arena.id === id) ?? DEFAULT_ARENA_DEFINITION;
}
