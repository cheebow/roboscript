import { t } from '../i18n/messages';
import { MAX_TEAM_SIZE } from '../data/castle';
import { type Loadout, readLoadout } from '../data/parts';
import type { KeyValueStorage } from './project_store';

/** A robot kept under a name: its program and its parts. */
export interface SavedRobot {
  name: string;
  source: string;
  loadout: Loadout;
}

/** A team of the castle match kept under a name: its one program and the parts of each of its machines. */
export interface SavedTeam {
  name: string;
  source: string;
  /** One loadout per machine, 1 to MAX_TEAM_SIZE of them. */
  loadouts: Loadout[];
}

/** The team in data read from elsewhere; null when there is none. Parts it does not know are the standard ones. */
export function readSavedTeam(value: unknown): SavedTeam | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name, source, loadouts } = value as Record<string, unknown>;
  if (typeof name !== 'string' || typeof source !== 'string') return null;
  if (!Array.isArray(loadouts) || loadouts.length < 1) return null;
  return { name, source, loadouts: loadouts.slice(0, MAX_TEAM_SIZE).map(readLoadout) };
}

/** A copy of the team that does not change when the team does. */
export function copyTeam(team: SavedTeam): SavedTeam {
  return { name: team.name, source: team.source, loadouts: team.loadouts.map((loadout) => ({ ...loadout })) };
}

/** The robot in data read from elsewhere (storage, a share code, a file); null when there is none. Parts it does not know are the standard ones. */
export function readSavedRobot(value: unknown): SavedRobot | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name, source, loadout } = value as Record<string, unknown>;
  if (typeof name !== 'string' || typeof source !== 'string') return null;
  return { name, source, loadout: readLoadout(loadout) };
}

/** A copy of the robot that does not change when the robot does. */
export function copyRobot(robot: SavedRobot): SavedRobot {
  return { name: robot.name, source: robot.source, loadout: { ...robot.loadout } };
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
    this.write([...others, copyRobot(robot)]);
    return replaced;
  }

  /**
   * Keeps a robot received from elsewhere, under its own name if that is free,
   * otherwise under the name with a number ("Striker (2)"). A name that will
   * not do is replaced by "Shared". Returns the name it is kept under.
   */
  importRobot(robot: SavedRobot): string {
    const taken = new Set(this.list().map((saved) => saved.name));
    const base = garageName(robot.name) ?? t('garage.sharedName');
    let name = base;
    for (let n = 2; taken.has(name); n++) {
      const suffix = ` (${n})`;
      name = `${base.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
    }
    this.save({ name, source: robot.source, loadout: { ...robot.loadout } });
    return name;
  }

  /** Does nothing when no robot is kept under the name. */
  remove(name: string): void {
    const robots = this.list();
    const others = robots.filter((robot) => robot.name !== name);
    if (others.length < robots.length) this.write(others);
  }

  /** The saved teams of the castle match, under names of their own, apart from the robots'. */
  listTeams(): SavedTeam[] {
    const entries = this.raw()?.teams;
    const teams = new Map<string, SavedTeam>();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const team = readSavedTeam(entry);
      if (team !== null && garageName(team.name) === team.name && !teams.has(team.name)) teams.set(team.name, team);
    }
    return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  findTeam(name: string): SavedTeam | undefined {
    return this.listTeams().find((team) => team.name === name);
  }

  /** Keeps the team under its name, in place of any team kept under that name before. Returns whether there was one. */
  saveTeam(team: SavedTeam): boolean {
    if (garageName(team.name) !== team.name) throw new Error(`"${team.name}" is not a name a team can be kept under`);
    const others = this.listTeams().filter((other) => other.name !== team.name);
    const replaced = others.length < this.listTeams().length;
    this.writeTeams([...others, copyTeam(team)]);
    return replaced;
  }

  /** Keeps a team received from elsewhere, numbering its name if that is taken, as importRobot does. Returns the name it is kept under. */
  importTeam(team: SavedTeam): string {
    const taken = new Set(this.listTeams().map((saved) => saved.name));
    const base = garageName(team.name) ?? t('garage.sharedName');
    let name = base;
    for (let n = 2; taken.has(name); n++) {
      const suffix = ` (${n})`;
      name = `${base.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
    }
    this.saveTeam({ ...copyTeam(team), name });
    return name;
  }

  /** Does nothing when no team is kept under the name. */
  removeTeam(name: string): void {
    const teams = this.listTeams();
    const others = teams.filter((team) => team.name !== name);
    if (others.length < teams.length) this.writeTeams(others);
  }

  /** What is saved, as parsed JSON; null when nothing readable is. */
  private raw(): Record<string, unknown> | null {
    const text = this.storage.getItem(GARAGE_KEY);
    if (text === null) return null;
    try {
      const saved: unknown = JSON.parse(text);
      return isRecord(saved) ? saved : null;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return null;
    }
  }

  private write(robots: readonly SavedRobot[]): void {
    // The teams kept alongside stay as they are, and the other way round.
    this.storage.setItem(GARAGE_KEY, JSON.stringify({ version: VERSION, robots, teams: this.raw()?.teams ?? [] }));
  }

  private writeTeams(teams: readonly SavedTeam[]): void {
    this.storage.setItem(GARAGE_KEY, JSON.stringify({ version: VERSION, robots: this.raw()?.robots ?? [], teams }));
  }
}

/** A robot kept in the garage: one under a name it could not be saved under is left out. */
function readRobot(value: unknown): SavedRobot | null {
  const robot = readSavedRobot(value);
  return robot !== null && garageName(robot.name) === robot.name ? robot : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
