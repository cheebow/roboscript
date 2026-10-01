import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { DEFAULT_ARENA } from '../src/data/default_arena';
import { DEFAULT_ENEMY, ENEMIES, findEnemy } from '../src/data/enemies';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { compileBrain, createSimulation, runToEnd } from './helpers';
import { APPROACH, DODGE, KEEP_DISTANCE, TURRET } from './strategies';

const SEEDS = [1, 2, 3, 4, 5];

/** Who wins when the player's script fights the given enemy: 'ALPHA' (player), 'BRAVO' (enemy) or 'DRAW'. */
function winner(playerSource: string, enemyId: string, seed: number): string {
  const simulation = createSimulation([compileBrain(playerSource), compileBrain(findEnemy(enemyId).source)], {
    arena: DEFAULT_ARENA,
    stats: ROBOT_DEFAULTS,
    seed,
  });
  runToEnd(simulation);
  return simulation.result?.winnerId ?? 'DRAW';
}

function winners(playerSource: string, enemyId: string): string[] {
  return [...new Set(SEEDS.map((seed) => winner(playerSource, enemyId, seed)))];
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

// SPEC §32: the way the AI is written must clearly change who wins.
describe('strategies against the enemies', () => {
  it('the sample AI loses to every enemy as shipped', () => {
    for (const enemy of ENEMIES) expect(winners(APPROACH, enemy.id)).toEqual(['BRAVO']);
  });

  it('keeping distance beats the enemies that walk up to it', () => {
    expect(winners(KEEP_DISTANCE, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(KEEP_DISTANCE, 'aggressive_bot')).toEqual(['ALPHA']);
  });

  it('keeping distance does not beat the enemy that also keeps its distance', () => {
    expect(winners(KEEP_DISTANCE, 'coward_bot')).toContain('DRAW');
  });

  it('standing still beats only the enemy that stops outside its own range', () => {
    expect(winners(TURRET, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(TURRET, 'aggressive_bot')).toEqual(['DRAW']);
    expect(winners(TURRET, 'coward_bot')).toEqual(['DRAW']);
  });

  it('sidestepping beats every enemy', () => {
    for (const enemy of ENEMIES) expect(winners(DODGE, enemy.id)).toEqual(['ALPHA']);
  });

  it('plays out the same way for the same seed', () => {
    for (const enemy of ENEMIES) {
      expect(winner(KEEP_DISTANCE, enemy.id, 3)).toBe(winner(KEEP_DISTANCE, enemy.id, 3));
    }
  });
});
