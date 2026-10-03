import type { RobotStats } from '../data/robot_defaults';
import type { RobotSnapshot } from '../debug/snapshot';
import type { Arena } from '../sim/types';
import { sensorField } from './sensor_field';

const SENSOR_FIELD_ALPHA = 0.07;
const SENSOR_EDGE_ALPHA = 0.3;
const SIGHT_LINE_ALPHA = 0.3;
const MARK_ALPHA = 0.9;
// Sizes in arena units.
/** Wide enough for the frame to pass outside the HP bar and inside the name label. */
const TARGET_FRAME_MARGIN = 13;
const TARGET_CORNER_LENGTH = 8;
const LAST_SEEN_MARK_SIZE = 7;
const COVER_MARK_SIZE = 6;
/** Strong enough to show over the tint of the sensor fields, which is in the same colour. */
const COVER_LINE_ALPHA = 0.85;
/** Screen pixels: dash and gap of the line to the cover. */
const COVER_DASH_PX = 5;
const BULLET_RING_RADIUS = 7;
const LEAD_MARK_SIZE = 5;
/** Line width of the marks, in screen pixels. */
const MARK_LINE_PX = 1.5;

/** What the robot's sensor covers right now: a tint over the ground it sees, with an edge where obstacles or its range stop it. */
export function drawSensorField(
  ctx: CanvasRenderingContext2D,
  robot: RobotSnapshot,
  stats: RobotStats,
  arena: Arena,
  color: string,
  pixel: number,
): void {
  const points = sensorField(robot, robot.rotation, stats, arena);
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = SENSOR_FIELD_ALPHA;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = pixel;
  ctx.globalAlpha = SENSOR_EDGE_ALPHA;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The line along which the robot sees the enemy; drawn only while it does. */
export function drawSightLine(
  ctx: CanvasRenderingContext2D,
  robot: RobotSnapshot,
  enemy: RobotSnapshot,
  color: string,
  pixel: number,
): void {
  if (!robot.enemyVisible) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = pixel;
  ctx.globalAlpha = SIGHT_LINE_ALPHA;
  ctx.beginPath();
  ctx.moveTo(robot.x, robot.y);
  ctx.lineTo(enemy.x, enemy.y);
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
  enemyStats: RobotStats,
  color: string,
  pixel: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = MARK_LINE_PX * pixel;
  ctx.globalAlpha = MARK_ALPHA;
  ctx.beginPath();
  if (robot.enemyVisible) {
    traceFrame(ctx, enemy.x, enemy.y, enemyStats.radius + TARGET_FRAME_MARGIN);
  } else if (robot.lastSeen !== null) {
    traceCross(ctx, robot.lastSeen.x, robot.lastSeen.y, LAST_SEEN_MARK_SIZE);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Where the robot would take cover: a diamond at the place, and a dashed line along the way to it. Nothing once it is there. */
export function drawCoverMark(ctx: CanvasRenderingContext2D, robot: RobotSnapshot, color: string, pixel: number): void {
  const { cover } = robot;
  if (cover === null || cover.distance === 0) return;
  const { x, y } = cover.position;
  ctx.strokeStyle = color;

  ctx.lineWidth = MARK_LINE_PX * pixel;
  ctx.globalAlpha = COVER_LINE_ALPHA;
  ctx.setLineDash([COVER_DASH_PX * pixel, COVER_DASH_PX * pixel]);
  ctx.beginPath();
  ctx.moveTo(robot.x, robot.y);
  for (const point of cover.route) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = MARK_LINE_PX * pixel;
  ctx.globalAlpha = MARK_ALPHA;
  ctx.beginPath();
  ctx.moveTo(x, y - COVER_MARK_SIZE);
  ctx.lineTo(x + COVER_MARK_SIZE, y);
  ctx.lineTo(x, y + COVER_MARK_SIZE);
  ctx.lineTo(x - COVER_MARK_SIZE, y);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A ring around the bullet that is on course to hit the robot. */
export function drawIncomingBulletMark(
  ctx: CanvasRenderingContext2D,
  robot: RobotSnapshot,
  color: string,
  pixel: number,
): void {
  const bullet = robot.incomingBullet;
  if (bullet === null) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = MARK_LINE_PX * pixel;
  ctx.globalAlpha = MARK_ALPHA;
  ctx.beginPath();
  ctx.arc(bullet.position.x, bullet.position.y, BULLET_RING_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A plus where the robot would shoot to hit the enemy as it moves; drawn only while that is not the enemy itself. */
export function drawLeadMark(ctx: CanvasRenderingContext2D, robot: RobotSnapshot, color: string, pixel: number): void {
  const { lead, lastSeen } = robot;
  if (lead === null || lastSeen === null) return;
  if (Math.hypot(lead.x - lastSeen.x, lead.y - lastSeen.y) < LEAD_MARK_SIZE) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = MARK_LINE_PX * pixel;
  ctx.globalAlpha = MARK_ALPHA;
  ctx.beginPath();
  ctx.moveTo(lead.x - LEAD_MARK_SIZE, lead.y);
  ctx.lineTo(lead.x + LEAD_MARK_SIZE, lead.y);
  ctx.moveTo(lead.x, lead.y - LEAD_MARK_SIZE);
  ctx.lineTo(lead.x, lead.y + LEAD_MARK_SIZE);
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
