import type { ProgramFeatures } from '../ai/features';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../data/match_defaults';
import { type Loadout, STANDARD_LOADOUT } from '../data/parts';
import { type Recording, recordMatch } from '../debug/recorder';
import { stageLoadout, tutorialMatch } from '../tutorial/match';
import { type Stage, stageTeams } from '../tutorial/types';
import { createElement } from '../ui/dom';
import { BattleView } from '../view/battle_view';
import { type ReplayedMatch, playReplay } from './replays';
import type { ReadingSensor, Readings, Replay, Scene, Timeline } from './types';

// The book's pictures of matches: each is a real match, played from its
// stage, its program and its seed when the page is read, so a picture always
// shows what the game does now.

const NO_FEATURES: ProgramFeatures = { cover: false, bullets: false, lead: false };
/** A replay's robots both have the standard parts, as on the program screen. */
const REPLAY_LOADOUTS: readonly Loadout[] = [STANDARD_LOADOUT, STANDARD_LOADOUT];

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

/** What ALPHA's sensors read on each of the ticks asked for, one row a tick, in the order of the sensors. */
export function readingsRows(readings: Readings): (boolean | number)[][] {
  const { recording } = recordFor(readings.stage, readings.program, Math.max(...readings.ticks));
  return readings.ticks.map((tick) => {
    const robot = recording.snapshots[tick].robots[0];
    const value: Record<ReadingSensor, boolean | number> = {
      enemy_visible: robot.enemyVisible,
      enemy_distance: robot.enemyDistance,
      enemy_angle: robot.enemyAngle,
      hp: robot.hp,
    };
    return readings.sensors.map((sensor) => value[sensor]);
  });
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

/** A picture of a book's whole match that can be moved to any of its moments. */
export interface ReplayFrame {
  element: HTMLElement;
  /** Shows that moment; the match is played the first time something is shown. */
  show(tick: number): void;
}

/**
 * A frame for a moment of a replay, drawn as the debugger draws it: the
 * labels under the robots, ALPHA's line of sight and its marks.
 */
export function createReplayFrame(replay: Replay, tick: number, label: string): ReplayFrame {
  const element = createElement('div', 'book-scene');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
  const canvas = createElement('canvas', 'book-scene-canvas');
  element.append(canvas);
  let shown = tick;
  let drawn: { match: ReplayedMatch; view: BattleView } | null = null;
  const draw = () => {
    if (element.clientWidth === 0) return;
    drawn ??= { match: playReplay(replay), view: new BattleView(canvas, EFFECT_LIFETIMES) };
    const { recording, features } = drawn.match;
    drawn.view.render(recording.snapshots[Math.min(shown, recording.snapshots.length - 1)], recording.arena, recording.stats, REPLAY_LOADOUTS, {
      sensorOf: 0,
      marks: features[0],
      coverRoutes: features.map((each) => each.cover),
      overrun: 0,
    });
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(element);
  return {
    element,
    show: (at) => {
      shown = at;
      draw();
    },
  };
}
