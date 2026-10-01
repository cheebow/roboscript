import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { DebugLogger } from '../src/debug/debug_logger';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate, mirrorTurns, templateSource } from '../src/data/templates';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { QUIET_CONTEXT, compileBrain, createSimulation, enemySource, runToEnd } from './helpers';
import { APPROACH, DODGE, EARLY_GUARD, GUARD, KEEP_DISTANCE, RUSH, TURRET } from './strategies';

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
const ENEMY_IDS = ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot', 'cover_bot'];

describe('template list', () => {
  it('offers the sample, the three enemies of the spec and two that defend themselves, each with a unique id', () => {
    expect(TEMPLATES.map((template) => template.name)).toEqual([
      'Sample',
      'DumbBot',
      'AggressiveBot',
      'CowardBot',
      'GuardBot',
      'CoverBot',
    ]);
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

  it('gives the player templates that go left around obstacles and the enemy ones that go right', () => {
    /** The turns a program makes, in the order they are written. */
    const turns = (source: string) => source.match(/turn (left|right)/g) ?? [];
    for (const template of TEMPLATES) {
      const forPlayer = turns(templateSource(template, 0));
      const forEnemy = turns(templateSource(template, 1));
      expect(forPlayer.at(-1)).toBe('turn left');
      expect(forEnemy.at(-1)).toBe('turn right');
      expect(forEnemy).toEqual(forPlayer.map((turn) => (turn === 'turn left' ? 'turn right' : 'turn left')));
    }
    // Only CoverBot ever goes the other way: after hiding, to meet the enemy head-on.
    const bothWays = TEMPLATES.filter((template) => new Set(turns(template.source)).size > 1);
    expect(bothWays.map((template) => template.id)).toEqual(['cover_bot']);
  });
});

describe('CowardBot', () => {
  const closeEnemy = { ...QUIET_CONTEXT, enemyVisible: true, enemyDistance: 200 };

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

describe('GuardBot', () => {
  it('beats DumbBot, whose program it shares but for the guard', () => {
    const guardBot = findTemplate('guard_bot')?.source ?? '';
    expect(guardBot).toContain('guard');
    expect(winners(guardBot, 'dumb_bot')).toEqual(['ALPHA']);
  });

  it('braces for most of the shots that hit it, a tick at a time', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain(APPROACH), compileBrain(enemySource('guard_bot'))], {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
      logger,
    });
    runToEnd(simulation);
    const hits = logger.events.filter((event) => event.type === 'hit' && event.robotId === 'ALPHA');
    const guarded = hits.filter((hit) => hit.message.endsWith('(guarded)'));
    expect(hits.length).toBeGreaterThan(0);
    expect(guarded.length).toBeGreaterThan(hits.length / 2);
  });
});

describe('CoverBot', () => {
  it('goes into hiding once it is hurt, and comes out again', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation(
      [compileBrain(findTemplate('cover_bot')?.source ?? ''), compileBrain(enemySource('coward_bot'))],
      { arena: DEFAULT_ARENA, stats: ROBOT_DEFAULTS, logger },
    );
    runToEnd(simulation);

    const own = logger.events.filter((event) => event.robotId === 'ALPHA');
    const messages = own.map((event) => event.message);
    const evading = messages.indexOf('state ATTACK -> EVADE');
    expect(evading).toBeGreaterThan(-1);
    expect(messages).toContain('turn cover');
    // Out of the enemy's sight after that, then back to looking for it.
    const lost = messages.indexOf('enemy lost: BRAVO', evading);
    expect(lost).toBeGreaterThan(evading);
    expect(messages.indexOf('state EVADE -> SEARCH', lost)).toBeGreaterThan(lost);
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
    expect(winners(TURRET, 'guard_bot')).toEqual(['ALPHA']);
    expect(winners(TURRET, 'cover_bot')).toEqual(['ALPHA']);
  });

  it('bracing on the very tick each bullet hits beats every enemy', () => {
    for (const enemyId of ENEMY_IDS) expect(winners(GUARD, enemyId)).toEqual(['ALPHA']);
  });

  it('bracing a tick or two early costs more shots than it saves', () => {
    // Without the guard, this AI beats AggressiveBot (see the improved sample above).
    expect(winners(EARLY_GUARD, 'aggressive_bot')).toEqual(['BRAVO']);
    expect(winners(EARLY_GUARD, 'coward_bot')).toEqual(['BRAVO']);
    expect(winners(EARLY_GUARD, 'dumb_bot')).toEqual(['ALPHA']);
  });

  it('dodging until the enemy is out of ammo beats the enemies that keep shooting from afar', () => {
    expect(winners(DODGE, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(DODGE, 'coward_bot')).toEqual(['ALPHA']);
    expect(winners(DODGE, 'guard_bot')).toEqual(['ALPHA']);
    // AggressiveBot keeps coming and shoots from too close to dodge.
    expect(winners(DODGE, 'aggressive_bot')).toEqual(['BRAVO']);
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
