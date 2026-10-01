import { describe, expect, it } from 'vitest';
import type { AIContext } from '../src/sim/ai_context';
import { SAMPLE_AI } from '../src/data/sample_ai';
import { compileBrain } from './helpers';

const BASE_CONTEXT: AIContext = {
  enemyVisible: false,
  enemyDistance: 0,
  enemyAngle: 0,
  enemyX: 0,
  enemyY: 0,
  hp: 100,
  ammo: 50,
};

function run(source: string, context: Partial<AIContext> = {}) {
  return compileBrain(source).decide({ ...BASE_CONTEXT, ...context });
}

/** Whether `if <expression>` takes its then-branch. */
function holds(expression: string, context: Partial<AIContext> = {}): boolean {
  return run(`if ${expression}\n    fire`, context).fire;
}

describe('runtime: commands', () => {
  it('does nothing for an empty program', () => {
    expect(run('')).toEqual({
      move: null,
      turn: null,
      fire: false,
      state: null,
      executedLines: [],
      sourceLines: { move: null, turn: null, fire: null, state: null },
    });
  });

  it('turns each command into the action and notes which line decided it', () => {
    expect(run('move left\nturn enemy\nfire\nstate TRACK')).toEqual({
      move: 'left',
      turn: 'enemy',
      fire: true,
      state: 'TRACK',
      executedLines: [1, 2, 3, 4],
      sourceLines: { move: 1, turn: 2, fire: 3, state: 4 },
    });
  });

  it('lets the last move, turn and state win', () => {
    const action = run('move forward\nturn left\nstate SEARCH\nmove backward\nturn right\nstate ATTACK');
    expect(action.move).toBe('backward');
    expect(action.turn).toBe('right');
    expect(action.state).toBe('ATTACK');
    expect(action.sourceLines).toEqual({ move: 4, turn: 5, fire: null, state: 6 });
  });

  it('cancels the action and stops the tick at wait, keeping the state', () => {
    expect(run('state EVADE\nmove forward\nturn left\nfire\nwait\nmove backward\nfire')).toEqual({
      move: null,
      turn: null,
      fire: false,
      state: 'EVADE',
      executedLines: [1, 2, 3, 4, 5],
      sourceLines: { move: null, turn: null, fire: null, state: 1 },
    });
  });

  it('stops the whole tick when wait is inside a block', () => {
    const action = run('if enemy_visible\n    wait\nfire', { enemyVisible: true });
    expect(action.fire).toBe(false);
    expect(action.executedLines).toEqual([1, 2]);
  });
});

describe('runtime: conditions', () => {
  it('reads each variable from the context', () => {
    expect(holds('enemy_visible', { enemyVisible: true })).toBe(true);
    expect(holds('enemy_visible', { enemyVisible: false })).toBe(false);
    expect(holds('enemy_distance == 120', { enemyDistance: 120 })).toBe(true);
    expect(holds('enemy_angle == -30', { enemyAngle: -30 })).toBe(true);
    expect(holds('hp == 40', { hp: 40 })).toBe(true);
    expect(holds('ammo == 7', { ammo: 7 })).toBe(true);
  });

  it('evaluates each comparison operator', () => {
    const context = { hp: 50 };
    expect(holds('hp < 51', context)).toBe(true);
    expect(holds('hp < 50', context)).toBe(false);
    expect(holds('hp > 49', context)).toBe(true);
    expect(holds('hp > 50', context)).toBe(false);
    expect(holds('hp <= 50', context)).toBe(true);
    expect(holds('hp <= 49', context)).toBe(false);
    expect(holds('hp >= 50', context)).toBe(true);
    expect(holds('hp >= 51', context)).toBe(false);
    expect(holds('hp == 50', context)).toBe(true);
    expect(holds('hp != 50', context)).toBe(false);
    expect(holds('hp != 49', context)).toBe(true);
  });

  it('evaluates and, or, not with their precedence', () => {
    expect(holds('not enemy_visible')).toBe(true);
    expect(holds('enemy_visible and hp > 0')).toBe(false);
    expect(holds('enemy_visible or hp > 0')).toBe(true);
    // (hp < 30) or (enemy_visible and ammo > 0)
    expect(holds('hp < 30 or enemy_visible and ammo > 0', { hp: 10 })).toBe(true);
    // (not enemy_visible) and (hp < 30)
    expect(holds('not enemy_visible and hp < 30', { hp: 100 })).toBe(false);
  });
});

describe('runtime: executed lines', () => {
  it('records the then-branch', () => {
    const action = run(SAMPLE_AI, { enemyVisible: true, enemyDistance: 100 });
    expect(action.executedLines).toEqual([1, 3, 4, 6, 8, 9]);
    expect(action).toMatchObject({ state: 'ATTACK', turn: 'enemy', fire: true, move: null });
  });

  it('records a nested else-branch', () => {
    const action = run(SAMPLE_AI, { enemyVisible: true, enemyDistance: 400 });
    expect(action.executedLines).toEqual([1, 3, 4, 6, 8, 10, 11]);
    expect(action).toMatchObject({ state: 'ATTACK', turn: 'enemy', fire: false, move: 'forward' });
  });

  it('records the outer else-branch', () => {
    const action = run(SAMPLE_AI, { enemyVisible: false });
    expect(action.executedLines).toEqual([1, 3, 12, 13]);
    expect(action).toMatchObject({ state: 'SEARCH', turn: 'right', fire: false, move: null });
  });

  it('records only the if line when the condition fails and there is no else', () => {
    expect(run('if enemy_visible\n    fire\nwait').executedLines).toEqual([1, 3]);
  });

  it('decides the same way every tick', () => {
    const brain = compileBrain(SAMPLE_AI);
    const context = { ...BASE_CONTEXT, enemyVisible: true, enemyDistance: 100 };
    expect(brain.decide(context)).toEqual(brain.decide(context));
  });
});
