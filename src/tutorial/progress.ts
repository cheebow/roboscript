import { type Loadout, STANDARD_LOADOUT, readLoadout } from '../data/parts';
import type { KeyValueStorage } from '../project/project_store';

export const TUTORIAL_KEY = 'roboscript/tutorial.json';

/** How far the player has got: the step shown, the steps cleared, and the code of each step. */
export interface Progress {
  current: string | null;
  cleared: string[];
  code: Record<string, string>;
  /** ALPHA's parts, for the steps that let them be chosen. */
  loadout: Loadout;
}

/** What is kept, or a fresh start when nothing usable is. */
export function readProgress(text: string | null): Progress {
  const fresh: Progress = { current: null, cleared: [], code: {}, loadout: { ...STANDARD_LOADOUT } };
  if (text === null) return fresh;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return fresh;
    const { current, cleared, code, loadout } = value as Record<string, unknown>;
    return {
      current: typeof current === 'string' ? current : null,
      cleared: Array.isArray(cleared) ? cleared.filter((id): id is string => typeof id === 'string') : [],
      code:
        typeof code === 'object' && code !== null
          ? Object.fromEntries(Object.entries(code).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
          : {},
      loadout: readLoadout(loadout),
    };
  } catch {
    return fresh;
  }
}

/** Keeps the progress; storage failing only means it is not kept. */
export function writeProgress(storage: KeyValueStorage | null, progress: Progress): void {
  try {
    storage?.setItem(TUTORIAL_KEY, JSON.stringify({ version: 1, ...progress }));
  } catch {
    // Storage may be full or blocked: the tutorial still works until the page is left.
  }
}
