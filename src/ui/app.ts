import { readShareLink } from '../share/link';
import type { ProgramFeatures } from '../ai/features';
import { LANGUAGE_KEY, currentLanguage, otherLanguage } from '../i18n/language';
import { t } from '../i18n/messages';
import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import { robotIdOf } from '../arena/castle_match';
import { randomSeed } from '../arena/seed';
import { scatterSpawns } from '../arena/spawns';
import { ARENAS, CASTLE_ARENAS, findArena } from '../data/arenas';
import { MAX_TEAM_SIZE, teamCostLimitFor } from '../data/castle';
import { TEAM_TEMPLATES, findTeamTemplate } from '../data/team_templates';
import {
  DEFAULT_PLAYBACK_SPEED,
  EFFECT_LIFETIMES,
  MATCH_DEFAULTS,
  PLAYBACK_SPEEDS,
  ROBOT_IDS,
} from '../data/match_defaults';
import { COST_LIMIT, type Loadout, STANDARD_LOADOUT, type Slot, costOf, statsOf } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import { DEFAULT_TEMPLATES, TEMPLATES, findTemplate } from '../data/templates';
import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import { recordMatch } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import { type Snapshot, captureSnapshot } from '../debug/snapshot';
import { ProjectStore } from '../project/project_store';
import { IDLE_BRAIN, type RobotBrain } from '../sim/ai_context';
import { Simulation, type SimulationConfig } from '../sim/simulation';
import { BattleView, formatOutcome } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import { ActionMenu } from './action_menu';
import { type BootChoice, BootScreen } from './boot_screen';
import { stageTeams } from '../tutorial/types';
import { TutorialPanel } from './tutorial_panel';
import { ChallengePanel } from './challenge_panel';
import type { Coach } from './coach';
import { createReplay } from './watched_match';
import { CommentaryView } from './commentary_view';
import { HelpPanel } from './help_panel';
import { AnalysisView } from './analysis_view';
import { analyze, lineCounts } from '../arena/analysis';
import type { Recording } from '../debug/recorder';
import { HELP } from '../help/topics';
import { GUIDE_EVENT } from './roboscript_assist';
import { parse } from '../ai/parser';
import { functionLines } from '../ai/structure';
import { ArenaMode } from './arena_mode';
import { ContestMode } from './contest_mode';
import { DebugLogView } from './debug_log';
import { createButton, createElement, requireElement } from './dom';
import { GarageController } from './garage_controller';
import { TeamBattleMode } from './team_battle_mode';
import { TEAM_EDITOR_ELEMENT_IDS, TeamEditor } from './team_editor';
import { describeError } from './format';
import type { WatchingScreen } from './watch_screen';
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

/**
 * PROGRAM is where the code of ALPHA and BRAVO is written and debugged; ARENA
 * is where robots fight and are watched; CONTEST is where robots gathered from
 * anywhere play a league or a tournament.
 */
const SCREENS = ['program', 'arena', 'contest'] as const;
/** The screens: the three of the tabs, the tutorial and the challenges, and the team battle's two faces (editing and watching). */
type Screen = (typeof SCREENS)[number] | 'tutorial' | 'challenge' | 'team' | 'teamwatch';

const MS_PER_SECOND = 1000;
const PLAYER_INDEX = 0;
/** What a robot's config shows as its AI: every robot runs the program in its own main.bot. */
const AI_LABEL = 'main.bot';
/** The element that holds each robot's code editor, in spawn order. */
const EDITOR_ELEMENT_IDS = ['code', 'enemy-code'];
/** The programs the robots start with. */
const DEFAULT_SOURCES = DEFAULT_TEMPLATES.map((template) => template.source);
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

/** A line of a program that the player follows through the match: where it runs is marked on the seek bar. */
interface FollowedLine {
  /** The editor the line is in: the robot's in a duel, the team's in the team battle. */
  team: number;
  /** Which of the team's machines is followed through the line; 1 in a duel. */
  machine: number;
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
  /** null when the browser refuses access to localStorage (e.g. blocked site data). */
  private readonly storage = openStorage();
  private readonly store = this.storage === null ? null : new ProjectStore(this.storage, DEFAULT_SOURCES);
  private readonly garage = new GarageController(requireElement('garage'), ROBOT_IDS, this.storage, {
    robot: (robotIndex) => ({ source: this.ownWorkspaces[robotIndex].source, loadout: this.loadouts[robotIndex] }),
    load: (robotIndex, robot) => {
      this.ownWorkspaces[robotIndex].load(robot.source);
      this.setLoadout(robotIndex, { ...robot.loadout });
      this.showFile(codeFileOf(robotIndex));
    },
  });

  private readonly toolbar: Toolbar;
  private readonly transport: Transport;
  private readonly projectPanel: ProjectPanel;
  /** The two programs a match is played with, in spawn order: the player's own, or in the tutorial its editor and BRAVO's. */
  private workspaces: RobotWorkspace[];
  /** The player's ALPHA and BRAVO. */
  private readonly ownWorkspaces: RobotWorkspace[];
  /** The editor of the tutorial and the challenges: their code is kept apart from the player's. */
  private readonly tutorialWorkspace: RobotWorkspace;
  /** Set once the panels are in place; screens shown before then need no fitting. */
  private splitters: Splitters | null = null;
  private readonly tutorial: TutorialPanel;
  private readonly challenges: ChallengePanel;
  private readonly inspector: Inspector;
  private readonly watch = new WatchPanel(requireElement('watch-fields'), requireElement('watch-robot'), this.storage);
  private readonly logView = new DebugLogView(requireElement('log-rows'), (event) => this.jumpTo(event));
  /** The analysis of the program screen's match, in the tab beside the log. */
  private readonly analysisView = new AnalysisView((tick) => this.replay?.seek(tick));
  /** Which tab of the bottom left is shown: the log or the analysis. */
  private analysisShown = false;
  /** The recording the analysis tab and the run counts were worked out for, so as not to work them out every frame. */
  private analyzed: { recording: Recording; counts: Map<number, number>[] } | null = null;
  /** The analysis of a match watched in the arena or a contest, over the battle view. */
  private readonly watchedAnalysis = new AnalysisView((tick) => {
    this.shownReplay()?.seek(tick);
    this.analysisOverlay.hidden = true;
  });
  private readonly analysisOverlay = createElement('div', 'analysis-overlay');
  private readonly seedLabel = requireElement('battle-seed');
  /** The help and the guide to the language, from the right. */
  private readonly help = new HelpPanel();
  /** The commentary over the battle view, on the arena and contest screens. */
  private readonly commentaryView = new CommentaryView();
  private commentaryOn = readCommentaryOn(this.storage);
  private ownersOf: { source: string; owners: Map<number, string> } | null = null;
  /** The start-up screen and its menu: shown first, and again from the ⏻ button. */
  private readonly boot = new BootScreen(this.storage, (choice) => this.bootInto(choice));
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

  /** The team battle's editing, kept apart from the duel's. */
  private readonly team = new TeamEditor(this.storage, {
    codeEdited: (workspace) => this.codeEdited(workspace),
    lineClicked: (workspace, line) => this.toggleFollowedLine(workspace, line),
    noteSave: (what, problem) => this.noteSave(what, problem),
    loadTeam: (team, saved) => this.loadTeam(team, saved),
  });
  /** The team battle's watching, made the first time it is shown. */
  private teamWatch: TeamBattleMode | null = null;
  private readonly machinePicker = requireElement('machine-picker');

  /** The robots where the next RUN / DEBUG will start them, shown while there is no match. */
  private idleSnapshot = this.captureIdle();

  /** null while no match has been recorded. */
  private replay: ReplayManager | null = null;
  private mode: Mode = 'run';
  private speed: number = DEFAULT_PLAYBACK_SPEED;
  private events: readonly DebugEvent[] = [];
  /** Replaces the usual toolbar message until the next RUN, DEBUG or RESET. */
  private notice: string | null = null;
  /** What could not be saved the last time it was, by what it is: shown next to the toolbar message until a save of it works. */
  private readonly saveProblems = new Map<string, string>();
  /** Per robot: what the program of the match being shown has to do with, which decides the marks drawn for it. */
  private features: ProgramFeatures[] = [];
  /** The line whose number was last clicked while debugging. */
  private followed: FollowedLine | null = null;
  /** The marked line of the program screen, kept in storage: it is marked again in the next DEBUG, after a reload too. */
  private savedMark = readMark(this.storage);
  private lastFrame = performance.now();

  constructor() {
    this.toolbar = new Toolbar(
      {
        selectArena: (id) => this.selectArena(id),
        run: () => this.start('run'),
        debug: () => this.start('debug'),
        reset: () => this.reset(),
      },
      { options: ARENAS, selectedId: this.arena.id },
    );
    this.transport = new Transport(PLAYBACK_SPEEDS, {
      playPause: () => this.togglePlay(),
      step: () => this.step(),
      stepOver: () => this.stepOver(),
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
    this.ownWorkspaces = this.workspaces;
    this.tutorial = new TutorialPanel(requireElement('tutorial-body'), this.storage, {
      code: () => this.tutorialWorkspace.source,
      setCode: (code, undoable) => this.setTutorialCode(code, undoable),
      stepChanged: () => this.coachedStageChanged(),
      exit: () => this.boot.show(),
      showParts: (shown) => this.showFile({ robotIndex: PLAYER_INDEX, file: shown ? 'config' : 'main.bot' }),
    });
    this.challenges = new ChallengePanel(requireElement('challenge-body'), this.storage, {
      code: () => this.tutorialWorkspace.source,
      setCode: (code, undoable) => this.setTutorialCode(code, undoable),
      challengeChanged: () => this.coachedStageChanged(),
      exit: () => this.boot.show(),
      showParts: (shown) => this.showFile({ robotIndex: PLAYER_INDEX, file: shown ? 'config' : 'main.bot' }),
    });
    this.tutorialWorkspace = new RobotWorkspace(ROBOT_IDS[0], requireElement('tutorial-code'), '', {
      save: (code) => this.coach?.codeEdited(code),
      edited: (workspace) => this.codeEdited(workspace),
      saveProblem: () => {},
      lineClicked: (workspace, line) => this.toggleFollowedLine(workspace, line),
    });
    this.inspector = new Inspector(requireElement('inspector-tabs'), requireElement('inspector-fields'), ROBOT_IDS, (index) =>
      this.inspectorPicked(index),
    );
    if (this.store === null) {
      this.events = [appEvent('warning', t('program.storageUnavailable'))];
    }
    this.arenaMode = new ArenaMode(requireElement('lineup-slots'), requireElement('result-rows'), {
      arena: () => this.arena,
      garage: () => this.garage.list(),
      editing: () => ROBOT_IDS.map((name, robotIndex) => ({ name, source: this.ownWorkspaces[robotIndex].source, loadout: this.loadouts[robotIndex] })),
      speed: () => this.speed,
      chooseArena: (id) => {
        this.selectArena(id);
        this.toolbar.setArena(id);
      },
      keepRobots: (robots) => this.garage.keep(robots),
      storage: this.storage,
    });
    this.contestMode = new ContestMode(requireElement('contest-body'), requireElement('board'), {
      garage: () => this.garage.list(),
      speed: () => this.speed,
      shown: () => this.screen === 'contest',
      storage: this.storage,
    });
    const teamSizeSelect = requireElement<HTMLSelectElement>('team-size');
    teamSizeSelect.replaceChildren(
      ...Array.from({ length: MAX_TEAM_SIZE }, (_, index) => new Option(t('toolbar.teamSize.option', { n: index + 1 }), String(index + 1))),
    );
    teamSizeSelect.value = String(this.team.size);
    teamSizeSelect.addEventListener('change', () => this.setTeamSize(Number.parseInt(teamSizeSelect.value, 10)));
    for (const screen of SCREENS) {
      requireElement(`screen-${screen}`).addEventListener('click', () => this.showScreen(screen));
    }
    requireElement('screen-team-edit').addEventListener('click', () => this.showScreen('team'));
    requireElement('screen-team-watch').addEventListener('click', () => this.showScreen('teamwatch'));
    this.showScreen(this.screen);
    this.showFile(this.shownFile);
    this.splitters = new Splitters(requireElement('app'), requireElement('editor'), requireElement('vsplit'), requireElement('hsplit'), this.storage);
    requireElement('language').addEventListener('click', () => switchLanguage(this.storage, this.screen));
    requireElement('boot-button').addEventListener('click', () => this.boot.show());
    requireElement('help-button').addEventListener('click', () => this.help.toggle());
    requireElement('guide-button').addEventListener('click', () => this.help.open(HELP[1].topics[0].id));
    document.addEventListener(GUIDE_EVENT, (event) => {
      const word = (event as CustomEvent<string>).detail;
      if (word === '') this.help.open(HELP[1].topics[0].id);
      else this.help.openWord(word);
    });
    requireElement('battle-frame').append(this.commentaryView.element);
    requireElement('analysis-body').append(this.analysisView.element);
    this.analysisView.show(null, null);
    const closeAnalysis = createButton('tool-button', t('analysis.close'), '', () => {
      this.analysisOverlay.hidden = true;
    });
    const overlayHeader = createElement('div', 'board-header');
    overlayHeader.append(createElement('span', 'board-title', t('analysis.button')), closeAnalysis);
    this.analysisOverlay.append(overlayHeader, this.watchedAnalysis.element);
    this.analysisOverlay.hidden = true;
    requireElement('battle-frame').append(this.analysisOverlay);
    requireElement('analysis-button').addEventListener('click', () => this.toggleWatchedAnalysis());
    requireElement('log-tab-log').addEventListener('click', () => this.showAnalysisTab(false));
    requireElement('log-tab-analysis').addEventListener('click', () => this.showAnalysisTab(true));
    const toggle = requireElement('commentary-toggle');
    toggle.classList.toggle('selected', this.commentaryOn);
    toggle.addEventListener('click', () => {
      this.commentaryOn = !this.commentaryOn;
      toggle.classList.toggle('selected', this.commentaryOn);
      try {
        this.storage?.setItem(COMMENTARY_KEY, this.commentaryOn ? 'on' : 'off');
      } catch {
        // Storage may be full or blocked: the choice holds until the page is left.
      }
    });
    document.addEventListener('keydown', (event) => this.onShortcut(event));
    requestAnimationFrame(this.frame);
    // A share link opens where its robot or match goes. After a language switch the
    // screen that was shown comes back; any other address opens the start menu.
    const returnTo = consumeReturnScreen();
    if (!this.openShareLink()) {
      if (returnTo !== null) this.showScreen(returnTo);
      else this.boot.show();
    }
    window.addEventListener('hashchange', () => this.openShareLink());
  }

  /**
   * Takes in the robot or the match of a share link in the address: a robot
   * into the garage, on the program screen; a match played in the arena. The
   * code is then taken out of the address, so that reloading does not take
   * it in again. False when the address has none.
   */
  private openShareLink(): boolean {
    const link = readShareLink(window.location.hash);
    if (link === null) return false;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    this.boot.hide();
    if (link.kind === 'robot') {
      this.showScreen('program');
      void this.garage.importCode(link.code);
    } else if (link.kind === 'team') {
      this.showScreen('team');
      void this.team.garage?.importCode(link.code);
    } else if (link.kind === 'castle') {
      this.showScreen('teamwatch');
      void this.ensureTeamWatch().importMatch(link.code);
    } else {
      this.showScreen('arena');
      void this.arenaMode.importMatch(link.code);
    }
    return true;
  }

  /**
   * The keys of the screen: Space plays and pauses, ← and → step back and on,
   * Cmd/Ctrl+Enter runs the code. While typing (in the editor or a field) only
   * Cmd/Ctrl+Enter counts: the other keys are the text's.
   */
  private onShortcut(event: KeyboardEvent): void {
    if (this.boot.shown || event.altKey) return;
    if (event.key === 'Escape' && this.help.shown) {
      this.help.close();
      return;
    }
    const run = event.key === 'Enter' && (event.metaKey || event.ctrlKey);
    if (run) {
      if (!this.coding) return;
      event.preventDefault();
      this.start('run');
      return;
    }
    if (event.metaKey || event.ctrlKey || isTyping(event.target)) return;
    if (event.key === ' ') this.togglePlay();
    else if (event.key === 'ArrowRight') this.step();
    else if (event.key === 'ArrowLeft') this.stepBack();
    else return;
    event.preventDefault();
  }

  /** The log or the analysis in the bottom left of the program screen. */
  private showAnalysisTab(shown: boolean): void {
    this.analysisShown = shown;
    requireElement('log-rows').hidden = shown;
    requireElement('analysis-body').hidden = !shown;
    requireElement('log-tab-log').classList.toggle('selected', !shown);
    requireElement('log-tab-analysis').classList.toggle('selected', shown);
  }

  /** The analysis and the run counts of the program screen's match: worked out once a match, when first wanted. */
  private analysisOf(replay: ReplayManager): { recording: Recording; counts: Map<number, number>[] } {
    if (this.analyzed?.recording !== replay.recording) {
      const { recording } = replay;
      const ids = recording.snapshots[0].robots.map((robot) => robot.id);
      this.analyzed = { recording, counts: ids.map((id) => lineCounts(recording, id)) };
      this.analysisView.show(analyze(recording, ids), recording.arena);
    }
    return this.analyzed;
  }

  /** Opens or closes the analysis of the match watched in the arena, a contest or the team battle. */
  private toggleWatchedAnalysis(): void {
    if (!this.analysisOverlay.hidden) {
      this.analysisOverlay.hidden = true;
      return;
    }
    const screen = this.watchingScreen();
    const replay = screen?.replay ?? null;
    if (screen === null || replay === null) return;
    this.watchedAnalysis.show(analyze(replay.recording, screen.fightNames()), replay.recording.arena);
    this.analysisOverlay.hidden = false;
  }

  /** What the start menu starts. Help opens over the screen that was shown. */
  private bootInto(choice: BootChoice): void {
    if (choice === 'language') switchLanguage(this.storage);
    else if (choice === 'help') this.help.open(HELP[0].topics[0].id);
    else this.showScreen(choice);
  }

  /** Switches between writing programs and watching fights. Either keeps what it was showing; its replay is paused meanwhile. */
  private showScreen(screen: Screen): void {
    this.shownReplay()?.pause();
    const before = this.coach;
    const wasTeam = this.teamMode;
    this.screen = screen;
    const after = this.coach;
    // The tutorial, the challenges, the team battle and the program screen show the same panels with other programs: none's match is another's.
    if (before !== after || wasTeam !== this.teamMode) {
      this.leaveMatch();
      this.workspaces =
        after !== null ? [this.tutorialWorkspace, this.ownWorkspaces[1]] : this.teamMode ? this.team.ensureWorkspaces() : this.ownWorkspaces;
      before?.close();
      this.enterBattleForm();
      if (after !== null) after.open();
      else this.idleSnapshot = this.captureIdle();
      this.showFile(codeFileOf(PLAYER_INDEX));
    }
    // The team battle's two faces share the toolbar's castle maps and team size.
    this.toolbar.setArenas(
      this.castleScreen ? { options: CASTLE_ARENAS, selectedId: this.team.castleArena.id } : { options: ARENAS, selectedId: this.arena.id },
    );
    requireElement('app').dataset.screen = screen;
    // The editor stands beside another column on the tutorial and challenge screens: its width is fitted again.
    this.splitters?.refresh();
    for (const each of SCREENS) requireElement(`screen-${each}`).classList.toggle('selected', each === screen);
    requireElement('screen-team-edit').classList.toggle('selected', screen === 'team');
    requireElement('screen-team-watch').classList.toggle('selected', screen === 'teamwatch');
    // Robots may have been saved or deleted since the arena was last shown.
    if (screen === 'arena') this.arenaMode.refresh();
    if (screen === 'contest') this.contestMode.shown();
    // Teams may have been saved or renamed since the watching was last shown.
    if (screen === 'teamwatch') this.ensureTeamWatch().refresh();
  }

  /** Fits the fixed panels to the battle's form: the duel's two robots, or the team battle's machines, maps and sizes. */
  private enterBattleForm(): void {
    this.inspector.setRobots(this.robotIdsNow());
    if (this.teamMode) {
      this.toolbar.setArenas({ options: CASTLE_ARENAS, selectedId: this.team.castleArena.id });
      // The team templates first; a duel's program also drives every machine of a team, so they stay in reach, one step aside.
      this.templateMenu.setItems([
        ...TEAM_TEMPLATES.map(({ id, name }) => ({ id, label: name })),
        { id: 'solo-templates', label: t('editor.soloTemplates'), items: TEMPLATES.map(({ id, name }) => ({ id, label: name })) },
      ]);
      requireElement<HTMLSelectElement>('team-size').value = String(this.team.size);
    } else {
      this.toolbar.setArenas({ options: ARENAS, selectedId: this.arena.id });
      this.templateMenu.setItems(TEMPLATES.map(({ id, name }) => ({ id, label: name })));
    }
    this.refreshMachinePicker();
  }

  /**
   * The numbered tabs beside the editor's title, to pick which machine's
   * parts the config shows. The program is the whole team's, so the tabs
   * appear only over the config; while the code is shown, the machine to
   * follow is picked on the inspector's tabs instead.
   */
  private refreshMachinePicker(): void {
    if (!this.teamMode || this.shownFile.file !== 'config') {
      this.machinePicker.hidden = true;
      return;
    }
    const team = this.shownFile.robotIndex;
    const pickedNow = this.pickedMachine(team);
    const tabs = Array.from({ length: this.team.size }, (_, index) => {
      const machine = index + 1;
      const tab = createButton('tab', String(machine), t('team.machine.title', { n: machine }), () => this.pickMachine(team, machine));
      tab.classList.toggle('selected', machine === pickedNow);
      return tab;
    });
    this.machinePicker.replaceChildren(...tabs);
    this.machinePicker.hidden = false;
  }

  /** Picks the machine of the team whose config is shown: the parts, the watch and the stepping are its from here. */
  private pickMachine(team: number, machine: number): void {
    this.team.pick(team, machine);
    this.inspector.select(this.robotIndexOf(team, machine));
    // Shows the same file again: the title, the parts and the followed program move to the machine.
    this.showFile(this.shownFile);
  }

  /** The player picked a robot on the inspector: in the team battle, its team's editor follows that machine from here. */
  private inspectorPicked(index: number): void {
    if (!this.teamMode) return;
    const { team, machine } = this.team.machineAt(index);
    this.team.pick(team, machine);
    // Stepping keeps following the open file's team, through whichever of its machines is now picked.
    this.replay?.focusOn(this.editorRobotId(this.shownFile.robotIndex));
    if (this.shownFile.file === 'config' && this.shownFile.robotIndex === team) this.showFile(this.shownFile);
  }

  /** Puts the match of the program screen (or the tutorial) away, back to the robots waiting. */
  private leaveMatch(): void {
    this.replay = null;
    this.events = [];
    this.notice = null;
    this.followed = null;
    for (const workspace of this.workspaces) workspace.stale = false;
  }

  /** What leads the player on this screen: the tutorial, the challenges, or nothing. */
  private get coach(): Coach | null {
    if (this.screen === 'tutorial') return this.tutorial;
    if (this.screen === 'challenge') return this.challenges;
    return null;
  }

  /** The tutorial went to another step, or the challenges to another challenge: its field and robots are shown waiting, with its code. */
  private coachedStageChanged(): void {
    this.leaveMatch();
    this.idleSnapshot = this.captureCoachedIdle();
    // A castle stage fields several machines a side: the inspector gets a tab for each.
    this.inspector.setRobots(this.coachRobotIds());
    this.showFile(codeFileOf(PLAYER_INDEX));
  }

  private setTutorialCode(code: string, undoable: boolean): void {
    if (undoable) this.tutorialWorkspace.load(code);
    else this.tutorialWorkspace.editor.replaceSource(code);
    this.tutorialWorkspace.editor.showErrorLines([]);
  }

  /** Plays the coached match: the program in the editor against the training robot, where the stage puts them. */
  private startCoached(coach: Coach, mode: Mode): void {
    if (coach.stage === undefined) return;
    this.mode = mode;
    const workspace = this.tutorialWorkspace;
    workspace.flush();
    workspace.stale = false;
    const { loadout } = coach;
    // A castle stage fields the same parts on every machine: the team's pooled cost is what counts.
    const stageSize = coach.stage.teamSize;
    const cost = costOf(loadout) * (stageSize ?? 1);
    const limit = stageSize === undefined ? COST_LIMIT : teamCostLimitFor(stageSize);
    if (cost > limit) {
      const message = stageSize === undefined ? t('program.costOverLimit', { cost, limit }) : t('castle.costOverLimit', { team: ROBOT_IDS[PLAYER_INDEX], cost, limit });
      this.showFaults([{ file: { robotIndex: PLAYER_INDEX, file: 'config' }, events: [appEvent('error', message, null, workspace.robotId)] }]);
      coach.matchRefused('cost');
      return;
    }
    const built = coach.match(workspace.source, loadout);
    if (!built.ok) {
      workspace.editor.showErrorLines(built.errors.map((error) => error.line));
      this.showFaults([{ file: codeFileOf(PLAYER_INDEX), events: built.errors.map((error) => appEvent('error', formatError(error), error.line, workspace.robotId)) }]);
      coach.matchRefused('errors');
      return;
    }
    workspace.editor.showErrorLines([]);
    const { config, loadouts, features } = built.match;
    this.features = features;
    this.matchLoadouts = loadouts;
    const played = recordMatch(config, EFFECT_LIFETIMES);
    const recording = coach.played(played);
    const replay = this.showRecorded(recording, mode, recording.snapshots[0].robots[PLAYER_INDEX].id);
    coach.watch(replay);
    if (mode === 'debug') coach.acted('debug');
  }

  /** The coached stage's robots where its match starts them. */
  private captureCoachedIdle(): Snapshot {
    const { coach } = this;
    if (coach?.stage === undefined) return this.captureIdle();
    const built = coach.match('wait', coach.loadout);
    if (!built.ok) return this.captureIdle();
    const config = built.match.config;
    return captureSnapshot(new Simulation({ ...config, robots: config.robots.map((robot) => ({ ...robot, brain: IDLE_BRAIN })) }));
  }

  /** The watching screen being shown; null on a screen where code is written. */
  private watchingScreen(): WatchingScreen | null {
    if (this.screen === 'arena') return this.arenaMode;
    if (this.screen === 'contest') return this.contestMode;
    if (this.screen === 'teamwatch') return this.teamWatch;
    return null;
  }

  /** The replay of the screen being shown: the one the transport and PAUSE act on. */
  private shownReplay(): ReplayManager | null {
    const watching = this.watchingScreen();
    return watching === null ? this.replay : watching.replay;
  }

  private createWorkspace(robotId: string, robotIndex: number): RobotWorkspace {
    const source = this.store?.loadSource(robotIndex) ?? DEFAULT_SOURCES[robotIndex];
    return new RobotWorkspace(robotId, requireElement(EDITOR_ELEMENT_IDS[robotIndex]), source, {
      save: (code) => this.store?.saveSource(robotIndex, code),
      edited: (workspace) => this.codeEdited(workspace),
      saveProblem: (problem) => this.noteSave(`code:${robotIndex}`, problem),
      lineClicked: (workspace, line) => this.toggleFollowedLine(workspace, line),
    });
  }

  /** Loading a template replaces the code of the robot (or the team) whose file is shown. */
  private loadTemplate(id: string): void {
    const template = findTeamTemplate(id) ?? findTemplate(id);
    if (template === undefined) return;
    this.workspaces[this.shownFile.robotIndex].load(template.source);
  }

  /**
   * Records a match with the code in the editors and the parts chosen, and
   * plays it back, unless some code has errors or some robot's parts cost too much.
   */
  private start(mode: Mode): void {
    const { coach } = this;
    if (coach !== null) {
      this.startCoached(coach, mode);
      return;
    }
    if (this.teamMode) {
      this.startTeamMatch(mode);
      return;
    }
    this.mode = mode;
    for (const workspace of this.workspaces) {
      workspace.flush();
      workspace.stale = false;
    }
    this.partsStale.fill(false);

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
    this.showRecorded(recording, mode, ROBOT_IDS[this.shownFile.robotIndex]);
  }

  /** Puts a recorded match on the screen: its replay from the start, with the log the mode asks for. */
  private showRecorded(recording: Recording, mode: Mode, followId: string): ReplayManager {
    const replay = createReplay(recording, this.speed, followId);
    this.replay = replay;
    this.events = mode === 'debug' ? recording.events : recording.events.filter((event) => RUN_LOG_TYPES.has(event.type));
    this.notice = null;
    replay.restart();
    this.refollow(replay);
    return replay;
  }

  /** Records the team match with both teams' programs and machines, and plays it back. */
  private startTeamMatch(mode: Mode): void {
    this.mode = mode;
    const workspaces = this.team.ensureWorkspaces();
    for (const workspace of workspaces) {
      workspace.flush();
      workspace.stale = false;
    }
    this.team.partsStale.clear();

    // Errors are shown on the editors' lines, so each team's program is compiled here first.
    const faults: Fault[] = [];
    workspaces.forEach((workspace, team) => {
      const result = compileScript(workspace.source);
      workspace.editor.showErrorLines(result.ok ? [] : result.errors.map((error) => error.line));
      if (!result.ok) {
        faults.push({
          file: codeFileOf(team),
          events: result.errors.map((error) => appEvent('error', formatError(error), error.line, ROBOT_IDS[team])),
        });
      }
      const { cost, limit } = this.team.costOf(team);
      if (cost > limit) {
        faults.push({
          file: { robotIndex: team, file: 'config' },
          events: [appEvent('error', t('castle.costOverLimit', { team: ROBOT_IDS[team], cost, limit }), null, ROBOT_IDS[team])],
        });
      }
    });
    if (faults.length > 0) {
      this.showFaults(faults);
      return;
    }

    const prepared = this.team.prepareFight(this.seed);
    if (!prepared.ok) {
      // These are about the match's set-up (team size, loadouts), not either team's code.
      this.showFaults([{ file: { robotIndex: PLAYER_INDEX, file: 'config' }, events: prepared.problems.map((problem) => appEvent('error', problem)) }]);
      return;
    }
    const { fight } = prepared;
    this.features = fight.features;
    this.matchLoadouts = fight.loadouts;
    const recording = recordMatch(fight.config, EFFECT_LIFETIMES);
    this.drawSeed();
    this.showRecorded(recording, mode, this.editorRobotId(this.shownFile.robotIndex));
  }

  /** Keeps following the same line in a new match, so that a change to the code can be compared with the run before. */
  private refollow(replay: ReplayManager): void {
    const saved = this.screen === 'program' && this.savedMark !== null ? { team: this.savedMark.robotIndex, machine: 1, line: this.savedMark.line } : null;
    const mark = this.followed ?? saved;
    if (mark === null) return;
    const { team, machine, line } = mark;
    const robotId = this.teamMode ? this.team.robotIdOf(team, machine) : ROBOT_IDS[team];
    const marks = replay.runsOf(robotId, line).map((run) => run.tick);
    this.followed = { team, machine, line, replay, marks };
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
    if (this.coding && this.mode === 'debug') {
      this.replay?.stepLine();
      this.coach?.acted('stepLine');
    }
    else this.shownReplay()?.step();
  }

  /** One line of the program in view, through any function the line calls; only while debugging. */
  private stepOver(): void {
    const { replay } = this;
    if (!this.coding || this.mode !== 'debug' || replay === null) return;
    const workspace = this.workspaces[this.shownFile.robotIndex];
    if (workspace.stale) {
      replay.stepLine();
      return;
    }
    const owners = this.functionLinesOf(workspace.source);
    replay.stepOver((line) => owners.get(line) ?? null);
  }

  /** Which function each line of a program belongs to; kept for the last program asked about. */
  private functionLinesOf(source: string): Map<number, string> {
    if (this.ownersOf?.source !== source) {
      const { program } = parse(source);
      this.ownersOf = { source, owners: program === null ? new Map() : functionLines(program) };
    }
    return this.ownersOf.owners;
  }

  private stepBack(): void {
    if (this.coding && this.mode === 'debug') this.replay?.stepLineBack();
    else this.shownReplay()?.stepBack();
  }

  /** Whether the screen is one where code is written and debugged: the program screen, the team battle, the tutorial or the challenges. */
  private get coding(): boolean {
    return this.screen === 'program' || this.screen === 'team' || this.coach !== null;
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
    this.followed = null;
    for (const workspace of this.workspaces) workspace.stale = false;
    this.partsStale.fill(false);
    this.team.partsStale.clear();
    if (this.coach !== null) this.idleSnapshot = this.captureCoachedIdle();
    else this.drawSeed();
  }

  /** Gives the next match a seed of its own, and puts the waiting robots where it will start them. Unless the URL pins the seed. */
  private drawSeed(): void {
    if (this.pinnedSeed !== null) return;
    this.seed = randomSeed();
    this.idleSnapshot = this.captureIdle();
  }

  /** Puts the part into the slot of the robot whose config is shown. Takes effect from the next RUN / DEBUG. */
  private pickPart(slot: Slot, partId: string): void {
    const { coach } = this;
    if (coach !== null) {
      coach.setLoadout({ ...coach.loadout, [slot]: partId });
      // The coach may keep some parts as they are.
      this.partsView.show(ROBOT_IDS[PLAYER_INDEX], AI_LABEL, coach.loadout, paletteOf(PLAYER_INDEX), coach.fixedSlots);
      this.idleSnapshot = this.captureCoachedIdle();
      return;
    }
    const { robotIndex } = this.shownFile;
    if (this.teamMode) {
      const machine = this.pickedMachine(robotIndex);
      this.setTeamLoadout(robotIndex, machine, { ...this.team.loadoutOf(robotIndex, machine), [slot]: partId });
      return;
    }
    this.setLoadout(robotIndex, { ...this.loadouts[robotIndex], [slot]: partId });
  }

  /** Gives one of a team's machines the parts. Takes effect from the next RUN / DEBUG. */
  private setTeamLoadout(team: number, machine: number, loadout: Loadout): void {
    const problem = this.team.setLoadout(team, machine, loadout);
    this.idleSnapshot = this.captureIdle();
    const robotId = this.team.robotIdOf(team, machine);
    if (this.replay !== null) this.team.partsStale.add(robotId);
    if (this.shownFile.robotIndex === team && this.shownFile.file === 'config') this.showFile(this.shownFile);
    this.noteSave(`team-parts:${team}:${machine}`, problem === null ? null : t('program.couldNotSaveParts', { robot: robotId, reason: problem }));
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
      this.noteSave(`parts:${robotIndex}`, null);
    } catch (error) {
      this.noteSave(`parts:${robotIndex}`, t('program.couldNotSaveParts', { robot: ROBOT_IDS[robotIndex], reason: describeError(error) }));
    }
  }

  /** Takes effect from the next RUN / DEBUG (or FIGHT); shown at once while there is no match. */
  private selectArena(id: string): void {
    if (this.castleScreen) {
      const problem = this.team.setArena(id);
      if (this.teamMode) this.idleSnapshot = this.captureIdle();
      this.teamWatch?.formChanged();
      this.noteSave('team-map', problem === null ? null : t('program.couldNotSaveMap', { reason: problem }));
      return;
    }
    this.arena = findArena(id);
    this.idleSnapshot = this.captureIdle();
    this.arenaMode.arenaChanged();
    try {
      this.store?.saveArena(this.arena.id);
      this.noteSave('map', null);
    } catch (error) {
      this.noteSave('map', t('program.couldNotSaveMap', { reason: describeError(error) }));
    }
  }

  /** The team battle fields this many robots a side from the next RUN / DEBUG (or FIGHT); the cost pool grows with it. */
  private setTeamSize(teamSize: number): void {
    this.team.setSize(teamSize);
    if (this.teamMode) {
      this.leaveMatch();
      this.enterBattleForm();
      this.idleSnapshot = this.captureIdle();
      this.showFile(this.shownFile);
    }
    this.teamWatch?.formChanged();
  }

  private captureIdle(): Snapshot {
    if (this.teamMode) return captureSnapshot(new Simulation(this.team.idleConfig(this.seed)));
    return captureSnapshot(new Simulation(this.matchConfig(ROBOT_IDS.map(() => IDLE_BRAIN))));
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    for (const replay of [this.replay, this.arenaMode.replay, this.contestMode.replay, this.teamWatch?.replay ?? null]) {
      if (replay !== null) replay.speed = speed;
    }
  }

  /**
   * Goes to the moment of a log row. A row that came from a line of code goes
   * to just before that line ran, and shows it in the code of its robot.
   */
  private jumpTo(event: DebugEvent): void {
    const robotIndex = this.robotIdsNow().findIndex((id) => id === event.robotId);
    const team = robotIndex < 0 ? -1 : this.teamMode ? this.team.machineAt(robotIndex).team : robotIndex;
    const workspace = team < 0 ? undefined : this.workspaces[team];
    if (event.sourceLine === null || workspace === undefined || workspace.stale || event.robotId === null) {
      this.replay?.seek(event.tick);
      return;
    }
    // The row belongs to one machine: the editor's picker moves to it, so the line shown is the line that ran.
    if (this.teamMode) this.team.pick(team, this.team.machineAt(robotIndex).machine);
    this.replay?.seekToLine(event.tick, event.robotId, event.sourceLine);
    this.showFile(codeFileOf(team));
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
    const team = this.workspaces.indexOf(workspace);
    const machine = this.pickedMachine(team);
    const marked = this.followedNow();
    if (marked !== null && marked.team === team && marked.machine === machine && marked.line === line) {
      this.followed = null;
      this.keepMark(null);
      return;
    }
    const robotId = this.editorRobotId(team);
    replay.seekToNextRun(robotId, line);
    const marks = replay.runsOf(robotId, line).map((run) => run.tick);
    this.followed = { team, machine, line, replay, marks };
    this.keepMark({ robotIndex: team, line });
    this.coach?.acted('mark');
  }

  /** Keeps the marked line of the program screen (null when the mark is taken off). The tutorial's marks are not kept. */
  private keepMark(mark: { robotIndex: number; line: number } | null): void {
    if (this.screen !== 'program') return;
    this.savedMark = mark;
    try {
      if (mark === null) this.storage?.removeItem(MARK_KEY);
      else this.storage?.setItem(MARK_KEY, JSON.stringify(mark));
    } catch {
      // Storage may be full or blocked: the mark is then kept until the page is left.
    }
  }

  /** Goes to the next or the previous time the marked line runs, and shows its program. */
  private goToRun(which: 'next' | 'previous'): void {
    const followed = this.followedNow();
    if (followed === null) return;
    const robotId = this.teamMode ? this.team.robotIdOf(followed.team, followed.machine) : ROBOT_IDS[followed.team];
    if (which === 'next') followed.replay.seekToNextRun(robotId, followed.line);
    else followed.replay.seekToPreviousRun(robotId, followed.line);
    this.showFile(codeFileOf(followed.team));
    this.workspaces[followed.team].editor.scrollToLine(followed.line);
  }

  /** The followed line, if it belongs to the match being shown and its code has not changed since. */
  private followedNow(): FollowedLine | null {
    const { followed } = this;
    if (followed === null || followed.replay !== this.replay || this.mode !== 'debug') return null;
    return this.workspaces[followed.team].stale ? null : followed;
  }

  /** Notes how the last save of one thing (a robot's code or parts, the map) went: a problem, or null when it worked. */
  private noteSave(what: string, problem: string | null): void {
    if (problem === null) this.saveProblems.delete(what);
    else this.saveProblems.set(what, problem);
  }

  private codeEdited(workspace: RobotWorkspace): void {
    if (this.replay !== null || this.events.length > 0) workspace.stale = true;
  }

  /** Whether the team battle screen is shown: two teams, one program each, castles. */
  private get teamMode(): boolean {
    return this.screen === 'team';
  }

  /** Every robot of the next match in spawn order: ALPHA's machines then BRAVO's; the duel's two robots otherwise. */
  private robotIdsNow(): string[] {
    return this.teamMode ? this.team.robotIds() : [...ROBOT_IDS];
  }

  /** The spawn index of a team's machine; the robot's own in a duel. */
  private robotIndexOf(team: number, machine: number): number {
    return this.teamMode ? this.team.robotIndexOf(team, machine) : team;
  }

  /** The machine a team's editor follows, kept within the team size. */
  private pickedMachine(team: number): number {
    return this.teamMode ? this.team.pickedMachine(team) : 1;
  }

  /** The robot a team's editor follows: its picked machine; the robot itself in a duel. */
  private editorRobotId(team: number): string {
    if (this.teamMode) return this.team.pickedRobotId(team);
    // A coached castle stage: each side's editor follows its first machine.
    const coached = this.coach?.stage?.teamSize;
    if (coached !== undefined) return robotIdOf(ROBOT_IDS[team], coached, 1);
    return ROBOT_IDS[team];
  }

  /** The robots of the coached stage's match: a castle stage fields teams, the rest the usual pair. */
  private coachRobotIds(): string[] {
    const teamSize = this.coach?.stage?.teamSize;
    if (teamSize === undefined) return [...ROBOT_IDS];
    return ROBOT_IDS.flatMap((name) => Array.from({ length: teamSize }, (_, machine) => robotIdOf(name, teamSize, machine + 1)));
  }

  /** Whether a castle-battle screen is shown: the team battle's editing or its watching, which share the maps and the size. */
  private get castleScreen(): boolean {
    return this.screen === 'team' || this.screen === 'teamwatch';
  }

  /** The team battle's watching, made the first time it is shown. */
  private ensureTeamWatch(): TeamBattleMode {
    this.team.ensureWorkspaces();
    this.teamWatch ??= new TeamBattleMode(requireElement('team-lineup-slots'), requireElement('team-result-rows'), {
      arena: () => this.team.castleArena,
      teamSize: () => this.team.size,
      garageTeams: () => this.team.garage?.list() ?? [],
      speed: () => this.speed,
      chooseArena: (id) => {
        this.selectArena(id);
        this.toolbar.setArena(id);
      },
      chooseTeamSize: (size) => {
        this.setTeamSize(size);
        requireElement<HTMLSelectElement>('team-size').value = String(this.team.size);
      },
      keepTeams: (teams) => {
        const { garage } = this.team;
        if (garage === null) throw new Error(t('garage.noStorage'));
        return garage.keep(teams);
      },
      storage: this.storage,
    });
    return this.teamWatch;
  }

  /** Puts a saved team's program and parts in place of a team's own. Does not change the match's team size. */
  private loadTeam(team: number, saved: { source: string; loadouts: readonly Loadout[] }): void {
    this.team.ensureWorkspaces()[team].load(saved.source);
    saved.loadouts.slice(0, MAX_TEAM_SIZE).forEach((loadout, machine) => this.setTeamLoadout(team, machine + 1, { ...loadout }));
    this.showFile(codeFileOf(team));
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

    const { coach } = this;
    const coached = coach !== null;
    const team = this.teamMode;
    EDITOR_ELEMENT_IDS.forEach((elementId, robotIndex) => {
      requireElement(elementId).hidden = coached || team || !(isCode && robotIndex === file.robotIndex);
    });
    TEAM_EDITOR_ELEMENT_IDS.forEach((elementId, teamIndex) => {
      requireElement(elementId).hidden = !team || !(isCode && teamIndex === file.robotIndex);
    });
    requireElement('tutorial-code').hidden = !coached || !isCode;
    requireElement('config').hidden = isCode;
    this.templateMenu.hidden = !isCode || coached;
    if (!isCode) {
      if (team) {
        const machine = this.pickedMachine(file.robotIndex);
        const { cost, limit } = this.team.costOf(file.robotIndex);
        this.partsView.show(
          this.editorRobotId(file.robotIndex),
          AI_LABEL,
          this.team.loadoutOf(file.robotIndex, machine),
          paletteOf(this.robotIndexOf(file.robotIndex, machine), this.teamsNow()),
          undefined,
          { text: t('castle.teamCost', { cost, limit }), over: cost > limit },
        );
      } else {
        this.partsView.show(robotId, AI_LABEL, coach?.loadout ?? this.loadouts[file.robotIndex], paletteOf(file.robotIndex), coach?.fixedSlots);
      }
    }

    requireElement('editor-title').textContent =
      this.screen === 'tutorial'
        ? t(isCode ? 'tutorial.editorTitle' : 'tutorial.partsTitle')
        : this.screen === 'challenge'
          ? t(isCode ? 'challenge.editorTitle' : 'challenge.partsTitle')
          : team
            ? t('team.editorTitle', { team: robotId, file: file.file })
            : t('program.editorTitle', { robot: robotId, file: file.file });
    this.projectPanel.markSelected(file);
    this.refreshMachinePicker();
    // Line-by-line stepping follows the program in view: in the team battle, its picked machine.
    this.replay?.focusOn(this.editorRobotId(file.robotIndex));
  }

  /** The team of each robot of the next match, in spawn order; undefined outside the team battle. */
  private teamsNow(): number[] | undefined {
    return this.teamMode ? this.team.teams() : undefined;
  }

  private frame = (now: number): void => {
    const elapsed = (now - this.lastFrame) / MS_PER_SECOND;
    this.lastFrame = now;
    this.coach?.update();
    if (this.screen === 'arena') this.showArena(elapsed);
    else if (this.screen === 'contest') this.showContest(elapsed);
    else if (this.screen === 'teamwatch') this.showTeamWatch(elapsed);
    else this.showProgram(elapsed);
    requestAnimationFrame(this.frame);
  };

  /** One frame of the team battle's watching: the castle match being watched, or the picked teams waiting. */
  private showTeamWatch(elapsed: number): void {
    const watch = this.ensureTeamWatch();
    watch.update();
    this.showWatched(elapsed, watch);
  }

  /** One frame of the arena mode: the fight being watched, or the picked robots waiting. */
  private showArena(elapsed: number): void {
    this.arenaMode.update();
    this.showWatched(elapsed, this.arenaMode);
  }

  /** One frame of the contest screen: a match of the contest being watched, or an empty arena under its board. */
  private showContest(elapsed: number): void {
    this.contestMode.update();
    this.showWatched(elapsed, this.contestMode);
  }

  /** Draws the match a watching screen shows, and sets the toolbar and the transport to it. */
  private showWatched(elapsed: number, screen: WatchingScreen): void {
    const { replay } = screen;
    replay?.advance(elapsed);
    const scene = screen.scene();
    const { snapshot, arena, stats, loadouts } = scene;
    this.battleView.render(snapshot, arena, stats, loadouts, {
      sensorOf: null,
      marks: NO_FEATURES,
      coverRoutes: screen.coverRoutes(),
      overrun: replay?.overrun ?? 0,
      teams: scene.teams,
      bases: scene.bases,
      teamNames: scene.teamNames,
    });
    this.toolbar.setMessage(screen.message());
    this.showSeed(replay?.recording.seed ?? null);
    this.commentaryView.update(screen.commentary(), replay?.tick ?? 0, this.commentaryOn);
    if (replay === null) this.analysisOverlay.hidden = true;
    else if (!this.analysisOverlay.hidden) this.watchedAnalysis.update(replay.tick);
    requireElement('analysis-button').toggleAttribute('disabled', replay === null);
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
            canStepOver: false,
          },
      this.speed,
    );
  }

  /** One frame of the program mode: the match of ALPHA and BRAVO (or the two teams), and the panels that follow it. */
  private showProgram(elapsed: number): void {
    const { replay } = this;
    replay?.advance(elapsed);
    const followed = this.followedNow();

    const view = replay?.view ?? this.idleSnapshot;
    const debugging = this.mode === 'debug' && replay !== null;
    const { coach } = this;
    const stage = coach?.stage;
    const team = this.teamMode;
    const idleArena = stage?.arena ?? (team ? this.team.castleArena.arena : this.arena.arena);
    const stageSize = stage?.teamSize ?? 1;
    const idleLoadouts =
      coach === null || stage === undefined
        ? team
          ? this.team.flatLoadouts()
          : this.loadouts
        : [
            ...Array.from({ length: stageSize }, () => coach.loadout),
            ...Array.from({ length: stageSize }, () => ({ ...STANDARD_LOADOUT, ...stage.botLoadout })),
          ];
    const idleStats = stage === undefined && !team ? this.stats : idleLoadouts.map((loadout) => statsOf(loadout));
    const stats = replay?.recording.stats ?? idleStats;
    const loadouts = replay === null ? idleLoadouts : this.matchLoadouts;
    const castleStage = stage !== undefined && stage.teamSize !== undefined;
    this.battleView.render(view, replay?.recording.arena ?? idleArena, stats, loadouts, {
      goal: stage?.goal,
      sensorOf: debugging ? this.inspector.selected : null,
      marks: (debugging ? this.features[this.inspector.selected] : undefined) ?? NO_FEATURES,
      // The way to cover is shown for any robot whose program has to do with cover, in RUN as well.
      coverRoutes: replay === null ? NO_COVER_ROUTES : this.features.map((features) => features.cover),
      overrun: replay?.overrun ?? 0,
      teams: replay?.recording.teams ?? (team ? this.teamsNow() : stage !== undefined ? stageTeams(stage) : undefined),
      teamNames: team || castleStage ? ROBOT_IDS : undefined,
      bases: replay?.recording.bases ?? (team ? this.team.castleArena.basesFor(this.team.size) : stage?.bases),
    });
    this.inspector.update(view);
    const watched = view.robots[this.inspector.selected] ?? view.robots[0];
    this.watch.update(watched, replay?.variablesOf(watched.id) ?? {});
    this.workspaces.forEach((workspace, editorIndex) => {
      const showLines = debugging && !workspace.stale;
      const robotId = this.editorRobotId(editorIndex);
      const current = showLines ? replay.currentLine(robotId) : null;
      workspace.editor.showExecutedLines(showLines ? replay.linesSoFar(robotId) : []);
      workspace.editor.showCurrentLine(current);
      workspace.editor.showFollowedLine(
        followed?.team === editorIndex && (!team || followed.machine === this.pickedMachine(editorIndex)) ? followed.line : null,
      );
    });
    this.logView.update(this.events, replay?.reachedTick ?? 0, replay?.tick ?? 0);
    const analyzed = replay === null ? null : this.analysisOf(replay);
    if (replay === null && this.analyzed !== null) {
      this.analyzed = null;
      this.analysisView.show(null, null);
    }
    if (this.analysisShown) this.analysisView.update(replay?.tick ?? 0);
    // Beside the lines, while debugging the code that was run: how many times each ran in the match (the followed machine's).
    const recordingIds = replay?.recording.snapshots[0].robots.map((robot) => robot.id) ?? [];
    this.workspaces.forEach((workspace, editorIndex) => {
      const countsIndex = recordingIds.indexOf(this.editorRobotId(editorIndex));
      const counts = debugging && !workspace.stale && countsIndex >= 0 ? (analyzed?.counts[countsIndex] ?? null) : null;
      workspace.editor.showRunCounts(counts);
    });
    this.toolbar.setMessage(this.message());
    this.toolbar.setMode(replay === null ? null : this.mode);
    this.showSeed(replay?.recording.seed ?? stage?.seed ?? this.seed);
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
            canStepOver: debugging,
          },
      this.speed,
    );
  }

  /** The seed of the match shown, or of the next one, in the battle view's heading. */
  private showSeed(seed: number | null): void {
    const text = seed === null ? '' : t('program.seed', { seed });
    if (this.seedLabel.textContent !== text) this.seedLabel.textContent = text;
  }

  private message(): string {
    const parts = [this.notice ?? this.replayStatus()];
    const edited = this.workspaces.filter((workspace) => workspace.stale).map((workspace) => workspace.robotId);
    if (edited.length > 0) parts.push(`[${t('program.staleNote', { robots: edited.join(', ') })}]`);
    const refitted = this.teamMode ? [...this.team.partsStale] : ROBOT_IDS.filter((_, robotIndex) => this.partsStale[robotIndex]);
    if (refitted.length > 0) parts.push(`[${t('program.partsNote', { robots: refitted.join(', ') })}]`);
    for (const problem of this.saveProblems.values()) parts.push(`[${problem}]`);
    return parts.join('   ');
  }

  private replayStatus(): string {
    if (this.replay === null) return t('program.ready');
    const parts = [
      t(this.mode === 'run' ? 'program.mode.run' : 'program.mode.debug'),
      playbackStatus(this.replay, this.teamMode ? ROBOT_IDS : undefined),
    ];
    const followed = this.followedNow();
    if (followed !== null) parts.push(this.describeFollowed(followed));
    return parts.join('   ');
  }

  /** Which of its runs the followed line is at, e.g. "ALPHA line 13: run 2 of 5". */
  private describeFollowed({ team, machine, line, replay, marks }: FollowedLine): string {
    const robotId = this.teamMode ? this.team.robotIdOf(team, machine) : ROBOT_IDS[team];
    if (marks.length === 0) return t('program.followed.never', { robot: robotId, line });
    const run = replay.runAt(robotId, line);
    return run === null
      ? t('program.followed.runs', { robot: robotId, line, count: marks.length })
      : t('program.followed.run', { robot: robotId, line, run: run + 1, count: marks.length });
  }
}

function playbackStatus(replay: ReplayManager, teamNames?: readonly string[]): string {
  const { result } = replay.snapshot;
  if (result !== null) return formatOutcome(result, teamNames);
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
  // A seed that is not a number is left out: the page still starts, with seeds of its own.
  return Number.isNaN(seed) ? null : seed;
}

const MARK_KEY = 'roboscript/mark.json';
const COMMENTARY_KEY = 'roboscript/commentary';

/** Whether the commentary is on: it is unless it was turned off. */
function readCommentaryOn(storage: Storage | null): boolean {
  try {
    return storage?.getItem(COMMENTARY_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Whether a key goes to something being typed in: a field, a list, or the code editor. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** The marked line kept from before, if there is a usable one. */
function readMark(storage: Storage | null): { robotIndex: number; line: number } | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(MARK_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const { robotIndex, line } = value as Record<string, unknown>;
    if (!Number.isInteger(robotIndex) || !Number.isInteger(line)) return null;
    if ((robotIndex as number) < 0 || (robotIndex as number) >= ROBOT_IDS.length || (line as number) < 1) return null;
    return { robotIndex: robotIndex as number, line: line as number };
  } catch {
    return null;
  }
}

/** Where the screen goes again after the reload of a language switch, for this tab alone. */
const RETURN_SCREEN_KEY = 'roboscript/return-screen';

/**
 * Keeps the other language and starts the page again in it: every text is
 * made at start-up. With `returnTo`, the page comes back to that screen
 * instead of the start menu, so the switch does not throw the player out.
 */
function switchLanguage(storage: Storage | null, returnTo: Screen | null = null): void {
  try {
    storage?.setItem(LANGUAGE_KEY, otherLanguage(currentLanguage()));
  } catch {
    // Storage may be full or blocked: the language then falls back to the browser's at the next start.
  }
  try {
    if (returnTo !== null) window.sessionStorage.setItem(RETURN_SCREEN_KEY, returnTo);
  } catch {
    // Without session storage the page simply starts on the menu again.
  }
  window.location.reload();
}

/** The screen kept over a language switch, taken out so it is used only once; null when there is none. */
function consumeReturnScreen(): Screen | null {
  try {
    const kept = window.sessionStorage.getItem(RETURN_SCREEN_KEY);
    window.sessionStorage.removeItem(RETURN_SCREEN_KEY);
    const screens: readonly string[] = [...SCREENS, 'tutorial', 'challenge', 'team', 'teamwatch'];
    return kept !== null && screens.includes(kept) ? (kept as Screen) : null;
  } catch {
    return null;
  }
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

export function startApp(): void {
  new App();
}
