import { readLoadout } from '../data/parts';
import { LEAGUE_MAX } from '../arena/league';
import type { SavedRobot } from './garage';

export const CONTEST_KEY = 'roboscript/contest.json';

/** Where a robot on the contest's list came from: a share code, the built-in ones, or the player's garage. */
export type ContestOrigin = 'code' | 'built-in' | 'garage';

/** A robot on the list of a contest: a copy of it as it was added, so that it fights as it was even if its source changes. */
export interface ContestEntry {
  robot: SavedRobot;
  origin: ContestOrigin;
}

const ORIGINS: readonly ContestOrigin[] = ['code', 'built-in', 'garage'];

/** The list kept in storage; whatever of it cannot be read is left out. */
export function readContest(text: string | null): ContestEntry[] {
  if (text === null) return [];
  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return [];
  }
  const entries = typeof saved === 'object' && saved !== null && Array.isArray((saved as { entries?: unknown }).entries)
    ? (saved as { entries: unknown[] }).entries
    : [];
  const list: ContestEntry[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { robot, origin } = entry as Record<string, unknown>;
    if (typeof robot !== 'object' || robot === null) continue;
    const { name, source, loadout } = robot as Record<string, unknown>;
    if (typeof name !== 'string' || typeof source !== 'string') continue;
    if (typeof origin !== 'string' || !(ORIGINS as readonly string[]).includes(origin)) continue;
    list.push({ robot: { name, source, loadout: readLoadout(loadout) }, origin: origin as ContestOrigin });
    if (list.length === LEAGUE_MAX) break;
  }
  return list;
}

export function writeContest(list: readonly ContestEntry[]): string {
  return JSON.stringify({ version: 1, entries: list });
}

/** The list with the robot added at the end; refused when the list is full. */
export function addEntry(list: readonly ContestEntry[], entry: ContestEntry): { ok: true; list: ContestEntry[] } | { ok: false } {
  if (list.length >= LEAGUE_MAX) return { ok: false };
  return { ok: true, list: [...list, { robot: { ...entry.robot, loadout: { ...entry.robot.loadout } }, origin: entry.origin }] };
}

/** The list without the robot at the index. */
export function removeEntry(list: readonly ContestEntry[], index: number): ContestEntry[] {
  return list.filter((_, at) => at !== index);
}
