import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { compileBrain, createSimulation, enemySource, runToEnd } from './helpers';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Plays the real game setup: the player's script against DumbBot. */
function playAgainstDumbBot(playerSource: string, seed: number) {
  const simulation = createSimulation([compileBrain(playerSource), compileBrain(enemySource('dumb_bot'))], {
    arena: DEFAULT_ARENA,
    stats: ROBOT_DEFAULTS,
    seed,
  });
  runToEnd(simulation);
  return simulation;
}

describe('bundled scripts', () => {
  it('compile without errors', () => {
    expect(compileScript(SAMPLE_AI)).toMatchObject({ ok: true });
    expect(compileScript(enemySource('dumb_bot'))).toMatchObject({ ok: true });
  });

  it('refuses to compile a script with errors', () => {
    expect(compileScript('shoot')).toEqual({
      ok: false,
      errors: [{ line: 1, message: 'Unknown command "shoot"' }],
    });
  });
});

describe('sample AI against DumbBot', () => {
  it('finds the enemy and fights to a finish', () => {
    const simulation = playAgainstDumbBot(SAMPLE_AI, 1);
    expect(simulation.result?.reason).toBe('destroyed');
    expect(simulation.robots.every((robot) => robot.label === 'ATTACK')).toBe(true);
  });

  it('loses as shipped', () => {
    for (const seed of SEEDS) {
      expect(playAgainstDumbBot(SAMPLE_AI, seed).result?.winnerId).toBe('BRAVO');
    }
  });

  it('wins after raising the fire distance', () => {
    const improved = SAMPLE_AI.replace('enemy_distance < 250', 'enemy_distance < 350');
    expect(improved).not.toBe(SAMPLE_AI);
    for (const seed of SEEDS) {
      expect(playAgainstDumbBot(improved, seed).result?.winnerId).toBe('ALPHA');
    }
  });
});
