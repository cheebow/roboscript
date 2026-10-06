import { describe, expect, it } from 'vitest';
import type { Program, StatementNode } from '../src/ai/ast';
import { MAX_CALL_DEPTH } from '../src/ai/functions';
import { MAX_NESTING, parse } from '../src/ai/parser';
import { compileScript } from '../src/ai/roboscript';
import { ScriptBrain } from '../src/ai/runtime';
import { arenaFor } from '../src/arena/match';
import { CHALLENGES } from '../src/challenge/challenges';
import { CHAMPION } from '../src/challenge/champion';
import { ARENAS } from '../src/data/arenas';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { TEMPLATES } from '../src/data/templates';
import { RECIPES } from '../src/help/recipes';
import { STANDARD_LOADOUT } from '../src/data/parts';
import { MAX_INFLATED_BYTES, decodeRobot, encodeRobot } from '../src/share/codec';
import type { AIAction, RobotBrain } from '../src/sim/ai_context';
import { QUIET_CONTEXT, compileBrain, createSimulation } from './helpers';

// A crafted program, share code or file must not freeze or crash the page:
// it may be opened from a link, and a match link plays at once.

const { lineBudget } = MATCH_DEFAULTS;

/** f0 returns 1; each f(i) adds up two calls of f(i - 1), so f(n) runs 2^n times as many lines. */
function doubling(levels: number, use: string): string {
  let source = 'def f0()\n    return 1\n';
  for (let level = 1; level <= levels; level++) source += `def f${level}()\n    return f${level - 1}() + f${level - 1}()\n`;
  return `${source}loop\n${use.replace('N', String(levels))}\n`;
}

function messagesOf(source: string): string[] {
  return parse(source).errors.map((error) => error.message);
}

function timed<T>(work: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = work();
  return { result, ms: performance.now() - start };
}

describe('functions called for a value count against the line budget', () => {
  it.each([
    ['a value', '    set x = fN()\n    wait'],
    ['a condition', '    if fN() > 0\n        wait\n    else\n        wait'],
    ['the values of a call', '    g(fN())\ndef g(a)\n    wait'],
    ['an angle', '    turn left fN()'],
  ])('in %s: a call that would run billions of lines ends the tick at the budget, every tick', (_, use) => {
    const { result: compiled, ms: compileMs } = timed(() => compileScript(doubling(30, use)));
    expect(compiled.ok).toBe(true);
    expect(compileMs).toBeLessThan(1000);
    if (!compiled.ok) return;
    const { result: actions, ms } = timed(() => [1, 2, 3].map(() => compiled.brain.decide(QUIET_CONTEXT)));
    expect(ms).toBeLessThan(1000);
    for (const action of actions) {
      expect(action.status).toBe('stalled');
      expect(action.executedLines.length).toBeLessThanOrEqual(lineBudget + 1);
      expect(action.turn).toBeNull();
    }
  });

  it('leaves a call within the budget as it was: worked out at once, in the same tick', () => {
    const [action] = [compileBrain(doubling(5, '    set x = fN()\n    fire'))].map((brain) => brain.decide(QUIET_CONTEXT));
    expect(action).toMatchObject({ status: 'running', fire: true });
    expect(action.assignments.at(-1)).toMatchObject({ name: 'x', value: 32 });
  });

  it('goes on once a value that was over the budget comes within it', () => {
    // f's work depends on the HP: over the budget at full HP, small once hurt.
    const source = `${doubling(12, '    if hp > 150 and fN() > 0\n        wait\n    else\n        fire')}`;
    const brain = compileBrain(source);
    expect(brain.decide(QUIET_CONTEXT).status).toBe('stalled');
    expect(brain.decide({ ...QUIET_CONTEXT, hp: 100 })).toMatchObject({ status: 'running', fire: true });
  });
});

describe('nesting has a limit, reported as an error on its line', () => {
  const tooDeep = `Nested too deep: up to ${MAX_NESTING} levels (blocks and else ifs, brackets, not, minus signs, and the steps of a long calculation each count as one)`;

  it.each([
    ['brackets', (n: number) => `set x = ${'('.repeat(n)}1${')'.repeat(n)}\nwait`],
    ['not', (n: number) => `if ${'not '.repeat(n)}enemy_visible\n    wait`],
    ['minus signs', (n: number) => `set x = ${'- '.repeat(n)}hp\nwait`],
    ['a long calculation', (n: number) => `set x = 1${' + 1'.repeat(n)}\nwait`],
    ['calls in calls', (n: number) => `def g(a)\n    return a\nset x = ${'g('.repeat(n)}1${')'.repeat(n)}\nwait`],
    // One space a level: the text of a block nested thousands deep grows with the square of the depth.
    ['blocks', (n: number) => Array.from({ length: Math.min(n, 3000) }, (_, depth) => `${' '.repeat(depth)}if enemy_visible`).join('\n') + `\n${' '.repeat(Math.min(n, 3000))}wait`],
    ['else ifs', (n: number) => `if hp < 0\n    wait\n${Array.from({ length: n }, (_, k) => `else if hp < ${k}\n    wait`).join('\n')}`],
  ])('%s: fine well within the limit, an error far beyond it, and never a crash', (_, build) => {
    expect(parse(build(MAX_NESTING - 10)).errors).toEqual([]);
    for (const n of [MAX_NESTING + 10, 20_000]) {
      const { result, ms } = timed(() => parse(build(n)));
      expect(result.errors.map((error) => error.message)).toContain(tooDeep);
      expect(ms).toBeLessThan(2000);
    }
  });

  it('turns the browser running out of room into an error, should nesting within the limits still come to that', () => {
    // Within each limit, but a crafted program is past what any limit foresees: whatever happens, parse answers.
    expect(() => parse('wait')).not.toThrow();
    expect(messagesOf(`set x = ${'('.repeat(50_000)}`).length).toBeGreaterThan(0);
  });
});

describe('calls of functions in functions have a limit', () => {
  const chain = (length: number) =>
    Array.from({ length }, (_, k) => (k === length - 1 ? `def f${k}()\n    wait` : `def f${k}()\n    f${k + 1}()`)).join('\n') + '\nloop\n    f0()';

  it('allows a chain within the limit, and refuses a longer one on the function it starts from', () => {
    expect(parse(chain(MAX_CALL_DEPTH)).errors).toEqual([]);
    expect(parse(chain(MAX_CALL_DEPTH + 1)).errors).toEqual([
      { line: 1, message: `Calls go too deep from "f0": a function may call one that calls another and so on, up to ${MAX_CALL_DEPTH} deep` },
    ]);
  });

  it('checks a chain of thousands of functions at once, without running out of room', () => {
    const { result, ms } = timed(() => parse(chain(20_000)));
    expect(result.errors).toHaveLength(1);
    expect(ms).toBeLessThan(2000);
  });

  it('checks which functions can be values once for each, however many times they are called', () => {
    // 40 levels of doubling: looked into call by call, 2^40 visits.
    const { result, ms } = timed(() => parse(doubling(40, '    set x = fN()\n    wait')));
    expect(result.errors).toEqual([]);
    expect(ms).toBeLessThan(1000);
  });
});

describe('a program the browser cannot run through', () => {
  it('stops, and leaves the match going, instead of breaking it', () => {
    // Deeper than any parsed program can be: built by hand, past the parser's limits.
    let body: StatementNode[] = [{ kind: 'wait', line: 1 }];
    for (let depth = 0; depth < 50_000; depth++) body = [{ kind: 'loop', line: 1, body }];
    const program: Program = { body, functions: new Map() };
    const brain = new ScriptBrain(program, lineBudget);
    expect(() => brain.decide(QUIET_CONTEXT)).not.toThrow();
    expect(brain.decide(QUIET_CONTEXT).status).toBe('failed');
  });
});

describe('share codes', () => {
  it(`refuses one that inflates past ${MAX_INFLATED_BYTES} bytes, without inflating it all`, async () => {
    const huge = await encodeRobot({ name: 'Bomb', loadout: STANDARD_LOADOUT, source: `# ${'a'.repeat(50 * MAX_INFLATED_BYTES)}\nwait` });
    // Deflated, 50 MB of one letter is small enough to put in a link.
    expect(huge.length).toBeLessThan(MAX_INFLATED_BYTES / 4);
    const { result, ms } = await (async () => {
      const start = performance.now();
      const decoded = await decodeRobot(huge);
      return { result: decoded, ms: performance.now() - start };
    })();
    expect(result.ok).toBe(false);
    expect(ms).toBeLessThan(2000);
  });

  it('takes in an ordinary robot as before', async () => {
    const robot = { name: 'Champion', loadout: STANDARD_LOADOUT, source: CHAMPION };
    expect(await decodeRobot(await encodeRobot(robot))).toMatchObject({ ok: true, shared: { robot } });
  });
});

describe('the programs that come with the game', () => {
  /** Notes every tick's status, as the brain gives it. */
  function watched(source: string, seen: Set<string>): RobotBrain {
    const brain = compileBrain(source);
    return {
      decide(context): AIAction {
        const action = brain.decide(context);
        seen.add(action.status);
        return action;
      },
    };
  }

  it('never come near the line budget or the limits in a match', () => {
    const programs = [
      ...TEMPLATES.map((template) => template.source),
      CHAMPION,
      ...RECIPES.map((recipe) => recipe.code),
      ...CHALLENGES.map((challenge) => challenge.answer),
    ];
    for (const source of programs) {
      expect(parse(source).errors, source.slice(0, 60)).toEqual([]);
      const seen = new Set<string>();
      for (const seed of [1, 2]) {
        const simulation = createSimulation([watched(source, seen), compileBrain(TEMPLATES[1].source)], {
          arena: arenaFor(ARENAS[seed].arena, seed, 2),
          stats: ROBOT_DEFAULTS,
          seed,
        });
        while (simulation.result === null) simulation.step();
      }
      expect(seen.has('stalled'), source.slice(0, 60)).toBe(false);
      expect(seen.has('failed'), source.slice(0, 60)).toBe(false);
    }
  });
});
