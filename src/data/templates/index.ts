import { AGGRESSIVE_BOT } from './aggressive_bot';
import { COVER_BOT } from './cover_bot';
import { COWARD_BOT } from './coward_bot';
import { DUMB_BOT } from './dumb_bot';
import { GUARD_BOT } from './guard_bot';
import { SAMPLE_AI } from './sample';

/** A ready-made RoboScript program that can be loaded into either robot's editor. */
export interface Template {
  /** Stable identifier. */
  id: string;
  /** Name shown to the player. */
  name: string;
  /** RoboScript source as written for the player's robot: it turns left around obstacles. */
  source: string;
}

export const TEMPLATES: readonly Template[] = [
  { id: 'sample', name: 'Sample', source: SAMPLE_AI },
  { id: 'dumb_bot', name: 'DumbBot', source: DUMB_BOT },
  { id: 'aggressive_bot', name: 'AggressiveBot', source: AGGRESSIVE_BOT },
  { id: 'coward_bot', name: 'CowardBot', source: COWARD_BOT },
  { id: 'guard_bot', name: 'GuardBot', source: GUARD_BOT },
  { id: 'cover_bot', name: 'CoverBot', source: COVER_BOT },
];

/** What each robot's editor holds until the player writes or loads something else, in spawn order. */
export const DEFAULT_TEMPLATES: readonly Template[] = [TEMPLATES[0], TEMPLATES[1]];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

const TURN = /\bturn (left|right)\b/g;

/** Swaps `turn left` and `turn right` throughout a program. */
export function mirrorTurns(source: string): string {
  return source.replace(TURN, (_, side: string) => `turn ${side === 'left' ? 'right' : 'left'}`);
}

/**
 * The template's source for the robot at the given spawn index. The robots
 * start facing each other, so two that turn the same way around an obstacle
 * end up on opposite sides of it and never meet; the second robot therefore
 * gets the mirrored program.
 */
export function templateSource(template: Template, robotIndex: number): string {
  return robotIndex % 2 === 0 ? template.source : mirrorTurns(template.source);
}
