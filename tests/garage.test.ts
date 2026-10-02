import { describe, expect, it } from 'vitest';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { GARAGE_KEY, Garage, MAX_NAME_LENGTH, type SavedRobot, garageName } from '../src/project/garage';
import type { KeyValueStorage } from '../src/project/project_store';

class MemoryStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function createGarage() {
  const storage = new MemoryStorage();
  return { storage, garage: new Garage(storage) };
}

function robot(name: string, changes: Partial<SavedRobot> = {}): SavedRobot {
  return { name, source: `label ${name.toUpperCase()}\n`, loadout: STANDARD_LOADOUT, ...changes };
}

const names = (garage: Garage) => garage.list().map((saved) => saved.name);

describe('Garage', () => {
  it('is empty until a robot is saved', () => {
    expect(createGarage().garage.list()).toEqual([]);
  });

  it('keeps the robots saved, in the order of their names', () => {
    const { garage } = createGarage();
    const tank = robot('Tank', { loadout: { ...STANDARD_LOADOUT, body: 'heavy', sensor: 'short' } });
    garage.save(tank);
    garage.save(robot('Striker'));
    garage.save(robot('alpha one'));
    expect(names(garage)).toEqual(['alpha one', 'Striker', 'Tank']);
    expect(garage.find('Tank')).toEqual(tank);
    expect(garage.find('Nobody')).toBeUndefined();
  });

  it('puts a robot in place of the one kept under its name, and says so', () => {
    const { garage } = createGarage();
    expect(garage.save(robot('Striker'))).toBe(false);
    expect(garage.save(robot('Tank'))).toBe(false);
    expect(garage.save(robot('Striker', { source: 'fire\n' }))).toBe(true);
    expect(names(garage)).toEqual(['Striker', 'Tank']);
    expect(garage.find('Striker')?.source).toBe('fire\n');
  });

  it('keeps what it was given, whatever becomes of the loadout afterwards', () => {
    const { garage } = createGarage();
    const loadout = { ...STANDARD_LOADOUT, gun: 'rapid' };
    garage.save(robot('Striker', { loadout }));
    loadout.gun = 'cannon';
    expect(garage.find('Striker')?.loadout.gun).toBe('rapid');
  });

  it('deletes a robot, and does nothing about a name it does not know', () => {
    const { garage, storage } = createGarage();
    garage.save(robot('Striker'));
    garage.save(robot('Tank'));
    garage.remove('Striker');
    expect(names(garage)).toEqual(['Tank']);

    const before = storage.items.get(GARAGE_KEY);
    garage.remove('Nobody');
    expect(storage.items.get(GARAGE_KEY)).toBe(before);
  });

  it('still has the robots when opened again', () => {
    const { garage, storage } = createGarage();
    garage.save(robot('Striker'));
    expect(names(new Garage(storage))).toEqual(['Striker']);
  });

  it('refuses a name a robot cannot be kept under', () => {
    const { garage } = createGarage();
    expect(() => garage.save(robot(' Striker'))).toThrow('not a name');
    expect(() => garage.save(robot(''))).toThrow('not a name');
    expect(garage.list()).toEqual([]);
  });

  it('is empty when what was saved cannot be read', () => {
    const { garage, storage } = createGarage();
    for (const saved of ['{not json', '[]', '{"robots": 7}', 'null']) {
      storage.setItem(GARAGE_KEY, saved);
      expect(garage.list()).toEqual([]);
    }
  });

  it('leaves out the saved robots it cannot read, and mends the parts of the others', () => {
    const { garage, storage } = createGarage();
    const robots = [
      { name: 'Striker', source: 'fire\n', loadout: { body: 'heavy', gun: 'laser' } },
      { name: 'No code' },
      { name: '', source: 'wait\n' },
      'nonsense',
      { name: 'Striker', source: 'wait\n' },
      { name: 'Bare', source: 'wait\n' },
    ];
    storage.setItem(GARAGE_KEY, JSON.stringify({ version: 1, robots }));
    expect(garage.list()).toEqual([
      { name: 'Bare', source: 'wait\n', loadout: STANDARD_LOADOUT },
      { name: 'Striker', source: 'fire\n', loadout: { ...STANDARD_LOADOUT, body: 'heavy' } },
    ]);
  });

  it('lets storage failures reach the caller', () => {
    const failing: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => new Garage(failing).save(robot('Striker'))).toThrow('quota exceeded');
  });
});

describe('garageName', () => {
  it('takes the spaces off both ends', () => {
    expect(garageName('  Striker ')).toBe('Striker');
    expect(garageName('Tank 01')).toBe('Tank 01');
  });

  it('refuses a name with nothing in it, or one that is too long', () => {
    expect(garageName('')).toBeNull();
    expect(garageName('   ')).toBeNull();
    expect(garageName('x'.repeat(MAX_NAME_LENGTH))).toBe('x'.repeat(MAX_NAME_LENGTH));
    expect(garageName('x'.repeat(MAX_NAME_LENGTH + 1))).toBeNull();
  });
});
