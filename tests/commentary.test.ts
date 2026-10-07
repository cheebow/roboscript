import { describe, expect, it } from 'vitest';
import { commentaryOf } from '../src/arena/commentary';
import { builtInEntrants, prepareFight } from '../src/arena/match';
import { ARENAS } from '../src/data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../src/data/match_defaults';
import { recordMatch } from '../src/debug/recorder';
import type { Arena, Base } from '../src/sim/types';
import { FixedBrain, NO_SPREAD_STATS, compileBrain } from './helpers';

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
    // 15 ticks is the climax gap, the closest two lines may ever come unless the later is louder.
    for (let index = 1; index < first.length; index++) {
      const gap = first[index].tick - first[index - 1].tick;
      if (gap < 15) expect(first[index].weight > first[index - 1].weight || first[index].weight === 4).toBe(true);
    }
  });

  it('opens a battle royale with every robot', () => {
    const { lines } = commentaryFor(['Sample', 'DumbBot', 'StrafeBot']);
    for (const name of ['Sample', 'DumbBot', 'StrafeBot']) expect(lines[0].text).toContain(name);
  });
});

describe('the commentary of a castle match', () => {
  const FIELD: Arena = {
    width: 1000,
    height: 600,
    obstacles: [],
    spawns: [
      { x: 150, y: 200, rotation: 0 },
      { x: 150, y: 400, rotation: 0 },
      { x: 850, y: 200, rotation: 180 },
      { x: 850, y: 400, rotation: 180 },
    ],
  };
  const BASES: Base[] = [
    { team: 0, rect: { x: 0, y: 220, width: 40, height: 160 }, maxHp: 400 },
    { team: 1, rect: { x: 960, y: 220, width: 40, height: 160 }, maxHp: 400 },
  ];

  it("reads each side's plan from its opening moves", () => {
    // RED marches on the enemy castle with everything; BLUE never moves.
    const recording = recordMatch(
      {
        arena: FIELD,
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: 8,
        seed: 5,
        robots: [
          { id: 'A1', brain: compileBrain('drive forward\nloop\n    wait\n'), stats: NO_SPREAD_STATS },
          { id: 'A2', brain: compileBrain('drive forward\nloop\n    wait\n'), stats: NO_SPREAD_STATS },
          { id: 'B1', brain: new FixedBrain(), stats: NO_SPREAD_STATS },
          { id: 'B2', brain: new FixedBrain(), stats: NO_SPREAD_STATS },
        ],
        teams: [0, 0, 1, 1],
        bases: BASES,
      },
      EFFECT_LIFETIMES,
    );
    const lines = commentaryOf(recording, ['A1', 'A2', 'B1', 'B2'], 8, ['RED', 'BLUE']);
    expect(lines.some((line) => /All-out|commits everything/.test(line.text) && line.text.includes('RED'))).toBe(true);
    expect(lines.some((line) => /not moving|wall of steel/.test(line.text) && line.text.includes('BLUE'))).toBe(true);
  });

  it('calls a wiped-out team whose castle holds, and its win at the judgement', () => {
    // BLUE's one robot shells RED's castle until RED guns it down; at the end
    // of time the healthier castle gives wiped-out BLUE the judgement.
    const arena: Arena = {
      ...FIELD,
      spawns: [
        { x: 400, y: 300, rotation: 0 },
        { x: 700, y: 300, rotation: 0 },
      ],
    };
    const recording = recordMatch(
      {
        arena,
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: 20,
        seed: 1,
        robots: [
          { id: 'RED-1', brain: compileBrain('loop\n    if enemy_visible\n        aim enemy\n        fire\n    else\n        wait\n'), stats: NO_SPREAD_STATS },
          { id: 'BLUE-1', brain: compileBrain('loop\n    aim ahead\n    fire\n'), stats: NO_SPREAD_STATS },
        ],
        teams: [0, 1],
        bases: [
          { team: 0, rect: { x: 960, y: 220, width: 40, height: 160 }, maxHp: 400 },
          { team: 1, rect: { x: 0, y: 220, width: 40, height: 160 }, maxHp: 400 },
        ],
      },
      EFFECT_LIFETIMES,
    );
    const lines = commentaryOf(recording, ['RED-1', 'BLUE-1'], 20, ['RED', 'BLUE']);
    expect(lines.some((line) => /wiped out|castle fights on/.test(line.text) && line.text.includes('BLUE'))).toBe(true);
    const last = lines[lines.length - 1];
    expect(/beyond the field|carries the day/.test(last.text)).toBe(true);
    expect(last.text).toContain('BLUE');
  });
});
