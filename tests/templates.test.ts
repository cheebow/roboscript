import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate, mirrorTurns, templateSource } from '../src/data/templates';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { compileBrain, createSimulation, enemySource, runToEnd } from './helpers';
import { APPROACH, KEEP_DISTANCE, RUSH, TURRET } from './strategies';

const SEEDS = [1, 2, 3, 4, 5];

/** How the match ends when the player's script fights the given enemy. The winner is 'ALPHA' (player), 'BRAVO' (enemy) or 'DRAW'. */
function outcome(playerSource: string, enemyId: string, seed: number): { winner: string; reason: string } {
  const simulation = createSimulation([compileBrain(playerSource), compileBrain(enemySource(enemyId))], {
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

/** The templates written as enemies; the player's own starting program is the sample. */
const ENEMY_IDS = ['dumb_bot', 'aggressive_bot', 'coward_bot'];

describe('template list', () => {
  it('offers the sample and the three enemies of the spec, each with a unique id', () => {
    expect(TEMPLATES.map((template) => template.name)).toEqual(['Sample', 'DumbBot', 'AggressiveBot', 'CowardBot']);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
  });

  it('starts the player with the sample and the enemy with DumbBot', () => {
    expect(DEFAULT_TEMPLATES.map((template) => template.id)).toEqual(['sample', 'dumb_bot']);
  });

  it('has only templates that compile, for either robot', () => {
    for (const template of TEMPLATES) {
      for (const robotIndex of [0, 1]) {
        expect(compileScript(templateSource(template, robotIndex))).toMatchObject({ ok: true });
      }
    }
  });

  it('finds a template by id', () => {
    expect(findTemplate('coward_bot')?.name).toBe('CowardBot');
    expect(findTemplate('no_such_bot')).toBeUndefined();
  });
});

describe('turn mirroring', () => {
  it('swaps left and right turns and leaves everything else alone', () => {
    expect(mirrorTurns('turn left\nturn right\nturn enemy\nmove forward')).toBe(
      'turn right\nturn left\nturn enemy\nmove forward',
    );
  });

  it('gives back the original when applied twice', () => {
    for (const template of TEMPLATES) expect(mirrorTurns(mirrorTurns(template.source))).toBe(template.source);
  });

  it('gives the player templates that turn left and the enemy ones that turn right', () => {
    for (const template of TEMPLATES) {
      const forPlayer = templateSource(template, 0);
      const forEnemy = templateSource(template, 1);
      expect(forPlayer).toContain('turn left');
      expect(forPlayer).not.toContain('turn right');
      expect(forEnemy).toContain('turn right');
      expect(forEnemy).not.toContain('turn left');
    }
  });
});

describe('CowardBot', () => {
  const coward = () => compileBrain(enemySource('coward_bot'));
  const closeEnemy = {
    enemyVisible: true,
    enemyDistance: 200,
    enemyAngle: 0,
    enemyX: 0,
    enemyY: 0,
    hp: 100,
    ammo: 50,
    blocked: false,
    blockedBehind: false,
  };

  it('backs away from a close enemy while shooting', () => {
    expect(coward().decide(closeEnemy)).toMatchObject({ state: 'EVADE', move: 'backward', fire: true });
  });

  it('stands and fights when it cannot back away any further', () => {
    const cornered = coward().decide({ ...closeEnemy, blockedBehind: true });
    expect(cornered).toMatchObject({ state: 'ATTACK', move: null, turn: 'enemy', fire: true });
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
    for (const enemyId of ENEMY_IDS) expect(winners(improved, enemyId)).toEqual(['ALPHA']);
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
    for (const enemyId of ENEMY_IDS) expect(winners(RUSH, enemyId)).not.toContain('ALPHA');
  });

  it('turning around the centre block on the same hand as the enemy never meets it', () => {
    // The robots then stay on opposite sides of the block until time runs out.
    const sameHand = APPROACH.replace('turn left', 'turn right');
    expect(sameHand).not.toBe(APPROACH);
    for (const enemyId of ENEMY_IDS) {
      expect(outcome(sameHand, enemyId, 1)).toEqual({ winner: 'DRAW', reason: 'timeout' });
    }
  });

  it('plays out the same way for the same seed', () => {
    for (const enemyId of ENEMY_IDS) {
      expect(outcome(KEEP_DISTANCE, enemyId, 3)).toEqual(outcome(KEEP_DISTANCE, enemyId, 3));
    }
  });
});
