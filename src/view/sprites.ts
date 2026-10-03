import type { Loadout, Slot } from '../data/parts';

/** One dot of a sprite covers this many arena units. */
export const DOT = 2;

export interface RobotPalette {
  body: string;
  shade: string;
  light: string;
  gun: string;
  hatch: string;
  tread: string;
  treadLight: string;
  sensor: string;
}

const TREAD = '#2b3238';
const TREAD_LIGHT = '#48525b';
const GUN = '#b9c2c9';
const SENSOR = '#e8f4ff';

/** One palette per robot, in spawn order: the player first. */
export const ROBOT_PALETTES: readonly RobotPalette[] = [
  {
    body: '#6fb7a8',
    shade: '#4d8a7d',
    light: '#9fd6c9',
    gun: GUN,
    hatch: '#1c2a28',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  {
    body: '#d49a6a',
    shade: '#a8744a',
    light: '#ecc19c',
    gun: GUN,
    hatch: '#2e2118',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  // The third and fourth robots of a battle royale.
  {
    body: '#9a8fd6',
    shade: '#7166ad',
    light: '#c3bbef',
    gun: GUN,
    hatch: '#221e33',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  {
    body: '#d6c86a',
    shade: '#a99c45',
    light: '#eee39c',
    gun: GUN,
    hatch: '#2e2a14',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  // Further colours, for the boards of leagues and tournaments of up to eight robots.
  {
    body: '#d6707a',
    shade: '#a84c56',
    light: '#efa3aa',
    gun: GUN,
    hatch: '#2e1418',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  {
    body: '#6a9fd6',
    shade: '#4776a8',
    light: '#a3c6ef',
    gun: GUN,
    hatch: '#14202e',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  {
    body: '#d68cc4',
    shade: '#a8659a',
    light: '#efbde3',
    gun: GUN,
    hatch: '#2e1429',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
  {
    body: '#9cc76a',
    shade: '#739945',
    light: '#c6e3a3',
    gun: GUN,
    hatch: '#1e2a14',
    tread: TREAD,
    treadLight: TREAD_LIGHT,
    sensor: SENSOR,
  },
];

export const WRECK_PALETTE: RobotPalette = {
  body: '#4a5158',
  shade: '#3a4046',
  light: '#5a626a',
  gun: '#4a5158',
  hatch: '#22272b',
  tread: '#262b30',
  treadLight: '#30363c',
  sensor: '#5a626a',
};

/** The palette of the robot at the given spawn index. */
export function paletteOf(robotIndex: number): RobotPalette {
  return ROBOT_PALETTES[robotIndex % ROBOT_PALETTES.length];
}

/** Which palette colour each character of a pattern stands for; '.' is transparent. */
export const PATTERN_COLORS: Record<string, keyof RobotPalette> = {
  b: 'body',
  d: 'shade',
  l: 'light',
  g: 'gun',
  c: 'hatch',
  t: 'tread',
  T: 'treadLight',
  s: 'sensor',
};

/** Rows of dots, seen from above with the robot facing right. */
export type Pattern = readonly string[];

/** Patterns are this many dots wide and high: the robot's diameter. */
export const PATTERN_SIZE = 16;

const NONE = '................';

/** A part looks the same on either side of the robot, so only its upper half is written out. */
function mirrored(upperHalf: readonly string[]): Pattern {
  return [...upperHalf, ...[...upperHalf].reverse()];
}

/**
 * What each part looks like, by slot and part id. The legs, the body and the
 * sensor lie on the hull, one over the other in that order; the gun is the
 * turret, which turns about the middle of its pattern.
 */
export const PART_PATTERNS: Record<Slot, Record<string, Pattern>> = {
  legs: {
    // Three wheels a side.
    sprint: mirrored([NONE, '.ttt..ttt..ttt..', '.tTt..tTt..tTt..', '.ttt..ttt..ttt..', NONE, NONE, NONE, NONE]),
    standard: mirrored([NONE, '.tttttttttttt...', '.TtTtTtTtTtTt...', '.tttttttttttt...', NONE, NONE, NONE, NONE]),
    // Short, wide tracks.
    pivot: mirrored([
      '...tttttttt.....',
      '...TtTtTtTt.....',
      '...tTtTtTtT.....',
      '...tttttttt.....',
      NONE,
      NONE,
      NONE,
      NONE,
    ]),
  },
  body: {
    // Slim, with a pointed nose.
    light: mirrored([
      NONE,
      NONE,
      NONE,
      NONE,
      '....dbbbbd......',
      '....bbbbbbbl....',
      '....bbbbbbbbl...',
      '....bbbbbbbbbl..',
    ]),
    standard: mirrored([
      NONE,
      NONE,
      NONE,
      NONE,
      '..dbbbbbbbbd....',
      '..bbbbbbbbbbl...',
      '..bbbbbbbbbbl...',
      '..bbbbbbbbbbl...',
    ]),
    // Armour plates that reach out over the legs.
    heavy: mirrored([
      NONE,
      NONE,
      NONE,
      '.dddddddddddd...',
      '.dbbbbbbbbbbdl..',
      '.bbbbbbbbbbbbl..',
      '.bbdbbbbbbdbbl..',
      '.bbbbbbbbbbbbl..',
    ]),
  },
  gun: {
    // A short barrel.
    pistol: mirrored([NONE, NONE, NONE, NONE, NONE, NONE, '......dddd......', '......dccdggg...']),
    // Two thin barrels.
    rapid: mirrored([NONE, NONE, NONE, NONE, NONE, NONE, '......ddddgggg..', '......dccd......']),
    standard: mirrored([NONE, NONE, NONE, NONE, NONE, NONE, '......dddd......', '......dccdggggg.']),
    // A big turret and a long barrel with a muzzle brake.
    cannon: mirrored([NONE, NONE, NONE, NONE, NONE, '.....dddddd.....', '.....dccccd...gg', '.....dccccdggggg']),
  },
  sensor: {
    // A stub of an aerial at the back.
    short: mirrored([NONE, NONE, NONE, NONE, NONE, NONE, NONE, '...s............']),
    // A dish at the back.
    standard: mirrored([NONE, NONE, NONE, NONE, NONE, NONE, NONE, '...ss...........']),
    // A lens on each front corner.
    scope: mirrored([NONE, NONE, NONE, NONE, NONE, '...........s....', NONE, NONE]),
  },
};

/** The patterns laid one over the other, the last on top. */
export function overlay(patterns: readonly Pattern[]): Pattern {
  return Array.from({ length: PATTERN_SIZE }, (_, y) =>
    Array.from({ length: PATTERN_SIZE }, (_, x) => {
      const dots = patterns.map((pattern) => pattern[y][x]).filter((dot) => dot !== '.');
      return dots.at(-1) ?? '.';
    }).join(''),
  );
}

function patternOf(loadout: Loadout, slot: Slot): Pattern {
  const pattern = PART_PATTERNS[slot][loadout[slot]];
  if (pattern === undefined) throw new Error(`No picture of the ${slot} part "${loadout[slot]}"`);
  return pattern;
}

/** What a robot with the given parts is drawn from: its hull, and the turret on it. */
export function patternsOf(loadout: Loadout): { hull: Pattern; turret: Pattern } {
  return {
    hull: overlay([patternOf(loadout, 'legs'), patternOf(loadout, 'body'), patternOf(loadout, 'sensor')]),
    turret: patternOf(loadout, 'gun'),
  };
}

/** The two parts a robot is drawn from, each turned its own way. */
export interface RobotSprites {
  hull: HTMLCanvasElement;
  turret: HTMLCanvasElement;
}

/** Paints a robot with the given parts, one canvas pixel per dot. Draw the sprites scaled by DOT, without smoothing. */
export function createRobotSprites(palette: RobotPalette, loadout: Loadout): RobotSprites {
  const { hull, turret } = patternsOf(loadout);
  return { hull: paint(hull, palette), turret: paint(turret, palette) };
}

function paint(pattern: Pattern, palette: RobotPalette): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = pattern[0].length;
  sprite.height = pattern.length;
  const context = sprite.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context is not available');

  pattern.forEach((row, y) => {
    [...row].forEach((character, x) => {
      const color = PATTERN_COLORS[character];
      if (color === undefined) return;
      context.fillStyle = palette[color];
      context.fillRect(x, y, 1, 1);
    });
  });
  return sprite;
}
