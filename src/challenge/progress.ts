import { type Loadout, STANDARD_LOADOUT, readLoadout } from '../data/parts';
import type { KeyValueStorage } from '../project/project_store';

export const CHALLENGES_KEY = 'roboscript/challenges.json';

/** The best a challenge was cleared with: its stars, and the record of that try. */
export interface Best {
  stars: number;
  lines: number;
  seconds: number;
  hp: number;
}

/** The challenge shown, the code of each, the best of each cleared, and ALPHA's parts. */
export interface ChallengeProgress {
  current: string | null;
  code: Record<string, string>;
  best: Record<string, Best>;
  loadout: Loadout;
}

/** What is kept, or a fresh start when nothing usable is. */
export function readChallengeProgress(text: string | null): ChallengeProgress {
  const fresh: ChallengeProgress = { current: null, code: {}, best: {}, loadout: { ...STANDARD_LOADOUT } };
  if (text === null) return fresh;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return fresh;
    const { current, code, best, loadout } = value as Record<string, unknown>;
    return {
      current: typeof current === 'string' ? current : null,
      code: isRecord(code) ? Object.fromEntries(Object.entries(code).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {},
      best: isRecord(best) ? Object.fromEntries(Object.entries(best).flatMap(([id, each]) => (isBest(each) ? [[id, each]] : []))) : {},
      loadout: readLoadout(loadout),
    };
  } catch {
    return fresh;
  }
}

/** Keeps the progress; storage failing only means it is not kept. */
export function writeChallengeProgress(storage: KeyValueStorage | null, progress: ChallengeProgress): void {
  try {
    storage?.setItem(CHALLENGES_KEY, JSON.stringify({ version: 1, ...progress }));
  } catch {
    // Storage may be full or blocked: the challenges still work until the page is left.
  }
}

/** The better of two tries: more stars; with as many, more HP left, then quicker. */
export function better(best: Best | undefined, next: Best): Best {
  if (best === undefined) return next;
  if (next.stars !== best.stars) return next.stars > best.stars ? next : best;
  if (next.hp !== best.hp) return next.hp > best.hp ? next : best;
  return next.seconds < best.seconds ? next : best;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBest(value: unknown): value is Best {
  if (!isRecord(value)) return false;
  const { stars, lines, seconds, hp } = value;
  return [stars, lines, seconds, hp].every((number) => typeof number === 'number' && Number.isFinite(number)) && (stars as number) >= 1 && (stars as number) <= 3;
}
