import { compileScript } from '../ai/roboscript';
import { type ScriptError, formatError } from '../ai/script_error';
import { DEFAULT_ARENA } from '../data/default_arena';
import { DUMB_BOT } from '../data/enemies/dumb_bot';
import { MATCH_DEFAULTS, ROBOT_IDS } from '../data/match_defaults';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { SAMPLE_AI } from '../data/sample_ai';
import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import { DebugLogger } from '../debug/debug_logger';
import { DEFAULT_PROJECT, ProjectStore } from '../project/project_store';
import { type RobotBrain, createIdleAction } from '../sim/ai_context';
import { MatchController } from '../sim/match_controller';
import { type MatchResult, Simulation } from '../sim/simulation';
import { BattleView, formatResult } from '../view/battle_view';
import { CodeEditor } from './code_editor';
import { renderConfig } from './config_view';
import { DebugLogView } from './debug_log';
import { requireElement } from './dom';
import { formatSeconds } from './format';
import { Inspector } from './inspector';
import { type ProjectFile, ProjectPanel } from './project_panel';
import { Toolbar } from './toolbar';
import { WatchPanel } from './watch_panel';

const MS_PER_SECOND = 1000;
const SAVE_DELAY_MS = 400;
const PLAYER_INDEX = 0;
const READY_MESSAGE = 'Edit the code and press RUN.';
const IDLE_BRAIN: RobotBrain = { decide: createIdleAction };

/** Wires the panels to a match: creates matches, runs the frame loop, saves the code. */
class App {
  private readonly seed = readSeed();
  private readonly store = openStore();
  private readonly toolbar: Toolbar;
  private readonly projectPanel: ProjectPanel;
  private readonly editor: CodeEditor;
  private readonly inspector: Inspector;
  private readonly watch = new WatchPanel(requireElement('watch-fields'));
  private readonly logView = new DebugLogView(requireElement('log-rows'));
  private readonly battleView = new BattleView(requireElement<HTMLCanvasElement>('battle-canvas'));

  private simulation = this.createSimulation(IDLE_BRAIN);
  /** null while no match has been started (the arena then shows the starting positions). */
  private controller: MatchController | null = null;
  private events: readonly DebugEvent[] = [];
  /** Replaces the usual toolbar message until the next RUN or RESET. */
  private notice: string | null = null;
  /** Set while the last attempt to save failed; shown next to the toolbar message. */
  private saveProblem: string | null = null;
  private saveTimer: number | null = null;
  private lastFrame = performance.now();

  constructor() {
    const project = this.loadProject();
    this.toolbar = new Toolbar({
      run: () => this.run(),
      pause: () => this.togglePause(),
      reset: () => this.reset(),
    });
    this.toolbar.setProjectName(project.name);
    this.projectPanel = new ProjectPanel(requireElement('project-tree'), project.name, (file) => this.showFile(file));
    this.editor = new CodeEditor(requireElement('code'), project.source, () => this.scheduleSave());
    this.inspector = new Inspector(requireElement('inspector-tabs'), requireElement('inspector-fields'), ROBOT_IDS);
    renderConfig(requireElement('config'), ROBOT_DEFAULTS);
    this.showFile('main.bot');
    requestAnimationFrame(this.frame);
  }

  /** Starts a new match with the code in the editor, unless it has errors. */
  private run(): void {
    this.save();
    const result = compileScript(this.editor.source);
    if (!result.ok) {
      this.showErrors(result.errors);
      return;
    }
    const logger = new DebugLogger();
    this.editor.showErrorLines([]);
    this.simulation = this.createSimulation(result.brain, logger);
    this.controller = new MatchController(this.simulation, MATCH_DEFAULTS.maxFrameTime);
    this.events = logger.events;
    this.notice = null;
  }

  private showErrors(errors: ScriptError[]): void {
    this.editor.showErrorLines(errors.map((error) => error.line));
    this.clearMatch();
    this.events = errors.map((error) => appEvent('error', formatError(error), error.line));
    this.notice = `${errors.length} error(s). Fix the code and press RUN.`;
  }

  private togglePause(): void {
    if (this.controller?.running) this.controller.paused = !this.controller.paused;
  }

  private reset(): void {
    this.clearMatch();
    this.events = [];
    this.notice = null;
  }

  /** Drops the current match and shows the starting positions again. */
  private clearMatch(): void {
    this.simulation = this.createSimulation(IDLE_BRAIN);
    this.controller = null;
  }

  private createSimulation(playerBrain: RobotBrain, logger?: DebugLogger): Simulation {
    return new Simulation({
      arena: DEFAULT_ARENA,
      stats: ROBOT_DEFAULTS,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.seed,
      robots: [
        { id: ROBOT_IDS[0], brain: playerBrain },
        { id: ROBOT_IDS[1], brain: compileBundled('dumb_bot', DUMB_BOT) },
      ],
      logger,
    });
  }

  private showFile(file: ProjectFile): void {
    requireElement('code').hidden = file !== 'main.bot';
    requireElement('config').hidden = file !== 'config';
    requireElement('editor-title').textContent = file;
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
    this.controller?.advance((now - this.lastFrame) / MS_PER_SECOND);
    this.lastFrame = now;

    this.battleView.render(this.simulation);
    this.inspector.update(this.simulation);
    this.watch.update(this.simulation.robots[PLAYER_INDEX]);
    this.logView.update(this.events);
    this.toolbar.setMessage(this.message());
    this.toolbar.setPauseState(this.controller?.running ?? false, this.controller?.paused ?? false);
    requestAnimationFrame(this.frame);
  };

  private message(): string {
    const status = this.notice ?? this.matchStatus();
    return this.saveProblem === null ? status : `${status}   [${this.saveProblem}]`;
  }

  private matchStatus(): string {
    if (this.controller === null) return READY_MESSAGE;
    const time = `T ${formatSeconds(this.simulation.time)}`;
    return `${time}   ${describeMatch(this.simulation.result, this.controller.paused)}`;
  }
}

function describeMatch(result: MatchResult | null, paused: boolean): string {
  if (result !== null) return `${formatResult(result)} (${result.reason})`;
  return paused ? 'PAUSED' : 'RUNNING';
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
