import type { RobotStats } from '../data/robot_defaults';
import type { EffectLifetimes } from '../debug/effects';
import type { BulletSnapshot, RobotSnapshot, Snapshot } from '../debug/snapshot';
import type { MatchResult } from '../sim/simulation';
import type { Arena } from '../sim/types';
import { drawSensorFan, drawTargetMarks } from './debug_overlay';
import { drawEffects } from './effects_layer';
import { DOT, ROBOT_PALETTES, WRECK_PALETTE, createRobotSprite } from './sprites';

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
const LABEL_GAP_PX = 3;
const LABEL_LINE_PX = 13;
const RESULT_FONT_PX = 22;
// Sizes in arena units.
const HP_BAR_HEIGHT = 3;
const HP_BAR_GAP = 8;
/** A bullet is drawn as a square of this size, with a dimmer one trailing behind it. */
const BULLET_SIZE = DOT * 2;
/** Near the top edge, clear of the robots, which tend to meet in the middle. */
const RESULT_Y = 50;

export interface RenderOptions {
  /** Index of the robot whose sensor is drawn, or null to draw no debug overlay. */
  sensorOf: number | null;
  /** Ticks played past the snapshot; ages its effects further. */
  overrun: number;
}

/** Draws one snapshot of a match onto a canvas, in a dot-art style. */
export class BattleView {
  private readonly context: CanvasRenderingContext2D;
  private readonly sprites = ROBOT_PALETTES.map(createRobotSprite);
  private readonly wreck = createRobotSprite(WRECK_PALETTE);
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

  render(snapshot: Snapshot, arena: Arena, stats: RobotStats, options: RenderOptions): void {
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

    if (watcher !== undefined && watcher.alive) drawSensorFan(ctx, watcher, stats, watcherColor, pixel);

    for (const bullet of snapshot.bullets) this.drawBullet(bullet);
    snapshot.robots.forEach((robot, index) => this.drawRobot(robot, index, stats, debug));
    drawEffects(ctx, snapshot.effects, options.overrun, this.effectLifetimes);

    if (watcher !== undefined && watched !== undefined && watcher.alive) {
      drawTargetMarks(ctx, watcher, watched, stats, watcherColor, pixel);
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
    return ROBOT_PALETTES[robotIndex % ROBOT_PALETTES.length].body;
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

  private drawRobot(robot: RobotSnapshot, index: number, stats: RobotStats, showState: boolean): void {
    const ctx = this.context;
    const { x, y } = robot;
    const { radius } = stats;
    const sprite = robot.alive ? this.sprites[index % this.sprites.length] : this.wreck;
    const size = sprite.width * DOT;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((robot.rotation * Math.PI) / 180);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();

    const barWidth = radius * 2;
    const barY = y - radius - HP_BAR_GAP;
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(x - radius, barY, barWidth, HP_BAR_HEIGHT);
    ctx.fillStyle = robot.alive ? this.colorOf(index) : COLORS.destroyed;
    ctx.fillRect(x - radius, barY, barWidth * (robot.hp / stats.maxHp), HP_BAR_HEIGHT);

    const labelY = y + radius + LABEL_GAP_PX / this.scale;
    ctx.font = this.font(LABEL_FONT_PX);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(robot.id, x, labelY);
    if (showState) {
      ctx.fillStyle = COLORS.mutedText;
      ctx.fillText(robot.state, x, labelY + LABEL_LINE_PX / this.scale);
    }
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

export function formatResult(result: MatchResult): string {
  return result.winnerId === null ? 'DRAW' : `WINNER: ${result.winnerId}`;
}
