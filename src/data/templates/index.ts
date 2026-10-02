import { aggressiveBot } from './aggressive_bot';
import { coverBot } from './cover_bot';
import { cowardBot } from './coward_bot';
import { dumbBot } from './dumb_bot';
import { guardBot } from './guard_bot';
import { sampleAi } from './sample';
import type { Side } from './side';
import { strafeBot } from './strafe_bot';

/** A ready-made RoboScript program that can be loaded into either robot's editor. */
export interface Template {
  /** Stable identifier. */
  id: string;
  /** Name shown to the player. */
  name: string;
  /** The RoboScript source for a robot that gets around obstacles on the given side. */
  build(avoid: Side): string;
}

export const TEMPLATES: readonly Template[] = [
  { id: 'sample', name: 'Sample', build: sampleAi },
  { id: 'dumb_bot', name: 'DumbBot', build: dumbBot },
  { id: 'aggressive_bot', name: 'AggressiveBot', build: aggressiveBot },
  { id: 'coward_bot', name: 'CowardBot', build: cowardBot },
  { id: 'guard_bot', name: 'GuardBot', build: guardBot },
  { id: 'cover_bot', name: 'CoverBot', build: coverBot },
  { id: 'strafe_bot', name: 'StrafeBot', build: strafeBot },
];

/** What each robot's editor holds until the player writes or loads something else, in spawn order. */
export const DEFAULT_TEMPLATES: readonly Template[] = [TEMPLATES[0], TEMPLATES[1]];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

/**
 * The template's source for the robot at the given spawn index. The robots
 * start facing each other, so two that turn the same way around an obstacle
 * end up on opposite sides of it and never meet; the first robot therefore
 * goes round on the left and the second on the right.
 */
export function templateSource(template: Template, robotIndex: number): string {
  return template.build(robotIndex % 2 === 0 ? 'left' : 'right');
}
