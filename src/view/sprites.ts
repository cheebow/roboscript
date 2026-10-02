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
}

const TREAD = '#2b3238';
const TREAD_LIGHT = '#48525b';
const GUN = '#b9c2c9';

/** One palette per robot, in spawn order: the player first. */
export const ROBOT_PALETTES: readonly RobotPalette[] = [
  { body: '#6fb7a8', shade: '#4d8a7d', light: '#9fd6c9', gun: GUN, hatch: '#1c2a28', tread: TREAD, treadLight: TREAD_LIGHT },
  { body: '#d49a6a', shade: '#a8744a', light: '#ecc19c', gun: GUN, hatch: '#2e2118', tread: TREAD, treadLight: TREAD_LIGHT },
];

export const WRECK_PALETTE: RobotPalette = {
  body: '#4a5158',
  shade: '#3a4046',
  light: '#5a626a',
  gun: '#4a5158',
  hatch: '#22272b',
  tread: '#262b30',
  treadLight: '#30363c',
};

/** Which palette colour each character of a pattern stands for; '.' is transparent. */
const PATTERN_COLORS: Record<string, keyof RobotPalette> = {
  b: 'body',
  d: 'shade',
  l: 'light',
  g: 'gun',
  c: 'hatch',
  t: 'tread',
  T: 'treadLight',
};

/** The hull of a robot seen from above, facing right: two treads and the body. */
const HULL_PATTERN = [
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

/** The turret, pointing right: the ring with its hatch, and the gun barrel. It turns about the middle of the pattern. */
const TURRET_PATTERN = [
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

/** The two parts a robot is drawn from, each turned its own way. */
export interface RobotSprites {
  hull: HTMLCanvasElement;
  turret: HTMLCanvasElement;
}

/** Paints the parts of a robot, one canvas pixel per dot. Draw them scaled by DOT, without smoothing. */
export function createRobotSprites(palette: RobotPalette): RobotSprites {
  return { hull: paint(HULL_PATTERN, palette), turret: paint(TURRET_PATTERN, palette) };
}

function paint(pattern: readonly string[], palette: RobotPalette): HTMLCanvasElement {
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
