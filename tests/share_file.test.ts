import { describe, expect, it } from 'vitest';
import { recordLeague, recordTournament, readRecord } from '../src/arena/contest_record';
import { type LeagueMatch, standingsOf } from '../src/arena/league';
import type { Bracket } from '../src/arena/tournament';
import { ARENAS, DEFAULT_ARENA_DEFINITION } from '../src/data/arenas';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { RULES_VERSION } from '../src/data/rules_version';
import type { SavedRobot } from '../src/project/garage';
import { FILE_EXTENSION, contestFileText, fileName, readSharedFile, robotFileText } from '../src/share/file';

const ROBOTS: SavedRobot[] = ['Alpha', 'Bravo', 'Alpha'].map((name, index) => ({
  name,
  source: `// robot ${index}\nfire\n`,
  loadout: { ...STANDARD_LOADOUT },
}));
const ARENA = ARENAS[ARENAS.length - 1];

function leagueMatch(first: number, second: number, winner: number | null, hpLeft: [number, number]): LeagueMatch {
  return { first, second, arena: ARENA, seed: 1000 + first * 10 + second, winner, reason: 'destroyed', ticks: 600, hpLeft };
}

const MATCHES = [leagueMatch(0, 1, 0, [120, 0]), leagueMatch(1, 0, null, [40, 40]), leagueMatch(0, 2, 2, [0, 80]), leagueMatch(2, 0, 2, [0, 10]), leagueMatch(1, 2, 1, [5, 0]), leagueMatch(2, 1, 1, [0, 60])];

const BRACKET: Bracket = {
  rounds: [
    [
      { a: 0, b: 1, winner: 0, score: [2, 1], matches: [
        { first: 0, second: 1, arena: ARENA, seed: 5, winner: 0, reason: 'destroyed', hpLeft: [10, 0] },
        { first: 1, second: 0, arena: ARENA, seed: 6, winner: 1, reason: 'timeout', hpLeft: [50, 20] },
        { first: 0, second: 1, arena: ARENA, seed: 7, winner: 0, reason: 'destroyed', hpLeft: [70, 0] },
      ] },
      { a: 2, b: null, winner: 2, score: [0, 0], matches: [] },
    ],
    [{ a: 0, b: 2, winner: 2, score: [0, 2], matches: [
      { first: 0, second: 2, arena: ARENA, seed: 8, winner: 2, reason: 'destroyed', hpLeft: [0, 30] },
      { first: 2, second: 0, arena: ARENA, seed: 9, winner: 2, reason: 'destroyed', hpLeft: [90, 0] },
    ] }],
  ],
  champion: 2,
  places: [2, 3, 1],
};

/** The file's text read back: what another player gets on opening it. */
function reopen(text: string) {
  const read = readSharedFile(text);
  if (!read.ok) throw new Error(read.problem);
  return read.file;
}

describe('robot files', () => {
  it('give back the robot as it was saved, with the rules it was made under', () => {
    const robot = { name: 'Striker', source: 'repeat\n  fire\nend\n'.repeat(500), loadout: { ...STANDARD_LOADOUT, gun: 'cannon' } } as SavedRobot;
    const file = reopen(robotFileText(robot));
    expect(file).toEqual({ kind: 'robot', rules: RULES_VERSION, robot });
  });

  it('are plain JSON a person can read', () => {
    const text = robotFileText(ROBOTS[0]);
    expect(JSON.parse(text)).toMatchObject({ format: 'roboscript', kind: 'robot', robot: { name: 'Alpha' } });
    expect(text).toContain('\n');
  });

  it('get a name that file systems take', () => {
    expect(fileName('Striker')).toBe(`Striker${FILE_EXTENSION}`);
    expect(fileName('a/b: c?')).toBe(`a_b_c${FILE_EXTENSION}`);
    expect(fileName('///')).toBe(`roboscript${FILE_EXTENSION}`);
  });
});

describe('contest files', () => {
  it('give back a league as it was played: robots, matches by arena, standings', () => {
    const standings = standingsOf(3, MATCHES);
    const file = reopen(contestFileText(recordLeague(ROBOTS, MATCHES, standings), new Date('2026-10-03T12:00:00Z')));
    expect(file.kind).toBe('contest');
    if (file.kind !== 'contest') return;
    expect(file.savedAt).toBe('2026-10-03T12:00:00.000Z');
    expect(file.contest).toEqual({ format: 'league', robots: ROBOTS, matches: MATCHES, standings, unknownArenas: [] });
  });

  it('give back a tournament as it was played', () => {
    const file = reopen(contestFileText(recordTournament(ROBOTS, BRACKET), new Date()));
    if (file.kind !== 'contest') throw new Error('not a contest');
    expect(file.contest).toEqual({ format: 'tournament', robots: ROBOTS, bracket: BRACKET, unknownArenas: [] });
  });

  it('keep each arena by its id, not as a copy of the map', () => {
    const record = recordLeague(ROBOTS, MATCHES, standingsOf(3, MATCHES));
    expect(record.format === 'league' && record.matches[0].arena).toBe(ARENA.id);
  });

  it('play a match of a map this version does not have in the default map, and say which maps those were', () => {
    const record = JSON.parse(JSON.stringify(recordLeague(ROBOTS, MATCHES, standingsOf(3, MATCHES))));
    record.matches[0].arena = 'gone-map';
    const read = readRecord(record);
    expect(read?.unknownArenas).toEqual(['gone-map']);
    expect(read?.format === 'league' && read.matches[0].arena).toBe(DEFAULT_ARENA_DEFINITION);
  });

  it('keep the rules of when they were saved, to tell when replays may differ', () => {
    const text = contestFileText(recordTournament(ROBOTS, BRACKET), new Date()).replace(`"rules": "${RULES_VERSION}"`, '"rules": "old"');
    expect(reopen(text).rules).toBe('old');
  });
});

describe('a file that is not right', () => {
  const problem = (text: string) => {
    const read = readSharedFile(text);
    return read.ok ? null : read.problem;
  };

  it('is refused when it is not JSON, or not RoboScript', () => {
    expect(problem('not json')).toBe('not a RoboScript file');
    expect(problem('{"name": "Striker"}')).toBe('not a RoboScript file');
    expect(problem('[]')).toBe('not a RoboScript file');
  });

  it('is refused when it is of another version or kind', () => {
    const file = JSON.parse(robotFileText(ROBOTS[0]));
    expect(problem(JSON.stringify({ ...file, v: 99 }))).toContain('99');
    expect(problem(JSON.stringify({ ...file, kind: 'map' }))).toBe('a RoboScript file of an unknown kind');
    expect(problem(JSON.stringify({ ...file, robot: { name: 'X' } }))).not.toBeNull();
  });

  it('is refused when its contest is broken', () => {
    const file = JSON.parse(contestFileText(recordLeague(ROBOTS, MATCHES, standingsOf(3, MATCHES)), new Date()));
    const broken = (change: (contest: Record<string, any>) => void) => {
      const copy = structuredClone(file);
      change(copy.contest);
      return problem(JSON.stringify(copy));
    };
    expect(broken(() => {})).toBeNull();
    expect(broken((contest) => { contest.matches[0].first = 7; })).toBe('the contest in the file cannot be read');
    expect(broken((contest) => { contest.robots = contest.robots.slice(0, 1); })).not.toBeNull();
    expect(broken((contest) => { contest.format = 'cup'; })).not.toBeNull();
    expect(broken((contest) => { contest.matches[2].arena = 3; })).not.toBeNull();
  });

  it('is refused when its bracket is broken', () => {
    const file = JSON.parse(contestFileText(recordTournament(ROBOTS, BRACKET), new Date()));
    const broken = (change: (contest: Record<string, any>) => void) => {
      const copy = structuredClone(file);
      change(copy.contest);
      return problem(JSON.stringify(copy));
    };
    expect(broken((contest) => { contest.rounds = []; })).not.toBeNull();
    expect(broken((contest) => { contest.rounds[0][0].winner = -1; })).not.toBeNull();
    // A winner who was not in the tie, or a final between robots who did not win their ties.
    expect(broken((contest) => { contest.rounds[0][0].winner = 2; })).not.toBeNull();
    expect(broken((contest) => { contest.rounds[1][0].a = 1; })).not.toBeNull();
  });

  it('works out the table, the champion and the places from the matches, whatever the file says', () => {
    const league = JSON.parse(contestFileText(recordLeague(ROBOTS, MATCHES, standingsOf(3, MATCHES)), new Date()));
    league.contest.standings = [];
    const readLeague = reopen(JSON.stringify(league));
    expect(readLeague.kind === 'contest' && readLeague.contest.format === 'league' && readLeague.contest.standings).toEqual(standingsOf(3, MATCHES));

    const cup = JSON.parse(contestFileText(recordTournament(ROBOTS, BRACKET), new Date()));
    cup.contest.champion = 0;
    cup.contest.places = [1, 1, 1];
    const readCup = reopen(JSON.stringify(cup));
    expect(readCup.kind === 'contest' && readCup.contest.format === 'tournament' && readCup.contest.bracket).toEqual(BRACKET);
  });

  it('reads an end of a match it does not know as "destroyed"', () => {
    const league = JSON.parse(contestFileText(recordLeague(ROBOTS, MATCHES, standingsOf(3, MATCHES)), new Date()));
    league.contest.matches[0].reason = 'exploded';
    const read = reopen(JSON.stringify(league));
    expect(read.kind === 'contest' && read.contest.format === 'league' && read.contest.matches[0].reason).toBe('destroyed');
  });
});

describe('match files', () => {
  it('give back the match: its robots in order, the arena and the seed', async () => {
    const { matchFileText } = await import('../src/share/file');
    const file = reopen(matchFileText({ robots: ROBOTS, arenaId: 'cross', seed: 77 }));
    expect(file).toEqual({ kind: 'match', rules: RULES_VERSION, match: { robots: ROBOTS, arenaId: 'cross', seed: 77 } });
  });

  it('are refused without 2 to 4 robots, or without an arena and a seed', async () => {
    const { matchFileText } = await import('../src/share/file');
    const good = JSON.parse(matchFileText({ robots: ROBOTS, arenaId: 'cross', seed: 77 }));
    const problem = (change: (file: Record<string, any>) => void) => {
      const copy = structuredClone(good);
      change(copy);
      const read = readSharedFile(JSON.stringify(copy));
      return read.ok ? null : read.problem;
    };
    expect(problem((file) => { file.robots = file.robots.slice(0, 1); })).toBe('a match without 2 to 4 robots in it');
    expect(problem((file) => { file.robots = [...file.robots, ...file.robots]; })).toBe('a match without 2 to 4 robots in it');
    expect(problem((file) => { delete file.seed; })).toBe('a share code with no arena or seed in it');
  });
});

describe('team and castle-match files', () => {
  const TEAM = {
    name: 'Pack',
    source: 'loop\n    wait\n',
    loadouts: [{ ...STANDARD_LOADOUT, gun: 'pistol' }, { ...STANDARD_LOADOUT }],
  };

  it('bring a team back as it was', async () => {
    const { readSharedFile, teamFileText } = await import('../src/share/file');
    const read = readSharedFile(teamFileText(TEAM));
    expect(read).toEqual({ ok: true, file: { kind: 'team', rules: RULES_VERSION, team: TEAM } });
  });

  it('bring a castle match back whole', async () => {
    const { castleMatchFileText, readSharedFile } = await import('../src/share/file');
    const match = { teams: [TEAM, { ...TEAM, name: 'Wall' }] as [typeof TEAM, typeof TEAM], arenaId: 'castle_plain', teamSize: 2, seed: 9 };
    const read = readSharedFile(castleMatchFileText(match));
    expect(read.ok && read.file).toEqual({ kind: 'castle', rules: RULES_VERSION, match });
  });
});
