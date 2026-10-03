import type { ProgramFeatures } from '../ai/features';
import { LANGUAGE_KEY, currentLanguage, otherLanguage } from '../i18n/language';
import { t } from '../i18n/messages';
import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import { randomSeed } from '../arena/seed';
import { scatterSpawns } from '../arena/spawns';
import { ARENAS, findArena } from '../data/arenas';
import {
  DEFAULT_PLAYBACK_SPEED,
  EFFECT_LIFETIMES,
  MATCH_DEFAULTS,
  PLAYBACK_SPEEDS,
  REPLAY_TAIL_TICKS,
  ROBOT_IDS,
} from '../data/match_defaults';
import { COST_LIMIT, type Loadout, STANDARD_LOADOUT, type Slot, costOf, statsOf } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate } from '../data/templates';
import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import { recordMatch } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import { type Snapshot, captureSnapshot } from '../debug/snapshot';
import { Garage, MAX_NAME_LENGTH, garageName } from '../project/garage';
import { ProjectStore } from '../project/project_store';
import { RULES_VERSION } from '../data/rules_version';
import { decodeRobot, encodeRobot } from '../share/codec';
import { type RobotBrain, createIdleAction } from '../sim/ai_context';
import { Simulation, type SimulationConfig } from '../sim/simulation';
import { BattleView, formatResult } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import { ActionMenu } from './action_menu';
import { ArenaMode } from './arena_mode';
import { ContestMode } from './contest_mode';
import { DebugLogView } from './debug_log';
import { requireElement } from './dom';
import { GaragePanel } from './garage_panel';
import { Inspector } from './inspector';
import { PartsView } from './parts_view';
import { type ProjectFile, ProjectPanel } from './project_panel';
import { RobotWorkspace } from './robot_workspace';
import { Splitters } from './splitters';
import { Toolbar } from './toolbar';
import { Transport } from './transport';
import { WatchPanel } from './watch_panel';

/** RUN just plays the match; DEBUG also shows the programs running line by line and the full log, and lets a line be followed through the match. */
type Mode = 'run' | 'debug';

/** PROGRAM is where the code of ALPHA and BRAVO is written and debugged; ARENA is where saved robots fight and are watched. */
const SCREENS = ['program', 'arena', 'contest'] as const;
type Screen = (typeof SCREENS)[number];

const MS_PER_SECOND = 1000;
const PLAYER_INDEX = 0;
/** What a robot's config shows as its AI: every robot runs the program in its own main.bot. */
const AI_LABEL = 'main.bot';
/** The element that holds each robot's code editor, in spawn order. */
const EDITOR_ELEMENT_IDS = ['code', 'enemy-code'];
/** The programs the robots start with. */
const DEFAULT_SOURCES = DEFAULT_TEMPLATES.map((template) => template.source);
const IDLE_BRAIN: RobotBrain = { decide: createIdleAction };
/** The event types shown in the log outside DEBUG mode. */
const RUN_LOG_TYPES: ReadonlySet<DebugEventType> = new Set(['system', 'hit', 'warning', 'error']);
const NO_MARKS: readonly number[] = [];
const NO_FEATURES: ProgramFeatures = { cover: false, bullets: false, lead: false };
const NO_COVER_ROUTES: readonly boolean[] = [];

/** What keeps a match from starting: errors in a robot's code, or parts that cost too much. */
interface Fault {
  /** The file to put it right in. */
  file: ProjectFile;
  events: DebugEvent[];
}

/** A line of a robot's program that the player follows through the match: where it runs is marked on the seek bar. */
interface FollowedLine {
  robotIndex: number;
  line: number;
  /** The recording the marks were worked out for. */
  replay: ReplayManager;
  /** The ticks at which the line runs. */
  marks: readonly number[];
}

/** Wires the panels to a recorded match: records matches, runs the frame loop, keeps the robots' code and parts. */
class App {
  /** The seed every match gets when the URL names one, so that the same match can be watched again; null otherwise. */
  private readonly pinnedSeed = readPinnedSeed();
  /** The seed of the next RUN / DEBUG: where the robots start and how their shots scatter. */
  private seed = this.pinnedSeed ?? randomSeed();
  private readonly store = openStore();
  private readonly garage = openGarage();
  private readonly garagePanel = new GaragePanel(requireElement('garage'), ROBOT_IDS, {
    save: (name, robotIndex) => this.saveToGarage(name, robotIndex),
    load: (name, robotIndex) => this.loadFromGarage(name, robotIndex),
    remove: (name) => this.removeFromGarage(name),
    share: (name) => this.shareRobot(name),
    importCode: (text) => void this.importRobot(text),
  });
  private readonly toolbar: Toolbar;
  private readonly transport: Transport;
  private readonly projectPanel: ProjectPanel;
  /** One per robot, in spawn order: the player's first. */
  private readonly workspaces: RobotWorkspace[];
  private readonly inspector: Inspector;
  private readonly watch = new WatchPanel(requireElement('watch-fields'), requireElement('watch-robot'));
  private readonly logView = new DebugLogView(requireElement('log-rows'), (event) => this.jumpTo(event));
  private readonly battleView = new BattleView(requireElement<HTMLCanvasElement>('battle-canvas'), EFFECT_LIFETIMES);
  private readonly templateMenu: ActionMenu;
  private readonly partsView = new PartsView(requireElement('config'), (slot, partId) => this.pickPart(slot, partId));
  private readonly arenaMode: ArenaMode;
  private readonly contestMode: ContestMode;
  private screen: Screen = 'program';
  /** The arena the next match is fought in. */
  private arena = findArena(this.store?.loadInfo().arena ?? null);
  /** The parts each robot goes into the next match with, in spawn order. */
  private readonly loadouts: Loadout[] = ROBOT_IDS.map(
    (_, robotIndex) => this.store?.loadLoadout(robotIndex) ?? STANDARD_LOADOUT,
  );
  /** What the parts of each robot add up to. */
  private stats: RobotStats[] = this.loadouts.map((loadout) => statsOf(loadout));
  /** Per robot: whether its parts were changed after the last RUN / DEBUG. */
  private partsStale: boolean[] = ROBOT_IDS.map(() => false);
  /** The parts the robots carry in the match being shown. */
  private matchLoadouts: readonly Loadout[] = [];
  private shownFile: ProjectFile = codeFileOf(PLAYER_INDEX);
  /** The robots where the next RUN / DEBUG will start them, shown while there is no match. */
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
  /** What the garage last did, or why it could not; shown next to the toolbar message until the next RUN, DEBUG or RESET. */
  private garageNote: string | null = null;
  /** Per robot: what the program of the match being shown has to do with, which decides the marks drawn for it. */
  private features: ProgramFeatures[] = [];
  /** The line whose number was last clicked while debugging. */
  private followed: FollowedLine | null = null;
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
      step: () => this.step(),
      stepBack: () => this.stepBack(),
      nextRun: () => this.goToRun('next'),
      previousRun: () => this.goToRun('previous'),
      seek: (tick) => this.shownReplay()?.seek(tick),
      setSpeed: (speed) => this.setSpeed(speed),
    });
    this.templateMenu = new ActionMenu(
      requireElement('template-menu'),
      requireElement<HTMLButtonElement>('load-template'),
      TEMPLATES.map(({ id, name }) => ({ id, label: name })),
      (id) => this.loadTemplate(id),
    );
    this.projectPanel = new ProjectPanel(requireElement('project-tree'), ROBOT_IDS, (file) => this.showFile(file));
    this.workspaces = ROBOT_IDS.map((robotId, robotIndex) => this.createWorkspace(robotId, robotIndex));
    this.inspector = new Inspector(requireElement('inspector-tabs'), requireElement('inspector-fields'), ROBOT_IDS);
    if (this.store === null) {
      this.events = [appEvent('warning', t('program.storageUnavailable'))];
    }
    this.arenaMode = new ArenaMode(requireElement('lineup-slots'), requireElement('result-rows'), {
      arena: () => this.arena,
      garage: () => this.garage?.list() ?? [],
      speed: () => this.speed,
      chooseArena: (id) => {
        this.selectArena(id);
        this.toolbar.setArena(id);
      },
      keepRobots: (robots) => {
        if (this.garage === null) throw new Error(t('garage.noStorage'));
        const names = robots.map((robot) => this.garage?.importRobot(robot) ?? robot.name);
        this.showGarage();
        return names;
      },
    });
    this.contestMode = new ContestMode(requireElement('contest-body'), requireElement('board'), {
      garage: () => this.garage?.list() ?? [],
      speed: () => this.speed,
      storage: openStorage(),
    });
    for (const screen of SCREENS) {
      requireElement(`screen-${screen}`).addEventListener('click', () => this.showScreen(screen));
    }
    this.showScreen(this.screen);
    this.showFile(this.shownFile);
    this.showGarage();
    new Splitters(requireElement('app'), requireElement('vsplit'), requireElement('hsplit'), openStorage());
    requireElement('language').addEventListener('click', () => switchLanguage(openStorage()));
    requestAnimationFrame(this.frame);
  }

  /** The share code of a saved robot. */
  private async shareRobot(name: string): Promise<string | null> {
    const saved = this.garage?.find(name);
    return saved === undefined ? null : encodeRobot(saved);
  }

  /** Keeps the robot in a share code in the garage, and says so, or says what is wrong with the code. */
  private async importRobot(code: string): Promise<void> {
    if (this.garage === null) {
      this.garageNote = t('garage.noStorage');
      return;
    }
    const decoded = await decodeRobot(code);
    if (!decoded.ok) {
      this.garageNote = t('garage.couldNotImport', { problem: decoded.problem });
      return;
    }
    const { robot, rules } = decoded.shared;
    try {
      const name = this.garage.importRobot(robot);
      const received = name === robot.name ? t('garage.received', { name }) : t('garage.receivedAs', { name: robot.name, kept: name });
      const otherRules = rules === RULES_VERSION ? '' : t('garage.otherRules', { rules: rules || t('share.unknown'), now: RULES_VERSION });
      this.garageNote = `${received}${otherRules}`;
    } catch (error) {
      this.garageNote = t('garage.couldNotKeep', { name: robot.name, reason: describeError(error) });
    }
    this.showGarage();
  }

  /** Switches between writing programs and watching fights. Either keeps what it was showing; its replay is paused meanwhile. */
  private showScreen(screen: Screen): void {
    this.shownReplay()?.pause();
    this.screen = screen;
    requireElement('app').dataset.screen = screen;
    for (const each of SCREENS) requireElement(`screen-${each}`).classList.toggle('selected', each === screen);
    // Robots may have been saved or deleted since the arena was last shown.
    if (screen === 'arena') this.arenaMode.refresh();
    if (screen === 'contest') this.contestMode.shown();
  }

  /** The replay of the screen being shown: the one the transport and PAUSE act on. */
  private shownReplay(): ReplayManager | null {
    if (this.screen === 'arena') return this.arenaMode.replay;
    if (this.screen === 'contest') return this.contestMode.replay;
    return this.replay;
  }

  private createWorkspace(robotId: string, robotIndex: number): RobotWorkspace {
    const source = this.store?.loadSource(robotIndex) ?? DEFAULT_SOURCES[robotIndex];
    return new RobotWorkspace(robotId, requireElement(EDITOR_ELEMENT_IDS[robotIndex]), source, {
      save: (code) => this.store?.saveSource(robotIndex, code),
      edited: (workspace) => this.codeEdited(workspace),
      saveProblem: (problem) => {
        this.saveProblem = problem;
      },
      lineClicked: (workspace, line) => this.toggleFollowedLine(workspace, line),
    });
  }

  /** Loading a template replaces the code of the robot whose file is shown. */
  private loadTemplate(id: string): void {
    const template = findTemplate(id);
    if (template === undefined) return;
    this.workspaces[this.shownFile.robotIndex].load(template.source);
  }

  /**
   * Records a match with the code in the editors and the parts chosen, and
   * plays it back, unless some code has errors or some robot's parts cost too much.
   */
  private start(mode: Mode): void {
    this.mode = mode;
    for (const workspace of this.workspaces) {
      workspace.flush();
      workspace.stale = false;
    }
    this.partsStale.fill(false);
    this.garageNote = null;

    const brains: RobotBrain[] = [];
    const features: ProgramFeatures[] = [];
    const faults: Fault[] = [];
    this.loadouts.forEach((loadout, robotIndex) => {
      const cost = costOf(loadout);
      if (cost <= COST_LIMIT) return;
      const message = t('program.costOverLimit', { cost, limit: COST_LIMIT });
      faults.push({
        file: { robotIndex, file: 'config' },
        events: [appEvent('error', message, null, ROBOT_IDS[robotIndex])],
      });
    });
    this.workspaces.forEach((workspace, robotIndex) => {
      const result = compileScript(workspace.source);
      workspace.editor.showErrorLines(result.ok ? [] : result.errors.map((error) => error.line));
      if (result.ok) {
        brains.push(result.brain);
        features.push(result.features);
      } else {
        faults.push({
          file: codeFileOf(robotIndex),
          events: result.errors.map((error) => appEvent('error', formatError(error), error.line, workspace.robotId)),
        });
      }
    });
    if (faults.length > 0) {
      this.showFaults(faults);
      return;
    }

    this.features = features;
    this.matchLoadouts = [...this.loadouts];
    const recording = recordMatch(this.matchConfig(brains), EFFECT_LIFETIMES);
    this.drawSeed();
    this.replay = new ReplayManager(recording, {
      maxFrameTime: MATCH_DEFAULTS.maxFrameTime,
      tailTicks: REPLAY_TAIL_TICKS,
      speed: this.speed,
      focus: ROBOT_IDS[this.shownFile.robotIndex],
    });
    this.events =
      mode === 'debug' ? recording.events : recording.events.filter((event) => RUN_LOG_TYPES.has(event.type));
    this.notice = null;
    this.replay.restart();
    this.refollow(this.replay);
  }

  /** Keeps following the same line in a new match, so that a change to the code can be compared with the run before. */
  private refollow(replay: ReplayManager): void {
    if (this.followed === null) return;
    const { robotIndex, line } = this.followed;
    const marks = replay.runsOf(ROBOT_IDS[robotIndex], line).map((run) => run.tick);
    this.followed = { robotIndex, line, replay, marks };
  }

  private showFaults(faults: readonly Fault[]): void {
    this.replay = null;
    this.events = faults.flatMap((fault) => fault.events);
    this.notice = t('program.errors', { count: this.events.length });
    // Bring a faulty file into view, unless one is already shown.
    const { robotIndex, file } = this.shownFile;
    const shownIsFaulty = faults.some((fault) => fault.file.robotIndex === robotIndex && fault.file.file === file);
    if (!shownIsFaulty) this.showFile(faults[0].file);
  }

  /** One line of the program in view while debugging; otherwise one tick. */
  private step(): void {
    if (this.screen === 'program' && this.mode === 'debug') this.replay?.stepLine();
    else this.shownReplay()?.step();
  }

  private stepBack(): void {
    if (this.screen === 'program' && this.mode === 'debug') this.replay?.stepLineBack();
    else this.shownReplay()?.stepBack();
  }

  private togglePlay(): void {
    const replay = this.shownReplay();
    if (replay === null) return;
    if (replay.playing) replay.pause();
    else replay.play();
  }

  private reset(): void {
    this.replay = null;
    this.events = [];
    this.notice = null;
    this.partsStale.fill(false);
    this.garageNote = null;
    this.drawSeed();
  }

  /** Gives the next match a seed of its own, and puts the waiting robots where it will start them. Unless the URL pins the seed. */
  private drawSeed(): void {
    if (this.pinnedSeed !== null) return;
    this.seed = randomSeed();
    this.idleSnapshot = this.captureIdle();
  }

  /** Puts the part into the slot of the robot whose config is shown. Takes effect from the next RUN / DEBUG. */
  private pickPart(slot: Slot, partId: string): void {
    const { robotIndex } = this.shownFile;
    this.setLoadout(robotIndex, { ...this.loadouts[robotIndex], [slot]: partId });
  }

  /** Gives the robot the parts. Takes effect from the next RUN / DEBUG. */
  private setLoadout(robotIndex: number, loadout: Loadout): void {
    this.loadouts[robotIndex] = loadout;
    this.stats = this.loadouts.map((each) => statsOf(each));
    this.idleSnapshot = this.captureIdle();
    if (this.replay !== null) this.partsStale[robotIndex] = true;
    if (this.shownFile.robotIndex === robotIndex) {
      this.partsView.show(ROBOT_IDS[robotIndex], AI_LABEL, loadout, paletteOf(robotIndex));
    }
    try {
      this.store?.saveLoadout(robotIndex, loadout);
    } catch (error) {
      this.saveProblem = t('program.couldNotSaveParts', { robot: ROBOT_IDS[robotIndex], reason: describeError(error) });
    }
  }

  /** Keeps the robot, its code and its parts as they are now, in the garage under the name typed. */
  private saveToGarage(typedName: string, robotIndex: number): void {
    const name = garageName(typedName);
    const workspace = this.workspaces[robotIndex];
    if (name === null) {
      this.garageNote = t('garage.noName', { robot: workspace.robotId, max: MAX_NAME_LENGTH });
      return;
    }
    if (this.garage === null) {
      this.garageNote = t('garage.noStorage');
      return;
    }
    try {
      const replaced = this.garage.save({ name, source: workspace.source, loadout: this.loadouts[robotIndex] });
      this.garageNote = t(replaced ? 'garage.savedInstead' : 'garage.saved', { robot: workspace.robotId, name });
    } catch (error) {
      this.garageNote = t('garage.couldNotSave', { name, reason: describeError(error) });
    }
    this.showGarage();
  }

  /** Puts a saved robot's code and parts in place of the robot's own. The code can be brought back by undoing in its editor. */
  private loadFromGarage(name: string, robotIndex: number): void {
    const saved = this.garage?.find(name);
    if (saved === undefined) return;
    const workspace = this.workspaces[robotIndex];
    workspace.load(saved.source);
    this.setLoadout(robotIndex, { ...saved.loadout });
    this.showFile(codeFileOf(robotIndex));
    this.garageNote = t('garage.loaded', { name, robot: workspace.robotId });
  }

  private removeFromGarage(name: string): void {
    if (this.garage === null) return;
    try {
      this.garage.remove(name);
      this.garageNote = t('garage.deleted', { name });
    } catch (error) {
      this.garageNote = t('garage.couldNotDelete', { name, reason: describeError(error) });
    }
    this.showGarage();
  }

  private showGarage(): void {
    this.garagePanel.show(this.garage?.list().map((robot) => robot.name) ?? []);
  }

  /** Takes effect from the next RUN / DEBUG; shown at once while there is no match. */
  private selectArena(id: string): void {
    this.arena = findArena(id);
    this.idleSnapshot = this.captureIdle();
    this.arenaMode.arenaChanged();
    try {
      this.store?.saveArena(this.arena.id);
    } catch (error) {
      this.saveProblem = t('program.couldNotSaveMap', { reason: describeError(error) });
    }
  }

  private captureIdle(): Snapshot {
    return captureSnapshot(new Simulation(this.matchConfig(ROBOT_IDS.map(() => IDLE_BRAIN))));
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    if (this.replay !== null) this.replay.speed = speed;
    if (this.arenaMode.replay !== null) this.arenaMode.replay.speed = speed;
    if (this.contestMode.replay !== null) this.contestMode.replay.speed = speed;
  }

  /**
   * Goes to the moment of a log row. A row that came from a line of code goes
   * to just before that line ran, and shows it in the code of its robot.
   */
  private jumpTo(event: DebugEvent): void {
    const robotIndex = ROBOT_IDS.findIndex((id) => id === event.robotId);
    const workspace = robotIndex < 0 ? undefined : this.workspaces[robotIndex];
    if (event.sourceLine === null || workspace === undefined || workspace.stale) {
      this.replay?.seek(event.tick);
      return;
    }
    this.replay?.seekToLine(event.tick, workspace.robotId, event.sourceLine);
    this.showFile(codeFileOf(robotIndex));
    workspace.editor.revealLine(event.sourceLine);
  }

  /**
   * Marks the clicked line: goes to the next time the robot runs it, and
   * marks every time it runs on the seek bar. Clicking the marked line again
   * takes the mark off. Only while debugging, and only as long as the code is
   * the code that was run.
   */
  private toggleFollowedLine(workspace: RobotWorkspace, line: number): void {
    const { replay } = this;
    if (replay === null || this.mode !== 'debug' || workspace.stale) return;
    const robotIndex = this.workspaces.indexOf(workspace);
    const marked = this.followedNow();
    if (marked !== null && marked.robotIndex === robotIndex && marked.line === line) {
      this.followed = null;
      return;
    }
    replay.seekToNextRun(workspace.robotId, line);
    const marks = replay.runsOf(workspace.robotId, line).map((run) => run.tick);
    this.followed = { robotIndex, line, replay, marks };
  }

  /** Goes to the next or the previous time the marked line runs, and shows its program. */
  private goToRun(which: 'next' | 'previous'): void {
    const followed = this.followedNow();
    if (followed === null) return;
    const robotId = ROBOT_IDS[followed.robotIndex];
    if (which === 'next') followed.replay.seekToNextRun(robotId, followed.line);
    else followed.replay.seekToPreviousRun(robotId, followed.line);
    this.showFile(codeFileOf(followed.robotIndex));
    this.workspaces[followed.robotIndex].editor.scrollToLine(followed.line);
  }

  /** The followed line, if it belongs to the match being shown and its code has not changed since. */
  private followedNow(): FollowedLine | null {
    const { followed } = this;
    if (followed === null || followed.replay !== this.replay || this.mode !== 'debug') return null;
    return this.workspaces[followed.robotIndex].stale ? null : followed;
  }

  private codeEdited(workspace: RobotWorkspace): void {
    if (this.replay !== null || this.events.length > 0) workspace.stale = true;
  }

  /** The next match: in the chosen arena, from where its seed starts the robots. */
  private matchConfig(brains: readonly RobotBrain[]): SimulationConfig {
    return {
      arena: scatterSpawns(this.arena.arena, this.seed),
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.seed,
      robots: [
        { id: ROBOT_IDS[0], brain: brains[0], stats: this.stats[0] },
        { id: ROBOT_IDS[1], brain: brains[1], stats: this.stats[1] },
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
    this.templateMenu.hidden = !isCode;
    if (!isCode) this.partsView.show(robotId, AI_LABEL, this.loadouts[file.robotIndex], paletteOf(file.robotIndex));

    requireElement('editor-title').textContent = t('program.editorTitle', { robot: robotId, file: file.file });
    this.projectPanel.markSelected(file);
    // Line-by-line stepping follows the program in view.
    this.replay?.focusOn(robotId);
  }

  private frame = (now: number): void => {
    const elapsed = (now - this.lastFrame) / MS_PER_SECOND;
    this.lastFrame = now;
    if (this.screen === 'arena') this.showArena(elapsed);
    else if (this.screen === 'contest') this.showContest(elapsed);
    else this.showProgram(elapsed);
    requestAnimationFrame(this.frame);
  };

  /** One frame of the arena mode: the fight being watched, or the picked robots waiting. */
  private showArena(elapsed: number): void {
    this.arenaMode.update();
    this.showWatched(elapsed, this.arenaMode);
  }

  /** One frame of the contest screen: a match of the contest being watched, or an empty arena under its board. */
  private showContest(elapsed: number): void {
    this.showWatched(elapsed, this.contestMode);
  }

  /** Draws the match a watching screen shows, and sets the toolbar and the transport to it. */
  private showWatched(elapsed: number, screen: ArenaMode | ContestMode): void {
    const { replay } = screen;
    replay?.advance(elapsed);
    const { snapshot, arena, stats, loadouts } = screen.scene();
    this.battleView.render(snapshot, arena, stats, loadouts, {
      sensorOf: null,
      marks: NO_FEATURES,
      coverRoutes: screen.coverRoutes(),
      overrun: replay?.overrun ?? 0,
    });
    this.toolbar.setMessage(screen.message());
    this.toolbar.setPlayback(replay !== null, replay?.playing ?? false);
    this.transport.update(
      replay === null
        ? null
        : {
            tick: replay.tick,
            lastTick: replay.lastTick,
            tickRate: replay.recording.tickRate,
            playing: replay.playing,
            marks: NO_MARKS,
            canStep: replay.canStep,
            canStepBack: replay.tick > 0,
          },
      this.speed,
    );
  }

  /** One frame of the program mode: the match of ALPHA and BRAVO, and the panels that follow it. */
  private showProgram(elapsed: number): void {
    const { replay } = this;
    replay?.advance(elapsed);
    const followed = this.followedNow();

    const view = replay?.view ?? this.idleSnapshot;
    const debugging = this.mode === 'debug' && replay !== null;
    const stats = replay?.recording.stats ?? this.stats;
    const loadouts = replay === null ? this.loadouts : this.matchLoadouts;
    this.battleView.render(view, replay?.recording.arena ?? this.arena.arena, stats, loadouts, {
      sensorOf: debugging ? this.inspector.selected : null,
      marks: (debugging ? this.features[this.inspector.selected] : undefined) ?? NO_FEATURES,
      // The way to cover is shown for any robot whose program has to do with cover, in RUN as well.
      coverRoutes: replay === null ? NO_COVER_ROUTES : this.features.map((features) => features.cover),
      overrun: replay?.overrun ?? 0,
    });
    this.inspector.update(view);
    const watched = view.robots[this.inspector.selected];
    this.watch.update(watched, replay?.variablesOf(watched.id) ?? {});
    this.workspaces.forEach((workspace, robotIndex) => {
      const showLines = debugging && !workspace.stale;
      const current = showLines ? replay.currentLine(workspace.robotId) : null;
      workspace.editor.showExecutedLines(showLines ? replay.linesSoFar(workspace.robotId) : []);
      workspace.editor.showCurrentLine(current);
      workspace.editor.showFollowedLine(followed?.robotIndex === robotIndex ? followed.line : null);
    });
    this.logView.update(this.events, replay?.reachedTick ?? 0, replay?.tick ?? 0);
    this.toolbar.setMessage(this.message());
    this.toolbar.setPlayback(replay !== null, replay?.playing ?? false);
    this.transport.update(
      replay === null
        ? null
        : {
            tick: replay.tick,
            lastTick: replay.lastTick,
            tickRate: replay.recording.tickRate,
            playing: replay.playing,
            marks: followed?.marks ?? NO_MARKS,
            canStep: replay.canStep,
            canStepBack: debugging ? replay.canStepBack : replay.tick > 0,
          },
      this.speed,
    );
  }

  private message(): string {
    const parts = [this.notice ?? this.replayStatus()];
    const edited = this.workspaces.filter((workspace) => workspace.stale).map((workspace) => workspace.robotId);
    if (edited.length > 0) parts.push(`[${t('program.staleNote', { robots: edited.join(', ') })}]`);
    const refitted = ROBOT_IDS.filter((_, robotIndex) => this.partsStale[robotIndex]);
    if (refitted.length > 0) parts.push(`[${t('program.partsNote', { robots: refitted.join(', ') })}]`);
    if (this.saveProblem !== null) parts.push(`[${this.saveProblem}]`);
    if (this.garageNote !== null) parts.push(`[${this.garageNote}]`);
    return parts.join('   ');
  }

  private replayStatus(): string {
    if (this.replay === null) return `${t('program.ready')}   ${t('program.seed', { seed: this.seed })}`;
    const parts = [t(this.mode === 'run' ? 'program.mode.run' : 'program.mode.debug'), playbackStatus(this.replay), t('program.seed', { seed: this.replay.recording.seed })];
    const followed = this.followedNow();
    if (followed !== null) parts.push(this.describeFollowed(followed));
    return parts.join('   ');
  }

  /** Which of its runs the followed line is at, e.g. "ALPHA line 13: run 2 of 5". */
  private describeFollowed({ robotIndex, line, replay, marks }: FollowedLine): string {
    const robotId = ROBOT_IDS[robotIndex];
    if (marks.length === 0) return t('program.followed.never', { robot: robotId, line });
    const run = replay.runAt(robotId, line);
    return run === null
      ? t('program.followed.runs', { robot: robotId, line, count: marks.length })
      : t('program.followed.run', { robot: robotId, line, run: run + 1, count: marks.length });
  }
}

function playbackStatus(replay: ReplayManager): string {
  const { result } = replay.snapshot;
  if (result !== null) return t('program.result', { result: formatResult(result), reason: result.reason });
  return replay.playing ? t('program.playing') : t('program.paused');
}

function codeFileOf(robotIndex: number): ProjectFile {
  return { robotIndex, file: 'main.bot' };
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

/** The seed named in the URL (`?seed=7`), to watch the same match again; null when none is. */
function readPinnedSeed(): number | null {
  const value = new URLSearchParams(window.location.search).get('seed');
  if (value === null) return null;
  const seed = Number.parseInt(value, 10);
  if (Number.isNaN(seed)) throw new Error(`Invalid seed: "${value}"`);
  return seed;
}

/** null when the browser refuses access to localStorage (e.g. blocked site data). */
/** Keeps the other language and starts the page again in it: every text is made at start-up. */
function switchLanguage(storage: Storage | null): void {
  try {
    storage?.setItem(LANGUAGE_KEY, otherLanguage(currentLanguage()));
  } catch {
    // Storage may be full or blocked: the language then falls back to the browser's at the next start.
  }
  window.location.reload();
}

/** The browser's storage, or null when it refuses access (e.g. blocked site data). */
function openStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return null;
  }
}

function openStore(): ProjectStore | null {
  try {
    return new ProjectStore(window.localStorage, DEFAULT_SOURCES);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return null;
  }
}

/** null when the browser refuses access to localStorage. */
function openGarage(): Garage | null {
  try {
    return new Garage(window.localStorage);
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
