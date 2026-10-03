import { AGGRESSIVE_BOT } from './aggressive_bot';
import { COVER_BOT } from './cover_bot';
import { COWARD_BOT } from './coward_bot';
import { DUMB_BOT } from './dumb_bot';
import { GUARD_BOT } from './guard_bot';
import { SAMPLE_AI } from './sample';
import { SENTRY_BOT } from './sentry_bot';
import { STRAFE_BOT } from './strafe_bot';

/** A ready-made RoboScript program that can be loaded into either robot's editor. It is the same program wherever it is loaded. */
export interface Template {
  /** Stable identifier. */
  id: string;
  /** Name shown to the player. */
  name: string;
  source: string;
}

export const TEMPLATES: readonly Template[] = [
  { id: 'sample', name: 'Sample', source: SAMPLE_AI },
  { id: 'dumb_bot', name: 'DumbBot', source: DUMB_BOT },
  { id: 'aggressive_bot', name: 'AggressiveBot', source: AGGRESSIVE_BOT },
  { id: 'coward_bot', name: 'CowardBot', source: COWARD_BOT },
  { id: 'guard_bot', name: 'GuardBot', source: GUARD_BOT },
  { id: 'cover_bot', name: 'CoverBot', source: COVER_BOT },
  { id: 'strafe_bot', name: 'StrafeBot', source: STRAFE_BOT },
  { id: 'sentry_bot', name: 'SentryBot', source: SENTRY_BOT },
];

/** What each robot's editor holds until the player writes or loads something else, in spawn order. */
export const DEFAULT_TEMPLATES: readonly Template[] = [TEMPLATES[0], TEMPLATES[1]];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
