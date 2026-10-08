import { describe, expect, it } from 'vitest';
import { type MessageKey, en } from '../src/i18n/messages';

// Every call of t() with a written-out key is read from the source, and the
// names it passes are checked against the placeholders of its message: a
// placeholder no call fills shows on screen as "{name}", or (as {castle} once
// did, after a rename turned it into {base}) as nothing at all.

const SOURCES = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** A call of t(): where it is, its key, and the names its parameters give; null names when they cannot be read off the source. */
interface Call {
  where: string;
  key: string;
  names: string[] | null;
}

const OPENERS: Record<string, string> = { '{': '}', '(': ')', '[': ']' };

/** The index just past the bracket that closes the one at `from`, skipping strings and template literals. */
function closing(source: string, from: number): number {
  const stack: string[] = [];
  for (let index = from; index < source.length; index++) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      for (index++; index < source.length && source[index] !== char; index++) if (source[index] === '\\') index++;
      continue;
    }
    if (char in OPENERS) stack.push(OPENERS[char]);
    else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }
  return source.length;
}

/** The names an object literal gives (`name: value` and shorthand `name`); null when it spreads another object in. */
function namesOf(literal: string): string[] | null {
  const body = literal.slice(1, -1);
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (char === "'" || char === '"' || char === '`') {
      for (index++; index < body.length && body[index] !== char; index++) if (body[index] === '\\') index++;
    } else if (char in OPENERS) {
      index = closing(body, index) - 1;
    } else if (char === ',') {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  const names: string[] = [];
  for (const part of parts.map((each) => each.trim()).filter((each) => each !== '')) {
    if (part.startsWith('...')) return null;
    const name = /^(\w+)\s*(?::|$)/.exec(part)?.[1];
    if (name === undefined) return null;
    names.push(name);
  }
  return names;
}

function callsIn(where: string, source: string): Call[] {
  const calls: Call[] = [];
  for (const match of source.matchAll(/(?<![\w.])t\(\s*'([\w.]+)'\s*/g)) {
    const after = (match.index ?? 0) + match[0].length;
    const next = source[after];
    if (next === ')') {
      calls.push({ where, key: match[1], names: [] });
    } else if (next === ',') {
      const rest = source.slice(after + 1);
      const offset = rest.length - rest.trimStart().length;
      const open = after + 1 + offset;
      calls.push({ where, key: match[1], names: source[open] === '{' ? namesOf(source.slice(open, closing(source, open))) : null });
    }
  }
  return calls;
}

const CALLS = Object.entries(SOURCES).flatMap(([where, source]) => callsIn(where.replace('../', ''), source));

const placeholdersOf = (key: string) => [...(en[key as MessageKey] ?? '').matchAll(/\{(\w+)\}/g)].map((match) => match[1]);

describe('the parameters of the messages', () => {
  it('are read off a good share of the calls', () => {
    // A guard on the reading itself: should it stop finding calls, the checks below would pass on nothing.
    expect(CALLS.length).toBeGreaterThan(300);
    expect(CALLS.filter((call) => call.names !== null).length).toBeGreaterThan(CALLS.length * 0.9);
  });

  it('fill every placeholder of their message', () => {
    const missing = CALLS.filter((call) => call.names !== null)
      .flatMap((call) => placeholdersOf(call.key).filter((name) => !call.names?.includes(name)).map((name) => `${call.where}: t('${call.key}') does not give {${name}}`));
    expect(missing).toEqual([]);
  });

  it('give nothing their message has no place for', () => {
    const unused = CALLS.filter((call) => call.names !== null)
      .flatMap((call) => (call.names ?? []).filter((name) => !placeholdersOf(call.key).includes(name)).map((name) => `${call.where}: t('${call.key}') gives ${name}, which its message does not show`));
    expect(unused).toEqual([]);
  });
});
