import { describe, expect, it } from 'vitest';
import {
  BRAVO_BOT_KEY,
  DEFAULT_PROJECT,
  type KeyValueStorage,
  MAIN_BOT_KEY,
  PROJECT_INFO_KEY,
  ProjectStore,
} from '../src/project/project_store';

const PLAYER = 0;
const ENEMY = 1;
const DEFAULT_SOURCE = 'turn right\n';
const DEFAULT_ENEMY_SOURCE = 'turn left\n';
const DEFAULT_SOURCES = [DEFAULT_SOURCE, DEFAULT_ENEMY_SOURCE];

class MemoryStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function createStore() {
  const storage = new MemoryStorage();
  return { storage, store: new ProjectStore(storage, DEFAULT_SOURCES) };
}

describe('ProjectStore', () => {
  it('loads the default source of each robot when nothing was saved', () => {
    const { store } = createStore();
    expect(store.loadSource(PLAYER)).toBe(DEFAULT_SOURCE);
    expect(store.loadSource(ENEMY)).toBe(DEFAULT_ENEMY_SOURCE);
  });

  it('loads what was saved, separately for each robot', () => {
    const { store } = createStore();
    store.saveSource(PLAYER, 'fire\n');
    expect(store.loadSource(PLAYER)).toBe('fire\n');
    expect(store.loadSource(ENEMY)).toBe(DEFAULT_ENEMY_SOURCE);

    store.saveSource(ENEMY, 'wait\n');
    expect(store.loadSource(PLAYER)).toBe('fire\n');
    expect(store.loadSource(ENEMY)).toBe('wait\n');
  });

  it('keeps an emptied file empty instead of restoring the default', () => {
    const { store } = createStore();
    store.saveSource(PLAYER, '');
    expect(store.loadSource(PLAYER)).toBe('');
  });

  it('saves in the project layout', () => {
    const { storage, store } = createStore();
    store.saveSource(PLAYER, 'fire\n');
    store.saveSource(ENEMY, 'wait\n');
    expect(storage.items.get(MAIN_BOT_KEY)).toBe('fire\n');
    expect(storage.items.get(BRAVO_BOT_KEY)).toBe('wait\n');
    expect(JSON.parse(storage.items.get(PROJECT_INFO_KEY) ?? '')).toEqual({ name: 'ALPHA', version: 1 });
  });

  it('refuses a robot it keeps no program for', () => {
    expect(() => createStore().store.loadSource(2)).toThrow('No program is kept for robot 2');
  });

  it('reads the saved project info', () => {
    const { storage, store } = createStore();
    storage.setItem(PROJECT_INFO_KEY, JSON.stringify({ name: 'OMEGA', version: 1 }));
    expect(store.loadInfo()).toEqual({ name: 'OMEGA', version: 1 });
  });

  it('falls back to the default project when project.json is missing or unreadable', () => {
    const { storage, store } = createStore();
    expect(store.loadInfo()).toEqual(DEFAULT_PROJECT);

    storage.setItem(PROJECT_INFO_KEY, '{not json');
    expect(store.loadInfo()).toEqual(DEFAULT_PROJECT);

    storage.setItem(PROJECT_INFO_KEY, JSON.stringify({ name: 42 }));
    expect(store.loadInfo()).toEqual(DEFAULT_PROJECT);
  });

  it('remembers the chosen arena, also across saving the source', () => {
    const { store } = createStore();
    expect(store.loadInfo().arena).toBeUndefined();

    store.saveArena('open_field');
    store.saveSource(PLAYER, 'fire\n');
    expect(store.loadInfo()).toEqual({ name: 'ALPHA', version: 1, arena: 'open_field' });
  });

  it('still reads a project saved when the enemy was picked from a list', () => {
    const { storage, store } = createStore();
    storage.setItem(PROJECT_INFO_KEY, JSON.stringify({ name: 'ALPHA', version: 1, enemy: 'coward_bot' }));
    expect(store.loadInfo().name).toBe('ALPHA');
  });

  it('lets storage failures reach the caller', () => {
    const failing: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => new ProjectStore(failing, DEFAULT_SOURCES).saveSource(PLAYER, 'fire')).toThrow('quota exceeded');
  });
});
