import { describe, expect, it } from 'vitest';
import { type Entrant, builtInEntrants, fightNames, garageEntrants, playArenaSeries, prepareFight } from '../src/arena/match';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { COST_LIMIT, STANDARD_LOADOUT, costOf, statsOf } from '../src/data/parts';
import { TEMPLATES, templateSource } from '../src/data/templates';
import { Simulation } from '../src/sim/simulation';
import { DUEL_ARENA, runToEnd } from './helpers';

const SHOOT = 'loop\n    fire';
const SIT = 'loop\n    wait';

function saved(name: string, source: string, loadout = STANDARD_LOADOUT): Entrant {
  return garageEntrants([{ name, source, loadout }])[0];
}

function builtIn(templateId: string): Entrant {
  const entrant = builtInEntrants().find((candidate) => candidate.id === `built-in:${templateId}`);
  if (entrant === undefined) throw new Error(`No built-in robot "${templateId}"`);
  return entrant;
}

/** Plays a prepared fight to its end. */
function outcomeOf(entrants: [Entrant, Entrant], seed: number, arena = DUEL_ARENA) {
  const prepared = prepareFight(entrants, arena, seed);
  if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
  const simulation = new Simulation(prepared.fight.config);
  runToEnd(simulation);
  return { result: simulation.result, tick: simulation.tick, hp: simulation.robots.map((robot) => robot.hp) };
}

describe('builtInEntrants', () => {
  it('offers every template as a robot of standard parts', () => {
    const entrants = builtInEntrants();
    expect(entrants.map((entrant) => entrant.name)).toEqual(TEMPLATES.map((template) => template.name));
    expect(new Set(entrants.map((entrant) => entrant.id)).size).toBe(entrants.length);
    for (const entrant of entrants) {
      expect(entrant.origin).toBe('built-in');
      expect(entrant.loadout).toEqual(STANDARD_LOADOUT);
    }
  });

  it('gives a robot the program that suits the side it starts on', () => {
    const template = TEMPLATES[0];
    const entrant = builtIn(template.id);
    expect(entrant.sourceFor(0)).toBe(templateSource(template, 0));
    expect(entrant.sourceFor(1)).toBe(templateSource(template, 1));
    expect(entrant.sourceFor(0)).not.toBe(entrant.sourceFor(1));
  });
});

describe('garageEntrants', () => {
  it('offers the saved robots, with the program and the parts they were saved with', () => {
    const loadout = { ...STANDARD_LOADOUT, body: 'heavy', sensor: 'short' };
    const [entrant] = garageEntrants([{ name: 'Tank', source: SHOOT, loadout }]);
    expect(entrant).toMatchObject({ id: 'garage:Tank', name: 'Tank', origin: 'garage', loadout });
    expect(entrant.sourceFor(0)).toBe(SHOOT);
    expect(entrant.sourceFor(1)).toBe(SHOOT);
  });

  it('tells a saved robot from a built-in one of the same name', () => {
    const [mine] = garageEntrants([{ name: 'DumbBot', source: SIT, loadout: STANDARD_LOADOUT }]);
    expect(mine.id).not.toBe(builtIn('dumb_bot').id);
  });
});

describe('fightNames', () => {
  it('keeps the names of two different robots', () => {
    expect(fightNames([saved('Striker', SHOOT), saved('Tank', SIT)])).toEqual(['Striker', 'Tank']);
  });

  it('tells a robot from itself, and from another of the same name', () => {
    const striker = saved('Striker', SHOOT);
    expect(fightNames([striker, striker])).toEqual(['Striker', 'Striker (2)']);
    expect(fightNames([saved('DumbBot', SIT), builtIn('dumb_bot')])).toEqual(['DumbBot', 'DumbBot (2)']);
  });
});

describe('prepareFight', () => {
  it('sends the robots in with their own names, parts and stats, the first at the first spawn point', () => {
    const heavy = { ...STANDARD_LOADOUT, body: 'heavy', sensor: 'short' };
    const prepared = prepareFight([saved('Tank', SHOOT, heavy), saved('Striker', SIT)], DUEL_ARENA, 7);
    if (!prepared.ok) throw new Error('refused');
    const { names, loadouts, config } = prepared.fight;
    expect(names).toEqual(['Tank', 'Striker']);
    expect(loadouts).toEqual([heavy, STANDARD_LOADOUT]);
    expect(config.seed).toBe(7);
    expect(config.arena).toBe(DUEL_ARENA);
    expect(config.robots.map((robot) => robot.id)).toEqual(['Tank', 'Striker']);
    expect(config.robots.map((robot) => robot.stats)).toEqual([statsOf(heavy), statsOf(STANDARD_LOADOUT)]);
  });

  it('makes a match that the robots fight with their own programs', () => {
    expect(outcomeOf([saved('Striker', SHOOT), saved('Tank', SIT)], 1).result).toMatchObject({ winnerId: 'Striker' });
    expect(outcomeOf([saved('Tank', SIT), saved('Striker', SHOOT)], 1).result).toMatchObject({ winnerId: 'Striker' });
  });

  it('makes the same match again from the same seed, with fresh brains', () => {
    const entrants: [Entrant, Entrant] = [builtIn('sample'), builtIn('dumb_bot')];
    expect(outcomeOf(entrants, 3, DEFAULT_ARENA)).toEqual(outcomeOf(entrants, 3, DEFAULT_ARENA));
  });

  it('lets a robot fight itself', () => {
    const striker = saved('Striker', SHOOT);
    const prepared = prepareFight([striker, striker], DUEL_ARENA, 1);
    expect(prepared.ok && prepared.fight.names).toEqual(['Striker', 'Striker (2)']);
    expect(outcomeOf([striker, striker], 1).result).not.toBeNull();
  });

  it('refuses a program that does not compile, naming the robot and the line', () => {
    const prepared = prepareFight([saved('Broken', 'loop\n    fly'), saved('Tank', SIT)], DUEL_ARENA, 1);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.problems).toHaveLength(1);
      expect(prepared.problems[0]).toMatch(/^Broken: Line 2: /);
    }
  });

  it('refuses parts that cost more than the limit', () => {
    const tooMuch = { ...STANDARD_LOADOUT, body: 'heavy', gun: 'cannon' };
    const prepared = prepareFight([saved('Tank', SIT), saved('Greedy', SIT, tooMuch)], DUEL_ARENA, 1);
    expect(prepared).toEqual({
      ok: false,
      problems: [`Greedy: parts cost ${costOf(tooMuch)}, over the limit of ${COST_LIMIT}`],
    });
  });

  it('lists everything wrong with both robots', () => {
    const tooMuch = { ...STANDARD_LOADOUT, body: 'heavy', gun: 'cannon' };
    const prepared = prepareFight([saved('One', 'fly', tooMuch), saved('Two', 'swim')], DUEL_ARENA, 1);
    expect(prepared.ok === false && prepared.problems.map((problem) => problem.split(':')[0])).toEqual(['One', 'One', 'Two']);
  });
});

describe('playArenaSeries', () => {
  const seeds = [1, 2, 3];

  it('plays every seed from both sides and counts the wins in the order of the entrants', () => {
    const played = playArenaSeries([saved('Tank', SIT), saved('Striker', SHOOT)], DUEL_ARENA, seeds);
    if (!played.ok) throw new Error('refused');
    expect(played.names).toEqual(['Tank', 'Striker']);
    expect(played.result).toMatchObject({ matches: seeds.length * 2, wins: [0, seeds.length * 2], draws: 0 });
  });

  it('lets a robot play a series against itself', () => {
    const striker = saved('Striker', SHOOT);
    const played = playArenaSeries([striker, striker], DUEL_ARENA, seeds);
    expect(played.ok && played.names).toEqual(['Striker', 'Striker (2)']);
    expect(played.ok && played.result.matches).toBe(seeds.length * 2);
  });

  it('gives a built-in robot the program for the side it starts on in each match', () => {
    const played = playArenaSeries([builtIn('sample'), builtIn('dumb_bot')], DEFAULT_ARENA, [1]);
    if (!played.ok) throw new Error('refused');
    // As when the two templates are played by hand, once from each side.
    const byHand = [
      outcomeOf([builtIn('sample'), builtIn('dumb_bot')], 1, DEFAULT_ARENA).result?.winnerId,
      outcomeOf([builtIn('dumb_bot'), builtIn('sample')], 1, DEFAULT_ARENA).result?.winnerId,
    ];
    expect(played.result.wins).toEqual([
      byHand.filter((winner) => winner === 'Sample').length,
      byHand.filter((winner) => winner === 'DumbBot').length,
    ]);
  });

  it('is refused for the same reasons as a single match', () => {
    const played = playArenaSeries([saved('Tank', SIT), saved('Broken', 'fly')], DUEL_ARENA, seeds);
    expect(played.ok).toBe(false);
    expect(!played.ok && played.problems[0]).toMatch(/^Broken: Line 1: /);
  });
});
