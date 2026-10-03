import { describe, expect, it } from 'vitest';
import { commentaryOf } from '../src/arena/commentary';
import { builtInEntrants, prepareFight } from '../src/arena/match';
import { ARENAS } from '../src/data/arenas';
import { EFFECT_LIFETIMES } from '../src/data/match_defaults';
import { recordMatch } from '../src/debug/recorder';

function commentaryFor(names: string[], arena = ARENAS[1].arena, seed = 7) {
  const entrants = builtInEntrants().filter((entrant) => names.includes(entrant.name));
  const prepared = prepareFight(entrants, arena, seed);
  if (!prepared.ok) throw new Error(prepared.problems.join());
  const recording = recordMatch(prepared.fight.config, EFFECT_LIFETIMES);
  return { recording, lines: commentaryOf(recording, prepared.fight.names, prepared.fight.config.maxMatchTime) };
}

describe('the commentary of a match', () => {
  it('starts with the match, ends with how it ended, and goes in order of the match', () => {
    const { recording, lines } = commentaryFor(['Sample', 'SentryBot']);
    expect(lines[0].tick).toBe(0);
    expect(lines[0].text).toContain('Sample');
    const last = lines[lines.length - 1];
    expect(last.tick).toBe(recording.snapshots.length - 1);
    const winner = recording.snapshots[recording.snapshots.length - 1].result?.winnerId;
    if (winner) expect(last.text).toContain(winner);
    expect(lines.map((line) => line.tick)).toEqual([...lines.map((line) => line.tick)].sort((a, b) => a - b));
  });

  it('tells of hits and of a robot destroyed', () => {
    const { lines } = commentaryFor(['AggressiveBot', 'SentryBot']);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.some((line) => /destroyed|goes down|end of/.test(line.text))).toBe(true);
  });

  it('is the same every time for the same match, and leaves room between the quieter lines', () => {
    const first = commentaryFor(['StrafeBot', 'GuardBot']).lines;
    expect(commentaryFor(['StrafeBot', 'GuardBot']).lines).toEqual(first);
    for (let index = 1; index < first.length; index++) {
      const gap = first[index].tick - first[index - 1].tick;
      if (gap < 30) expect(first[index].weight > first[index - 1].weight || first[index].weight === 4).toBe(true);
    }
  });

  it('opens a battle royale with every robot', () => {
    const { lines } = commentaryFor(['Sample', 'DumbBot', 'StrafeBot']);
    for (const name of ['Sample', 'DumbBot', 'StrafeBot']) expect(lines[0].text).toContain(name);
  });
});
