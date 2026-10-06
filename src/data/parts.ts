import { ROBOT_DEFAULTS, type RobotStats } from './robot_defaults';

/** The places on a robot that take a part, in the order they are shown. */
export const SLOTS = ['body', 'legs', 'gun', 'sensor'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Part {
  /** Stable identifier, used when saving a robot's parts. Unique within its slot. */
  id: string;
  slot: Slot;
  /** Name shown to the player. */
  name: string;
  /** What the part takes out of the robot's cost limit. */
  cost: number;
  /** What the part is good and bad at, shown to the player. */
  summary: string;
  /** The stats the part decides. */
  stats: Partial<RobotStats>;
  /** Stats decided by other parts that this one multiplies. */
  scales?: Partial<Record<keyof RobotStats, number>>;
}

/** Which part a robot carries in each slot, by part id. */
export type Loadout = Record<Slot, string>;

/** The most the parts of one robot may cost together. */
export const COST_LIMIT = 12;

const STANDARD = 'standard';
const {
  maxHp,
  moveSpeed,
  rotateSpeed,
  turretSpeed,
  sensorRange,
  sensorAngle,
  weaponRange,
  shotDamage,
  shotSpeed,
  shotCooldown,
  shotSpread,
  movingShotSpread,
  maxAmmo,
} = ROBOT_DEFAULTS;

// The standard part of every slot carries the stats of ROBOT_DEFAULTS, so a
// robot of standard parts is the robot every program was written for.
export const PARTS: readonly Part[] = [
  {
    id: 'light',
    slot: 'body',
    name: 'Light',
    cost: 2,
    summary: 'Drives and turns faster. Less HP.',
    stats: { maxHp: 160 },
    scales: { moveSpeed: 1.2, rotateSpeed: 1.2 },
  },
  { id: STANDARD, slot: 'body', name: 'Standard', cost: 3, summary: 'Balanced.', stats: { maxHp } },
  {
    id: 'heavy',
    slot: 'body',
    name: 'Heavy',
    cost: 4,
    summary: 'More HP. Drives and turns slower.',
    stats: { maxHp: 220 },
    scales: { moveSpeed: 0.8, rotateSpeed: 0.8 },
  },

  {
    id: 'sprint',
    slot: 'legs',
    name: 'Sprint',
    cost: 3,
    summary: 'Fast in a straight line. Slow to turn.',
    stats: { moveSpeed: 135, rotateSpeed: 150 },
  },
  { id: STANDARD, slot: 'legs', name: 'Standard', cost: 3, summary: 'Balanced.', stats: { moveSpeed, rotateSpeed } },
  {
    id: 'pivot',
    slot: 'legs',
    name: 'Pivot',
    cost: 3,
    summary: 'Quick to turn. Slow in a straight line.',
    stats: { moveSpeed: 85, rotateSpeed: 260 },
  },
  {
    id: 'walker',
    slot: 'legs',
    name: 'Walker',
    cost: 3,
    summary: 'Slow, but shots fired on the move scatter far less.',
    stats: { moveSpeed: 70, rotateSpeed: 150 },
    scales: { movingShotSpread: 0.3 },
  },
  {
    id: 'hover',
    slot: 'legs',
    name: 'Hover',
    cost: 3,
    summary: 'Fast, and glides so smoothly that shots on the move scatter less. Cannot stop at once: it slides, and drifts after it turns.',
    stats: { moveSpeed: 150, rotateSpeed, slide: 0.7 },
    scales: { movingShotSpread: 0.6 },
  },

  {
    id: 'pistol',
    slot: 'gun',
    name: 'Pistol',
    cost: 2,
    summary: 'Short range, scattered shots, little ammo. Low cost.',
    stats: {
      shotDamage: 20,
      shotCooldown: 0.8,
      shotSpeed: 400,
      weaponRange: 300,
      shotSpread: 3,
      movingShotSpread: 15,
      maxAmmo: 40,
      turretSpeed: 270,
    },
  },
  {
    id: 'rapid',
    slot: 'gun',
    name: 'Rapid',
    cost: 3,
    summary: 'Fires often, with ammo to spare. Weak, scattered shots.',
    stats: {
      shotDamage: 9,
      shotCooldown: 0.3,
      shotSpeed: 450,
      weaponRange: 400,
      shotSpread: 3,
      movingShotSpread: 15,
      maxAmmo: 120,
      turretSpeed: 360,
    },
  },
  {
    id: STANDARD,
    slot: 'gun',
    name: 'Standard',
    cost: 3,
    summary: 'Balanced.',
    stats: { shotDamage, shotCooldown, shotSpeed, weaponRange, shotSpread, movingShotSpread, maxAmmo, turretSpeed },
  },
  {
    id: 'cannon',
    slot: 'gun',
    name: 'Cannon',
    cost: 4,
    summary: 'Heavy shots with a long range. Slow to reload and to turn, slow bullets, little ammo.',
    stats: {
      shotDamage: 45,
      shotCooldown: 1.5,
      shotSpeed: 300,
      weaponRange: 520,
      shotSpread: 1,
      movingShotSpread: 5,
      maxAmmo: 20,
      turretSpeed: 150,
    },
  },

  {
    id: 'short',
    slot: 'sensor',
    name: 'Short',
    cost: 2,
    summary: 'Sees all around, but not far. Low cost.',
    stats: { sensorRange: 300, sensorAngle: 360 },
  },
  {
    id: STANDARD,
    slot: 'sensor',
    name: 'Standard',
    cost: 3,
    summary: 'Sees far, all around.',
    stats: { sensorRange, sensorAngle },
  },
  {
    id: 'scope',
    slot: 'sensor',
    name: 'Scope',
    cost: 2,
    summary: 'Sees far, but only ahead. Low cost.',
    stats: { sensorRange: 1200, sensorAngle: 120 },
  },
];

export const STANDARD_LOADOUT: Loadout = { body: STANDARD, legs: STANDARD, gun: STANDARD, sensor: STANDARD };

/** The parts a slot can take, in the order they are shown. */
export function partsOf(slot: Slot): readonly Part[] {
  return PARTS.filter((part) => part.slot === slot);
}

/** The part the loadout carries in the slot. */
export function partIn(loadout: Loadout, slot: Slot): Part {
  const part = PARTS.find((candidate) => candidate.slot === slot && candidate.id === loadout[slot]);
  if (part === undefined) throw new Error(`No ${slot} part "${loadout[slot]}"`);
  return part;
}

export function costOf(loadout: Loadout): number {
  return SLOTS.reduce((cost, slot) => cost + partIn(loadout, slot).cost, 0);
}

/** The stats of a robot that carries the given parts. */
export function statsOf(loadout: Loadout): RobotStats {
  const parts = SLOTS.map((slot) => partIn(loadout, slot));
  const stats: RobotStats = { ...ROBOT_DEFAULTS };
  for (const part of parts) Object.assign(stats, part.stats);
  for (const part of parts) {
    for (const [name, factor] of Object.entries(part.scales ?? {})) stats[name as keyof RobotStats] *= factor;
  }
  return stats;
}

/** A loadout out of saved data: any slot that does not name a part of its own gets the standard part. */
export function readLoadout(value: unknown): Loadout {
  const saved = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const loadout = { ...STANDARD_LOADOUT };
  for (const slot of SLOTS) {
    const id = saved[slot];
    if (partsOf(slot).some((part) => part.id === id)) loadout[slot] = id as string;
  }
  return loadout;
}
