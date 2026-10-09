import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { scatterSpawns } from '../src/arena/spawns';
import { ARENAS, DEFAULT_ARENA } from '../src/data/arenas';
import { OPEN_FIELD } from '../src/data/arenas/open_field';
import { STANDARD_LOADOUT, partsOf, statsOf } from '../src/data/parts';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate } from '../src/data/templates';
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

/** The distinct winners over all seeds when the enemy runs a program written for the player. */
function winnersAgainst(playerSource: string, enemyStrategy: string, arena: Arena = DEFAULT_ARENA): string[] {
  return [...new Set(SEEDS.map((seed) => duel(playerSource, mirrorTurns(enemyStrategy), seed, arena).winner))];
}

/** The templates written as enemies; the player's own starting program is the sample. */
const ENEMY_IDS = ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot', 'cover_bot', 'strafe_bot', 'sentry_bot'];

describe('template list', () => {
  it('offers the sample, the three enemies of the spec and four that defend themselves or aim ahead, each with a unique id', () => {
    expect(TEMPLATES.map((template) => template.name)).toEqual([
      'Sample',
      'DumbBot',
      'AggressiveBot',
      'CowardBot',
      'GuardBot',
      'CoverBot',
      'HitAndHideBot',
      'StrafeBot',
      'SentryBot',
    ]);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
  });

  it('starts the player with the sample and the enemy with DumbBot', () => {
    expect(DEFAULT_TEMPLATES.map((template) => template.id)).toEqual(['sample', 'dumb_bot']);
  });

  it('has only templates that compile', () => {
    for (const template of TEMPLATES) {
      expect(compileScript(template.source)).toMatchObject({ ok: true });
    }
  });

  it('says which template it is on the first line of each, so that a loaded one can be told apart', () => {
    for (const template of TEMPLATES) {
      expect(template.source.split('\n')[0]).toMatch(new RegExp(`^# ${template.name}: `));
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

  it('is the left, for every template and wherever it is loaded', () => {
    // Two robots that go round the same way can fail to meet; the player changes the side when they do.
    for (const template of TEMPLATES) {
      expect(turns(template.source).at(-1)).toBe('turn left');
    }
  });

  it('does not change how StrafeBot turns its side to the enemy', () => {
    // Those turns go by where the enemy is, not by a side of the arena.
    const strafe = findTemplate('strafe_bot');
    if (strafe === undefined) throw new Error('Expected StrafeBot');
    expect(turns(strafe.source).slice(0, 2)).toEqual(['turn left', 'turn right']);
  });

  it('is the other one for CoverBot once it has hidden, to meet the enemy head-on', () => {
    expect(turns(findTemplate('cover_bot')?.source ?? '')).toEqual(['turn right', 'turn left']);
  });
});

describe('going round obstacles the other way when the enemy stays out of sight', () => {
  const turnsAtObstacles = (templateId: string, ticks: number) => {
    const brain = compileBrain(enemySource(templateId));
    const actions = Array.from({ length: ticks }, () => brain.decide({ ...QUIET_CONTEXT, blocked: true }));
    return [...new Set(actions.map((action) => action.turn).filter((turn) => turn !== null))];
  };

  for (const templateId of ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot', 'strafe_bot', 'sentry_bot']) {
    it(`${templateId} turns left at obstacles, and right after ten seconds without a sight of the enemy`, () => {
      expect(turnsAtObstacles(templateId, 300)).toEqual(['left']);
      expect(turnsAtObstacles(templateId, 320)).toEqual(['left', 'right']);
    });
  }

  it('the sample does not: it is the first program a player reads', () => {
    expect(turnsAtObstacles('sample', 320)).toEqual(['left']);
  });
});

describe('AggressiveBot', () => {
  const inRange = { ...QUIET_CONTEXT, enemyVisible: true, enemyDistance: 200 };

  it('keeps driving at the enemy while it shoots', () => {
    const aggressive = compileBrain(enemySource('aggressive_bot'));
    expect(aggressive.decide(inRange)).toMatchObject({ drive: 'forward', turn: 'enemy' });
    expect(aggressive.decide(inRange)).toMatchObject({ fire: true });
  });

  it('stops pushing once it is right up against the enemy', () => {
    const aggressive = compileBrain(enemySource('aggressive_bot'));
    const touching = { ...inRange, touchingEnemy: true };
    expect(aggressive.decide(touching)).toMatchObject({ drive: 'stop', turn: 'enemy' });
    expect(aggressive.decide(touching)).toMatchObject({ fire: true });
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
  it('turns to face a shooter it cannot see, and only then', () => {
    const firstTick = (context: typeof QUIET_CONTEXT) => compileBrain(enemySource('guard_bot')).decide(context);
    expect(firstTick({ ...QUIET_CONTEXT, hit: true, hitAngle: 90 })).toMatchObject({ turn: 'hit', label: 'SEARCH' });
    // It keeps turning until it faces the shooter, one tick at a time, then heads that way.
    const guardBot = compileBrain(enemySource('guard_bot'));
    expect(guardBot.decide({ ...QUIET_CONTEXT, hit: true, hitAngle: 90 })).toMatchObject({ turn: 'hit' });
    expect(guardBot.decide({ ...QUIET_CONTEXT, hitAngle: 40 })).toMatchObject({ turn: 'hit' });
    expect(guardBot.decide({ ...QUIET_CONTEXT, hitAngle: 0 })).toMatchObject({ turn: null, drive: 'forward' });
    expect(firstTick({ ...QUIET_CONTEXT, hit: true, enemyVisible: true, enemyDistance: 200 })).toMatchObject({ turn: 'enemy' });
    expect(firstTick(QUIET_CONTEXT)).toMatchObject({ drive: 'forward', turn: null });
  });

  it('beats DumbBot, whose program it shares but for the guard, from most starting places', () => {
    const guardBot = findTemplate('guard_bot')?.source ?? '';
    expect(guardBot).toContain('guard');
    const places = Array.from({ length: 20 }, (_, index) => index + 1);
    const won = places.filter(
      (seed) => duel(guardBot, enemySource('dumb_bot'), seed, scatterSpawns(DEFAULT_ARENA, seed)).winner === 'ALPHA',
    );
    expect(won.length).toBeGreaterThanOrEqual(12);
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
  it('recovers in cover until it is nearly whole, and comes out to fight when the enemy finds it', () => {
    const coverBot = findTemplate('cover_bot')?.source ?? '';
    const atCover = { ...QUIET_CONTEXT, hp: 100, coverVisible: true, coverDistance: 0, hidden: true };
    const brain = compileBrain(coverBot);
    // Hurt, at cover and out of the enemy's sight: it waits there, facing where the enemy was, while it is hurt.
    expect(brain.decide(atCover)).toMatchObject({ turn: 'enemy', fire: false, label: 'EVADE' });
    const recovering = { ...atCover, hp: 150 };
    for (let tick = 0; tick < 5; tick++) expect(brain.decide(recovering)).toMatchObject({ turn: 'enemy', fire: false });
    // Found by the enemy: it fights.
    const found = { ...atCover, hidden: false, hp: 150, enemyVisible: true, enemyDistance: 300 };
    brain.decide(found);
    expect(brain.decide(found)).toMatchObject({ fire: true, label: 'ATTACK' });
  });

  it('goes into hiding once it is hurt', () => {
    const logger = new DebugLogger();
    const simulation = createSimulation(
      [compileBrain(findTemplate('cover_bot')?.source ?? ''), compileBrain(enemySource('coward_bot'))],
      { arena: DEFAULT_ARENA, stats: ROBOT_DEFAULTS, logger },
    );
    runToEnd(simulation);

    const messages = logger.events.filter((event) => event.robotId === 'ALPHA').map((event) => event.message);
    const evading = messages.indexOf('label ATTACK -> EVADE');
    expect(evading).toBeGreaterThan(-1);
    expect(messages.indexOf('turn cover', evading)).toBeGreaterThan(evading);
  });
});

describe('HitAndHideBot', () => {
  const inSight = { ...QUIET_CONTEXT, enemyVisible: true, enemyDistance: 300, coverVisible: true, coverDistance: 100 };

  it('fires one shot, runs for cover, rests out of sight for 3 seconds, then comes out to find the enemy', () => {
    const brain = compileBrain(findTemplate('hit_and_hide_bot')?.source ?? '');
    expect(brain.decide(inSight)).toMatchObject({ fire: true, label: 'SHOOT' });
    // Still in sight, gun ready again: it does not shoot a second time, it runs.
    expect(brain.decide(inSight)).toMatchObject({ fire: false, turn: 'cover', drive: 'forward', label: 'RUN' });
    const hidden = { ...QUIET_CONTEXT, hidden: true, coverVisible: true };
    for (let tick = 0; tick < 89; tick++) expect(brain.decide(hidden)).toMatchObject({ drive: 'stop', label: 'HIDE' });
    brain.decide(hidden);
    expect(brain.decide(hidden)).toMatchObject({ drive: 'forward', label: 'SEEK' });
  });

  it('fights back instead of hiding with the enemy right against it, or with nowhere to hide', () => {
    const touched = compileBrain(findTemplate('hit_and_hide_bot')?.source ?? '');
    touched.decide(inSight);
    expect(touched.decide({ ...inSight, touchingEnemy: true })).toMatchObject({ fire: true, label: 'SHOOT' });

    const open = compileBrain(findTemplate('hit_and_hide_bot')?.source ?? '');
    open.decide(inSight);
    expect(open.decide({ ...inSight, coverVisible: false })).toMatchObject({ fire: true, label: 'SHOOT' });
  });

  it('waits for the gun to be ready rather than going into hiding without a shot', () => {
    const brain = compileBrain(findTemplate('hit_and_hide_bot')?.source ?? '');
    expect(brain.decide({ ...inSight, reload: 0.5 })).toMatchObject({ fire: false, label: 'SHOOT' });
    expect(brain.decide(inSight)).toMatchObject({ fire: true, label: 'SHOOT' });
  });
});

describe('SentryBot', () => {
  const inRange = { ...QUIET_CONTEXT, enemyVisible: true, enemyDistance: 300 };

  it('closes in on an enemy out of range, and stops within range to aim ahead of it and fire', () => {
    const sentry = compileBrain(enemySource('sentry_bot'));
    expect(sentry.decide({ ...inRange, enemyDistance: 500 })).toMatchObject({ drive: 'forward', turn: 'enemy', label: 'TRACK' });
    expect(sentry.decide({ ...inRange, leadAngle: 10 })).toMatchObject({ drive: 'stop', aim: 'lead', fire: false, label: 'ATTACK' });
    expect(sentry.decide({ ...inRange, leadAngle: 1 })).toMatchObject({ drive: 'stop', aim: null, fire: true });
  });

  it('turns to face a shooter it cannot see', () => {
    const sentry = compileBrain(enemySource('sentry_bot'));
    expect(sentry.decide({ ...QUIET_CONTEXT, hit: true, hitAngle: 90 })).toMatchObject({ turn: 'hit' });
    expect(sentry.decide({ ...QUIET_CONTEXT, hitAngle: 30 })).toMatchObject({ turn: 'hit' });
    expect(sentry.decide({ ...QUIET_CONTEXT, hitAngle: 0 })).toMatchObject({ turn: null, drive: 'forward' });
  });

  it('hits an enemy that drives across its line of fire, from standing still', () => {
    // StrafeBot crosses to and fro at range; shots aimed at where it is pass behind it.
    const logger = new DebugLogger();
    const simulation = createSimulation(
      [compileBrain(enemySource('sentry_bot')), compileBrain(STRAFE)],
      { arena: OPEN_FIELD, stats: ROBOT_DEFAULTS, logger },
    );
    runToEnd(simulation);
    const hitsOnStrafe = logger.events.filter((event) => event.type === 'hit' && event.robotId === 'BRAVO');
    expect(hitsOnStrafe.length).toBeGreaterThanOrEqual(5);
    expect(logger.events.filter((event) => event.robotId === 'ALPHA').map((event) => event.message)).toContain('aim lead');
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

// As the first spec asked: the way the AI is written must clearly change who wins. Played in
// the default arena from the starting places the seeds give, as the game
// plays it: a lesson holds when it holds from most of them.
describe('strategies against the enemies', () => {
  const PLACES = Array.from({ length: 20 }, (_, index) => index + 1);
  /** From how many of the starting places a lesson must hold. */
  const MOST = 12;

  interface Tally {
    wins: number;
    losses: number;
    draws: number;
    timeouts: number;
  }

  /** How the player's program does against the enemy template from every starting place. */
  function tally(playerSource: string, enemyId: string): Tally {
    const tally: Tally = { wins: 0, losses: 0, draws: 0, timeouts: 0 };
    for (const seed of PLACES) {
      const { winner, reason } = duel(playerSource, enemySource(enemyId), seed, scatterSpawns(DEFAULT_ARENA, seed));
      if (winner === 'ALPHA') tally.wins++;
      else if (winner === 'BRAVO') tally.losses++;
      else tally.draws++;
      if (reason === 'timeout') tally.timeouts++;
    }
    return tally;
  }

  it('HitAndHideBot wears down StrafeBot, which crosses the open, but loses to DumbBot, which comes to it', () => {
    const hitAndHide = findTemplate('hit_and_hide_bot')?.source ?? '';
    const strafe = tally(hitAndHide, 'strafe_bot');
    const dumb = tally(hitAndHide, 'dumb_bot');
    expect(strafe.wins).toBeGreaterThanOrEqual(MOST);
    expect(dumb.losses).toBeGreaterThanOrEqual(MOST);
  });

  it('the sample AI loses to every enemy that stops to shoot', () => {
    for (const enemyId of ['dumb_bot', 'coward_bot', 'guard_bot', 'strafe_bot', 'sentry_bot']) {
      expect(tally(APPROACH, enemyId).losses, enemyId).toBeGreaterThanOrEqual(MOST);
    }
    // CoverBot hides deep whenever it is hurt, and the sample, which keeps coming, runs it down there.
    expect(tally(APPROACH, 'cover_bot').wins).toBeGreaterThanOrEqual(MOST);
    // AggressiveBot only ever shoots on the move, and its shots scatter: even the sample beats it.
    expect(tally(APPROACH, 'aggressive_bot').wins).toBeGreaterThanOrEqual(MOST);
  });

  it('the sample AI beats DumbBot and GuardBot once it fires from further away', () => {
    const improved = APPROACH.replace('attack(250)', 'attack(350)');
    expect(improved).not.toBe(APPROACH);
    expect(tally(improved, 'dumb_bot').wins).toBeGreaterThanOrEqual(MOST);
    expect(tally(improved, 'guard_bot').wins).toBeGreaterThanOrEqual(MOST);
    expect(tally(improved, 'strafe_bot').losses).toBeGreaterThanOrEqual(MOST);
  });

  it('keeping distance beats the enemies that come to it, and mostly draws with CowardBot, which keeps its distance too', () => {
    for (const enemyId of ['dumb_bot', 'aggressive_bot', 'guard_bot']) {
      expect(tally(KEEP_DISTANCE, enemyId).wins, enemyId).toBeGreaterThanOrEqual(MOST);
    }
    const { wins, losses, draws } = tally(KEEP_DISTANCE, 'coward_bot');
    expect(draws).toBeGreaterThan(wins);
    expect(draws).toBeGreaterThan(losses);
  });

  it('rushing in, shooting on the move, loses to the enemies that stop to shoot', () => {
    // A shot fired while driving scatters five times as much.
    for (const enemyId of ['dumb_bot', 'guard_bot', 'coward_bot', 'strafe_bot', 'sentry_bot']) {
      expect(tally(RUSH, enemyId).losses, enemyId).toBeGreaterThanOrEqual(MOST);
    }
    // CoverBot hides from it and gets run down.
    expect(tally(RUSH, 'cover_bot').wins).toBeGreaterThanOrEqual(MOST);
  });

  it('bracing on the very tick each bullet hits beats the enemies that stand still to shoot', () => {
    for (const enemyId of ['dumb_bot', 'aggressive_bot', 'guard_bot']) {
      expect(tally(GUARD, enemyId).wins, enemyId).toBeGreaterThanOrEqual(MOST);
    }
    expect(tally(GUARD, 'strafe_bot').losses).toBeGreaterThanOrEqual(MOST);
  });

  it('bracing a tick or two early wastes the guards and the time to shoot', () => {
    // With the guard on the right tick, this AI beats GuardBot (see above); a tick early, it mostly loses to it.
    const early = tally(EARLY_GUARD, 'guard_bot');
    expect(early.losses).toBeGreaterThan(early.wins);
    expect(early.wins).toBeLessThan(tally(GUARD, 'guard_bot').wins);
    expect(tally(EARLY_GUARD, 'dumb_bot').wins).toBeGreaterThanOrEqual(MOST);
  });

  it('dodging alone does not win: AggressiveBot keeps coming and shoots from too close to dodge', () => {
    expect(tally(DODGE, 'aggressive_bot').losses).toBeGreaterThanOrEqual(MOST);
  });

  it('two robots that go round the centre block the same way, as every template does, meet from almost every starting place', () => {
    let timeouts = 0;
    for (const enemyId of ENEMY_IDS) timeouts += tally(APPROACH, enemyId).timeouts;
    // A starting place near the middle line keeps them apart.
    expect(timeouts).toBeLessThanOrEqual(ENEMY_IDS.length);
  });

  it('and would stay half a turn apart from the middle line, until DumbBot goes round the other way', () => {
    // On the middle line the two stay on opposite sides of the block; after ten seconds without a
    // sight of the sample, DumbBot turns the other way at the next obstacle, and they meet.
    const onTheLine = { ...DEFAULT_ARENA, spawns: DEFAULT_ARENA.spawns.map((spawn) => ({ ...spawn, y: DEFAULT_ARENA.height / 2 })) };
    expect(duel(APPROACH, enemySource('dumb_bot'), 1, onTheLine)).toEqual({ winner: 'BRAVO', reason: 'destroyed' });
    // Two samples, neither of which does, never meet.
    expect(duel(APPROACH, APPROACH, 1, onTheLine)).toEqual({ winner: 'DRAW', reason: 'timeout' });
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

  it('and, now that shots fired on the move scatter, beats one that drives across its line of fire on most maps', () => {
    // On the open ground of Bare Ground and Corridor the one driving across still wins; Zigzag goes either way.
    const drivingWins = ['bare_ground', 'corridor'];
    for (const { id, name, arena } of ARENAS) {
      if (id === 'zigzag') continue;
      const winner = drivingWins.includes(id) ? 'ALPHA' : 'BRAVO';
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
      compileBrain(findTemplate(templateId)?.source ?? ''),
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
