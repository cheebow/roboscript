import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { ARENAS, DEFAULT_ARENA } from '../src/data/arenas';
import { OPEN_FIELD } from '../src/data/arenas/open_field';
import { STANDARD_LOADOUT, partsOf, statsOf } from '../src/data/parts';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate, templateSource } from '../src/data/templates';
import { DebugLogger } from '../src/debug/debug_logger';
import type { RobotBrain } from '../src/sim/ai_context';
import { distance } from '../src/sim/math';
import type { Arena } from '../src/sim/types';
import {
  DUEL_ARENA,
  FixedBrain,
  QUIET_CONTEXT,
  compileBrain,
  createSimulation,
  enemySource,
  mirrorTurns,
  runToEnd,
} from './helpers';
import {
  APPROACH,
  DODGE,
  EARLY_GUARD,
  GUARD,
  KEEP_DISTANCE,
  RUSH,
  STRAFE,
  TURRET,
  TURRET_LEAD,
} from './strategies';

const SEEDS = [1, 2, 3, 4, 5];

/** How the match ends between the player's program and the enemy's. The winner is 'ALPHA' (player), 'BRAVO' (enemy) or 'DRAW'. */
function duel(
  playerSource: string,
  enemyProgram: string,
  seed: number,
  arena: Arena = DEFAULT_ARENA,
): { winner: string; reason: string } {
  const simulation = createSimulation([compileBrain(playerSource), compileBrain(enemyProgram)], {
    arena,
    stats: ROBOT_DEFAULTS,
    seed,
  });
  runToEnd(simulation);
  return { winner: simulation.result?.winnerId ?? 'DRAW', reason: simulation.result?.reason ?? '' };
}

/** How the match ends when the player's script fights the given enemy template in the default arena. */
function outcome(playerSource: string, enemyId: string, seed: number): { winner: string; reason: string } {
  return duel(playerSource, enemySource(enemyId), seed);
}

/** The distinct winners over all seeds. */
function winners(playerSource: string, enemyId: string): string[] {
  return [...new Set(SEEDS.map((seed) => outcome(playerSource, enemyId, seed).winner))];
}

/** On how many of the seeds the player wins. */
function wins(playerSource: string, enemyId: string): number {
  return SEEDS.filter((seed) => outcome(playerSource, enemyId, seed).winner === 'ALPHA').length;
}

/** The distinct winners over all seeds when the enemy runs a program written for the player. */
function winnersAgainst(playerSource: string, enemyStrategy: string, arena: Arena = DEFAULT_ARENA): string[] {
  return [...new Set(SEEDS.map((seed) => duel(playerSource, mirrorTurns(enemyStrategy), seed, arena).winner))];
}

/** The templates written as enemies; the player's own starting program is the sample. */
const ENEMY_IDS = ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot', 'cover_bot', 'strafe_bot'];

describe('template list', () => {
  it('offers the sample, the three enemies of the spec and three that defend themselves, each with a unique id', () => {
    expect(TEMPLATES.map((template) => template.name)).toEqual([
      'Sample',
      'DumbBot',
      'AggressiveBot',
      'CowardBot',
      'GuardBot',
      'CoverBot',
      'StrafeBot',
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

describe('the side a template goes round obstacles', () => {
  /** The turns to a side that a program makes, in the order they are written. */
  const turns = (source: string) => source.match(/turn (left|right)/g) ?? [];

  it('is the left for the player and the right for the enemy', () => {
    for (const template of TEMPLATES) {
      expect(templateSource(template, 0)).toBe(template.build('left'));
      expect(templateSource(template, 1)).toBe(template.build('right'));
      expect(turns(template.build('left')).at(-1)).toBe('turn left');
      expect(turns(template.build('right')).at(-1)).toBe('turn right');
    }
  });

  it('is all that differs between the two', () => {
    const neutral = (source: string) => source.replace(/turn (left|right)/g, 'turn aside');
    for (const template of TEMPLATES) {
      expect(neutral(template.build('left'))).toBe(neutral(template.build('right')));
    }
  });

  it('does not change how StrafeBot turns its side to the enemy', () => {
    // Those turns go by where the enemy is, not by the side of the arena the robot starts on.
    const strafe = findTemplate('strafe_bot');
    if (strafe === undefined) throw new Error('Expected StrafeBot');
    const sideOn = (source: string) => turns(source).slice(0, 2);
    expect(sideOn(strafe.build('left'))).toEqual(['turn left', 'turn right']);
    expect(sideOn(strafe.build('right'))).toEqual(['turn left', 'turn right']);
  });

  it('is the other one for CoverBot once it has hidden, to meet the enemy head-on', () => {
    expect(turns(findTemplate('cover_bot')?.build('left') ?? '')).toEqual(['turn right', 'turn left']);
  });
});

describe('CowardBot', () => {
  const closeEnemy = { ...QUIET_CONTEXT, enemyVisible: true, enemyDistance: 200 };

  /** What CowardBot does, tick by tick, in an unchanging situation. */
  function ticks(count: number, context: typeof closeEnemy) {
    const coward = compileBrain(enemySource('coward_bot'));
    return Array.from({ length: count }, () => coward.decide(context));
  }

  it('turns to a close enemy, then shoots while it backs away', () => {
    const [turn, fire, next] = ticks(3, closeEnemy);
    expect(turn).toMatchObject({ turn: 'enemy', drive: null });
    expect(fire).toMatchObject({ fire: true, drive: 'backward', label: 'EVADE' });
    expect(next).toMatchObject({ turn: 'enemy', fire: false });
  });

  it('stands and fights when it cannot back away any further', () => {
    const [, fire] = ticks(2, { ...closeEnemy, blockedBehind: true });
    expect(fire).toMatchObject({ fire: true, drive: 'stop', label: 'ATTACK' });
  });
});

describe('GuardBot', () => {
  it('beats DumbBot, whose program it shares but for the guard, on all seeds but one', () => {
    const guardBot = findTemplate('guard_bot')?.build('left') ?? '';
    expect(guardBot).toContain('guard');
    expect(wins(guardBot, 'dumb_bot')).toBe(SEEDS.length - 1);
  });

  it('braces for as many of the shots that hit it as it has guards, a tick at a time', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation([compileBrain(APPROACH), compileBrain(enemySource('guard_bot'))], {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
      logger,
    });
    runToEnd(simulation);
    const hits = logger.events.filter((event) => event.type === 'hit' && event.robotId === 'ALPHA');
    const guarded = hits.filter((hit) => hit.message.endsWith('(guarded)'));
    expect(hits.length).toBeGreaterThan(ROBOT_DEFAULTS.maxGuards);
    expect(guarded).toHaveLength(ROBOT_DEFAULTS.maxGuards);
  });
});

describe('CoverBot', () => {
  it('goes into hiding once it is hurt', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation(
      [compileBrain(findTemplate('cover_bot')?.build('left') ?? ''), compileBrain(enemySource('coward_bot'))],
      { arena: DEFAULT_ARENA, stats: ROBOT_DEFAULTS, logger },
    );
    runToEnd(simulation);

    const messages = logger.events.filter((event) => event.robotId === 'ALPHA').map((event) => event.message);
    const evading = messages.indexOf('label ATTACK -> EVADE');
    expect(evading).toBeGreaterThan(-1);
    expect(messages.indexOf('turn cover', evading)).toBeGreaterThan(evading);
  });
});

describe('StrafeBot', () => {
  it('shoots at where the enemy will be, with its turret, while it drives', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation(
      [compileBrain(STRAFE), compileBrain(mirrorTurns(TURRET))],
      { arena: OPEN_FIELD, stats: ROBOT_DEFAULTS, logger },
    );
    runToEnd(simulation);
    const messages = logger.events.filter((event) => event.robotId === 'ALPHA').map((event) => event.message);
    expect(messages).toContain('aim lead');
    expect(messages).toContain('drive backward');
    expect(messages).toContain('fire');
  });
});

// SPEC §32: the way the AI is written must clearly change who wins. Played in the default arena unless said otherwise.
describe('strategies against the enemies', () => {
  it('the sample AI loses to DumbBot and to the enemies that defend themselves, without running out the clock', () => {
    for (const enemyId of ['dumb_bot', 'coward_bot', 'guard_bot', 'strafe_bot']) {
      for (const seed of SEEDS) expect(outcome(APPROACH, enemyId, seed)).toEqual({ winner: 'BRAVO', reason: 'destroyed' });
    }
    expect(winners(APPROACH, 'aggressive_bot')).toEqual(['ALPHA']);
    expect(winners(APPROACH, 'cover_bot')).toEqual(['ALPHA']);
  });

  it('the sample AI beats DumbBot once it fires from further away', () => {
    const improved = APPROACH.replace('attack(250)', 'attack(350)');
    expect(improved).not.toBe(APPROACH);
    expect(winners(improved, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(improved, 'aggressive_bot')).toEqual(['ALPHA']);
    expect(winners(improved, 'coward_bot')).toEqual(['ALPHA']);
    expect(winners(improved, 'guard_bot')).toEqual(['ALPHA']);
    expect(winners(improved, 'strafe_bot')).toEqual(['BRAVO']);
  });

  it('keeping distance beats DumbBot and mostly draws with the others that shoot from afar', () => {
    expect(winners(KEEP_DISTANCE, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winners(KEEP_DISTANCE, 'aggressive_bot')).toEqual(['DRAW']);
    // Against CowardBot one or the other goes down first on some seeds.
    const draws = SEEDS.filter((seed) => outcome(KEEP_DISTANCE, 'coward_bot', seed).winner === 'DRAW');
    expect(draws.length).toBeGreaterThan(SEEDS.length / 2);
  });

  it('rushing in loses to the enemies that stop to shoot', () => {
    expect(winners(RUSH, 'dumb_bot')).toEqual(['BRAVO']);
    expect(winners(RUSH, 'guard_bot')).toEqual(['BRAVO']);
    expect(winners(RUSH, 'aggressive_bot')).toEqual(['DRAW']);
  });

  it('bracing on the very tick each bullet hits beats the enemies that stand still to shoot', () => {
    for (const enemyId of ['dumb_bot', 'aggressive_bot', 'guard_bot', 'cover_bot']) {
      expect(winners(GUARD, enemyId)).toEqual(['ALPHA']);
    }
    // CowardBot gets the better of it on one seed.
    expect(wins(GUARD, 'coward_bot')).toBe(SEEDS.length - 1);
    expect(winners(GUARD, 'strafe_bot')).toEqual(['BRAVO']);
  });

  it('bracing a tick or two early wastes the guards and the time to shoot', () => {
    // Without the guard, and with the guard on the right tick, this AI beats CowardBot (see above).
    expect(winners(EARLY_GUARD, 'coward_bot')).toEqual(['BRAVO']);
    expect(winners(EARLY_GUARD, 'dumb_bot')).toEqual(['ALPHA']);
  });

  it('dodging until the enemy is out of ammo beats the enemies that keep shooting at where it is', () => {
    expect(winners(DODGE, 'coward_bot')).toEqual(['ALPHA']);
    // AggressiveBot keeps coming and shoots from too close to dodge.
    expect(winners(DODGE, 'aggressive_bot')).toEqual(['BRAVO']);
  });

  it('going round the centre block the same way as the enemy still meets it', () => {
    const sameWay = APPROACH.replace('turn left', 'turn right');
    expect(sameWay).not.toBe(APPROACH);
    for (const seed of SEEDS) expect(outcome(sameWay, 'dumb_bot', seed)).toEqual({ winner: 'BRAVO', reason: 'destroyed' });
  });

  it('but would never meet it if the robots started on the middle line', () => {
    // They then stay half a turn apart, on opposite sides of the block, until time runs out.
    const sameWay = APPROACH.replace('turn left', 'turn right');
    const onTheLine = { ...DEFAULT_ARENA, spawns: DEFAULT_ARENA.spawns.map((spawn) => ({ ...spawn, y: DEFAULT_ARENA.height / 2 })) };
    expect(duel(sameWay, enemySource('dumb_bot'), 1, onTheLine)).toEqual({ winner: 'DRAW', reason: 'timeout' });
  });

  it('plays out the same way for the same seed', () => {
    for (const enemyId of ENEMY_IDS) {
      expect(outcome(KEEP_DISTANCE, enemyId, 3)).toEqual(outcome(KEEP_DISTANCE, enemyId, 3));
    }
  });
});

describe('standing still against driving', () => {
  it('standing still and shooting from maximum range beats the enemies that drive straight up to it', () => {
    expect(winners(TURRET, 'dumb_bot')).toEqual(['ALPHA']);
    expect(winnersAgainst(TURRET, APPROACH)).toEqual(['ALPHA']);
  });

  it('but loses, on all maps but two, to one that drives across its line of fire', () => {
    // In Cross the arms of the cross leave too little room to drive across. In Center Block the one standing still wins as well.
    const standingWins = ['cross', 'center_block'];
    for (const { id, name, arena } of ARENAS) {
      const winner = standingWins.includes(id) ? 'BRAVO' : 'ALPHA';
      expect(winnersAgainst(STRAFE, TURRET, arena), name).toEqual([winner]);
    }
  });

  it('unless it shoots at where the enemy will be, on open ground', () => {
    expect(winnersAgainst(STRAFE, TURRET_LEAD, OPEN_FIELD)).toEqual(['BRAVO']);
  });

  it('driving across the line of fire beats the enemies that shoot at where it is', () => {
    for (const enemyId of ['aggressive_bot', 'coward_bot', 'dumb_bot', 'guard_bot']) {
      expect(winners(STRAFE, enemyId)).toEqual(['ALPHA']);
    }
  });
});

describe('templates that shoot from as far as their gun reaches', () => {
  /** Far enough apart that every gun is out of range at the start. */
  const FAR_APART: Arena = {
    ...DUEL_ARENA,
    spawns: [
      { x: 100, y: 300, rotation: 0 },
      { x: 900, y: 300, rotation: 180 },
    ],
  };
  /** How far a robot can get in the tick between reading the distance and the shot leaving its gun. */
  const ONE_STEP = 10;

  /**
   * The distance to a waiting enemy at which the template, with the given gun,
   * fires its first shot: the distance at the start of the tick it fires in.
   * Where it ends up after that tick may differ, as CowardBot backs away while
   * it fires when its gun reaches no farther than the distance it keeps.
   */
  function firstShotDistance(templateId: string, gun: string): number {
    const stats = statsOf({ ...STANDARD_LOADOUT, gun });
    const brains: [RobotBrain, RobotBrain] = [
      compileBrain(findTemplate(templateId)?.build('left') ?? ''),
      new FixedBrain(),
    ];
    const simulation = createSimulation(brains, {
      arena: FAR_APART,
      robots: [
        { id: 'ALPHA', brain: brains[0], stats },
        { id: 'BRAVO', brain: brains[1], stats: ROBOT_DEFAULTS },
      ],
    });
    const [alpha, bravo] = simulation.robots;
    let before = distance(alpha.position, bravo.position);
    while (alpha.weapon.ammo === stats.maxAmmo && simulation.result === null) {
      before = distance(alpha.position, bravo.position);
      simulation.step();
    }
    return before;
  }

  for (const templateId of ['aggressive_bot', 'coward_bot']) {
    for (const gun of partsOf('gun')) {
      it(`${templateId} with the ${gun.name} gun opens fire just inside its range`, () => {
        const { weaponRange } = statsOf({ ...STANDARD_LOADOUT, gun: gun.id });
        const opened = firstShotDistance(templateId, gun.id);
        expect(opened).toBeLessThanOrEqual(weaponRange);
        expect(opened).toBeGreaterThan(weaponRange - 2 * ONE_STEP);
      });
    }
  }
});
