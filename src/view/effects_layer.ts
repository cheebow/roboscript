import type { EffectLifetimes, EffectSnapshot } from '../debug/effects';
import { DOT, paletteOf } from './sprites';

const FLASH = '#f2e9c4';
const SPARK = '#e6c98a';
const FIRE = '#e0a868';
const SMOKE = '#6f6a66';
const SHIELD = '#bfe3f2';

const DIAGONALS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const PLUS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// Destruction: two rings of dots that spread out from the wreck.
const BURST_START_RADIUS = 6;
const BURST_GROWTH = 30;
const BURST_OUTER_DOTS = 12;
const BURST_INNER_DOTS = 8;
const BURST_INNER_SCALE = 0.55;
/** Share of the lifetime during which the centre still flashes. */
const BURST_FLASH_PHASE = 0.3;
const BURST_FIRE_PHASE = 0.65;
const BURST_FLASH_SIZE = 20;

// A bullet stopped by a guard: one ring of dots that widens around the robot.
const DEFLECT_START_RADIUS = 20;
const DEFLECT_GROWTH = 14;
const DEFLECT_DOTS = 16;
// A robot caught sight of the enemy: a ring in its own colour that widens around it.
const DETECT_START_RADIUS = 22;
const DETECT_GROWTH = 26;
const DETECT_DOTS = 12;
// A new number on the radio: a dotted line runs out to each teammate and a
// pulse of data travels along it; where it arrives, reception bars light up.
// The sender itself shows a small antenna mark. (Rings were tried first, but
// read as the detection and guard rings.)
/** Where the sender's antenna mark sits above the robot's centre. */
const SEND_Y = -18;
const SEND_ARC_RADIUS = 6;
/** px between the dots of the line a signal travels along. */
const LINK_SPACING = 10;
/** How faint the line is next to the pulse riding it. */
const LINK_ALPHA = 0.35;
/** The pulse arrives this far into the effect's life; the bars have the rest. */
const LINK_ARRIVE = 0.5;
/** Dots trailing the pulse's head, each dimmer than the one before. */
const PULSE_TRAIL = 3;
// The reception bars at the receiving end.
const HEARD_BARS = 3;
const HEARD_X = 14;
const HEARD_Y = -20;
/** Dots across and extra dots up: every bar is this wide, and one step taller than the one before. */
const HEARD_BAR_WIDTH = 2;
const HEARD_BAR_STEP = 2;
/** The radio marks stay full until this share of their life, then fade out. */
const RADIO_FADE_FROM = 0.7;
// An enemy bullet wore the castle down: a heavier spark than an ordinary impact.
const BASE_HIT_REACH = 2;

/** What of the scene an effect may follow: the robots as they stand now, and their teams (for their colours). */
export interface EffectScene {
  robots?: readonly { x: number; y: number }[];
  teams?: readonly number[];
}

/**
 * Draws the effects of a snapshot as coarse dots. `overrun` is how many ticks
 * playback has run past the snapshot, which ages its effects further.
 * `scene` lets an effect that is a robot's own marker ride along with it.
 */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly EffectSnapshot[],
  overrun: number,
  lifetimes: EffectLifetimes,
  scene: EffectScene = {},
): void {
  for (const effect of effects) {
    const age = effect.age + overrun;
    const lifetime = lifetimes[effect.kind];
    if (age >= lifetime) continue;
    const progress = age / lifetime;

    switch (effect.kind) {
      case 'shot':
        drawShot(ctx, effect, age);
        break;
      case 'impact':
        drawImpact(ctx, effect, age, progress);
        break;
      case 'deflected':
        drawDeflection(ctx, effect, progress);
        break;
      case 'destroyed':
      case 'baseDestroyed':
        drawBurst(ctx, effect, progress);
        break;
      case 'detected':
        drawDetection(ctx, effect, progress, scene);
        break;
      case 'signal':
        drawSignal(ctx, effect, progress, scene);
        break;
      case 'signalHeard':
        drawHeard(ctx, effect, progress, scene);
        break;
      case 'baseHit':
        drawBaseHit(ctx, effect, age, progress);
        break;
    }
  }
  ctx.globalAlpha = 1;
}

/** The robot's own colours, team colours where the match has teams. */
function robotPalette(effect: EffectSnapshot, scene: EffectScene) {
  return paletteOf(effect.robot ?? 0, scene.teams);
}

/** Where the robot the effect belongs to stands now; where the effect started when it is not known. */
function anchorOf(effect: EffectSnapshot, scene: EffectScene): { x: number; y: number } {
  return (effect.robot !== undefined ? scene.robots?.[effect.robot] : undefined) ?? effect;
}

/** A dot snapped to the sprite grid, so effects line up with the robots' pixels. */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillRect(Math.floor(x / DOT) * DOT, Math.floor(y / DOT) * DOT, DOT, DOT);
}

function drawShot(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, age: number): void {
  ctx.fillStyle = FLASH;
  ctx.globalAlpha = 1;
  const dots = age === 0 ? PLUS : PLUS.slice(0, 1);
  for (const [dx, dy] of dots) dot(ctx, effect.x + dx * DOT, effect.y + dy * DOT);
}

function drawImpact(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, age: number, progress: number): void {
  ctx.fillStyle = SPARK;
  ctx.globalAlpha = 1 - progress;
  if (age === 0) dot(ctx, effect.x, effect.y);
  const reach = (age + 1) * DOT;
  for (const [dx, dy] of DIAGONALS) dot(ctx, effect.x + dx * reach, effect.y + dy * reach);
}

function drawDeflection(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, progress: number): void {
  ctx.fillStyle = SHIELD;
  ctx.globalAlpha = 1 - progress;
  drawRing(ctx, effect, DEFLECT_START_RADIUS + DEFLECT_GROWTH * progress, DEFLECT_DOTS, 0);
}

function drawDetection(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, progress: number, scene: EffectScene): void {
  ctx.fillStyle = robotPalette(effect, scene).body;
  ctx.globalAlpha = 1 - progress;
  drawRing(ctx, effect, DETECT_START_RADIUS + DETECT_GROWTH * progress, DETECT_DOTS, Math.PI / DETECT_DOTS);
}

/** How far into their life the radio marks are solid, and how they fade after. */
function radioAlpha(progress: number): number {
  return progress < RADIO_FADE_FROM ? 1 : 1 - (progress - RADIO_FADE_FROM) / (1 - RADIO_FADE_FROM);
}

/** The sender broadcasts: a small antenna mark above the robot, riding along with it. */
function drawSignal(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, progress: number, scene: EffectScene): void {
  const anchor = anchorOf(effect, scene);
  const centre = { x: anchor.x, y: anchor.y + SEND_Y };
  ctx.fillStyle = robotPalette(effect, scene).light;
  ctx.globalAlpha = radioAlpha(progress);
  dot(ctx, centre.x, centre.y);
  for (let index = 0; index < 5; index++) {
    const angle = -Math.PI * 0.75 + (Math.PI * 0.5 * index) / 4;
    dot(ctx, centre.x + Math.cos(angle) * SEND_ARC_RADIUS, centre.y + Math.sin(angle) * SEND_ARC_RADIUS);
  }
}

/**
 * The signal reaches a teammate: a dotted line from the sender, a pulse of
 * data running along it, and reception bars where it arrives. Both ends
 * follow their robots.
 */
function drawHeard(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, progress: number, scene: EffectScene): void {
  const to = anchorOf(effect, scene);
  const from = effect.from !== undefined ? (scene.robots?.[effect.from] ?? null) : null;
  const colour = (effect.from !== undefined ? paletteOf(effect.from, scene.teams) : robotPalette(effect, scene)).light;
  ctx.fillStyle = colour;
  if (from !== null) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.round(length / LINK_SPACING));
    const at = (share: number) => ({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share });
    // The line, faint, from sender to receiver.
    ctx.globalAlpha = radioAlpha(progress) * LINK_ALPHA;
    for (let step = 0; step <= steps; step++) {
      const place = at(step / steps);
      dot(ctx, place.x, place.y);
    }
    // The pulse, bright, with a short tail: the number on its way over.
    const travelled = Math.min(1, progress / LINK_ARRIVE);
    for (let tail = 0; tail < PULSE_TRAIL; tail++) {
      const share = travelled - (tail * LINK_SPACING) / Math.max(length, 1);
      if (share < 0) continue;
      ctx.globalAlpha = radioAlpha(progress) * (1 - tail / PULSE_TRAIL);
      const place = at(share);
      dot(ctx, place.x, place.y);
      if (tail === 0) for (const [dx, dy] of PLUS) dot(ctx, place.x + dx * DOT, place.y + dy * DOT);
    }
  }
  // The bars light up once the pulse is in: nothing yet while it is still on its way.
  const arrived = from === null ? progress : Math.max(0, (progress - LINK_ARRIVE) / (1 - LINK_ARRIVE));
  if (arrived <= 0) return;
  ctx.globalAlpha = radioAlpha(progress);
  const lit = Math.min(HEARD_BARS, 1 + Math.floor(arrived * 2 * HEARD_BARS));
  for (let bar = 0; bar < lit; bar++) {
    // Each bar is a step taller than the one before, like reception bars.
    for (let height = 0; height < HEARD_BAR_STEP * (bar + 1); height++) {
      for (let across = 0; across < HEARD_BAR_WIDTH; across++) {
        dot(ctx, to.x + HEARD_X + bar * DOT * (HEARD_BAR_WIDTH + 1) + across * DOT, to.y + HEARD_Y - height * DOT);
      }
    }
  }
}

/** An enemy bullet wore the castle down: a heavier, hotter spark than an ordinary impact. */
function drawBaseHit(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, age: number, progress: number): void {
  ctx.fillStyle = FIRE;
  ctx.globalAlpha = 1 - progress;
  if (age <= 1) for (const [dx, dy] of PLUS) dot(ctx, effect.x + dx * DOT, effect.y + dy * DOT);
  const reach = (age + 1) * DOT * BASE_HIT_REACH;
  for (const [dx, dy] of DIAGONALS) dot(ctx, effect.x + dx * reach, effect.y + dy * reach);
  dot(ctx, effect.x + reach, effect.y);
  dot(ctx, effect.x - reach, effect.y);
}

function drawBurst(ctx: CanvasRenderingContext2D, effect: EffectSnapshot, progress: number): void {
  if (progress < BURST_FLASH_PHASE) {
    const size = BURST_FLASH_SIZE * (1 - progress / BURST_FLASH_PHASE);
    ctx.fillStyle = FLASH;
    ctx.globalAlpha = 1;
    ctx.fillRect(effect.x - size / 2, effect.y - size / 2, size, size);
  }

  ctx.fillStyle = progress < BURST_FLASH_PHASE ? FLASH : progress < BURST_FIRE_PHASE ? FIRE : SMOKE;
  ctx.globalAlpha = 1 - progress;
  const radius = BURST_START_RADIUS + BURST_GROWTH * progress;
  drawRing(ctx, effect, radius, BURST_OUTER_DOTS, 0);
  drawRing(ctx, effect, radius * BURST_INNER_SCALE, BURST_INNER_DOTS, Math.PI / BURST_INNER_DOTS);
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radius: number,
  count: number,
  phase: number,
): void {
  for (let index = 0; index < count; index++) {
    const angle = phase + (index * 2 * Math.PI) / count;
    dot(ctx, center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
  }
}
