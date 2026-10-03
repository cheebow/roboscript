import type { ProgramFeatures } from '../ai/features';
import { type Loadout, SLOTS } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import type { EffectLifetimes } from '../debug/effects';
import type { BulletSnapshot, RobotSnapshot, Snapshot } from '../debug/snapshot';
import type { MatchResult } from '../sim/simulation';
import type { Arena } from '../sim/types';
import {
  drawCoverMark,
  drawIncomingBulletMark,
  drawLeadMark,
  drawSensorField,
  drawSightLine,
  drawTargetMarks,
} from './debug_overlay';
import { drawEffects } from './effects_layer';
import { DOT, type RobotSprites, WRECK_PALETTE, createRobotSprites, paletteOf } from './sprites';

const COLORS = {
  background: '#0f1215',
  border: '#2c333a',
  obstacle: '#232a30',
  obstacleEdge: '#3a444d',
  destroyed: '#4a5158',
  hpBack: '#2c333a',
  bullet: '#e6e2c8',
  bulletTail: '#8c8873',
  text: '#c5ccd3',
  mutedText: '#6f7a85',
};

const FONT_FAMILY = 'ui-monospace, Menlo, Consolas, monospace';
// Sizes in screen pixels: they stay the same however the arena is scaled.
const FRAME_MARGIN_PX = 8;
const LABEL_FONT_PX = 11;
const LABEL_LINE_PX = 13;
const RESULT_FONT_PX = 22;
// Sizes in arena units.
const HP_BAR_HEIGHT = 3;
const HP_BAR_GAP = 8;
/** A guarding robot is ringed this far outside its edge. */
const GUARD_RING_GAP = 4;
const GUARD_RING_PX = 2;
/** A single tick of guarding would be gone before it is seen: the ring and the label fade out over this many ticks. */
const GUARD_SHOWN_TICKS = 15;
const GUARD_LABEL = 'GUARD';
/** From the robot's edge up to the label, above the HP bar. */
const GUARD_LABEL_GAP = 13;
/** From the robot's edge down to its name; leaves room for the target frame in between. */
const LABEL_GAP = 15;
/** A bullet is drawn as a square of this size, with a dimmer one trailing behind it. */
const BULLET_SIZE = DOT * 2;
/** Near the top edge, clear of the robots, which tend to meet in the middle. */
const RESULT_Y = 50;

export interface RenderOptions {
  /** Index of the robot whose view of the enemy is drawn, or null to draw no debug overlay. */
  sensorOf: number | null;
  /** Which of that robot's marks to draw besides: those its program has to do with. */
  marks: ProgramFeatures;
  /** Ticks played past the snapshot; ages its effects further. */
  overrun: number;
}

/** Draws one snapshot of a match onto a canvas, in a dot-art style. */
export class BattleView {
  private readonly context: CanvasRenderingContext2D;
  /** The sprites painted so far, by who they are of: see spritesOf. */
  private readonly sprites = new Map<string, RobotSprites>();
  /** Screen pixels per arena unit. */
  private scale = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly effectLifetimes: EffectLifetimes,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Canvas 2D context is not available');
    this.context = context;
  }

  /** `stats` and `loadouts` are each robot's, in the order of the snapshot's robots. */
  render(
    snapshot: Snapshot,
    arena: Arena,
    stats: readonly RobotStats[],
    loadouts: readonly Loadout[],
    options: RenderOptions,
  ): void {
    if (!this.fit(arena)) return;
    const ctx = this.context;
    const pixel = 1 / this.scale;
    const debug = options.sensorOf !== null;
    const watcher = options.sensorOf === null ? undefined : snapshot.robots[options.sensorOf];
    const watched = snapshot.robots.find((robot) => robot !== watcher);
    const watcherColor = options.sensorOf === null ? '' : this.colorOf(options.sensorOf);

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, arena.width, arena.height);

    ctx.lineWidth = pixel;
    ctx.fillStyle = COLORS.obstacle;
    ctx.strokeStyle = COLORS.obstacleEdge;
    for (const obstacle of arena.obstacles) {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    snapshot.robots.forEach((robot, index) => {
      if (robot.alive) drawSensorField(ctx, robot, stats[index], arena, this.colorOf(index), pixel);
    });
    if (watcher !== undefined && watched !== undefined && watcher.alive) {
      drawSightLine(ctx, watcher, watched, watcherColor, pixel);
      if (options.marks.cover) drawCoverMark(ctx, watcher, watcherColor, pixel);
    }

    for (const bullet of snapshot.bullets) this.drawBullet(bullet);
    snapshot.robots.forEach((robot, index) =>
      this.drawRobot(robot, index, stats[index], loadouts[index], arena, debug, options.overrun),
    );
    drawEffects(ctx, snapshot.effects, options.overrun, this.effectLifetimes);

    if (watcher !== undefined && watched !== undefined && watcher.alive) {
      drawTargetMarks(ctx, watcher, watched, stats[snapshot.robots.indexOf(watched)], watcherColor, pixel);
      if (options.marks.bullets) drawIncomingBulletMark(ctx, watcher, watcherColor, pixel);
      if (options.marks.lead) drawLeadMark(ctx, watcher, watcherColor, pixel);
    }
    if (snapshot.result !== null) this.drawResult(snapshot.result, arena.width);

    ctx.lineWidth = pixel;
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(pixel / 2, pixel / 2, arena.width - pixel, arena.height - pixel);
  }

  /**
   * Sizes the canvas to the largest arena-shaped box that fits its parent, at
   * the display's pixel density. Returns false when there is no room to draw.
   */
  private fit(arena: Arena): boolean {
    const frame = this.canvas.parentElement;
    if (frame === null) throw new Error('The battle canvas has no parent element');
    const availableWidth = frame.clientWidth - FRAME_MARGIN_PX * 2;
    const availableHeight = frame.clientHeight - FRAME_MARGIN_PX * 2;
    this.scale = Math.min(availableWidth / arena.width, availableHeight / arena.height);
    if (this.scale <= 0) return false;

    const density = window.devicePixelRatio;
    const width = Math.round(arena.width * this.scale * density);
    const height = Math.round(arena.height * this.scale * density);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = `${width / density}px`;
      this.canvas.style.height = `${height / density}px`;
    }
    this.context.setTransform(this.scale * density, 0, 0, this.scale * density, 0, 0);
    // Resizing a canvas resets this; sprites must keep hard edges when scaled and rotated.
    this.context.imageSmoothingEnabled = false;
    return true;
  }

  private colorOf(robotIndex: number): string {
    return paletteOf(robotIndex).body;
  }

  /** The sprites of the robot at the given index with the given parts, whole or wrecked. Painted the first time they are asked for. */
  private spritesOf(robotIndex: number, loadout: Loadout, alive: boolean): RobotSprites {
    const palette = alive ? paletteOf(robotIndex) : WRECK_PALETTE;
    const key = [alive ? robotIndex : 'wreck', ...SLOTS.map((slot) => loadout[slot])].join('/');
    let sprites = this.sprites.get(key);
    if (sprites === undefined) {
      sprites = createRobotSprites(palette, loadout);
      this.sprites.set(key, sprites);
    }
    return sprites;
  }

  private drawBullet(bullet: BulletSnapshot): void {
    const ctx = this.context;
    const half = BULLET_SIZE / 2;
    ctx.fillStyle = COLORS.bulletTail;
    ctx.fillRect(
      bullet.x - bullet.directionX * BULLET_SIZE - half,
      bullet.y - bullet.directionY * BULLET_SIZE - half,
      BULLET_SIZE,
      BULLET_SIZE,
    );
    ctx.fillStyle = COLORS.bullet;
    ctx.fillRect(bullet.x - half, bullet.y - half, BULLET_SIZE, BULLET_SIZE);
  }

  private drawRobot(
    robot: RobotSnapshot,
    index: number,
    stats: RobotStats,
    loadout: Loadout,
    arena: Arena,
    showState: boolean,
    overrun: number,
  ): void {
    const ctx = this.context;
    const { x, y } = robot;
    const { radius } = stats;
    const sprites = this.spritesOf(index, loadout, robot.alive);
    this.drawPart(sprites.hull, x, y, robot.rotation);
    this.drawPart(sprites.turret, x, y, robot.gunHeading);

    const lineHeight = LABEL_LINE_PX / this.scale;
    const marks = placeMarks(y, radius, showState ? 2 : 1, lineHeight, arena.height);
    if (robot.alive) this.drawGuard(robot, index, radius, marks, arena.width, overrun);

    const barWidth = radius * 2;
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(x - radius, marks.barY, barWidth, HP_BAR_HEIGHT);
    ctx.fillStyle = robot.alive ? this.colorOf(index) : COLORS.destroyed;
    ctx.fillRect(x - radius, marks.barY, barWidth * (robot.hp / stats.maxHp), HP_BAR_HEIGHT);

    ctx.font = this.font(LABEL_FONT_PX);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.text;
    this.fillTextInside(robot.id, x, marks.labelsY, arena.width);
    if (showState) {
      ctx.fillStyle = COLORS.mutedText;
      this.fillTextInside(robot.label, x, marks.labelsY + lineHeight, arena.width);
    }
  }

  /** Writes a text centred on `x`, or as near to that as keeps all of it between the arena's left and right edges. */
  private fillTextInside(text: string, x: number, y: number, arenaWidth: number): void {
    const halfWidth = this.context.measureText(text).width / 2;
    this.context.fillText(text, centreInside(x, halfWidth, arenaWidth), y);
  }

  /** A ring around a robot that guards or has just guarded, and the word for it, both fading out. */
  private drawGuard(
    robot: RobotSnapshot,
    index: number,
    radius: number,
    marks: RobotMarks,
    arenaWidth: number,
    overrun: number,
  ): void {
    if (robot.guardAge === null) return;
    const age = robot.guardAge + overrun;
    if (age >= GUARD_SHOWN_TICKS) return;
    const ctx = this.context;
    const color = this.colorOf(index);

    ctx.globalAlpha = 1 - age / GUARD_SHOWN_TICKS;
    ctx.strokeStyle = color;
    // Bold on the very ticks it is guarding.
    ctx.lineWidth = (robot.guardAge === 0 ? GUARD_RING_PX * 2 : GUARD_RING_PX) / this.scale;
    ctx.beginPath();
    ctx.arc(robot.x, robot.y, radius + GUARD_RING_GAP, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = this.font(LABEL_FONT_PX);
    ctx.textAlign = 'center';
    ctx.textBaseline = marks.guardBaseline;
    ctx.fillStyle = color;
    this.fillTextInside(GUARD_LABEL, robot.x, marks.guardY, arenaWidth);
    ctx.globalAlpha = 1;
  }

  /** Draws a sprite centred on a point and turned to the given heading (deg). */
  private drawPart(sprite: HTMLCanvasElement, x: number, y: number, heading: number): void {
    const ctx = this.context;
    const size = sprite.width * DOT;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private drawResult(result: MatchResult, width: number): void {
    const ctx = this.context;
    ctx.font = this.font(RESULT_FONT_PX);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(formatResult(result), width / 2, RESULT_Y);
  }

  /** A font that appears `screenPixels` tall whatever the current scale. */
  private font(screenPixels: number): string {
    return `${screenPixels / this.scale}px ${FONT_FAMILY}`;
  }
}

/** Where the things shown around a robot go, as distances down the arena. */
export interface RobotMarks {
  /** The top of the HP bar. */
  barY: number;
  /** The top of the first line of labels. */
  labelsY: number;
  /** Where the word shown while guarding goes, and whether that is its top or its bottom. */
  guardY: number;
  guardBaseline: 'top' | 'bottom';
}

/**
 * Places the HP bar above a robot, the word shown while guarding above that,
 * and the robot's labels below it. Next to the top or the bottom edge of the
 * arena, whatever would fall outside goes to the other side of the robot.
 * `lineHeight` is that of a line of labels, of which there are `labelLines`.
 */
export function placeMarks(
  y: number,
  radius: number,
  labelLines: number,
  lineHeight: number,
  arenaHeight: number,
): RobotMarks {
  const barAbove = y - radius - HP_BAR_GAP >= 0;
  const barY = barAbove ? y - radius - HP_BAR_GAP : y + radius + HP_BAR_GAP - HP_BAR_HEIGHT;

  const labelsHeight = labelLines * lineHeight;
  const labelsBelow = y + radius + LABEL_GAP + labelsHeight <= arenaHeight;
  const labelsY = labelsBelow ? y + radius + LABEL_GAP : y - radius - GUARD_LABEL_GAP - labelsHeight;

  // Above everything else that is above the robot; with no room there, below everything below it.
  const above = labelsBelow ? y - radius - GUARD_LABEL_GAP : labelsY;
  if (above - lineHeight >= 0) return { barY, labelsY, guardY: above, guardBaseline: 'bottom' };
  const below = labelsBelow ? labelsY + labelsHeight : y + radius + LABEL_GAP;
  return { barY, labelsY, guardY: below, guardBaseline: 'top' };
}

/**
 * Where to centre something `halfWidth` wide to either side that belongs at
 * `x`: at `x`, or as near to it as keeps it between 0 and `width`.
 */
export function centreInside(x: number, halfWidth: number, width: number): number {
  return Math.min(Math.max(x, halfWidth), Math.max(width - halfWidth, halfWidth));
}

export function formatResult(result: MatchResult): string {
  return result.winnerId === null ? 'DRAW' : `WINNER: ${result.winnerId}`;
}
