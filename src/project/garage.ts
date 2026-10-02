import { type Loadout, readLoadout } from '../data/parts';
import { type StartSide, readStartSide } from '../sim/mirror';
import type { KeyValueStorage } from './project_store';

/** A robot kept under a name: its program and its parts. */
export interface SavedRobot {
  name: string;
  source: string;
  loadout: Loadout;
  /** The side of the arena its program was written for. Sent in from the other side, it is run in a mirror. */
  side: StartSide;
}

export const GARAGE_KEY = 'roboscript/garage.json';
export const MAX_NAME_LENGTH = 16;
const VERSION = 1;

/** The name as a robot is kept under it: without spaces around it. Null when nothing is left of it, or when it is too long. */
export function garageName(text: string): string | null {
  const name = text.trim();
  return name.length === 0 || name.length > MAX_NAME_LENGTH ? null : name;
}

/** The player's saved robots, each under a name of its own. Storage failures are thrown to the caller. */
export class Garage {
  constructor(private readonly storage: KeyValueStorage) {}

  /** The saved robots in the order of their names. Whatever of the saved data cannot be read is left out. */
  list(): SavedRobot[] {
    const text = this.storage.getItem(GARAGE_KEY);
    if (text === null) return [];
    let saved: unknown;
    try {
      saved = JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return [];
    }
    const entries = isRecord(saved) && Array.isArray(saved.robots) ? saved.robots : [];
    const robots = new Map<string, SavedRobot>();
    for (const entry of entries) {
      const robot = readRobot(entry);
      // Of two robots under one name, the first is the one that counts.
      if (robot !== null && !robots.has(robot.name)) robots.set(robot.name, robot);
    }
    return [...robots.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  find(name: string): SavedRobot | undefined {
    return this.list().find((robot) => robot.name === name);
  }

  /** Keeps the robot under its name, in place of any robot kept under that name before. Returns whether there was one. */
  save(robot: SavedRobot): boolean {
    if (garageName(robot.name) !== robot.name) throw new Error(`"${robot.name}" is not a name a robot can be kept under`);
    const others = this.list().filter((other) => other.name !== robot.name);
    const replaced = others.length < this.list().length;
    this.write([...others, { ...robot, loadout: { ...robot.loadout } }]);
    return replaced;
  }

  /** Does nothing when no robot is kept under the name. */
  remove(name: string): void {
    const robots = this.list();
    const others = robots.filter((robot) => robot.name !== name);
    if (others.length < robots.length) this.write(others);
  }

  private write(robots: readonly SavedRobot[]): void {
    this.storage.setItem(GARAGE_KEY, JSON.stringify({ version: VERSION, robots }));
  }
}

function readRobot(value: unknown): SavedRobot | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.source !== 'string') return null;
  if (garageName(value.name) !== value.name) return null;
  // Robots saved before sides were kept were written for the first one.
  return { name: value.name, source: value.source, loadout: readLoadout(value.loadout), side: readStartSide(value.side) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
