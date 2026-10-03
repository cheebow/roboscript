import { describe, expect, it } from 'vitest';
import { LEAGUE_MAX } from '../src/arena/league';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { type ContestEntry, addEntry, readContest, removeEntry, writeContest } from '../src/project/contest_store';

const entry = (name: string, origin: ContestEntry['origin'] = 'code'): ContestEntry => ({
  robot: { name, source: 'loop\n    wait', loadout: { ...STANDARD_LOADOUT, body: 'heavy' } },
  origin,
});

describe('the list of a contest', () => {
  it('comes back from storage as it was written', () => {
    const list = [entry('Striker'), entry('Sample', 'built-in'), entry('Mine', 'garage')];
    expect(readContest(writeContest(list))).toEqual(list);
  });

  it('is empty when nothing was saved or it cannot be read, and leaves out what is broken', () => {
    expect(readContest(null)).toEqual([]);
    expect(readContest('not json')).toEqual([]);
    const text = JSON.stringify({ entries: [entry('Good'), { robot: { name: 3 }, origin: 'code' }, { robot: { name: 'X', source: '' }, origin: 'elsewhere' }] });
    expect(readContest(text).map((each) => each.robot.name)).toEqual(['Good']);
  });

  it(`takes up to ${LEAGUE_MAX} robots, a robot of the same name as often as it is added`, () => {
    let list: ContestEntry[] = [];
    for (let index = 0; index < LEAGUE_MAX; index++) {
      const added = addEntry(list, entry('Striker'));
      if (!added.ok) throw new Error('Expected room');
      list = added.list;
    }
    expect(list).toHaveLength(LEAGUE_MAX);
    expect(addEntry(list, entry('One too many'))).toEqual({ ok: false });
  });

  it('keeps a copy, and lets a robot be taken off by its place', () => {
    const robot = entry('Striker');
    const added = addEntry([], robot);
    if (!added.ok) throw new Error('Expected room');
    robot.robot.loadout.body = 'light';
    expect(added.list[0].robot.loadout.body).toBe('heavy');
    expect(removeEntry([entry('A'), entry('B'), entry('C')], 1).map((each) => each.robot.name)).toEqual(['A', 'C']);
  });
});
