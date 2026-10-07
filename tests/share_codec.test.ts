import { describe, expect, it } from 'vitest';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { RULES_VERSION } from '../src/data/rules_version';
import { SAMPLE_AI } from '../src/data/templates/sample';
import type { SavedRobot } from '../src/project/garage';
import { CODE_VERSION, decodeMatch, decodeRobot, encodeMatch, encodeRobot } from '../src/share/codec';

const ROBOT: SavedRobot = { name: 'Striker', source: SAMPLE_AI, loadout: { ...STANDARD_LOADOUT, body: 'heavy', sensor: 'short' } };

describe('share codes for robots', () => {
  it('bring the robot back as it was: name, parts and program, under the rules of today', async () => {
    const code = await encodeRobot(ROBOT);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodeRobot(code);
    expect(decoded).toEqual({ ok: true, shared: { robot: ROBOT, rules: RULES_VERSION } });
  });

  it('keep any text of the program, including Japanese and blank lines', async () => {
    const robot = { ...ROBOT, name: '突撃くん', source: '# コメント\n\nloop\n    wait\n' };
    const decoded = await decodeRobot(await encodeRobot(robot));
    expect(decoded.ok && decoded.shared.robot).toEqual(robot);
  });

  it('are a good deal shorter than the program', async () => {
    const code = await encodeRobot(ROBOT);
    expect(code.length).toBeLessThan(SAMPLE_AI.length);
  });

  it('take the code with spaces around it, as pasted', async () => {
    const code = await encodeRobot(ROBOT);
    expect((await decodeRobot(`  ${code}\n`)).ok).toBe(true);
  });

  it('refuse text that is not a code, saying so', async () => {
    expect(await decodeRobot('hello world')).toEqual({ ok: false, problem: 'not a RoboScript share code' });
    expect(await decodeRobot('')).toEqual({ ok: false, problem: 'not a RoboScript share code' });
    expect(await decodeRobot('AAAA')).toEqual({ ok: false, problem: 'not a RoboScript share code' });
  });

  it('refuse a code of another kind or version', async () => {
    const encode = async (json: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(json));
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const deflated = new Uint8Array(await new Response(stream).arrayBuffer());
      return btoa(String.fromCharCode(...deflated)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    expect(await decodeRobot(await encode({ v: CODE_VERSION, kind: 'match' }))).toEqual({ ok: false, problem: 'not a share code for a robot' });
    expect(await decodeRobot(await encode({ v: 99, kind: 'robot' }))).toEqual({ ok: false, problem: 'a share code of another version (99)' });
    expect(await decodeRobot(await encode({ v: CODE_VERSION, kind: 'robot', name: 'x' }))).toEqual({ ok: false, problem: 'a share code with no robot in it' });
  });

  it('read the rules version the code was made under, and fall back to standard parts', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: CODE_VERSION, kind: 'robot', rules: '2026-01-01', name: 'Old', source: 'loop\n    wait', loadout: { gun: 'no_such_gun' } }));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const code = btoa(String.fromCharCode(...new Uint8Array(await new Response(stream).arrayBuffer()))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const decoded = await decodeRobot(code);
    expect(decoded.ok && decoded.shared.rules).toBe('2026-01-01');
    expect(decoded.ok && decoded.shared.robot.loadout).toEqual(STANDARD_LOADOUT);
  });
});

describe('share codes for matches', () => {
  const OTHER: SavedRobot = { name: 'DumbBot', source: 'loop\n    wait', loadout: STANDARD_LOADOUT };
  const MATCH = { robots: [ROBOT, OTHER] as [SavedRobot, SavedRobot], arenaId: 'cross', seed: 123456 };

  it('bring back both robots in spawn order, the arena and the seed', async () => {
    const decoded = await decodeMatch(await encodeMatch(MATCH));
    expect(decoded).toEqual({ ok: true, shared: { ...MATCH, rules: RULES_VERSION } });
  });

  it('carry a battle royale of three or four robots too, and no more', async () => {
    const four = { ...MATCH, robots: [ROBOT, OTHER, OTHER, ROBOT] };
    expect(await decodeMatch(await encodeMatch(four))).toEqual({ ok: true, shared: { ...four, rules: RULES_VERSION } });
    expect(await decodeMatch(await encodeMatch({ ...MATCH, robots: [ROBOT, OTHER, OTHER, ROBOT, OTHER] }))).toEqual({
      ok: false,
      problem: 'a match without 2 to 4 robots in it',
    });
  });

  it('are not read as robot codes, nor robot codes as match codes', async () => {
    expect(await decodeRobot(await encodeMatch(MATCH))).toEqual({ ok: false, problem: 'not a share code for a robot' });
    expect(await decodeMatch(await encodeRobot(ROBOT))).toEqual({ ok: false, problem: 'not a share code for a match' });
    expect(await decodeMatch('hello')).toEqual({ ok: false, problem: 'not a RoboScript share code' });
  });

  it('refuse a match code missing its robots, arena or seed', async () => {
    const encode = async (json: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(json));
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const deflated = new Uint8Array(await new Response(stream).arrayBuffer());
      return btoa(String.fromCharCode(...deflated)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const robot = { name: 'A', source: 'loop\n    wait' };
    expect(await decodeMatch(await encode({ v: CODE_VERSION, kind: 'match', robots: [robot], arena: 'cross', seed: 1 }))).toEqual({ ok: false, problem: 'a match without 2 to 4 robots in it' });
    expect(await decodeMatch(await encode({ v: CODE_VERSION, kind: 'match', robots: [robot, robot], seed: 1 }))).toEqual({ ok: false, problem: 'a share code with no arena or seed in it' });
    expect(await decodeMatch(await encode({ v: CODE_VERSION, kind: 'match', robots: [robot, robot], arena: 'cross', seed: 1.5 }))).toEqual({ ok: false, problem: 'a share code with no arena or seed in it' });
  });
});

describe('share codes for teams and castle matches', () => {
  const TEAM = {
    name: 'Pack',
    source: 'loop\n    signal 1\n    wait\n',
    loadouts: [
      { ...STANDARD_LOADOUT, gun: 'pistol' },
      { ...STANDARD_LOADOUT, body: 'light' },
      { ...STANDARD_LOADOUT },
    ],
  };

  it('bring a team back as it was: name, program and every machine’s parts', async () => {
    const { decodeTeam, encodeTeam } = await import('../src/share/codec');
    const decoded = await decodeTeam(await encodeTeam(TEAM));
    expect(decoded).toEqual({ ok: true, shared: { team: TEAM, rules: RULES_VERSION } });
  });

  it('bring a castle match back whole: both teams, the arena, the size and the seed', async () => {
    const { decodeCastleMatch, encodeCastleMatch } = await import('../src/share/codec');
    const match = { teams: [TEAM, { ...TEAM, name: 'Wall' }] as [typeof TEAM, typeof TEAM], arenaId: 'castle_lanes', teamSize: 3, seed: 7 };
    const decoded = await decodeCastleMatch(await encodeCastleMatch(match));
    expect(decoded.ok && decoded.shared).toEqual({ ...match, rules: RULES_VERSION });
  });

  it('are refused cleanly by the readers of the other kinds', async () => {
    const { decodeTeam, encodeTeam, encodeCastleMatch, decodeCastleMatch } = await import('../src/share/codec');
    const teamCode = await encodeTeam(TEAM);
    expect((await decodeRobot(teamCode)).ok).toBe(false);
    expect((await decodeMatch(teamCode)).ok).toBe(false);
    expect((await decodeCastleMatch(teamCode)).ok).toBe(false);
    const robotCode = await encodeRobot(ROBOT);
    expect((await decodeTeam(robotCode)).ok).toBe(false);
    const matchCode = await encodeCastleMatch({ teams: [TEAM, TEAM], arenaId: 'castle_plain', teamSize: 1, seed: 1 });
    expect((await decodeTeam(matchCode)).ok).toBe(false);
  });

  it('refuse a castle match whose teams do not cover its size', async () => {
    const { decodeCastleMatch, encodeCastleMatch } = await import('../src/share/codec');
    const thin = { ...TEAM, loadouts: TEAM.loadouts.slice(0, 1) };
    const code = await encodeCastleMatch({ teams: [thin, TEAM], arenaId: 'castle_plain', teamSize: 3, seed: 1 });
    expect((await decodeCastleMatch(code)).ok).toBe(false);
  });
});
