// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { EFFECT_LIFETIMES } from '../src/data/match_defaults';
import { captureSnapshot } from '../src/debug/snapshot';
import { BattleView } from '../src/view/battle_view';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, createSimulation } from './helpers';

it('draws the wrecks first, so a living robot on top of one is not hidden under it', () => {
  // A 2D context that records the names it writes, and takes every other call.
  const written: string[] = [];
  const context = new Proxy(
    {},
    {
      get: (_, name) =>
        name === 'measureText' ? () => ({ width: 0 }) : name === 'fillText' ? (text: string) => written.push(text) : () => {},
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const frame = document.createElement('div');
  Object.defineProperty(frame, 'clientWidth', { value: 1000 });
  Object.defineProperty(frame, 'clientHeight', { value: 600 });
  const canvas = document.createElement('canvas');
  frame.append(canvas);

  const snapshot = captureSnapshot(createSimulation([new FixedBrain(), new FixedBrain()]));
  // BRAVO, drawn last by its place in the list, is the wreck.
  snapshot.robots[1] = { ...snapshot.robots[1], alive: false, hp: 0 };
  new BattleView(canvas, EFFECT_LIFETIMES).render(snapshot, DUEL_ARENA, [NO_SPREAD_STATS, NO_SPREAD_STATS], [STANDARD_LOADOUT, STANDARD_LOADOUT], {
    sensorOf: null,
    marks: { cover: false, bullets: false, lead: false },
    coverRoutes: [false, false],
    overrun: 0,
  });
  const names = written.filter((text) => text === 'ALPHA' || text === 'BRAVO');
  expect(names).toEqual(['BRAVO', 'ALPHA']);
});

it('marks a detection with a "!" over the robot, and a hit with sparks flying on the way the bullet went', async () => {
  const { drawEffects } = await import('../src/view/effects_layer');
  const cells: { x: number; y: number }[] = [];
  const context = new Proxy(
    {},
    {
      get: (_, name) => (name === 'fillRect' ? (x: number, y: number) => cells.push({ x, y }) : () => {}),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  const robot = { x: 500, y: 300 };

  drawEffects(context, [{ kind: 'detected', ...robot, age: 0, robot: 0 }], 0, EFFECT_LIFETIMES, { robots: [robot] });
  expect(cells.length).toBeGreaterThan(0);
  // A narrow mark straight above the robot: no ring around it.
  for (const cell of cells) {
    expect(cell.y).toBeLessThan(robot.y - 16);
    expect(Math.abs(cell.x - robot.x)).toBeLessThanOrEqual(4);
  }

  cells.length = 0;
  // Hit by a bullet flying left to right (0 degrees): the sparks fly on to the right.
  drawEffects(context, [{ kind: 'hit', ...robot, age: 2, robot: 0, angle: 0 }], 0, EFFECT_LIFETIMES, { robots: [robot] });
  expect(cells.length).toBeGreaterThan(0);
  for (const cell of cells) expect(cell.x).toBeGreaterThan(robot.x);
});
