import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { TEMPLATES } from '../src/data/templates';

/** Whether a program is found to have anything to do with cover. */
function usesCover(source: string): boolean {
  const result = compileScript(source);
  if (!result.ok) throw new Error('Expected the program to compile');
  return result.usesCover;
}

describe('usesCover', () => {
  it('is true for a program that turns towards cover', () => {
    expect(usesCover('loop\n    turn cover')).toBe(true);
    expect(usesCover('loop\n    if blocked\n        wait\n    else\n        turn cover')).toBe(true);
  });

  it('is true for a program that reads a cover sensor, wherever it does', () => {
    expect(usesCover('loop\n    if cover_visible\n        fire\n    wait')).toBe(true);
    expect(usesCover('loop\n    if hp < 50 and not (cover_distance > 5)\n        fire\n    wait')).toBe(true);
    expect(usesCover('while cover_angle > 5\n    wait')).toBe(true);
    expect(usesCover('loop\n    set far = -(cover_distance / 2) + 1\n    wait')).toBe(true);
  });

  it('is false for a program that never mentions cover', () => {
    expect(usesCover('loop\n    if enemy_visible and hp > wall_ahead\n        turn enemy\n    else\n        wait')).toBe(false);
    expect(usesCover('')).toBe(false);
  });

  it('is not fooled by a comment or a label', () => {
    expect(usesCover('loop\n    label cover  # turn cover\n    wait')).toBe(false);
  });

  it('is true for CoverBot alone among the templates', () => {
    const users = TEMPLATES.filter((template) => usesCover(template.build('left')));
    expect(users.map((template) => template.id)).toEqual(['cover_bot']);
  });
});
