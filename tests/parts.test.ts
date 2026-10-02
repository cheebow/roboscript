import { describe, expect, it } from 'vitest';
import {
  COST_LIMIT,
  type Loadout,
  PARTS,
  SLOTS,
  STANDARD_LOADOUT,
  costOf,
  partIn,
  partsOf,
  readLoadout,
  statsOf,
} from '../src/data/parts';
import { ROBOT_DEFAULTS, type RobotStats } from '../src/data/robot_defaults';

/** The standard robot with the given parts swapped in. */
function fitted(parts: Partial<Loadout>): Loadout {
  return { ...STANDARD_LOADOUT, ...parts };
}

function allLoadouts(): Loadout[] {
  let loadouts: Loadout[] = [STANDARD_LOADOUT];
  for (const slot of SLOTS) {
    loadouts = loadouts.flatMap((loadout) => partsOf(slot).map((part) => ({ ...loadout, [slot]: part.id })));
  }
  return loadouts;
}

describe('parts', () => {
  it('make the robot every program was written for when all are standard', () => {
    expect(statsOf(STANDARD_LOADOUT)).toEqual(ROBOT_DEFAULTS);
  });

  it('cost exactly the limit when all are standard', () => {
    expect(costOf(STANDARD_LOADOUT)).toBe(COST_LIMIT);
  });

  it('offer a choice in every slot, the standard part among them', () => {
    for (const slot of SLOTS) {
      const ids = partsOf(slot).map((part) => part.id);
      expect(ids.length).toBeGreaterThan(1);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(STANDARD_LOADOUT[slot]);
    }
  });

  it('each change something about the robot', () => {
    for (const part of PARTS) {
      if (part.id === STANDARD_LOADOUT[part.slot]) continue;
      expect(statsOf(fitted({ [part.slot]: part.id })), `${part.slot} ${part.name}`).not.toEqual(ROBOT_DEFAULTS);
    }
  });

  it('leave the size of the robot and of its bullets, and how it guards, alone', () => {
    const fixed = ({ radius, bulletRadius, guardDamageFactor, maxGuards, guardRecovery }: RobotStats) => ({
      radius,
      bulletRadius,
      guardDamageFactor,
      maxGuards,
      guardRecovery,
    });
    for (const loadout of allLoadouts()) expect(fixed(statsOf(loadout))).toEqual(fixed(ROBOT_DEFAULTS));
  });

  it('give every robot stats it can fight with', () => {
    for (const loadout of allLoadouts()) {
      for (const [name, value] of Object.entries(statsOf(loadout))) {
        expect(value, `${name} of ${JSON.stringify(loadout)}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('statsOf', () => {
  it('takes each stat from the part that decides it', () => {
    const loadout = fitted({ legs: 'sprint', gun: 'cannon', sensor: 'scope' });
    const stats = statsOf(loadout);
    expect(stats).toMatchObject({
      ...partIn(loadout, 'legs').stats,
      ...partIn(loadout, 'gun').stats,
      ...partIn(loadout, 'sensor').stats,
    });
    expect(stats.maxHp).toBe(ROBOT_DEFAULTS.maxHp);
  });

  it('lets the body speed up or slow down whatever legs the robot has', () => {
    for (const body of ['light', 'heavy']) {
      for (const legs of partsOf('legs')) {
        const { scales } = partIn(fitted({ body }), 'body');
        const stats = statsOf(fitted({ body, legs: legs.id }));
        expect(stats.moveSpeed).toBeCloseTo((legs.stats.moveSpeed ?? 0) * (scales?.moveSpeed ?? 1));
        expect(stats.rotateSpeed).toBeCloseTo((legs.stats.rotateSpeed ?? 0) * (scales?.rotateSpeed ?? 1));
      }
    }
    expect(statsOf(fitted({ body: 'light' })).moveSpeed).toBeGreaterThan(ROBOT_DEFAULTS.moveSpeed);
    expect(statsOf(fitted({ body: 'heavy' })).moveSpeed).toBeLessThan(ROBOT_DEFAULTS.moveSpeed);
  });

  it('refuses a part that does not exist', () => {
    expect(() => statsOf(fitted({ gun: 'laser' }))).toThrow('No gun part "laser"');
  });
});

describe('costOf', () => {
  it('adds up the parts', () => {
    const loadout = fitted({ body: 'heavy', sensor: 'short' });
    const expected = SLOTS.reduce((sum, slot) => sum + partIn(loadout, slot).cost, 0);
    expect(costOf(loadout)).toBe(expected);
  });

  it('puts some loadouts over the limit and leaves others under it', () => {
    const costs = allLoadouts().map(costOf);
    expect(Math.max(...costs)).toBeGreaterThan(COST_LIMIT);
    expect(Math.min(...costs)).toBeLessThan(COST_LIMIT);
  });
});

describe('readLoadout', () => {
  it('keeps the parts that were saved', () => {
    const saved = fitted({ body: 'heavy', gun: 'rapid' });
    expect(readLoadout(saved)).toEqual(saved);
  });

  it('puts the standard part wherever nothing usable was saved', () => {
    expect(readLoadout({ body: 'heavy', legs: 'wings', gun: 3 })).toEqual(fitted({ body: 'heavy' }));
    // A part of another slot is no part of this one.
    expect(readLoadout({ body: 'cannon' })).toEqual(STANDARD_LOADOUT);
    for (const nothing of [undefined, null, 'heavy', 7, []]) expect(readLoadout(nothing)).toEqual(STANDARD_LOADOUT);
  });

  it('does not hand out the standard loadout itself', () => {
    expect(readLoadout(undefined)).not.toBe(STANDARD_LOADOUT);
  });
});
