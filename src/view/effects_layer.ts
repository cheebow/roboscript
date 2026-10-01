import type { EffectLifetimes, EffectSnapshot } from '../debug/effects';
import { DOT } from './sprites';

const FLASH = '#f2e9c4';
const SPARK = '#e6c98a';
const FIRE = '#e0a868';
const SMOKE = '#6f6a66';

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

/**
 * Draws the effects of a snapshot as coarse dots. `overrun` is how many ticks
 * playback has run past the snapshot, which ages its effects further.
 */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly EffectSnapshot[],
  overrun: number,
  lifetimes: EffectLifetimes,
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
      case 'destroyed':
        drawBurst(ctx, effect, progress);
        break;
    }
  }
  ctx.globalAlpha = 1;
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
