import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { scatterSpawns } from '../src/arena/spawns';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { compileBrain, createSimulation, enemySource, runToEnd } from './helpers';

const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
/** How many of the seeds a lesson must hold for: the starting places differ, and so does the odd match. */
const MOST = 15;

/** Plays the real game setup: the player's script against DumbBot, from where the seed starts them. */
function playAgainstDumbBot(playerSource: string, seed: number) {
  const simulation = createSimulation([compileBrain(playerSource), compileBrain(enemySource('dumb_bot'))], {
    arena: scatterSpawns(DEFAULT_ARENA, seed),
    stats: ROBOT_DEFAULTS,
    seed,
  });
  runToEnd(simulation);
  return simulation;
}

/** How many of the seeds the script wins or loses against DumbBot. */
function tally(playerSource: string): { wins: number; losses: number } {
  const tally = { wins: 0, losses: 0 };
  for (const seed of SEEDS) {
    const { winnerId } = playAgainstDumbBot(playerSource, seed).result ?? { winnerId: null };
    if (winnerId === 'ALPHA') tally.wins++;
    else if (winnerId === 'BRAVO') tally.losses++;
  }
  return tally;
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

  it('loses as shipped, from most starting places', () => {
    expect(tally(SAMPLE_AI).losses).toBeGreaterThanOrEqual(MOST);
  });

  it('wins after raising the fire distance, from most starting places', () => {
    const improved = SAMPLE_AI.replace('attack(250)', 'attack(350)');
    expect(improved).not.toBe(SAMPLE_AI);
    expect(tally(improved).wins).toBeGreaterThanOrEqual(MOST);
  });
});
