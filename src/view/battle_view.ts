import type { RobotStats } from '../data/robot_defaults';
import type { RobotSnapshot, Snapshot } from '../debug/snapshot';
import type { MatchResult } from '../sim/simulation';
import type { Arena } from '../sim/types';

const COLORS = {
  background: '#0f1215',
  border: '#2c333a',
  obstacle: '#232a30',
  obstacleEdge: '#3a444d',
  robots: ['#6fb7a8', '#d49a6a'],
  destroyed: '#4a5158',
  hpBack: '#2c333a',
  bullet: '#e6e2c8',
  text: '#c5ccd3',
};

const FONT_FAMILY = 'ui-monospace, Menlo, Consolas, monospace';
// Sizes in screen pixels: they stay the same however the arena is scaled.
const FRAME_MARGIN_PX = 8;
const LABEL_FONT_PX = 11;
const LABEL_GAP_PX = 3;
const RESULT_FONT_PX = 22;
// Sizes in arena units.
const BODY_SCALE = 1.6;
const BARREL_WIDTH = 4;
const HP_BAR_HEIGHT = 3;
const HP_BAR_GAP = 8;
/** Near the top edge, clear of the robots, which tend to meet in the middle. */
const RESULT_Y = 50;

/** Draws one snapshot of a match onto a canvas. */
export class BattleView {
  private readonly context: CanvasRenderingContext2D;
  /** Screen pixels per arena unit. */
  private scale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Canvas 2D context is not available');
    this.context = context;
  }

  render(snapshot: Snapshot, arena: Arena, stats: RobotStats): void {
    if (!this.fit(arena)) return;
    const ctx = this.context;
    const pixel = 1 / this.scale;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, arena.width, arena.height);

    ctx.lineWidth = pixel;
    ctx.fillStyle = COLORS.obstacle;
    ctx.strokeStyle = COLORS.obstacleEdge;
    for (const obstacle of arena.obstacles) {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    ctx.fillStyle = COLORS.bullet;
    const bulletSize = stats.bulletRadius * 2;
    for (const bullet of snapshot.bullets) {
      ctx.fillRect(bullet.x - stats.bulletRadius, bullet.y - stats.bulletRadius, bulletSize, bulletSize);
    }

    snapshot.robots.forEach((robot, index) => {
      this.drawRobot(robot, COLORS.robots[index % COLORS.robots.length], stats.radius, stats.maxHp);
    });

    if (snapshot.result !== null) this.drawResult(snapshot.result, arena.width);

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
    return true;
  }

  private drawRobot(robot: RobotSnapshot, color: string, radius: number, maxHp: number): void {
    const ctx = this.context;
    const { x, y } = robot;
    const bodyColor = robot.alive ? color : COLORS.destroyed;
    const half = (radius * BODY_SCALE) / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((robot.rotation * Math.PI) / 180);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-half, -half, half * 2, half * 2);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, -BARREL_WIDTH / 2, half, BARREL_WIDTH);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(half, -BARREL_WIDTH / 2, radius - half, BARREL_WIDTH);
    ctx.restore();

    const barWidth = radius * 2;
    const barY = y - radius - HP_BAR_GAP;
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(x - radius, barY, barWidth, HP_BAR_HEIGHT);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - radius, barY, barWidth * (robot.hp / maxHp), HP_BAR_HEIGHT);

    ctx.font = this.font(LABEL_FONT_PX);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(robot.id, x, y + radius + LABEL_GAP_PX / this.scale);
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
