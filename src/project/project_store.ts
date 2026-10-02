import { type Loadout, readLoadout } from '../data/parts';

/** The part of the Web Storage API the store needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProjectInfo {
  name: string;
  version: number;
  /** Id of the arena the player chose; absent until they choose one. */
  arena?: string;
  /** The parts of each robot, in spawn order; absent until the player changes a part. */
  loadouts?: unknown[];
}

export const DEFAULT_PROJECT: ProjectInfo = { name: 'ALPHA', version: 1 };

// Keys mirror the project layout in SPEC §43: projects/alpha/{project.json, main.bot}.
const PROJECT_DIRECTORY = 'roboscript/projects/alpha';
// Where the project was kept under the app's earlier name. It is read when nothing is saved under the present one.
const EARLIER_DIRECTORY = 'robograming/projects/alpha';
export const PROJECT_INFO_KEY = `${PROJECT_DIRECTORY}/project.json`;
export const MAIN_BOT_KEY = `${PROJECT_DIRECTORY}/main.bot`;
export const BRAVO_BOT_KEY = `${PROJECT_DIRECTORY}/bravo.bot`;
/** Where each robot's program is kept, in spawn order: the player's first. */
const SOURCE_KEYS = [MAIN_BOT_KEY, BRAVO_BOT_KEY];

/** Saves and loads the player's project. Storage failures are thrown to the caller. */
export class ProjectStore {
  /** `defaultSources` are what each robot starts with, in spawn order. */
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly defaultSources: readonly string[],
  ) {}

  /** The saved program of the robot at the given spawn index, or its default if nothing was saved yet. */
  loadSource(robotIndex: number): string {
    return this.read(sourceKey(robotIndex)) ?? this.defaultSources[robotIndex];
  }

  saveSource(robotIndex: number, source: string): void {
    this.saveInfo({});
    this.storage.setItem(sourceKey(robotIndex), source);
  }

  /** Remembers which arena the player chose. */
  saveArena(arenaId: string): void {
    this.saveInfo({ arena: arenaId });
  }

  /** The saved parts of the robot at the given spawn index; standard parts wherever nothing usable was saved. */
  loadLoadout(robotIndex: number): Loadout {
    return readLoadout(this.loadInfo().loadouts?.[robotIndex]);
  }

  saveLoadout(robotIndex: number, loadout: Loadout): void {
    const loadouts = [...(this.loadInfo().loadouts ?? [])];
    loadouts[robotIndex] = loadout;
    this.saveInfo({ loadouts });
  }

  /** The saved project.json, or the default project if it is missing or unreadable. */
  loadInfo(): ProjectInfo {
    const text = this.read(PROJECT_INFO_KEY);
    if (text === null) return DEFAULT_PROJECT;
    try {
      const value: unknown = JSON.parse(text);
      return isProjectInfo(value) ? value : DEFAULT_PROJECT;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return DEFAULT_PROJECT;
    }
  }

  private saveInfo(changes: Partial<ProjectInfo>): void {
    this.storage.setItem(PROJECT_INFO_KEY, JSON.stringify({ ...this.loadInfo(), ...changes }));
  }

  /** What is saved under the key, or else what was saved in its place under the app's earlier name. */
  private read(key: string): string | null {
    return this.storage.getItem(key) ?? this.storage.getItem(earlierKey(key));
  }
}

function sourceKey(robotIndex: number): string {
  const key = SOURCE_KEYS[robotIndex];
  if (key === undefined) throw new Error(`No program is kept for robot ${robotIndex}`);
  return key;
}

function earlierKey(key: string): string {
  return EARLIER_DIRECTORY + key.slice(PROJECT_DIRECTORY.length);
}

function isProjectInfo(value: unknown): value is ProjectInfo {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.arena !== undefined && typeof candidate.arena !== 'string') return false;
  if (candidate.loadouts !== undefined && !Array.isArray(candidate.loadouts)) return false;
  return typeof candidate.name === 'string' && typeof candidate.version === 'number';
}
