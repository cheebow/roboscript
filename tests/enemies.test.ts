import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { DEFAULT_ENEMY, ENEMIES, findEnemy } from '../src/data/enemies';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { compileBrain, createSimulation, runToEnd } from './helpers';
import { APPROACH, KEEP_DISTANCE, RUSH, TURRET } from './strategies';

const SEEDS = [1, 2, 3, 4, 5];

/** How the match ends when the player's script fights the given enemy. The winner is 'ALPHA' (player), 'BRAVO' (enemy) or 'DRAW'. */
function outcome(playerSource: string, enemyId: string, seed: number): { winner: string; reason: string } {
  const simulation = createSimulation([compileBrain(playerSource), compileBrain(findEnemy(enemyId).source)], {
    arena: DEFAULT_ARENA,
    stats: ROBOT_DEFAULTS,
    seed,
  });
  runToEnd(simulation);
  return { winner: simulation.result?.winnerId ?? 'DRAW', reason: simulation.result?.reason ?? '' };
}

/** The distinct winners over all seeds. */
function winners(playerSource: string, enemyId: string): string[] {
  return [...new Set(SEEDS.map((seed) => outcome(playerSource, enemyId, seed).winner))];
}

describe('enemy list', () => {
  it('offers the three enemies of the spec, each with a unique id', () => {
    expect(ENEMIES.map((enemy) => enemy.name)).toEqual(['DumbBot', 'AggressiveBot', 'CowardBot']);
    expect(new Set(ENEMIES.map((enemy) => enemy.id)).size).toBe(ENEMIES.length);
  });

  it('has only scripts that compile', () => {
    for (const enemy of ENEMIES) expect(compileScript(enemy.source)).toMatchObject({ ok: true });
  });

  it('finds an enemy by id and falls back to the default for unknown ids', () => {
    expect(findEnemy('coward_bot').name).toBe('CowardBot');
    expect(findEnemy('no_such_bot')).toBe(DEFAULT_ENEMY);
    expect(findEnemy(null)).toBe(DEFAULT_ENEMY);
  });
});

// SPEC §32: the way the AI is written must clearly change who wins. Played in the default arena.
describe('strategies against the enemies', () => {
  it('the sample AI, as shipped, loses to DumbBot and CowardBot and beats AggressiveBot', () => {
    for (const seed of SEEDS) {
      expect(outcome(APPROACH, 'dumb_bot', seed)).toEqual({ winner: 'BRAVO', reason: 'destroyed' });
      expect(outcome(APPROACH, 'coward_bot', seed)).toEqual({ winner: 'BRAVO', reason: 'destroyed' });
      expect(outcome(APPROACH, 'aggressive_bot', seed)).toEqual({ winner: 'ALPHA', reason: 'destroyed' });
    }
  });

  it('the sample AI beats every enemy once it fires from further away', () => {
    const improved = APPROACH.replace('enemy_distance < 250', 'enemy_distance < 350');
    expect(improved).not.toBe(APPROACH);
    for (const enemy of ENEMIES) expect(winners(improved, enemy.id)).toEqual(['ALPHA']);
  });

  it('keeping distance beats DumbBot but not the enemies that fire from as far away', () => {
    expect(winners(KEEP_DISTANCE, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(KEEP_DISTANCE, 'aggressive_bot')).toEqual(['DRAW']);
    expect(winners(KEEP_DISTANCE, 'coward_bot')).toEqual(['DRAW']);
  });

  it('standing still beats DumbBot, which stops to fire inside its range', () => {
    expect(winners(TURRET, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(TURRET, 'aggressive_bot')).toEqual(['DRAW']);
  });

  it('rushing in never wins', () => {
    for (const enemy of ENEMIES) expect(winners(RUSH, enemy.id)).not.toContain('ALPHA');
  });

  it('turning around the centre block on the same hand as the enemy never meets it', () => {
    // The robots then stay on opposite sides of the block until time runs out.
    const sameHand = APPROACH.replace('turn left', 'turn right');
    expect(sameHand).not.toBe(APPROACH);
    for (const enemy of ENEMIES) {
      expect(outcome(sameHand, enemy.id, 1)).toEqual({ winner: 'DRAW', reason: 'timeout' });
    }
  });

  it('plays out the same way for the same seed', () => {
    for (const enemy of ENEMIES) {
      expect(outcome(KEEP_DISTANCE, enemy.id, 3)).toEqual(outcome(KEEP_DISTANCE, enemy.id, 3));
    }
  });
});
