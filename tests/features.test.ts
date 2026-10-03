import { describe, expect, it } from 'vitest';
import type { ProgramFeatures } from '../src/ai/features';
import { compileScript } from '../src/ai/roboscript';
import { TEMPLATES } from '../src/data/templates';

/** What a program is found to have to do with. */
function featuresOf(source: string): ProgramFeatures {
  const result = compileScript(source);
  if (!result.ok) throw new Error('Expected the program to compile');
  return result.features;
}

const NONE: ProgramFeatures = { cover: false, bullets: false, lead: false };

describe('program features: cover', () => {
  const usesCover = (source: string) => featuresOf(source).cover;

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

  it('is not fooled by a comment or a label', () => {
    expect(usesCover('loop\n    label cover  # turn cover\n    wait')).toBe(false);
  });
});

describe('program features: bullets', () => {
  const usesBullets = (source: string) => featuresOf(source).bullets;

  it('is true for a program that reads a sensor for incoming bullets', () => {
    expect(usesBullets('loop\n    if bullet_incoming\n        guard\n    else\n        wait')).toBe(true);
    expect(usesBullets('loop\n    if hp > 0 or bullet_distance < 36\n        guard')).toBe(true);
    expect(usesBullets('loop\n    set side = bullet_angle\n    wait')).toBe(true);
  });

  it('is false for a program that guards blindly', () => {
    expect(usesBullets('loop\n    guard')).toBe(false);
  });
});

describe('program features: lead', () => {
  const usesLead = (source: string) => featuresOf(source).lead;

  it('is true for a program that aims at where the enemy will be, or checks its gun against that point', () => {
    expect(usesLead('loop\n    aim lead')).toBe(true);
    expect(usesLead('loop\n    if lead_angle < 2\n        fire\n    else\n        wait')).toBe(true);
  });

  it('is false for a program that aims at where the enemy is', () => {
    expect(usesLead('loop\n    if aim_angle > 2\n        aim enemy\n    else\n        fire')).toBe(false);
  });
});

describe('program features', () => {
  it('count facing cover as turning to it', () => {
    expect(featuresOf('loop\n    face cover')).toEqual({ ...NONE, cover: true });
    expect(featuresOf('loop\n    face hit')).toEqual(NONE);
  });

  it('are none for a program that does not use any of it', () => {
    expect(featuresOf('loop\n    if enemy_visible and hp > wall_ahead\n        turn enemy\n    else\n        wait')).toEqual(NONE);
    expect(featuresOf('')).toEqual(NONE);
  });

  it('are found for the templates that defend themselves, and for none of the plain ones', () => {
    const found = Object.fromEntries(TEMPLATES.map((template) => [template.id, featuresOf(template.source)]));
    expect(found).toEqual({
      sample: NONE,
      dumb_bot: NONE,
      aggressive_bot: NONE,
      coward_bot: NONE,
      guard_bot: { ...NONE, bullets: true },
      cover_bot: { ...NONE, cover: true },
      strafe_bot: { ...NONE, lead: true },
      sentry_bot: { ...NONE, lead: true },
    });
  });
});
