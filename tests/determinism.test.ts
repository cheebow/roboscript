import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { MatchRng } from '../src/sim/rng';
import type { Simulation } from '../src/sim/simulation';
import { compileBrain, createSimulation, enemySource } from './helpers';

function snapshot(simulation: Simulation): string {
  return JSON.stringify({
    robots: simulation.robots.map(({ position, rotation, hp, state }) => ({ position, rotation, hp, state })),
    bullets: simulation.bullets,
  });
}

/** Plays the default match and records the state after every tick. */
function playMatch(seed: number): string[] {
  const simulation = createSimulation([compileBrain(SAMPLE_AI), compileBrain(enemySource('dumb_bot'))], {
    arena: DEFAULT_ARENA,
    stats: ROBOT_DEFAULTS,
    seed,
  });
  const trace: string[] = [];
  while (simulation.result === null) {
    simulation.step();
    trace.push(snapshot(simulation));
  }
  return trace;
}

describe('determinism', () => {
  it('replays identically for the same seed', () => {
    expect(playMatch(7)).toEqual(playMatch(7));
  });

  it('plays differently for a different seed', () => {
    expect(playMatch(7)).not.toEqual(playMatch(8));
  });
});

describe('MatchRng', () => {
  it('yields the same sequence for the same seed', () => {
    const a = new MatchRng(42);
    const b = new MatchRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('stays within [0, 1)', () => {
    const rng = new MatchRng(42);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
