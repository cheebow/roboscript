import { describe, expect, it } from 'vitest';
import { PARTS, SLOTS, STANDARD_LOADOUT, partsOf } from '../src/data/parts';
import { PART_PATTERNS, PATTERN_COLORS, PATTERN_SIZE, overlay, patternsOf } from '../src/view/sprites';

/** The hull every robot was drawn with before robots had parts. */
const FORMER_HULL = [
  '................',
  '.tttttttttttt...',
  '.TtTtTtTtTtTt...',
  '.tttttttttttt...',
  '..dbbbbbbbbd....',
  '..bbbbbbbbbbl...',
  '..bbbbbbbbbbl...',
  '..bbbbbbbbbbl...',
  '..bbbbbbbbbbl...',
  '..bbbbbbbbbbl...',
  '..bbbbbbbbbbl...',
  '..dbbbbbbbbd....',
  '.tttttttttttt...',
  '.TtTtTtTtTtTt...',
  '.tttttttttttt...',
  '................',
];

/** And the turret. */
const FORMER_TURRET = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......dddd......',
  '......dccdggggg.',
  '......dccdggggg.',
  '......dddd......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const ALL_PATTERNS = SLOTS.flatMap((slot) =>
  Object.entries(PART_PATTERNS[slot]).map(([id, pattern]) => ({ name: `${slot} ${id}`, pattern })),
);

describe('the pictures of the parts', () => {
  it('exist for every part, and for nothing else', () => {
    for (const slot of SLOTS) {
      const ids = partsOf(slot).map((part) => part.id);
      expect(Object.keys(PART_PATTERNS[slot]).sort()).toEqual([...ids].sort());
    }
    expect(ALL_PATTERNS).toHaveLength(PARTS.length);
  });

  it('are as wide and as high as a robot', () => {
    for (const { name, pattern } of ALL_PATTERNS) {
      expect(pattern, name).toHaveLength(PATTERN_SIZE);
      for (const row of pattern) expect(row, name).toHaveLength(PATTERN_SIZE);
    }
  });

  it('use only the colours of the palette', () => {
    const known = new Set(['.', ...Object.keys(PATTERN_COLORS)]);
    for (const { name, pattern } of ALL_PATTERNS) {
      for (const dot of pattern.join('')) expect(known.has(dot), `"${dot}" in ${name}`).toBe(true);
    }
  });

  it('are the same on both sides of the robot', () => {
    for (const { name, pattern } of ALL_PATTERNS) expect([...pattern].reverse(), name).toEqual(pattern);
  });

  it('differ from part to part in a slot', () => {
    for (const slot of SLOTS) {
      const pictures = Object.values(PART_PATTERNS[slot]).map((pattern) => pattern.join('\n'));
      expect(new Set(pictures).size).toBe(pictures.length);
    }
  });

  it('show something of every part on a robot that carries it', () => {
    // No part may be wholly covered by the standard parts drawn over it.
    for (const part of PARTS) {
      const loadout = { ...STANDARD_LOADOUT, [part.slot]: part.id };
      const { hull, turret } = patternsOf(loadout);
      const picture = [...hull, ...turret].join('\n');
      const others = PARTS.filter((other) => other.slot === part.slot && other.id !== part.id).map((other) => {
        const drawn = patternsOf({ ...STANDARD_LOADOUT, [other.slot]: other.id });
        return [...drawn.hull, ...drawn.turret].join('\n');
      });
      expect(others, `${part.slot} ${part.name}`).not.toContain(picture);
    }
  });
});

describe('overlay', () => {
  it('lays later patterns over earlier ones, dot by dot', () => {
    const { legs, body } = PART_PATTERNS;
    const drawn = overlay([legs.standard, body.heavy]);
    // The armour of the heavy body covers the inner row of the tracks.
    expect(drawn[3]).toBe(body.heavy[3]);
    expect(drawn[2]).toBe(legs.standard[2]);
  });
});

describe('a robot of standard parts', () => {
  it('is drawn as every robot was before, with a sensor on it', () => {
    const { legs, body, sensor } = PART_PATTERNS;
    expect(overlay([legs.standard, body.standard])).toEqual(FORMER_HULL);
    expect(patternsOf(STANDARD_LOADOUT).turret).toEqual(FORMER_TURRET);
    expect(patternsOf(STANDARD_LOADOUT).hull).toEqual(overlay([FORMER_HULL, sensor.standard]));
  });
});

describe('patternsOf', () => {
  it('refuses a part there is no picture of', () => {
    expect(() => patternsOf({ ...STANDARD_LOADOUT, gun: 'laser' })).toThrow('No picture of the gun part "laser"');
  });
});

describe('the tread animation', () => {
  it('gives every kind of legs a second frame, and leaves the rest of the robot still', async () => {
    const { PART_PATTERNS, patternsOf } = await import('../src/view/sprites');
    const { STANDARD_LOADOUT } = await import('../src/data/parts');
    for (const legs of Object.keys(PART_PATTERNS.legs)) {
      const { hull, hullMoving, turret } = patternsOf({ ...STANDARD_LOADOUT, legs });
      expect(hullMoving, legs).not.toEqual(hull);
      // Only tread dots change between the frames: everything else stays put.
      hull.forEach((row, y) => {
        [...row].forEach((dot, x) => {
          const other = hullMoving[y][x];
          if (dot === other) return;
          expect('tT', `${legs} ${x},${y}`).toContain(dot);
          expect('tT', `${legs} ${x},${y}`).toContain(other);
        });
      });
      expect(patternsOf({ ...STANDARD_LOADOUT, legs }).turret).toEqual(turret);
    }
  });
});
