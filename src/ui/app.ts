import { compileScript } from '../ai/roboscript';
import { type ScriptError, formatError } from '../ai/script_error';
import { DEFAULT_ARENA } from '../data/default_arena';
import { ENEMIES, findEnemy } from '../data/enemies';
import {
  DEFAULT_PLAYBACK_SPEED,
  EFFECT_LIFETIMES,
  MATCH_DEFAULTS,
  PLAYBACK_SPEEDS,
  REPLAY_TAIL_TICKS,
  ROBOT_IDS,
} from '../data/match_defaults';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { SAMPLE_AI } from '../data/sample_ai';
import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import { recordMatch } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import { captureSnapshot } from '../debug/snapshot';
import { DEFAULT_PROJECT, ProjectStore } from '../project/project_store';
import { type RobotBrain, createIdleAction } from '../sim/ai_context';
import { Simulation, type SimulationConfig } from '../sim/simulation';
import { BattleView, formatResult } from '../view/battle_view';
import { CodeEditor } from './code_editor';
import { renderConfig } from './config_view';
import { DebugLogView } from './debug_log';
import { requireElement } from './dom';
import { Inspector } from './inspector';
import { type ProjectFile, ProjectPanel } from './project_panel';
import { Toolbar } from './toolbar';
import { Transport } from './transport';
import { WatchPanel } from './watch_panel';

/** RUN just plays the match; DEBUG also shows executed lines, the full log, and stops at breakpoints. */
type Mode = 'run' | 'debug';

const MS_PER_SECOND = 1000;
const SAVE_DELAY_MS = 400;
const PLAYER_INDEX = 0;
const READY_MESSAGE = 'Edit the code and press RUN.';
const STALE_NOTE = 'code edited since this run';
const IDLE_BRAIN: RobotBrain = { decide: createIdleAction };
/** The event types shown in the log outside DEBUG mode. */
const RUN_LOG_TYPES: ReadonlySet<DebugEventType> = new Set(['system', 'hit', 'warning', 'error']);

/** Wires the panels to a recorded match: records matches, runs the frame loop, saves the code. */
class App {
  private readonly seed = readSeed();
  private readonly store = openStore();
  private readonly toolbar: Toolbar;
  private readonly transport: Transport;
  private readonly projectPanel: ProjectPanel;
  private readonly editor: CodeEditor;
  private readonly enemyEditor: CodeEditor;
  private readonly inspector: Inspector;
  private readonly watch = new WatchPanel(requireElement('watch-fields'));
  private readonly logView = new DebugLogView(requireElement('log-rows'), (event) => this.jumpTo(event));
  private readonly battleView = new BattleView(requireElement<HTMLCanvasElement>('battle-canvas'), EFFECT_LIFETIMES);
  /** The enemy the next match is fought against. */
  private enemy = findEnemy(this.store?.loadInfo().enemy ?? null);
  private shownFile: ProjectFile = 'main.bot';
  /** The starting positions, shown while there is no match. */
  private readonly idleSnapshot = captureSnapshot(new Simulation(this.matchConfig(IDLE_BRAIN)));

  /** null while no match has been recorded. */
  private replay: ReplayManager | null = null;
  private mode: Mode = 'run';
  private speed: number = DEFAULT_PLAYBACK_SPEED;
  private events: readonly DebugEvent[] = [];
  /** True once the code was edited after the last RUN / DEBUG: line numbers no longer match. */
  private stale = false;
  /** Replaces the usual toolbar message until the next RUN, DEBUG or RESET. */
  private notice: string | null = null;
  /** Set while the last attempt to save failed; shown next to the toolbar message. */
  private saveProblem: string | null = null;
  private saveTimer: number | null = null;
  private lastFrame = performance.now();

  constructor() {
    const project = this.loadProject();
    this.toolbar = new Toolbar(
      {
        selectEnemy: (id) => this.selectEnemy(id),
        run: () => this.start('run'),
        debug: () => this.start('debug'),
        playPause: () => this.togglePlay(),
        reset: () => this.reset(),
      },
      ENEMIES,
      this.enemy.id,
    );
    this.toolbar.setProjectName(project.name);
    this.transport = new Transport(PLAYBACK_SPEEDS, {
      playPause: () => this.togglePlay(),
      step: () => this.replay?.step(),
      stepBack: () => this.replay?.stepBack(),
      seek: (tick) => this.replay?.seek(tick),
      setSpeed: (speed) => this.setSpeed(speed),
    });
    this.projectPanel = new ProjectPanel(requireElement('project-tree'), project.name, (file) => this.showFile(file));
    this.editor = new CodeEditor(requireElement('code'), project.source, { onChange: () => this.codeEdited() });
    this.enemyEditor = new CodeEditor(requireElement('enemy-code'), this.enemy.source, { readOnly: true });
    this.inspector = new Inspector(requireElement('inspector-tabs'), requireElement('inspector-fields'), ROBOT_IDS);
    renderConfig(requireElement('config'), ROBOT_DEFAULTS);
    this.showFile('main.bot');
    requestAnimationFrame(this.frame);
  }

  /** Records a match with the code in the editor and plays it back, unless the code has errors. */
  private start(mode: Mode): void {
    this.save();
    this.stale = false;
    this.mode = mode;
    const result = compileScript(this.editor.source);
    if (!result.ok) {
      this.showErrors(result.errors);
      return;
    }
    this.editor.showErrorLines([]);
    const recording = recordMatch(this.matchConfig(result.brain), EFFECT_LIFETIMES);
    this.replay = new ReplayManager(recording, {
      maxFrameTime: MATCH_DEFAULTS.maxFrameTime,
      tailTicks: REPLAY_TAIL_TICKS,
      speed: this.speed,
      breakpoints: mode === 'debug' ? { robotId: ROBOT_IDS[PLAYER_INDEX], lines: () => this.activeBreakpoints() } : null,
    });
    this.events =
      mode === 'debug' ? recording.events : recording.events.filter((event) => RUN_LOG_TYPES.has(event.type));
    this.notice = null;
    this.replay.restart();
  }

  private showErrors(errors: ScriptError[]): void {
    this.editor.showErrorLines(errors.map((error) => error.line));
    this.replay = null;
    this.events = errors.map((error) => appEvent('error', formatError(error), error.line));
    this.notice = `${errors.length} error(s). Fix the code and press RUN.`;
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

  /** Takes effect from the next RUN / DEBUG. */
  private selectEnemy(id: string): void {
    this.enemy = findEnemy(id);
    this.enemyEditor.setSource(this.enemy.source);
    this.showFile(this.shownFile);
    if (this.store === null) return;
    try {
      this.store.saveEnemy(this.enemy.id);
    } catch (error) {
      this.saveProblem = `could not save the enemy choice: ${describeError(error)}`;
    }
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    if (this.replay !== null) this.replay.speed = speed;
  }

  /** Goes to the moment of a log row, and to the source line behind it if there is one. */
  private jumpTo(event: DebugEvent): void {
    this.replay?.seek(event.tick);
    if (event.sourceLine === null || this.stale) return;
    this.showFile('main.bot');
    this.editor.revealLine(event.sourceLine);
  }

  private codeEdited(): void {
    if (this.replay !== null || this.events.length > 0) this.stale = true;
    this.scheduleSave();
  }

  /** Breakpoints only count while the editor still shows the code that was run. */
  private activeBreakpoints(): readonly number[] {
    return this.stale ? [] : this.editor.breakpointLines();
  }

  private matchConfig(playerBrain: RobotBrain): SimulationConfig {
    return {
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.seed,
      robots: [
        { id: ROBOT_IDS[0], brain: playerBrain },
        { id: ROBOT_IDS[1], brain: compileBundled(this.enemy.id, this.enemy.source) },
      ],
    };
  }

  private showFile(file: ProjectFile): void {
    this.shownFile = file;
    requireElement('code').hidden = file !== 'main.bot';
    requireElement('config').hidden = file !== 'config';
    requireElement('enemy-code').hidden = file !== 'enemy.bot';
    requireElement('editor-title').textContent =
      file === 'enemy.bot' ? `${file} — ${this.enemy.name} (read-only)` : file;
    this.projectPanel.markSelected(file);
  }

  private loadProject(): { name: string; source: string } {
    if (this.store === null) {
      this.events = [appEvent('warning', 'storage is unavailable: code will not be saved')];
      return { name: DEFAULT_PROJECT.name, source: SAMPLE_AI };
    }
    return { name: this.store.loadInfo().name, source: this.store.loadSource() };
  }

  /** Saves shortly after the last edit, so typing does not write on every key. */
  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  private save(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.store === null) return;
    try {
      this.store.saveSource(this.editor.source);
      this.saveProblem = null;
    } catch (error) {
      this.saveProblem = `could not save main.bot: ${describeError(error)}`;
    }
  }

  private frame = (now: number): void => {
    const { replay } = this;
    replay?.advance((now - this.lastFrame) / MS_PER_SECOND);
    this.lastFrame = now;

    const snapshot = replay?.snapshot ?? this.idleSnapshot;
    const player = snapshot.robots[PLAYER_INDEX];
    this.battleView.render(snapshot, DEFAULT_ARENA, ROBOT_DEFAULTS, {
      sensorOf: this.mode === 'debug' && replay !== null ? this.inspector.selected : null,
      overrun: replay?.overrun ?? 0,
    });
    this.inspector.update(snapshot);
    this.watch.update(player);
    const showLines = this.mode === 'debug' && replay !== null && !this.stale;
    const stoppedBefore = replay !== null && !replay.playing ? replay.breakpointsAhead : [];
    this.editor.showExecutedLines(showLines ? player.executedLines : []);
    this.editor.showNextLines(showLines ? stoppedBefore : []);
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
  private message(stoppedBefore: readonly number[]): string {
    const parts = [this.notice ?? this.replayStatus(stoppedBefore)];
    if (this.stale) parts.push(`[${STALE_NOTE}]`);
    if (this.saveProblem !== null) parts.push(`[${this.saveProblem}]`);
    return parts.join('   ');
  }

  private replayStatus(stoppedBefore: readonly number[]): string {
    if (this.replay === null) return READY_MESSAGE;
    return `${this.mode.toUpperCase()}   ${this.playbackStatus(this.replay, stoppedBefore)}`;
  }

  private playbackStatus(replay: ReplayManager, stoppedBefore: readonly number[]): string {
    const { result } = replay.snapshot;
    if (result !== null) return `${formatResult(result)} (${result.reason})`;
    if (replay.playing) return 'PLAYING';
    if (stoppedBefore.length === 0) return 'PAUSED';
    return `BREAKPOINT   line ${stoppedBefore.join(', ')} runs on the next tick. PLAY to continue, 1▶ to step.`;
  }
}

/** An event raised by the IDE itself rather than by a match. */
function appEvent(type: DebugEventType, message: string, sourceLine: number | null = null): DebugEvent {
  return { tick: 0, timestamp: 0, robotId: null, type, message, sourceLine };
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
    return new ProjectStore(window.localStorage, SAMPLE_AI);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return null;
  }
}

/** Compiles a script shipped with the game; an error there is a bug, not user input. */
function compileBundled(name: string, source: string): RobotBrain {
  const result = compileScript(source);
  if (!result.ok) {
    throw new Error(`Bundled script "${name}" is invalid: ${result.errors.map(formatError).join('; ')}`);
  }
  return result.brain;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function startApp(): void {
  new App();
}
