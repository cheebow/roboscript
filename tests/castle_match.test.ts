import { describe, expect, it } from 'vitest';
import { prepareCastleFight, robotIdOf } from '../src/arena/castle_match';
import { CASTLE_ARENAS } from '../src/data/arenas';
import { castleHpFor, teamCostLimitFor } from '../src/data/castle';
import { STANDARD_LOADOUT, type Loadout, costOf } from '../src/data/parts';
import { TEAM_TEMPLATES } from '../src/data/team_templates';
import { TeamStore } from '../src/project/project_store';
import { Simulation } from '../src/sim/simulation';
import { compileBrain, runToEnd } from './helpers';

const THREE: Loadout[] = [STANDARD_LOADOUT, STANDARD_LOADOUT, STANDARD_LOADOUT];
/** Cheap enough that three together fit the team limit. */
const LIGHT: Loadout = { ...STANDARD_LOADOUT, body: 'light', gun: 'pistol' };

function sides(source = 'loop\n    wait\n'): [Parameters<typeof prepareCastleFight>[0][0], Parameters<typeof prepareCastleFight>[0][1]] {
  return [
    { name: 'ALPHA', source, loadouts: [LIGHT, LIGHT, LIGHT] },
    { name: 'BRAVO', source, loadouts: [LIGHT, LIGHT, LIGHT] },
  ];
}

describe('prepareCastleFight', () => {
  it('builds a 3 vs 3 with teams, castles and one brain per machine', () => {
    const prepared = prepareCastleFight(sides(), CASTLE_ARENAS[0], 3, 1);
    if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
    const { fight } = prepared;
    expect(fight.names).toEqual(['ALPHA-1', 'ALPHA-2', 'ALPHA-3', 'BRAVO-1', 'BRAVO-2', 'BRAVO-3']);
    expect(fight.config.teams).toEqual([0, 0, 0, 1, 1, 1]);
    expect(fight.config.bases?.map((base) => base.maxHp)).toEqual([castleHpFor(3), castleHpFor(3)]);
    expect(fight.config.arena.spawns).toHaveLength(6);
    expect(new Set(fight.config.robots.map((robot) => robot.brain)).size).toBe(6);
    const simulation = new Simulation(fight.config);
    expect(simulation.robots.map((robot) => robot.selfId)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('calls the one robot of a 1 vs 1 by its team name alone', () => {
    const one = sides();
    const prepared = prepareCastleFight(one, CASTLE_ARENAS[0], 1, 1);
    if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
    expect(prepared.fight.names).toEqual(['ALPHA', 'BRAVO']);
    expect(prepared.fight.config.arena.spawns).toHaveLength(2);
    expect(robotIdOf('ALPHA', 1, 1)).toBe('ALPHA');
    expect(robotIdOf('ALPHA', 3, 2)).toBe('ALPHA-2');
  });

  it('refuses a team whose parts cost more together than the team limit', () => {
    const heavy: Loadout = { ...STANDARD_LOADOUT, body: 'heavy', gun: 'cannon', sensor: 'scope' };
    const [alpha, bravo] = sides();
    const overloaded = { ...alpha, loadouts: [heavy, heavy, heavy] };
    expect(costOf(heavy) * 3).toBeGreaterThan(teamCostLimitFor(3));
    const prepared = prepareCastleFight([overloaded, bravo], CASTLE_ARENAS[0], 3, 1);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.problems.some((problem) => problem.includes('ALPHA'))).toBe(true);
  });

  it('refuses a program that does not compile, and a team size out of range', () => {
    const [alpha, bravo] = sides();
    const broken = { ...alpha, source: 'turn sideways\n' };
    expect(prepareCastleFight([broken, bravo], CASTLE_ARENAS[0], 3, 1).ok).toBe(false);
    expect(prepareCastleFight(sides(), CASTLE_ARENAS[0], 0, 1).ok).toBe(false);
    expect(prepareCastleFight(sides(), CASTLE_ARENAS[0], 4, 1).ok).toBe(false);
  });
});

describe('the team templates', () => {
  it('compile', () => {
    for (const template of TEAM_TEMPLATES) {
      expect(() => compileBrain(template.source), template.id).not.toThrow();
    }
  });

  it('plays a full castle match to an end against each other', () => {
    const prepared = prepareCastleFight(
      [
        { name: 'ALPHA', source: TEAM_TEMPLATES[0].source, loadouts: THREE.map(() => LIGHT) },
        { name: 'BRAVO', source: TEAM_TEMPLATES[1].source, loadouts: THREE.map(() => LIGHT) },
      ],
      CASTLE_ARENAS[0],
      3,
      7,
    );
    if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
    const simulation = new Simulation(prepared.fight.config);
    runToEnd(simulation);
    expect(simulation.result?.winnerTeam).not.toBeUndefined();
  });
});

describe('TeamStore', () => {
  function memoryStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } {
    const map = new Map<string, string>();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
    };
  }

  it('keeps the two team programs, the loadouts per machine, the size and the arena', () => {
    const storage = memoryStorage();
    const store = new TeamStore(storage, ['a', 'b']);
    expect(store.loadSource(0)).toBe('a');
    store.saveSource(0, 'loop\n    wait');
    store.saveLoadout(1, 2, LIGHT);
    store.saveTeamSize(2);
    store.saveArena('castle_lanes');
    const again = new TeamStore(storage, ['a', 'b']);
    expect(again.loadSource(0)).toBe('loop\n    wait');
    expect(again.loadSource(1)).toBe('b');
    expect(again.loadLoadout(1, 2)).toEqual(LIGHT);
    expect(again.loadLoadout(0, 0)).toEqual(STANDARD_LOADOUT);
    expect(again.loadInfo().teamSize).toBe(2);
    expect(again.loadInfo().arena).toBe('castle_lanes');
  });

  it('never writes under the duel project keys', () => {
    const written: string[] = [];
    const storage = {
      getItem: () => null,
      setItem: (key: string) => void written.push(key),
    };
    const store = new TeamStore(storage, ['a', 'b']);
    store.saveSource(0, 'x');
    store.saveLoadout(0, 1, LIGHT);
    store.saveTeamSize(3);
    expect(written.every((key) => key.startsWith('roboscript/projects/team/'))).toBe(true);
  });
});
