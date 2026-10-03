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
import { decodeRobot } from '../share/codec';
import { Simulation } from '../sim/simulation';
import { formatResult } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import type { ArenaScene } from './arena_mode';
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
  storage: KeyValueStorage | null;
}

type Format = 'league' | 'tournament';
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
  /** The board of the last contest of each format: its title and its picture. */
  private readonly boards = new Map<Format, { title: string; content: HTMLElement }>();
  private note: string | null = null;

  private readonly formatButtons: HTMLButtonElement[];
  private readonly countLabel = createElement('span', 'contest-count');
  private readonly list = createElement('div', 'contest-entries');
  private readonly codeInput: HTMLInputElement;
  private readonly builtInSelect = createElement('select', 'contest-add-select');
  private readonly garageSelect = createElement('select', 'contest-add-select');
  private readonly startButton: HTMLButtonElement;
  private readonly boardButton: HTMLButtonElement;

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

    this.codeInput = createElement('input', 'garage-name-input');
    this.codeInput.type = 'text';
    this.codeInput.placeholder = t('contest.code.placeholder');
    this.codeInput.spellcheck = false;
    const addCode = this.button(t('contest.add'), t('contest.code.title'), () => void this.addFromCode());
    this.codeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addCode.click();
    });
    const codeRow = createElement('div', 'lineup-import');
    codeRow.append(this.codeInput, addCode);

    this.builtInSelect.addEventListener('change', () => this.addFromSelect(this.builtInSelect, 'built-in'));
    this.garageSelect.addEventListener('change', () => this.addFromSelect(this.garageSelect, 'garage'));
    const selects = createElement('div', 'contest-selects');
    selects.append(this.builtInSelect, this.garageSelect);

    this.startButton = this.button('', '', () => this.start());
    this.boardButton = this.button(t('contest.board'), t('contest.board.title'), () => this.showBoard());
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(this.startButton, this.boardButton);

    panel.replaceChildren(formats, heading, this.list, codeRow, selects, buttons);
    this.refresh();
  }

  /** Reads the garage again and shows the list, the format and what can be done. */
  refresh(): void {
    this.fillSelect(this.builtInSelect, t('contest.addBuiltIn'), builtInEntrants().map((entrant) => entrant.name));
    this.fillSelect(this.garageSelect, t('contest.addGarage'), this.setting.garage().map((robot) => robot.name));
    this.garageSelect.disabled = this.setting.garage().length === 0;
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
    const status = result !== null ? `${formatResult(result)} (${result.reason})` : replay.playing ? t('arena.playing') : t('arena.paused');
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

  private fillSelect(select: HTMLSelectElement, prompt: string, names: readonly string[]): void {
    const first = new Option(prompt, '');
    first.disabled = true;
    select.replaceChildren(first, ...names.map((name, index) => new Option(name, `${index}`)));
    select.value = '';
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
    this.boardButton.disabled = !this.boards.has(this.format);
  }

  /** The robots on the list as they fight: robots of the same name numbered, "Striker (2)". */
  private entrants(): Entrant[] {
    const names = fightNames(this.entries.map(({ robot }) => ({ id: '', name: robot.name, origin: 'garage', loadout: robot.loadout, source: robot.source })));
    return this.entries.map(({ robot }, index) => ({
      id: `contest:${index}`,
      name: names[index],
      origin: 'garage',
      loadout: robot.loadout,
      source: robot.source,
    }));
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

  private add(robot: SavedRobot, origin: ContestOrigin): void {
    const added = addEntry(this.entries, { robot, origin });
    if (!added.ok) {
      this.note = t('contest.full', { max: LEAGUE_MAX });
      return;
    }
    this.note = t('contest.added', { name: robot.name });
    this.setEntries(added.list);
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

  private async addFromCode(): Promise<void> {
    const decoded = await decodeRobot(this.codeInput.value);
    if (!decoded.ok) {
      this.note = t('garage.couldNotImport', { problem: decoded.problem });
      return;
    }
    this.codeInput.value = '';
    this.add(decoded.shared.robot, 'code');
  }

  private addFromSelect(select: HTMLSelectElement, origin: 'built-in' | 'garage'): void {
    const index = Number(select.value);
    select.value = '';
    if (origin === 'built-in') {
      const entrant = builtInEntrants()[index];
      if (entrant !== undefined) this.add({ name: entrant.name, source: entrant.source, loadout: entrant.loadout }, origin);
    } else {
      const robot = this.setting.garage()[index];
      if (robot !== undefined) this.add(robot, origin);
    }
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
      const content = createLeagueBoard({ entrants, matches, standings }, (match) => play(match.first, match.second, match.arena, match.seed));
      this.boards.set('league', { title: t('league.title', { count: entrants.length, matches: matches.length }), content });
    } else {
      const played = playTournament(entrants, randomSeed());
      if (!played.ok) {
        this.note = played.problems.join(' / ');
        return;
      }
      const { bracket } = played;
      const content = createTournamentBoard(entrants, bracket, (match) => play(match.first, match.second, match.arena, match.seed));
      const matches = bracket.rounds.flat().reduce((sum, tie) => sum + tie.matches.length, 0);
      this.boards.set('tournament', { title: t('tournament.title', { count: entrants.length, matches }), content });
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
    header.append(createElement('span', 'board-title', shown.title), close);
    this.board.replaceChildren(header, shown.content);
    this.board.hidden = false;
  }

  /** Plays a match of the contest in the battle view, putting the board away. */
  private watch(entrants: readonly Entrant[], first: number, second: number, arena: ArenaDefinition, seed: number): void {
    const prepared = prepareFight([entrants[first], entrants[second]], arena.arena, seed);
    if (!prepared.ok) return;
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

