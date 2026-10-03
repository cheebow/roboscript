import { describe, expect, it } from 'vitest';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { RULES_VERSION } from '../src/data/rules_version';
import { SAMPLE_AI } from '../src/data/templates/sample';
import type { SavedRobot } from '../src/project/garage';
import { CODE_VERSION, decodeRobot, encodeRobot } from '../src/share/codec';

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
