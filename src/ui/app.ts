import { compileScript } from '../ai/roboscript';
import { type ScriptError, formatError } from '../ai/script_error';
import { ARENAS, findArena } from '../data/arenas';
import {
  DEFAULT_PLAYBACK_SPEED,
  EFFECT_LIFETIMES,
  MATCH_DEFAULTS,
  PLAYBACK_SPEEDS,
  REPLAY_TAIL_TICKS,
  ROBOT_IDS,
} from '../data/match_defaults';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate, templateSource } from '../data/templates';
import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import { recordMatch } from '../debug/recorder';
import { type BreakpointHit, ReplayManager } from '../debug/replay_manager';
import { type Snapshot, captureSnapshot } from '../debug/snapshot';
import { ProjectStore } from '../project/project_store';
import { type RobotBrain, createIdleAction } from '../sim/ai_context';
import { Simulation, type SimulationConfig } from '../sim/simulation';
import { BattleView, formatResult } from '../view/battle_view';
import { renderConfig } from './config_view';
import { DebugLogView } from './debug_log';
import { requireElement } from './dom';
import { Inspector } from './inspector';
import { type ProjectFile, ProjectPanel } from './project_panel';
import { RobotWorkspace } from './robot_workspace';
import { Toolbar } from './toolbar';
import { Transport } from './transport';
import { WatchPanel } from './watch_panel';

/** RUN just plays the match; DEBUG also shows executed lines, the full log, and stops at breakpoints. */
type Mode = 'run' | 'debug';

const MS_PER_SECOND = 1000;
const PLAYER_INDEX = 0;
const READY_MESSAGE = 'Edit the code and press RUN.';
const STALE_NOTE = 'code edited since this run';
/** What a robot's config shows as its AI: every robot runs the program in its own main.bot. */
const AI_LABEL = 'main.bot';
/** The element that holds each robot's code editor, in spawn order. */
const EDITOR_ELEMENT_IDS = ['code', 'enemy-code'];
/** The programs the robots start with, each written for its own side. */
const DEFAULT_SOURCES = DEFAULT_TEMPLATES.map((template, robotIndex) => templateSource(template, robotIndex));
const IDLE_BRAIN: RobotBrain = { decide: createIdleAction };
/** The event types shown in the log outside DEBUG mode. */
const RUN_LOG_TYPES: ReadonlySet<DebugEventType> = new Set(['system', 'hit', 'warning', 'error']);

/** Wires the panels to a recorded match: records matches, runs the frame loop, keeps the robots' code. */
class App {
  private readonly seed = readSeed();
  private readonly store = openStore();
  private readonly toolbar: Toolbar;
  private readonly transport: Transport;
  private readonly projectPanel: ProjectPanel;
  /** One per robot, in spawn order: the player's first. */
  private readonly workspaces: RobotWorkspace[];
  private readonly inspector: Inspector;
  private readonly watch = new WatchPanel(requireElement('watch-fields'), requireElement('watch-robot'));
  private readonly logView = new DebugLogView(requireElement('log-rows'), (event) => this.jumpTo(event));
  private readonly battleView = new BattleView(requireElement<HTMLCanvasElement>('battle-canvas'), EFFECT_LIFETIMES);
  private readonly templatePicker = requireElement<HTMLSelectElement>('load-template');
  /** The arena the next match is fought in. */
  private arena = findArena(this.store?.loadInfo().arena ?? null);
  private shownFile: ProjectFile = codeFileOf(PLAYER_INDEX);
  /** The starting positions in the chosen arena, shown while there is no match. */
  private idleSnapshot = this.captureIdle();

  /** null while no match has been recorded. */
  private replay: ReplayManager | null = null;
  private mode: Mode = 'run';
  private speed: number = DEFAULT_PLAYBACK_SPEED;
  private events: readonly DebugEvent[] = [];
  /** Replaces the usual toolbar message until the next RUN, DEBUG or RESET. */
  private notice: string | null = null;
  /** Set while the last attempt to save failed; shown next to the toolbar message. */
  private saveProblem: string | null = null;
  private lastFrame = performance.now();

  constructor() {
    this.toolbar = new Toolbar(
      {
        selectArena: (id) => this.selectArena(id),
        run: () => this.start('run'),
        debug: () => this.start('debug'),
        playPause: () => this.togglePlay(),
        reset: () => this.reset(),
      },
      { options: ARENAS, selectedId: this.arena.id },
    );
    this.toolbar.setProjectName(this.store?.loadInfo().name ?? ROBOT_IDS[PLAYER_INDEX]);
    this.transport = new Transport(PLAYBACK_SPEEDS, {
      playPause: () => this.togglePlay(),
      step: () => this.replay?.step(),
      stepBack: () => this.replay?.stepBack(),
      seek: (tick) => this.replay?.seek(tick),
      setSpeed: (speed) => this.setSpeed(speed),
    });
    this.projectPanel = new ProjectPanel(requireElement('project-tree'), ROBOT_IDS, (file) => this.showFile(file));
    this.workspaces = ROBOT_IDS.map((robotId, robotIndex) => this.createWorkspace(robotId, robotIndex));
    this.inspector = new Inspector(requireElement('inspector-tabs'), requireElement('inspector-fields'), ROBOT_IDS);
    this.setUpTemplatePicker();
    if (this.store === null) {
      this.events = [appEvent('warning', 'storage is unavailable: code will not be saved')];
    }
    this.showFile(this.shownFile);
    requestAnimationFrame(this.frame);
  }

  private createWorkspace(robotId: string, robotIndex: number): RobotWorkspace {
    const source = this.store?.loadSource(robotIndex) ?? DEFAULT_SOURCES[robotIndex];
    return new RobotWorkspace(robotId, requireElement(EDITOR_ELEMENT_IDS[robotIndex]), source, {
      save: (code) => this.store?.saveSource(robotIndex, code),
      edited: (workspace) => this.codeEdited(workspace),
      saveProblem: (problem) => {
        this.saveProblem = problem;
      },
    });
  }

  /** Loading a template replaces the code of the robot whose file is shown, written for that robot's side. */
  private setUpTemplatePicker(): void {
    const picker = this.templatePicker;
    picker.append(...TEMPLATES.map((template) => new Option(template.name, template.id)));
    picker.addEventListener('change', () => {
      const template = findTemplate(picker.value);
      // Back to the caption, so the same template can be picked again.
      picker.selectedIndex = 0;
      if (template === undefined) return;
      const { robotIndex } = this.shownFile;
      this.workspaces[robotIndex].load(templateSource(template, robotIndex));
    });
  }

  /** Records a match with the code in the editors and plays it back, unless some code has errors. */
  private start(mode: Mode): void {
    this.mode = mode;
    for (const workspace of this.workspaces) {
      workspace.flush();
      workspace.stale = false;
    }

    const brains: RobotBrain[] = [];
    const faulty: { workspace: RobotWorkspace; errors: ScriptError[] }[] = [];
    for (const workspace of this.workspaces) {
      const result = compileScript(workspace.source);
      workspace.editor.showErrorLines(result.ok ? [] : result.errors.map((error) => error.line));
      if (result.ok) brains.push(result.brain);
      else faulty.push({ workspace, errors: result.errors });
    }
    if (faulty.length > 0) {
      this.showErrors(faulty);
      return;
    }

    const recording = recordMatch(this.matchConfig(brains), EFFECT_LIFETIMES);
    this.replay = new ReplayManager(recording, {
      maxFrameTime: MATCH_DEFAULTS.maxFrameTime,
      tailTicks: REPLAY_TAIL_TICKS,
      speed: this.speed,
      breakpoints: mode === 'debug' ? this.workspaces.map((workspace) => breakpointSourceOf(workspace)) : [],
    });
    this.events =
      mode === 'debug' ? recording.events : recording.events.filter((event) => RUN_LOG_TYPES.has(event.type));
    this.notice = null;
    this.replay.restart();
    this.openBreakpointFile(this.replay.breakpointsAhead);
  }

  private showErrors(faulty: { workspace: RobotWorkspace; errors: ScriptError[] }[]): void {
    this.replay = null;
    this.events = faulty.flatMap(({ workspace, errors }) =>
      errors.map((error) => appEvent('error', formatError(error), error.line, workspace.robotId)),
    );
    this.notice = `${this.events.length} error(s). Fix the code and press RUN.`;
    // Bring a faulty file into view, unless one is already shown.
    const shownIsFaulty = faulty.some(({ workspace }) => workspace === this.workspaces[this.shownFile.robotIndex]);
    if (!shownIsFaulty || this.shownFile.file !== 'main.bot') {
      this.showFile(codeFileOf(this.workspaces.indexOf(faulty[0].workspace)));
    }
  }

  private togglePlay(): void {
    if (this.replay === null) return;
    if (this.replay.playing) this.replay.pause();
    else this.replay.play();
  }

  private reset(): void {
    this.replay = null;
    this.events = [];
    this.notice = null;
  }

  /** Takes effect from the next RUN / DEBUG; shown at once while there is no match. */
  private selectArena(id: string): void {
    this.arena = findArena(id);
    this.idleSnapshot = this.captureIdle();
    try {
      this.store?.saveArena(this.arena.id);
    } catch (error) {
      this.saveProblem = `could not save the map choice: ${describeError(error)}`;
    }
  }

  private captureIdle(): Snapshot {
    return captureSnapshot(new Simulation(this.matchConfig(ROBOT_IDS.map(() => IDLE_BRAIN))));
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    if (this.replay !== null) this.replay.speed = speed;
  }

  /** Goes to the moment of a log row, and to the line behind it in the code of the robot the row belongs to. */
  private jumpTo(event: DebugEvent): void {
    this.replay?.seek(event.tick);
    const robotIndex = ROBOT_IDS.findIndex((id) => id === event.robotId);
    if (event.sourceLine === null || robotIndex < 0) return;
    const workspace = this.workspaces[robotIndex];
    if (workspace.stale) return;
    this.showFile(codeFileOf(robotIndex));
    workspace.editor.revealLine(event.sourceLine);
  }

  /** Shows the code of the robot whose breakpoint playback has just stopped at. */
  private openBreakpointFile(hits: readonly BreakpointHit[]): void {
    if (hits.length === 0) return;
    const robotIndex = ROBOT_IDS.findIndex((id) => id === hits[0].robotId);
    if (robotIndex >= 0) this.showFile(codeFileOf(robotIndex));
  }

  private codeEdited(workspace: RobotWorkspace): void {
    if (this.replay !== null || this.events.length > 0) workspace.stale = true;
  }

  private matchConfig(brains: readonly RobotBrain[]): SimulationConfig {
    return {
      arena: this.arena.arena,
      stats: ROBOT_DEFAULTS,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.seed,
      robots: [
        { id: ROBOT_IDS[0], brain: brains[0] },
        { id: ROBOT_IDS[1], brain: brains[1] },
      ],
    };
  }

  private showFile(file: ProjectFile): void {
    this.shownFile = file;
    const isCode = file.file === 'main.bot';
    const robotId = ROBOT_IDS[file.robotIndex];

    EDITOR_ELEMENT_IDS.forEach((elementId, robotIndex) => {
      requireElement(elementId).hidden = !(isCode && robotIndex === file.robotIndex);
    });
    requireElement('config').hidden = isCode;
    this.templatePicker.hidden = !isCode;
    if (!isCode) renderConfig(requireElement('config'), robotId, AI_LABEL, ROBOT_DEFAULTS);

    requireElement('editor-title').textContent = `${robotId} / ${file.file}`;
    this.projectPanel.markSelected(file);
  }

  private frame = (now: number): void => {
    const { replay } = this;
    const wasPlaying = replay?.playing ?? false;
    replay?.advance((now - this.lastFrame) / MS_PER_SECOND);
    this.lastFrame = now;

    const stoppedBefore = replay !== null && !replay.playing ? replay.breakpointsAhead : [];
    if (wasPlaying) this.openBreakpointFile(stoppedBefore);

    const snapshot = replay?.snapshot ?? this.idleSnapshot;
    const debugging = this.mode === 'debug' && replay !== null;
    this.battleView.render(snapshot, replay?.recording.arena ?? this.arena.arena, ROBOT_DEFAULTS, {
      sensorOf: debugging ? this.inspector.selected : null,
      overrun: replay?.overrun ?? 0,
    });
    this.inspector.update(snapshot);
    this.watch.update(snapshot.robots[this.inspector.selected]);
    this.workspaces.forEach((workspace, robotIndex) => {
      const showLines = debugging && !workspace.stale;
      const nextLines = stoppedBefore.filter((hit) => hit.robotId === workspace.robotId).map((hit) => hit.line);
      workspace.editor.showExecutedLines(showLines ? snapshot.robots[robotIndex].executedLines : []);
      workspace.editor.showNextLines(showLines ? nextLines : []);
    });
    this.logView.update(this.events, replay?.reachedTick ?? 0, replay?.tick ?? 0);
    this.toolbar.setMessage(this.message(stoppedBefore));
    this.toolbar.setPlayback(replay !== null, replay?.playing ?? false);
    this.transport.update(
      replay === null
        ? null
        : {
            tick: replay.tick,
            lastTick: replay.lastTick,
            tickRate: replay.recording.tickRate,
            playing: replay.playing,
          },
      this.speed,
    );
    requestAnimationFrame(this.frame);
  };

  /** `stoppedBefore`: the breakpoint lines the next tick will run, if playback is stopped at them. */
  private message(stoppedBefore: readonly BreakpointHit[]): string {
    const parts = [this.notice ?? this.replayStatus(stoppedBefore)];
    const edited = this.workspaces.filter((workspace) => workspace.stale).map((workspace) => workspace.robotId);
    if (edited.length > 0) parts.push(`[${edited.join(', ')} ${STALE_NOTE}]`);
    if (this.saveProblem !== null) parts.push(`[${this.saveProblem}]`);
    return parts.join('   ');
  }

  private replayStatus(stoppedBefore: readonly BreakpointHit[]): string {
    if (this.replay === null) return READY_MESSAGE;
    return `${this.mode.toUpperCase()}   ${this.playbackStatus(this.replay, stoppedBefore)}`;
  }

  private playbackStatus(replay: ReplayManager, stoppedBefore: readonly BreakpointHit[]): string {
    const { result } = replay.snapshot;
    if (result !== null) return `${formatResult(result)} (${result.reason})`;
    if (replay.playing) return 'PLAYING';
    if (stoppedBefore.length === 0) return 'PAUSED';
    const where = stoppedBefore.map((hit) => `${hit.robotId} line ${hit.line}`).join(', ');
    return `BREAKPOINT   ${where} runs on the next tick. PLAY to continue, 1▶ to step.`;
  }
}

function codeFileOf(robotIndex: number): ProjectFile {
  return { robotIndex, file: 'main.bot' };
}

/** A robot's breakpoints only count while its editor still shows the code that was run. */
function breakpointSourceOf(workspace: RobotWorkspace) {
  return {
    robotId: workspace.robotId,
    lines: () => (workspace.stale ? [] : workspace.editor.breakpointLines()),
  };
}

/** An event raised by the IDE itself rather than by a match. */
function appEvent(
  type: DebugEventType,
  message: string,
  sourceLine: number | null = null,
  robotId: string | null = null,
): DebugEvent {
  return { tick: 0, timestamp: 0, robotId, type, message, sourceLine };
}

function readSeed(): number {
  const value = new URLSearchParams(window.location.search).get('seed');
  if (value === null) return MATCH_DEFAULTS.seed;
  const seed = Number.parseInt(value, 10);
  if (Number.isNaN(seed)) throw new Error(`Invalid seed: "${value}"`);
  return seed;
}

/** null when the browser refuses access to localStorage (e.g. blocked site data). */
function openStore(): ProjectStore | null {
  try {
    return new ProjectStore(window.localStorage, DEFAULT_SOURCES);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function startApp(): void {
  new App();
}
