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

/** A robot seen from above, facing right: two treads, the hull, a hatch and the gun barrel. */
const ROBOT_PATTERN = [
  '................',
  '.tttttttttttt...',
  '.TtTtTtTtTtTt...',
  '.tttttttttttt...',
  '..dbbbbbbbbd....',
  '..bbbbbbbbbbl...',
  '..bbbddddbbbl...',
  '..bbbdccdgggggg.',
  '..bbbdccdgggggg.',
  '..bbbddddbbbl...',
  '..bbbbbbbbbbl...',
  '..dbbbbbbbbd....',
  '.tttttttttttt...',
  '.TtTtTtTtTtTt...',
  '.tttttttttttt...',
  '................',
];

/** Paints the robot pattern, one canvas pixel per dot. Draw it scaled by DOT, without smoothing. */
export function createRobotSprite(palette: RobotPalette): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = ROBOT_PATTERN[0].length;
  sprite.height = ROBOT_PATTERN.length;
  const context = sprite.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context is not available');

  ROBOT_PATTERN.forEach((row, y) => {
    [...row].forEach((character, x) => {
      const color = PATTERN_COLORS[character];
      if (color === undefined) return;
      context.fillStyle = palette[color];
      context.fillRect(x, y, 1, 1);
    });
  });
  return sprite;
}
