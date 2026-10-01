import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT,
  type KeyValueStorage,
  MAIN_BOT_KEY,
  PROJECT_INFO_KEY,
  ProjectStore,
} from '../src/project/project_store';

const DEFAULT_SOURCE = 'turn right\n';

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
  return { storage, store: new ProjectStore(storage, DEFAULT_SOURCE) };
}

describe('ProjectStore', () => {
  it('loads the default source when nothing was saved', () => {
    expect(createStore().store.loadSource()).toBe(DEFAULT_SOURCE);
  });

  it('loads what was saved', () => {
    const { store } = createStore();
    store.saveSource('fire\n');
    expect(store.loadSource()).toBe('fire\n');
  });

  it('keeps an emptied file empty instead of restoring the default', () => {
    const { store } = createStore();
    store.saveSource('');
    expect(store.loadSource()).toBe('');
  });

  it('saves in the project layout', () => {
    const { storage, store } = createStore();
    store.saveSource('fire\n');
    expect(storage.items.get(MAIN_BOT_KEY)).toBe('fire\n');
    expect(JSON.parse(storage.items.get(PROJECT_INFO_KEY) ?? '')).toEqual({ name: 'ALPHA', version: 1 });
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

  it('remembers the chosen enemy, also across saving the source', () => {
    const { store } = createStore();
    expect(store.loadInfo().enemy).toBeUndefined();

    store.saveEnemy('coward_bot');
    store.saveSource('fire\n');
    expect(store.loadInfo()).toEqual({ name: 'ALPHA', version: 1, enemy: 'coward_bot' });
  });

  it('remembers the chosen arena alongside the chosen enemy', () => {
    const { store } = createStore();
    store.saveEnemy('coward_bot');
    store.saveArena('open_field');
    expect(store.loadInfo()).toEqual({ name: 'ALPHA', version: 1, enemy: 'coward_bot', arena: 'open_field' });
  });

  it('lets storage failures reach the caller', () => {
    const failing: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => new ProjectStore(failing, DEFAULT_SOURCE).saveSource('fire')).toThrow('quota exceeded');
  });
});
