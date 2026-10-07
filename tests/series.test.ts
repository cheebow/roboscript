import { describe, expect, it } from 'vitest';
import { DEFAULT_ARENA } from '../src/data/arenas';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { type Contender, playSeries } from '../src/sim/series';
import type { Arena } from '../src/sim/types';
import { DUEL_ARENA, FixedBrain, NO_SPREAD_STATS, compileBrain, enemySource } from './helpers';

const { tickRate, maxMatchTime } = MATCH_DEFAULTS;
const SEEDS = [1, 2, 3];

const shooter = (id = 'SHOOTER'): Contender => ({
  id,
  stats: NO_SPREAD_STATS,
  createBrain: () => new FixedBrain({ fire: true }),
});
const sitter = (id = 'SITTER'): Contender => ({ id, stats: NO_SPREAD_STATS, createBrain: () => new FixedBrain() });

function series(contenders: [Contender, Contender], arenas: Arena[] = [DUEL_ARENA]) {
  return playSeries({ contenders, arenas, seeds: SEEDS, tickRate, maxMatchTime });
}

describe('playSeries', () => {
  it('plays every arena with every seed from both sides', () => {
    const arenas = [DUEL_ARENA, { ...DUEL_ARENA }];
    expect(series([shooter(), sitter()], arenas).matches).toBe(arenas.length * SEEDS.length * 2);
  });

  it('counts the wins of each contender in the order they were given', () => {
    const matches = SEEDS.length * 2;
    const reasons = { destroyed: matches, timeout: 0, 'out of ammo': 0, 'base destroyed': 0 };
    expect(series([shooter(), sitter()])).toEqual({ matches, wins: [matches, 0], draws: 0, reasons });
    expect(series([sitter(), shooter()])).toEqual({ matches, wins: [0, matches], draws: 0, reasons });
  });

  it('gives each contender a turn on each side', () => {
    // Only the robot that starts first faces the other: whoever starts there wins.
    const [facing, other] = DUEL_ARENA.spawns;
    const oneSided = { ...DUEL_ARENA, spawns: [facing, { ...other, rotation: 0 }] };
    const { wins, draws } = series([shooter('ONE'), shooter('TWO')], [oneSided]);
    expect(wins).toEqual([SEEDS.length, SEEDS.length]);
    expect(draws).toBe(0);
  });

  it('counts matches nobody wins as draws', () => {
    const { matches, wins, draws, reasons } = series([sitter('ONE'), sitter('TWO')]);
    expect(wins).toEqual([0, 0]);
    expect(draws).toBe(matches);
    expect(reasons.timeout).toBe(matches);
  });

  it('makes a new brain for every match, told where the robot starts', () => {
    const spawnIndexes: number[] = [];
    const counted: Contender = {
      ...sitter('COUNTED'),
      createBrain: (spawnIndex) => {
        spawnIndexes.push(spawnIndex);
        return new FixedBrain();
      },
    };
    const { matches } = series([counted, shooter()]);
    expect(spawnIndexes).toHaveLength(matches);
    expect(spawnIndexes.slice(0, 2)).toEqual([0, 1]);
  });

  it('comes out the same every time', () => {
    const play = () =>
      playSeries({
        contenders: [
          { id: 'SAMPLE', stats: ROBOT_DEFAULTS, createBrain: () => compileBrain(SAMPLE_AI) },
          { id: 'DUMB', stats: ROBOT_DEFAULTS, createBrain: () => compileBrain(enemySource('dumb_bot')) },
        ],
        arenas: [DEFAULT_ARENA],
        seeds: SEEDS,
        tickRate,
        maxMatchTime,
      });
    expect(play()).toEqual(play());
  });

  it('refuses two contenders with the same id', () => {
    expect(() => series([shooter('SAME'), sitter('SAME')])).toThrow('SAME');
  });
});
