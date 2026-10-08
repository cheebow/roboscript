import { type ContestRecord, recordLeague, recordTournament } from '../arena/contest_record';
import { LEAGUE_MAX, LEAGUE_MIN, type LeagueMatch, type Standing, leagueSteps } from '../arena/league';
import type { SteppedPlay } from '../arena/match';
import { type DrivenRun, driveSteps } from './stepped_run';
import { type Entrant, builtInEntrants, fightNames, prepareFight } from '../arena/match';
import { randomSeed } from '../arena/seed';
import { type Bracket, tournamentSteps } from '../arena/tournament';
import { type ArenaDefinition, DEFAULT_ARENA } from '../data/arenas';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import type { ReplayManager } from '../debug/replay_manager';
import { captureSnapshot } from '../debug/snapshot';
import { t } from '../i18n/messages';
import { type ContestEntry, type ContestOrigin, CONTEST_KEY, addEntry, readContest, removeEntry, writeContest } from '../project/contest_store';
import { type SavedRobot, copyRobot } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { RULES_VERSION } from '../data/rules_version';
import { decodeRobot } from '../share/codec';
import { type SharedFile, acceptDrops, chooseFile, contestFileText, downloadText, fileName, readSharedFile } from '../share/file';
import { Simulation } from '../sim/simulation';
import { paletteOf } from '../view/sprites';
import { type ArenaScene, WatchedMatch } from './watched_match';
import type { CommentaryLine } from '../arena/commentary';
import { ActionMenu, type MenuItem } from './action_menu';
import { Notice } from './notice';
import { RobotIntake } from './robot_intake';
import { createButton, createElement } from './dom';
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

/** A finished contest: the robots, and how its matches went. */
type PlayedContest =
  | { format: 'league'; robots: readonly SavedRobot[]; matches: LeagueMatch[]; standings: Standing[] }
  | { format: 'tournament'; robots: readonly SavedRobot[]; bracket: Bracket };

/** A board over the battle view: its title, its picture, and what it was drawn from. */
interface ShownBoard {
  title: string;
  content: HTMLElement;
  /** The contest as it is written to a file. */
  record: ContestRecord;
  /** Set when the board was opened from a file: when that was saved, and the rules it was played under. */
  opened: { savedAt: string; rules: string } | null;
  /** The winner of the contest: the top of the table, or the champion. */
  winner: string;
  /** For a contest played here: the list it was played with, to tell when the list has changed since. */
  playedWith: string | null;
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
 * The contest screen: a list of robots, gathered from the built-in ones, the
 * garage, share codes and files, plays a league or a tournament; the result is
 * shown as a board over the battle view, and any of its matches can be
 * watched there. Results can be saved to a file and opened from one.
 */
export class ContestMode {
  /** The match of the contest being watched; none while the board is shown or before any. */
  private readonly watched = new WatchedMatch();
  private entries: ContestEntry[];
  private format: Format = 'league';
  /** The board of the last contest of each format, played here or opened from a file. */
  private readonly boards = new Map<Format, ShownBoard>();
  /** What the last action did, or why it could not: under the panel's buttons. */
  private readonly notice = new Notice();
  /** The contest being computed, match by match; null while there is none. */
  private run: DrivenRun | null = null;

  private readonly formatButtons: HTMLButtonElement[];
  private readonly countLabel = createElement('span', 'contest-count');
  /** Over the battle view while a match of the contest is watched: the way back to its board. */
  private readonly returnBar = createElement('div', 'board-return');
  private readonly watching = createElement('span', 'board-return-what');
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
      const button = createButton('contest-format', t(`contest.format.${format}`), t(`contest.format.${format}.title`), () => this.setFormat(format));
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

    this.startButton = createButton('tool-button', '', '', () => this.start());
    const results = ActionMenu.inPanel(t('contest.resultMenu'), t('contest.resultMenu.title'), (id) => this.pickResult(id));
    this.resultMenu = results.menu;
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(this.startButton, results.element);

    panel.replaceChildren(formats, heading, this.list, this.addMenu.element, buttons, this.notice.element);
    this.returnBar.append(createButton('tool-button', t('contest.backToBoard'), t('contest.backToBoard.title'), () => this.showBoard()), this.watching);
    this.returnBar.hidden = true;
    (board.parentElement ?? board).append(this.returnBar);
    new ResizeObserver(() => this.fitBoard()).observe(board);

    // A robot file dropped on the panel joins the list; a result file shows its board.
    const onProblem = (problem: string) => {
      this.notice.show(problem, true);
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
    return this.watched.scene(EMPTY_SCENE);
  }

  /** The replay of the match being watched; null while there is none. */
  get replay(): ReplayManager | null {
    return this.watched.replay;
  }

  coverRoutes(): readonly boolean[] {
    return this.watched.coverRoutes();
  }

  /** The commentary of the match being watched. */
  commentary(): readonly CommentaryLine[] {
    return this.watched.commentary;
  }

  /** The names the robots of the match being watched fight under; empty while there is none. */
  fightNames(): readonly string[] {
    return this.watched.fight?.names ?? [];
  }

  /** The line for the toolbar. */
  message(): string {
    const { fight } = this.watched;
    const status = this.watched.status();
    if (status === null || fight === null) {
      const shown = this.boards.get(this.format);
      if (shown === undefined) return t('contest.ready', { min: LEAGUE_MIN, max: LEAGUE_MAX });
      return t('contest.finished', { format: t(`contest.format.${this.format}`), winner: shown.winner });
    }
    return `${t('arena.vs', { first: fight.names[0], second: fight.names[1] })}   ${status}`;
  }

  /** Called when the screen is shown: the board of the format, if there is one, comes back up. */
  shown(): void {
    this.refresh();
    if (this.replay === null) this.showBoard();
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
        this.notice.show(problem, true);
      });
    }
  }

  private pickResult(id: string): void {
    const shown = this.boards.get(this.format);
    if (id === 'board') this.showBoard();
    else if (id === 'save' && shown !== undefined) this.saveResult(shown);
    else if (id === 'open') {
      chooseFile((text) => this.openFile(text), (problem) => {
        this.notice.show(problem, true);
      });
    }
  }

  private setFormat(format: Format): void {
    this.cancelRun();
    this.format = format;
    this.notice.clear();
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
    this.countLabel.textContent = t('contest.count', { count: this.entries.length, min: LEAGUE_MIN, max: LEAGUE_MAX });
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
        const remove = createButton('garage-action', '×', t('contest.remove.title', { name: entrant.name }), () => this.setEntries(removeEntry(this.entries, index)));
        row.append(picture, name, origin, remove);
        return row;
      }),
    );
  }

  private add(robot: SavedRobot, origin: ContestOrigin): boolean {
    const added = addEntry(this.entries, { robot, origin });
    if (!added.ok) {
      this.notice.show(t('contest.full', { max: LEAGUE_MAX }), true);
      return false;
    }
    this.notice.show(t('contest.added', { name: robot.name }));
    this.setEntries(added.list);
    return true;
  }

  private setEntries(list: ContestEntry[]): void {
    this.cancelRun();
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
      this.notice.show(t('garage.couldNotImport', { problem: decoded.problem }), true);
      return false;
    }
    return this.add(decoded.shared.robot, 'code');
  }


  /** Plays the contest of the chosen format between the robots on the list, match by match, and shows its board. */
  private start(): void {
    this.cancelRun();
    this.notice.clear();
    const entrants = this.entrants();
    if (entrants.length < LEAGUE_MIN) {
      this.notice.show(t('contest.pickCount', { min: LEAGUE_MIN, max: LEAGUE_MAX, count: entrants.length }), true);
      return;
    }
    const robots = this.entries.map(({ robot }) => robot);
    const play: SteppedPlay<{ matches: LeagueMatch[]; standings: Standing[] } | { bracket: Bracket }> =
      this.format === 'league' ? leagueSteps(entrants, randomSeed()) : tournamentSteps(entrants, randomSeed());
    this.startButton.disabled = true;
    this.run = driveSteps(
      play,
      (at, count) => this.notice.show(t('contest.playing', { at, count })),
      (played) => {
        this.cancelRun();
        if (!played.ok) {
          this.notice.show(played.problems.join(' / '), true);
          return;
        }
        this.setBoard('bracket' in played ? { format: 'tournament', robots, bracket: played.bracket } : { format: 'league', robots, ...played }, null);
        this.leaveMatch();
        this.showFormat();
        this.showBoard();
      },
    );
  }

  /** Stops a contest being computed; its matches so far are thrown away. */
  private cancelRun(): void {
    this.run?.cancel();
    this.run = null;
    this.startButton.disabled = false;
    this.notice.clear();
  }

  /** Puts the board of the chosen format over the battle view. */
  private showBoard(): void {
    const shown = this.boards.get(this.format);
    if (shown === undefined) {
      this.board.hidden = true;
      return;
    }
    const header = createElement('div', 'board-header');
    const close = createButton('tool-button', t('contest.close'), t('contest.close.title'), () => {
      this.board.hidden = true;
    });
    const save = createButton('tool-button', t('contest.saveResult'), t('contest.saveResult.title'), () => this.saveResult(shown));
    const title = createElement('span', 'board-title', shown.title);
    const actions = createElement('span', 'board-actions');
    if (shown.opened !== null) {
      const when = new Date(shown.opened.savedAt);
      const saved = Number.isNaN(when.getTime()) ? '?' : when.toLocaleString();
      const otherRules = shown.opened.rules === RULES_VERSION ? '' : t('contest.otherRules', { rules: shown.opened.rules || t('share.unknown'), now: RULES_VERSION });
      title.append(createElement('span', 'board-note', `${t('contest.openedNote', { saved })}${otherRules}`));
      actions.append(createButton('tool-button', t('contest.useEntrants'), t('contest.useEntrants.title'), () => this.useEntrants(shown)));
    }
    if (shown.playedWith !== null && shown.playedWith !== this.listKey()) {
      title.append(createElement('span', 'board-note', t('contest.listChanged')));
    }
    actions.append(save, close);
    header.append(title, actions);
    this.board.replaceChildren(header, shown.content);
    this.board.hidden = false;
    this.fitBoard();
  }

  /** Has the browser save the board's contest as a file. */
  private saveResult(shown: ShownBoard): void {
    const { record } = shown;
    const date = new Date();
    const stamp = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    downloadText(fileName(`${t(`contest.format.${record.format}`)}-${stamp}`), contestFileText(record, date));
    this.notice.show(t('contest.resultSaved'));
  }

  /** A robot file adds its robot to the list; a result file shows its board. */
  private openFile(text: string): void {
    const read = readSharedFile(text);
    if (!read.ok) {
      this.notice.show(t('file.couldNotOpen', { problem: read.problem }), true);
      return;
    }
    this.openShared(read.file);
  }

  private openShared(file: SharedFile): void {
    if (file.kind === 'robot') {
      this.add(file.robot, 'file');
      return;
    }
    if (file.kind !== 'contest') {
      // Each kind of file has its own home: say where this one is opened.
      this.notice.show(t(file.kind === 'match' ? 'contest.matchFile' : file.kind === 'castle' ? 'contest.castleFile' : 'contest.teamFile'), true);
      return;
    }
    const { contest } = file;
    this.setBoard(contest, { savedAt: file.savedAt, rules: file.rules });
    this.format = contest.format;
    this.notice.show(contest.unknownArenas.length === 0 ? t('contest.resultOpened') : t('contest.unknownArenas', { arenas: contest.unknownArenas.join(', ') }));
    this.leaveMatch();
    this.showFormat();
    this.showBoard();
  }

  /** Keeps the board of a contest, played here or opened from a file (`opened`), as the board of its format. */
  private setBoard(contest: PlayedContest, opened: ShownBoard['opened']): void {
    const entrants = entrantsOf(contest.robots);
    const playedWith = opened === null ? this.listKey() : null;
    const play = (match: { first: number; second: number; arena: ArenaDefinition; seed: number }) =>
      this.watch(entrants, match.first, match.second, match.arena, match.seed);
    if (contest.format === 'league') {
      const { matches, standings } = contest;
      this.boards.set('league', {
        title: t('league.title', { count: entrants.length, matches: matches.length }),
        content: createLeagueBoard({ entrants, matches, standings }, play),
        record: recordLeague(contest.robots, matches, standings),
        opened,
        winner: entrants[standings[0].entrant].name,
        playedWith,
      });
    } else {
      const { bracket } = contest;
      const matches = bracket.rounds.flat().reduce((sum, tie) => sum + tie.matches.length, 0);
      this.boards.set('tournament', {
        title: t('tournament.title', { count: entrants.length, matches }),
        content: createTournamentBoard(entrants, bracket, play),
        record: recordTournament(contest.robots, bracket),
        opened,
        winner: entrants[bracket.champion].name,
        playedWith,
      });
    }
  }

  /** Puts the robots of an opened contest on the list, in place of the robots there. */
  private useEntrants(shown: ShownBoard): void {
    const robots = shown.record.robots.slice(0, LEAGUE_MAX);
    this.setEntries(robots.map((robot) => ({ robot: copyRobot(robot), origin: 'file' })));
    this.notice.show(t('contest.entrantsUsed', { count: robots.length }));
  }

  /** Plays a match of the contest in the battle view, putting the board away. */
  private watch(entrants: readonly Entrant[], first: number, second: number, arena: ArenaDefinition, seed: number): void {
    const prepared = prepareFight([entrants[first], entrants[second]], arena.arena, seed);
    if (!prepared.ok) {
      // A robot of a file made under other rules may no longer be a working program.
      this.notice.show(t('contest.cannotPlay', { problems: prepared.problems.join(' / ') }), true);
      return;
    }
    this.board.hidden = true;
    this.watched.watch(prepared.fight, this.setting.speed());
    this.watching.textContent = t('contest.watching', { format: t(`contest.format.${this.format}`), map: arena.name });
  }

  /** Makes a board wider than the battle view smaller, so that all of it shows; a board that fits is left as it is. */
  private fitBoard(): void {
    const content = this.board.querySelector<HTMLElement>('.tournament-board');
    if (content === null || this.board.hidden) return;
    content.style.zoom = '';
    const room = this.board.clientWidth - 32;
    const wide = content.offsetWidth;
    if (wide > room && room > 0) content.style.zoom = `${room / wide}`;
  }

  /** Called every frame while the screen is shown: the way back to the board shows while a match is watched. */
  update(): void {
    this.returnBar.hidden = this.watched.replay === null || !this.board.hidden || !this.boards.has(this.format);
  }

  /** The list of robots as it stands, to compare with the list a contest was played with. */
  private listKey(): string {
    return JSON.stringify(this.entries.map(({ robot }) => robot));
  }

  private leaveMatch(): void {
    this.watched.leave();
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
