import type { Loadout } from '../data/parts';
import { PATTERN_SIZE, type RobotPalette, createRobotSprites } from '../view/sprites';
import { createElement } from './dom';

/** A canvas for a picture of a robot, one pixel per dot of its sprites. Its styles enlarge it dot for dot. */
export function createRobotPreview(): HTMLCanvasElement {
  const canvas = createElement('canvas', 'robot-preview');
  canvas.width = PATTERN_SIZE;
  canvas.height = PATTERN_SIZE;
  return canvas;
}

/** Draws a robot with the given parts as the battle view draws it, facing right with its gun straight ahead. */
export function drawRobotPreview(canvas: HTMLCanvasElement, loadout: Loadout, palette: RobotPalette): void {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context is not available');
  const { hull, turret } = createRobotSprites(palette, loadout);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(hull, 0, 0);
  context.drawImage(turret, 0, 0);
}
