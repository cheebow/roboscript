import type { RobotStats } from '../data/robot_defaults';
import type { RobotSnapshot } from '../debug/snapshot';

const FAN_FILL_ALPHA = 0.07;
const FAN_EDGE_ALPHA = 0.35;
const MARK_ALPHA = 0.9;
// Sizes in arena units.
const TARGET_FRAME_MARGIN = 7;
const TARGET_CORNER_LENGTH = 8;
const LAST_SEEN_MARK_SIZE = 7;
/** Line width of the marks, in screen pixels. */
const MARK_LINE_PX = 1.5;

/** The robot's field of view: a sector from its position, as wide as the sensor angle. */
export function drawSensorFan(
  ctx: CanvasRenderingContext2D,
  robot: RobotSnapshot,
  stats: RobotStats,
  color: string,
  pixel: number,
): void {
  const heading = (robot.rotation * Math.PI) / 180;
  const halfAngle = (stats.sensorAngle * Math.PI) / 360;

  ctx.beginPath();
  ctx.moveTo(robot.x, robot.y);
  ctx.arc(robot.x, robot.y, stats.sensorRange, heading - halfAngle, heading + halfAngle);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = pixel;
  ctx.globalAlpha = FAN_FILL_ALPHA;
  ctx.fill();
  ctx.globalAlpha = FAN_EDGE_ALPHA;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * What the robot's sensor makes of the enemy: a frame around the enemy while
 * it is visible, otherwise a cross where it was last seen.
 */
export function drawTargetMarks(
  ctx: CanvasRenderingContext2D,
  robot: RobotSnapshot,
  enemy: RobotSnapshot,
  stats: RobotStats,
  color: string,
  pixel: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = MARK_LINE_PX * pixel;
  ctx.globalAlpha = MARK_ALPHA;
  ctx.beginPath();
  if (robot.enemyVisible) {
    traceFrame(ctx, enemy.x, enemy.y, stats.radius + TARGET_FRAME_MARGIN);
  } else if (robot.lastSeen !== null) {
    traceCross(ctx, robot.lastSeen.x, robot.lastSeen.y, LAST_SEEN_MARK_SIZE);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Four corner brackets of a square. */
function traceFrame(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const cornerX = x + sx * half;
      const cornerY = y + sy * half;
      ctx.moveTo(cornerX - sx * TARGET_CORNER_LENGTH, cornerY);
      ctx.lineTo(cornerX, cornerY);
      ctx.lineTo(cornerX, cornerY - sy * TARGET_CORNER_LENGTH);
    }
  }
}

function traceCross(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
  ctx.moveTo(x - half, y - half);
  ctx.lineTo(x + half, y + half);
  ctx.moveTo(x + half, y - half);
  ctx.lineTo(x - half, y + half);
}
