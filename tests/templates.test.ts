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

  /** What CowardBot does, tick by tick, in an unchanging situation. */
  function ticks(count: number, context: typeof closeEnemy) {
    const coward = compileBrain(enemySource('coward_bot'));
    return Array.from({ length: count }, () => coward.decide(context));
  }

  it('turns to a close enemy, shoots, and backs away, one tick each', () => {
    const [turn, fire, retreat] = ticks(3, closeEnemy);
    expect(turn).toMatchObject({ turn: 'enemy' });
    expect(fire).toMatchObject({ fire: true });
    expect(retreat).toMatchObject({ move: 'backward', state: 'EVADE' });
  });

  it('stands and fights when it cannot back away any further', () => {
    const [turn, fire, next] = ticks(3, { ...closeEnemy, blockedBehind: true });
    expect(turn).toMatchObject({ turn: 'enemy' });
    expect(fire).toMatchObject({ fire: true });
    // No retreat: it goes straight back to aiming, now in ATTACK.
    expect(next).toMatchObject({ turn: 'enemy', move: null, state: 'ATTACK' });
  });
});

// SPEC §32: the way the AI is written must clearly change who wins. Played in the default arena.
describe('strategies against the enemies', () => {
  it('the sample AI loses to every enemy as shipped, without running out the clock', () => {
    for (const enemyId of ENEMY_IDS) {
      for (const seed of SEEDS) expect(outcome(APPROACH, enemyId, seed)).toEqual({ winner: 'BRAVO', reason: 'destroyed' });
    }
  });

  it('the sample AI beats DumbBot and AggressiveBot once it fires from further away', () => {
    const improved = APPROACH.replace('enemy_distance < 250', 'enemy_distance < 350');
    expect(improved).not.toBe(APPROACH);
    expect(winners(improved, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(improved, 'aggressive_bot')).toEqual(['ALPHA']);
    expect(winners(improved, 'coward_bot')).toEqual(['BRAVO']);
  });

  it('keeping distance beats DumbBot and holds the others to a draw', () => {
    expect(winners(KEEP_DISTANCE, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(KEEP_DISTANCE, 'aggressive_bot')).toEqual(['DRAW']);
    expect(winners(KEEP_DISTANCE, 'coward_bot')).toEqual(['DRAW']);
  });

  it('standing still and shooting from maximum range never loses', () => {
    expect(winners(TURRET, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(TURRET, 'aggressive_bot')).toEqual(['ALPHA']);
    expect(winners(TURRET, 'coward_bot')).not.toContain('BRAVO');
  });

  it('rushing in beats DumbBot but not the enemies that fire from as far away', () => {
    expect(winners(RUSH, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(RUSH, 'aggressive_bot')).toEqual(['DRAW']);
    expect(winners(RUSH, 'coward_bot')).toEqual(['BRAVO']);
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
