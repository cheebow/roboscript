import { type ContestRecord, recordLeague, recordTournament } from '../arena/contest_record';
import { LEAGUE_MAX, LEAGUE_MIN, playLeague } from '../arena/league';
import { type Entrant, type Fight, builtInEntrants, fightNames, prepareFight } from '../arena/match';
import { randomSeed } from '../arena/seed';
import { playTournament } from '../arena/tournament';
import { type ArenaDefinition, DEFAULT_ARENA } from '../data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, REPLAY_TAIL_TICKS } from '../data/match_defaults';
import { recordMatch } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import { captureSnapshot } from '../debug/snapshot';
import { t } from '../i18n/messages';
import { type ContestEntry, type ContestOrigin, CONTEST_KEY, addEntry, readContest, removeEntry, writeContest } from '../project/contest_store';
import type { SavedRobot } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { RULES_VERSION } from '../data/rules_version';
import { decodeRobot } from '../share/codec';
import { type SharedFile, acceptDrops, chooseFile, contestFileText, downloadText, fileName, readSharedFile } from '../share/file';
import { Simulation } from '../sim/simulation';
import { formatOutcome } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import type { ArenaScene } from './arena_mode';
import { ActionMenu, type MenuItem } from './action_menu';
import { RobotIntake } from './robot_intake';
import { createElement } from './dom';
import { createLeagueBoard } from './league_board';
import { createRobotPreview, drawRobotPreview } from './robot_preview';
import { createTournamentBoard } from './tournament_board';

/** What the contest screen needs to know of the rest of the app. */
export interface ContestSetting {
  /** The saved robots, read afresh. */
  garage(): readonly SavedRobot[];
  /** The playback speed chosen under the battle view. */
  speed(): number;
  /** Whether the contest screen is the one shown. */
  shown(): boolean;
  storage: KeyValueStorage | null;
}

type Format = 'league' | 'tournament';

/** A board over the battle view: its title, its picture, and what it was drawn from. */
interface ShownBoard {
  title: string;
  content: HTMLElement;
  /** The contest as it is written to a file. */
  record: ContestRecord;
  /** Set when the board was opened from a file: when that was saved, and the rules it was played under. */
  opened: { savedAt: string; rules: string } | null;
}
const FORMATS: readonly Format[] = ['league', 'tournament'];

/** The empty arena the battle view shows before any match of the contest is watched. */
const EMPTY_SCENE: ArenaScene = {
  snapshot: captureSnapshot(
    new Simulation({ arena: DEFAULT_ARENA, tickRate: MATCH_DEFAULTS.tickRate, maxMatchTime: 1, seed: 1, robots: [] }),
  ),
  arena: DEFAULT_ARENA,
  stats: [],
  loadouts: [],
};

/**
 * The contest screen: a list of robots, gathered from share codes, the
 * built-in ones and the garage, plays a league or a tournament; the result is
 * shown as a board over the battle view, and any of its matches can be
 * watched there.
 */
export class ContestMode {
  /** The match of the contest being watched; null while the board is shown or before any. */
  replay: ReplayManager | null = null;
  private fight: Fight | null = null;
  private entries: ContestEntry[];
  private format: Format = 'league';
  /** The board of the last contest of each format, played here or opened from a file. */
  private readonly boards = new Map<Format, ShownBoard>();
  private note: string | null = null;

  private readonly formatButtons: HTMLButtonElement[];
  private readonly countLabel = createElement('span', 'contest-count');
  private readonly list = createElement('div', 'contest-entries');
  private readonly addMenu: RobotIntake;
  private readonly resultMenu: ActionMenu;
  private readonly startButton: HTMLButtonElement;

  constructor(
    panel: HTMLElement,
    /** Over the battle view: where the result of the contest is shown. */
    private readonly board: HTMLElement,
    private readonly setting: ContestSetting,
  ) {
    this.entries = readContest(setting.storage?.getItem(CONTEST_KEY) ?? null);

    const formats = createElement('div', 'contest-formats');
    this.formatButtons = FORMATS.map((format) => {
      const button = createElement('button', 'contest-format', t(`contest.format.${format}`));
      button.type = 'button';
      button.title = t(`contest.format.${format}.title`);
      button.addEventListener('click', () => this.setFormat(format));
      formats.append(button);
      return button;
    });

    const heading = createElement('div', 'contest-heading');
    heading.append(createElement('span', 'field-name', t('contest.entrants')), this.countLabel);

    this.addMenu = new RobotIntake(
      { label: t('contest.addMenu'), title: t('contest.addMenu.title'), submit: t('contest.add'), submitTitle: t('contest.code.title') },
      (code) => this.addFromCode(code),
      (id) => this.pickAdd(id),
    );

    this.startButton = this.button('', '', () => this.start());
    const [resultHolder, resultButton] = this.menuButton(t('contest.resultMenu'), t('contest.resultMenu.title'));
    this.resultMenu = new ActionMenu(resultHolder, resultButton, [], (id) => this.pickResult(id));
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(this.startButton, resultHolder);

    panel.replaceChildren(formats, heading, this.list, this.addMenu.element, buttons);
    // A robot file dropped on the panel joins the list; a result file shows its board.
    const onProblem = (problem: string) => {
      this.note = problem;
    };
    acceptDrops(panel, (text) => this.openFile(text), { onProblem });
    // The battle view is on the other screens too: it takes files only while the contest screen is shown.
    acceptDrops(board.parentElement ?? board, (text) => this.openFile(text), { accepts: () => setting.shown(), onProblem });
    this.refresh();
  }

  /** Reads the garage again and shows the list, the format and what can be done. */
  refresh(): void {
    const garage = this.setting.garage();
    const items: MenuItem[] = [
      { id: 'built-in', label: t('contest.add.builtIn'), items: builtInEntrants().map((entrant, index) => ({ id: `built-in:${index}`, label: entrant.name })) },
      garage.length === 0
        ? { id: 'garage', label: t('contest.add.garageEmpty'), disabled: true }
        : { id: 'garage', label: t('contest.add.garage'), items: garage.map((robot, index) => ({ id: `garage:${index}`, label: robot.name })) },
      { id: 'file', label: t('contest.add.file') },
    ];
    this.addMenu.setItems(items);
    this.showList();
    this.showFormat();
  }

  /** What to draw: the match being watched, or an empty arena. */
  scene(): ArenaScene {
    const { replay, fight } = this;
    if (replay === null || fight === null) return EMPTY_SCENE;
    const { recording } = replay;
    return { snapshot: replay.view, arena: recording.arena, stats: recording.stats, loadouts: fight.loadouts };
  }

  coverRoutes(): readonly boolean[] {
    return this.fight === null ? [] : this.fight.features.map((features) => features.cover);
  }

  /** The line for the toolbar. */
  message(): string {
    const note = this.note === null ? '' : `   [${this.note}]`;
    const { replay, fight } = this;
    if (replay === null || fight === null) return `${t('contest.ready', { min: LEAGUE_MIN, max: LEAGUE_MAX })}${note}`;
    const { result } = replay.snapshot;
    const status = result !== null ? formatOutcome(result) : replay.playing ? t('arena.playing') : t('arena.paused');
    return `${t('arena.vs', { first: fight.names[0], second: fight.names[1] })}   ${status}${note}`;
  }

  /** Called when the screen is shown: the board of the format, if there is one, comes back up. */
  shown(): void {
    this.refresh();
    if (this.replay === null) this.showBoard();
  }

  private button(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = createElement('button', 'tool-button', label);
    button.type = 'button';
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  /** A menu's holder and its button, which looks like the other buttons of the panel. */
  private menuButton(label: string, title: string): [HTMLElement, HTMLButtonElement] {
    const holder = createElement('div', 'menu panel-menu');
    const button = createElement('button', 'tool-button panel-menu-button', label);
    button.type = 'button';
    button.title = title;
    holder.append(button);
    return [holder, button];
  }

  private pickAdd(id: string): void {
    const [kind, at] = id.split(':');
    const index = Number(at);
    if (kind === 'built-in') {
      const entrant = builtInEntrants()[index];
      if (entrant !== undefined) this.add({ name: entrant.name, source: entrant.source, loadout: entrant.loadout }, 'built-in');
    } else if (kind === 'garage') {
      const robot = this.setting.garage()[index];
      if (robot !== undefined) this.add(robot, 'garage');
    } else if (kind === 'file') {
      chooseFile((text) => this.openFile(text), (problem) => {
        this.note = problem;
      });
    }
  }

  private pickResult(id: string): void {
    const shown = this.boards.get(this.format);
    if (id === 'board') this.showBoard();
    else if (id === 'save' && shown !== undefined) this.saveResult(shown);
    else if (id === 'open') {
      chooseFile((text) => this.openFile(text), (problem) => {
        this.note = problem;
      });
    }
  }

  private setFormat(format: Format): void {
    this.format = format;
    this.note = null;
    this.showFormat();
    this.leaveMatch();
    if (this.boards.has(format)) this.showBoard();
    else this.board.hidden = true;
  }

  private showFormat(): void {
    this.formatButtons.forEach((button, index) => button.classList.toggle('selected', FORMATS[index] === this.format));
    this.startButton.textContent = t(`contest.start.${this.format}`);
    this.startButton.title = t(`contest.format.${this.format}.title`);
    this.startButton.disabled = this.entries.length < LEAGUE_MIN;
    const noBoard = !this.boards.has(this.format);
    this.resultMenu.setItems([
      { id: 'board', label: t('contest.result.board'), disabled: noBoard },
      { id: 'save', label: t('contest.result.save'), disabled: noBoard },
      { id: 'open', label: t('contest.result.open') },
    ]);
  }

  /** The robots on the list as they fight. */
  private entrants(): Entrant[] {
    return entrantsOf(this.entries.map(({ robot }) => robot));
  }

  private showList(): void {
    const entrants = this.entrants();
    this.countLabel.textContent = t('contest.count', { count: this.entries.length, max: LEAGUE_MAX });
    this.countLabel.classList.toggle('over-limit', this.entries.length < LEAGUE_MIN);
    if (entrants.length === 0) {
      this.list.replaceChildren(createElement('div', 'garage-empty', t('contest.empty')));
      return;
    }
    this.list.replaceChildren(
      ...entrants.map((entrant, index) => {
        const row = createElement('div', 'contest-entry');
        const picture = createRobotPreview();
        drawRobotPreview(picture, entrant.loadout, paletteOf(index));
        const name = createElement('span', 'contest-entry-name', entrant.name);
        const origin = createElement('span', 'contest-entry-origin', t(`contest.origin.${this.entries[index].origin}`));
        const remove = createElement('button', 'garage-action', '×');
        remove.type = 'button';
        remove.title = t('contest.remove.title', { name: entrant.name });
        remove.addEventListener('click', () => this.setEntries(removeEntry(this.entries, index)));
        row.append(picture, name, origin, remove);
        return row;
      }),
    );
  }

  private add(robot: SavedRobot, origin: ContestOrigin): boolean {
    const added = addEntry(this.entries, { robot, origin });
    if (!added.ok) {
      this.note = t('contest.full', { max: LEAGUE_MAX });
      return false;
    }
    this.note = t('contest.added', { name: robot.name });
    this.setEntries(added.list);
    return true;
  }

  private setEntries(list: ContestEntry[]): void {
    this.entries = list;
    try {
      this.setting.storage?.setItem(CONTEST_KEY, writeContest(list));
    } catch {
      // Storage may be full or blocked: the list still holds until the page is left.
    }
    this.showList();
    this.showFormat();
  }

  /** Adds the robot of a pasted share code; true when it was added. */
  private async addFromCode(code: string): Promise<boolean> {
    const decoded = await decodeRobot(code);
    if (!decoded.ok) {
      this.note = t('garage.couldNotImport', { problem: decoded.problem });
      return false;
    }
    return this.add(decoded.shared.robot, 'code');
  }


  /** Plays the contest of the chosen format between the robots on the list, and shows its board. */
  private start(): void {
    this.note = null;
    const entrants = this.entrants();
    if (entrants.length < LEAGUE_MIN) {
      this.note = t('contest.pickCount', { min: LEAGUE_MIN, max: LEAGUE_MAX, count: entrants.length });
      return;
    }
    const play = (first: number, second: number, arena: ArenaDefinition, seed: number) => this.watch(entrants, first, second, arena, seed);
    if (this.format === 'league') {
      const played = playLeague(entrants, randomSeed());
      if (!played.ok) {
        this.note = played.problems.join(' / ');
        return;
      }
      const { matches, standings } = played;
      const record = recordLeague(this.entries.map(({ robot }) => robot), matches, standings);
      const content = createLeagueBoard({ entrants, matches, standings }, (match) => play(match.first, match.second, match.arena, match.seed));
      this.boards.set('league', { title: t('league.title', { count: entrants.length, matches: matches.length }), content, record, opened: null });
    } else {
      const played = playTournament(entrants, randomSeed());
      if (!played.ok) {
        this.note = played.problems.join(' / ');
        return;
      }
      const { bracket } = played;
      const record = recordTournament(this.entries.map(({ robot }) => robot), bracket);
      const content = createTournamentBoard(entrants, bracket, (match) => play(match.first, match.second, match.arena, match.seed));
      const matches = bracket.rounds.flat().reduce((sum, tie) => sum + tie.matches.length, 0);
      this.boards.set('tournament', { title: t('tournament.title', { count: entrants.length, matches }), content, record, opened: null });
    }
    this.leaveMatch();
    this.showFormat();
    this.showBoard();
  }

  /** Puts the board of the chosen format over the battle view. */
  private showBoard(): void {
    const shown = this.boards.get(this.format);
    if (shown === undefined) {
      this.board.hidden = true;
      return;
    }
    const header = createElement('div', 'board-header');
    const close = this.button(t('contest.close'), t('contest.close.title'), () => {
      this.board.hidden = true;
    });
    const save = this.button(t('contest.saveResult'), t('contest.saveResult.title'), () => this.saveResult(shown));
    const title = createElement('span', 'board-title', shown.title);
    const actions = createElement('span', 'board-actions');
    if (shown.opened !== null) {
      const when = new Date(shown.opened.savedAt);
      const saved = Number.isNaN(when.getTime()) ? '?' : when.toLocaleString();
      const otherRules = shown.opened.rules === RULES_VERSION ? '' : t('contest.otherRules', { rules: shown.opened.rules || t('share.unknown'), now: RULES_VERSION });
      title.append(createElement('span', 'board-note', `${t('contest.openedNote', { saved })}${otherRules}`));
      actions.append(this.button(t('contest.useEntrants'), t('contest.useEntrants.title'), () => this.useEntrants(shown)));
    }
    actions.append(save, close);
    header.append(title, actions);
    this.board.replaceChildren(header, shown.content);
    this.board.hidden = false;
  }

  /** Has the browser save the board's contest as a file. */
  private saveResult(shown: ShownBoard): void {
    const { record } = shown;
    const date = new Date();
    const stamp = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    downloadText(fileName(`${t(`contest.format.${record.format}`)}-${stamp}`), contestFileText(record, date));
    this.note = t('contest.resultSaved');
  }

  /** A robot file adds its robot to the list; a result file shows its board. */
  private openFile(text: string): void {
    const read = readSharedFile(text);
    if (!read.ok) {
      this.note = t('file.couldNotOpen', { problem: read.problem });
      return;
    }
    this.openShared(read.file);
  }

  private openShared(file: SharedFile): void {
    if (file.kind === 'robot') {
      this.add(file.robot, 'file');
      return;
    }
    const { contest } = file;
    const entrants = entrantsOf(contest.robots);
    const play = (first: number, second: number, arena: ArenaDefinition, seed: number) => this.watch(entrants, first, second, arena, seed);
    const opened = { savedAt: file.savedAt, rules: file.rules };
    if (contest.format === 'league') {
      const { matches, standings } = contest;
      const content = createLeagueBoard({ entrants, matches, standings }, (match) => play(match.first, match.second, match.arena, match.seed));
      const record = recordLeague(contest.robots, matches, standings);
      this.boards.set('league', { title: t('league.title', { count: entrants.length, matches: matches.length }), content, record, opened });
    } else {
      const { bracket } = contest;
      const content = createTournamentBoard(entrants, bracket, (match) => play(match.first, match.second, match.arena, match.seed));
      const matches = bracket.rounds.flat().reduce((sum, tie) => sum + tie.matches.length, 0);
      const record = recordTournament(contest.robots, bracket);
      this.boards.set('tournament', { title: t('tournament.title', { count: entrants.length, matches }), content, record, opened });
    }
    this.format = contest.format;
    this.note = contest.unknownArenas.length === 0 ? t('contest.resultOpened') : t('contest.unknownArenas', { arenas: contest.unknownArenas.join(', ') });
    this.leaveMatch();
    this.showFormat();
    this.showBoard();
  }

  /** Puts the robots of an opened contest on the list, in place of the robots there. */
  private useEntrants(shown: ShownBoard): void {
    const robots = shown.record.robots.slice(0, LEAGUE_MAX);
    this.setEntries(robots.map((robot) => ({ robot: { ...robot, loadout: { ...robot.loadout } }, origin: 'file' })));
    this.note = t('contest.entrantsUsed', { count: robots.length });
  }

  /** Plays a match of the contest in the battle view, putting the board away. */
  private watch(entrants: readonly Entrant[], first: number, second: number, arena: ArenaDefinition, seed: number): void {
    const prepared = prepareFight([entrants[first], entrants[second]], arena.arena, seed);
    if (!prepared.ok) {
      // A robot of a file made under other rules may no longer be a working program.
      this.note = t('contest.cannotPlay', { problems: prepared.problems.join(' / ') });
      return;
    }
    this.board.hidden = true;
    this.fight = prepared.fight;
    this.replay = new ReplayManager(recordMatch(prepared.fight.config, EFFECT_LIFETIMES), {
      maxFrameTime: MATCH_DEFAULTS.maxFrameTime,
      tailTicks: REPLAY_TAIL_TICKS,
      speed: this.setting.speed(),
      focus: prepared.fight.names[0],
    });
    this.replay.restart();
  }

  private leaveMatch(): void {
    this.replay = null;
    this.fight = null;
  }
}


/** The robots as they fight: robots of the same name numbered, "Striker (2)". */
function entrantsOf(robots: readonly SavedRobot[]): Entrant[] {
  const names = fightNames(robots.map((robot) => ({ id: '', name: robot.name, origin: 'garage', loadout: robot.loadout, source: robot.source })));
  return robots.map((robot, index) => ({
    id: `contest:${index}`,
    name: names[index],
    origin: 'garage',
    loadout: robot.loadout,
    source: robot.source,
  }));
}
