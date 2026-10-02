import { describe, expect, it } from 'vitest';
import {
  type Entrant,
  type SeriesFixture,
  builtInEntrants,
  fightNames,
  garageEntrants,
  inOrder,
  isMirrored,
  playArenaSeries,
  prepareFight,
} from '../src/arena/match';
import { scatterSpawns } from '../src/arena/spawns';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { COST_LIMIT, STANDARD_LOADOUT, costOf, statsOf } from '../src/data/parts';
import { TEMPLATES, templateSource } from '../src/data/templates';
import { normalizeAngle } from '../src/sim/math';
import type { StartSide } from '../src/sim/mirror';
import { Simulation } from '../src/sim/simulation';
import type { Arena } from '../src/sim/types';
import { DUEL_ARENA, runToEnd } from './helpers';

/** Turns to the enemy, wherever it starts, and shoots. */
const SHOOT = 'loop\n    turn enemy\n    fire';
const SIT = 'loop\n    wait';

function saved(name: string, source: string, loadout = STANDARD_LOADOUT, side: StartSide = 0): Entrant {
  return garageEntrants([{ name, source, loadout, side }])[0];
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
      expect(entrant.side).toBeNull();
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
    const [entrant] = garageEntrants([{ name: 'Tank', source: SHOOT, loadout, side: 1 }]);
    expect(entrant).toMatchObject({ id: 'garage:Tank', name: 'Tank', origin: 'garage', loadout, side: 1 });
    expect(entrant.sourceFor(0)).toBe(SHOOT);
    expect(entrant.sourceFor(1)).toBe(SHOOT);
  });

  it('tells a saved robot from a built-in one of the same name', () => {
    const mine = saved('DumbBot', SIT);
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
    expect(config.arena).toEqual(scatterSpawns(DUEL_ARENA, 7));
    expect(config.robots.map((robot) => robot.id)).toEqual(['Tank', 'Striker']);
    expect(config.robots.map((robot) => robot.stats)).toEqual([statsOf(heavy), statsOf(STANDARD_LOADOUT)]);
  });

  it('starts the robots where the seed puts them', () => {
    const entrants: [Entrant, Entrant] = [saved('Striker', SHOOT), saved('Tank', SIT)];
    const startOf = (seed: number) => {
      const prepared = prepareFight(entrants, DUEL_ARENA, seed);
      if (!prepared.ok) throw new Error('refused');
      return new Simulation(prepared.fight.config).robots.map((robot) => robot.position);
    };
    expect(startOf(7)).toEqual(scatterSpawns(DUEL_ARENA, 7).spawns.map(({ x, y }) => ({ x, y })));
    expect(startOf(7)).toEqual(startOf(7));
    expect(startOf(8)).not.toEqual(startOf(7));
  });

  it('makes a match that the robots fight with their own programs', () => {
    expect(outcomeOf([saved('Striker', SHOOT), saved('Tank', SIT)], 1).result).toMatchObject({ winnerId: 'Striker' });
    expect(outcomeOf([saved('Tank', SIT), saved('Striker', SHOOT)], 1).result).toMatchObject({ winnerId: 'Striker' });
  });

  it('makes the same match again from the same seed, with fresh brains', () => {
    const entrants: [Entrant, Entrant] = [builtIn('sample'), builtIn('dumb_bot')];
    expect(outcomeOf(entrants, 3, DEFAULT_ARENA)).toEqual(outcomeOf(entrants, 3, DEFAULT_ARENA));
  });

  it('runs a robot in a mirror when it starts on the other side than it was written for', () => {
    // Turns left for ever: its rotation goes down as written, up in a mirror.
    const spinner = (side: StartSide) => saved('Spinner', 'loop\n    turn left', STANDARD_LOADOUT, side);
    const turnOf = (entrants: [Entrant, Entrant], spawnIndex: number) => {
      const prepared = prepareFight(entrants, DUEL_ARENA, 1);
      if (!prepared.ok) throw new Error('refused');
      const simulation = new Simulation(prepared.fight.config);
      const before = simulation.robots[spawnIndex].rotation;
      simulation.step();
      return Math.sign(normalizeAngle(simulation.robots[spawnIndex].rotation - before));
    };
    const still = saved('Tank', SIT);
    expect(turnOf([spinner(0), still], 0)).toBe(-1);
    expect(turnOf([still, spinner(0)], 1)).toBe(1);
    expect(turnOf([spinner(1), still], 0)).toBe(1);
    expect(turnOf([still, spinner(1)], 1)).toBe(-1);
  });

  it('tells which entrants run in a mirror', () => {
    expect(isMirrored(saved('A', SIT, STANDARD_LOADOUT, 0), 0)).toBe(false);
    expect(isMirrored(saved('A', SIT, STANDARD_LOADOUT, 0), 1)).toBe(true);
    expect(isMirrored(saved('B', SIT, STANDARD_LOADOUT, 1), 0)).toBe(true);
    expect(isMirrored(builtIn('sample'), 0)).toBe(false);
    expect(isMirrored(builtIn('sample'), 1)).toBe(false);
  });

  it('lets two robots written for the same side meet where something stands in the middle', () => {
    const template = TEMPLATES.find((candidate) => candidate.id === 'dumb_bot');
    const source = template?.build('left') ?? '';
    const entrants: [Entrant, Entrant] = [saved('One', source), saved('Two', source)];
    for (const seed of [1, 2, 3]) expect(outcomeOf(entrants, seed, DEFAULT_ARENA).result?.reason).not.toBe('timeout');
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
  /** Every seed from both sides in the arena. */
  const roundsIn = (arena: Arena, roundSeeds: readonly number[] = seeds): SeriesFixture[] =>
    roundSeeds.flatMap((seed) => [
      { arena, seed, first: 0 },
      { arena, seed, first: 1 },
    ]);

  it('plays every seed from both sides and counts the wins in the order of the entrants', () => {
    const played = playArenaSeries([saved('Tank', SIT), saved('Striker', SHOOT)], roundsIn(DUEL_ARENA));
    if (!played.ok) throw new Error('refused');
    expect(played.names).toEqual(['Tank', 'Striker']);
    expect(played.result).toMatchObject({ matches: seeds.length * 2, wins: [0, seeds.length * 2], draws: 0 });
  });

  it('plays each seed from its own starting places', () => {
    // Shoots straight ahead without turning: it hits only an enemy that starts level with it.
    const blind = saved('Blind', 'loop\n    fire');
    const level = (seed: number) => {
      const [first, second] = scatterSpawns(DUEL_ARENA, seed).spawns;
      return Math.abs(first.y - second.y) < 30;
    };
    const candidates = Array.from({ length: 60 }, (_, index) => index + 1);
    const apart = candidates.filter((seed) => !level(seed)).slice(0, 3);
    const played = playArenaSeries([blind, saved('Tank', SIT)], roundsIn(DUEL_ARENA, apart));
    expect(apart).toHaveLength(3);
    expect(played.ok && played.result).toMatchObject({ matches: 6, wins: [0, 0], draws: 6 });
  });

  it('tells how every match went, in the order they were fought', () => {
    const played = playArenaSeries([saved('Tank', SIT), saved('Striker', SHOOT)], roundsIn(DUEL_ARENA));
    if (!played.ok) throw new Error('refused');
    expect(played.matches).toHaveLength(seeds.length * 2);
    // Striker, the second entrant, wins wherever it starts.
    for (const match of played.matches) {
      expect(match).toMatchObject({ winner: 1, reason: 'destroyed' });
      expect(match.ticks).toBeGreaterThan(0);
    }
  });

  it('plays each match from the starting places of its own seed', () => {
    const entrants: [Entrant, Entrant] = [builtIn('sample'), builtIn('dumb_bot')];
    const fixtures: SeriesFixture[] = [
      { arena: DEFAULT_ARENA, seed: 5, first: 0 },
      { arena: DEFAULT_ARENA, seed: 6, first: 1 },
    ];
    const played = playArenaSeries(entrants, fixtures);
    if (!played.ok) throw new Error('refused');
    expect(played.matches.map((match) => match.ticks)).toEqual([
      outcomeOf(inOrder(entrants, 0), 5, DEFAULT_ARENA).tick,
      outcomeOf(inOrder(entrants, 1), 6, DEFAULT_ARENA).tick,
    ]);
  });

  it('plays a match of the series as that match is played on its own', () => {
    const entrants: [Entrant, Entrant] = [builtIn('sample'), builtIn('dumb_bot')];
    const played = playArenaSeries(entrants, roundsIn(DEFAULT_ARENA, [5]));
    if (!played.ok) throw new Error('refused');
    const [fromFirst, fromSecond] = played.matches;
    expect(fromFirst.ticks).toBe(outcomeOf(inOrder(entrants, 0), 5, DEFAULT_ARENA).tick);
    expect(fromSecond.ticks).toBe(outcomeOf(inOrder(entrants, 1), 5, DEFAULT_ARENA).tick);
  });

  it('plays each round in its own arena', () => {
    // A wall right across the field: the robots never see each other, and nobody wins.
    const walled: Arena = { ...DUEL_ARENA, obstacles: [{ x: 490, y: 0, width: 20, height: DUEL_ARENA.height }] };
    const fixtures = [...roundsIn(DUEL_ARENA, [1]), ...roundsIn(walled, [1])];
    const played = playArenaSeries([saved('Striker', SHOOT), saved('Tank', SIT)], fixtures);
    expect(played.ok && played.result).toMatchObject({ matches: 4, wins: [2, 0], draws: 2 });
    expect(played.ok && played.matches.map((match) => match.winner)).toEqual([0, 0, null, null]);
  });

  it('lets a robot play a series against itself', () => {
    const striker = saved('Striker', SHOOT);
    const played = playArenaSeries([striker, striker], roundsIn(DUEL_ARENA));
    expect(played.ok && played.names).toEqual(['Striker', 'Striker (2)']);
    expect(played.ok && played.result.matches).toBe(seeds.length * 2);
  });

  it('gives a built-in robot the program for the side it starts on in each match', () => {
    const played = playArenaSeries([builtIn('sample'), builtIn('dumb_bot')], roundsIn(DEFAULT_ARENA, [1]));
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
    const played = playArenaSeries([saved('Tank', SIT), saved('Broken', 'fly')], roundsIn(DUEL_ARENA));
    expect(played.ok).toBe(false);
    expect(!played.ok && played.problems[0]).toMatch(/^Broken: Line 1: /);
  });
});
