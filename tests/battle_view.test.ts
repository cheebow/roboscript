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
