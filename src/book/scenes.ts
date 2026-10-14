import type { ProgramFeatures } from '../ai/features';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../data/match_defaults';
import type { Loadout } from '../data/parts';
import { type Recording, recordMatch } from '../debug/recorder';
import { stageLoadout, tutorialMatch } from '../tutorial/match';
import { type Stage, stageTeams } from '../tutorial/types';
import { createElement } from '../ui/dom';
import { BattleView } from '../view/battle_view';
import type { Scene, Timeline } from './types';

// The book's pictures of matches: each is a real match, played from its
// stage, its program and its seed when the page is read, so a picture always
// shows what the game does now.

const NO_FEATURES: ProgramFeatures = { cover: false, bullets: false, lead: false };

/** Plays the match of a scene or a timeline far enough to show `ticks` of it: what comes after makes no difference. */
export function recordFor(stage: Stage, program: string, ticks: number): { recording: Recording; loadouts: Loadout[] } {
  const seconds = Math.ceil((ticks + 1) / MATCH_DEFAULTS.tickRate);
  const built = tutorialMatch(stage, program, stageLoadout(stage), seconds);
  if (!built.ok) throw new Error(`A program of the book does not compile: ${built.errors[0]?.message}`);
  return { recording: recordMatch(built.match.config, EFFECT_LIFETIMES), loadouts: built.match.loadouts };
}

/** The lines of ALPHA's program that ran on each of the first ticks: rows[0] is tick 1. */
export function timelineRows(timeline: Timeline): (readonly number[])[] {
  const { recording } = recordFor(timeline.stage, timeline.program, timeline.ticks);
  return recording.snapshots.slice(1, timeline.ticks + 1).map((snapshot) => snapshot.robots[0].executedLines);
}

/**
 * A frame for the moment of a scene, drawn once it is on the page and has a
 * size, and again when its size changes. The match is played only then, so
 * pictures far down the page cost nothing until they are needed.
 */
export function createSceneFrame(scene: Scene, label: string): HTMLElement {
  const frame = createElement('div', 'book-scene');
  frame.setAttribute('role', 'img');
  frame.setAttribute('aria-label', label);
  const canvas = createElement('canvas', 'book-scene-canvas');
  frame.append(canvas);
  let drawn: { recording: Recording; loadouts: Loadout[]; view: BattleView } | null = null;
  const draw = () => {
    if (frame.clientWidth === 0) return;
    drawn ??= { ...recordFor(scene.stage, scene.program, scene.tick), view: new BattleView(canvas, EFFECT_LIFETIMES) };
    const { recording, loadouts, view } = drawn;
    view.render(recording.snapshots[Math.min(scene.tick, recording.snapshots.length - 1)], recording.arena, recording.stats, loadouts, {
      sensorOf: null,
      marks: NO_FEATURES,
      coverRoutes: recording.stats.map(() => false),
      overrun: 0,
      teams: stageTeams(scene.stage),
      bases: recording.bases,
      goal: scene.stage.goal,
    });
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(frame);
  return frame;
}
