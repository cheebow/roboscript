/** The part of the Web Storage API the store needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProjectInfo {
  name: string;
  version: number;
  /** Id of the enemy the player chose to fight; absent until they choose one. */
  enemy?: string;
  /** Id of the arena the player chose; absent until they choose one. */
  arena?: string;
}

export const DEFAULT_PROJECT: ProjectInfo = { name: 'ALPHA', version: 1 };

// Keys mirror the project layout in SPEC §43: projects/alpha/{project.json, main.bot}.
const PROJECT_DIRECTORY = 'robograming/projects/alpha';
export const PROJECT_INFO_KEY = `${PROJECT_DIRECTORY}/project.json`;
export const MAIN_BOT_KEY = `${PROJECT_DIRECTORY}/main.bot`;

/** Saves and loads the player's project. Storage failures are thrown to the caller. */
export class ProjectStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly defaultSource: string,
  ) {}

  /** The saved main.bot, or the default source if nothing was saved yet. */
  loadSource(): string {
    return this.storage.getItem(MAIN_BOT_KEY) ?? this.defaultSource;
  }

  saveSource(source: string): void {
    this.storage.setItem(PROJECT_INFO_KEY, JSON.stringify(this.loadInfo()));
    this.storage.setItem(MAIN_BOT_KEY, source);
  }

  /** Remembers which enemy the player chose. */
  saveEnemy(enemyId: string): void {
    this.saveInfo({ enemy: enemyId });
  }

  /** Remembers which arena the player chose. */
  saveArena(arenaId: string): void {
    this.saveInfo({ arena: arenaId });
  }

  /** The saved project.json, or the default project if it is missing or unreadable. */
  loadInfo(): ProjectInfo {
    const text = this.storage.getItem(PROJECT_INFO_KEY);
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
}

function isProjectInfo(value: unknown): value is ProjectInfo {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.enemy !== undefined && typeof candidate.enemy !== 'string') return false;
  if (candidate.arena !== undefined && typeof candidate.arena !== 'string') return false;
  return typeof candidate.name === 'string' && typeof candidate.version === 'number';
}
