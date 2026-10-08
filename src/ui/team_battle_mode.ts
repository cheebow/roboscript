import { castleFieldConfig, prepareCastleFight, robotIdOf } from '../arena/castle_match';
import { randomSeed } from '../arena/seed';
import { type CastleArenaDefinition, findCastleArena } from '../data/arenas';
import { MAX_TEAM_SIZE, TEAM_DEFAULT_LOADOUT, teamCostLimitFor, teamCostOf } from '../data/castle';
import { ROBOT_IDS } from '../data/match_defaults';
import { statsOf } from '../data/parts';
import { RULES_VERSION } from '../data/rules_version';
import { TEAM_TEMPLATES } from '../data/team_templates';
import { captureSnapshot } from '../debug/snapshot';
import { t } from '../i18n/messages';
import { type SavedTeam, copyTeam, sameTeam } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { decodeCastleMatch, encodeCastleMatch } from '../share/codec';
import { type SharedCastleMatchFile, acceptDrops, castleMatchFileText, downloadText, fileName, readSharedFile } from '../share/file';
import { shareLink } from '../share/link';
import { IDLE_BRAIN } from '../sim/ai_context';
import { Simulation } from '../sim/simulation';
import { paletteOf } from '../view/sprites';
import { createButton, createElement } from './dom';
import { describeError } from './format';
import { createImportRow, entrantOptions } from './lineup_parts';
import { createRobotPreview, drawRobotPreview } from './robot_preview';
import type { ArenaScene } from './watched_match';
import { WatchScreen, finalResult, prependResult, readLineup, resultLine, restorePicked, saveLineup } from './watch_screen';

/** What the team battle's watching needs to know of the rest of the app. */
export interface TeamWatchSetting {
  /** The castle arena chosen in the toolbar. */
  arena(): CastleArenaDefinition;
  /** Robots a side, as chosen in the toolbar. */
  teamSize(): number;
  /** The saved teams, read afresh. */
  garageTeams(): readonly SavedTeam[];
  /** The playback speed chosen under the battle view. */
  speed(): number;
  /** Makes the castle arena with the id the chosen one, in the toolbar as well. */
  chooseArena(id: string): void;
  /** Makes the given team size the chosen one, in the toolbar as well. */
  chooseTeamSize(size: number): void;
  /** Keeps the teams in the garage of teams and returns the names they are kept under. Throws when it cannot. */
  keepTeams(teams: readonly SavedTeam[]): string[];
  /** Where the line-up is kept; null when storage is unavailable. */
  storage: KeyValueStorage | null;
}

const LINEUP_KEY = 'roboscript/team_arena.json';
/** The teams the slots start with. */
const DEFAULT_PICKED = ['built-in:castle_split', 'built-in:castle_rush'];

/** A team that can be picked for a slot. */
interface TeamEntrant extends SavedTeam {
  id: string;
  origin: 'garage' | 'built-in';
}

/** A castle match that was fought, or is being shown: enough to fight it over again. */
interface FoughtCastleMatch {
  sides: [SavedTeam, SavedTeam];
  arena: CastleArenaDefinition;
  teamSize: number;
  seed: number;
}

interface SlotView {
  preview: HTMLCanvasElement;
  select: HTMLSelectElement;
  parts: HTMLElement;
  cost: HTMLElement;
  status: HTMLElement;
}

/**
 * The team battle's watching: two teams picked from the garage of teams and
 * the built-in ones fight a castle match, and the match is watched with its
 * commentary. No code is shown or edited here.
 */
export class TeamBattleMode extends WatchScreen {
  private entrants: TeamEntrant[] = [];
  private picked: string[] = [...DEFAULT_PICKED];
  private readonly slots: SlotView[];
  private readonly results: HTMLElement;
  private fights = 0;
  private unannounced: FoughtCastleMatch | null = null;
  /** The team names of the match being shown; null while there is none. */
  private watchingNames: [string, string] | null = null;
  private nextSeed = randomSeed();
  private idle: ArenaScene;

  constructor(
    lineup: HTMLElement,
    results: HTMLElement,
    private readonly setting: TeamWatchSetting,
  ) {
    super();
    this.slots = [0, 1].map((team) => this.createSlot(team));
    const slotElements = this.slots.map((slot, team) => this.slotElement(slot, team));
    const fight = createButton('tool-button', t('arena.fight'), t('arena.fight.title'), () => this.startFight());
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(fight);
    const importRow = createImportRow({
      importCode: (code) => this.importMatch(code),
      openFile: (text) => this.openMatchFile(text),
      problem: (problem) => this.notice.show(problem, true),
    });
    lineup.replaceChildren(...slotElements, buttons, importRow, this.notice.element);
    acceptDrops(lineup, (text) => this.openMatchFile(text), { onProblem: (problem) => this.notice.show(problem, true) });

    this.results = results;
    results.dataset.empty = t('arena.results.empty');
    this.readLineup();
    this.refresh();
    this.idle = this.captureIdle();
  }

  /** Reads the garage of teams again: teams saved or deleted since show up in, or go from, the line-up. */
  refresh(): void {
    this.entrants = [
      ...this.setting.garageTeams().map((team) => ({ ...copyTeam(team), id: `garage:${team.name}`, origin: 'garage' as const })),
      ...TEAM_TEMPLATES.map((template) => ({
        id: `built-in:${template.id}`,
        name: template.name,
        source: template.source,
        loadouts: Array.from({ length: MAX_TEAM_SIZE }, () => TEAM_DEFAULT_LOADOUT),
        origin: 'built-in' as const,
      })),
    ];
    this.picked = this.picked.map((id, index) => (this.entrants.some((entrant) => entrant.id === id) ? id : DEFAULT_PICKED[index]));
    this.slots.forEach((slot, team) => {
      slot.select.replaceChildren(...entrantOptions(this.entrants));
      slot.select.value = this.picked[team];
      this.showEntrant(team);
    });
    this.idle = this.captureIdle();
  }

  /** The chosen map or team size changed: the field shown while there is no match is the new one. */
  formChanged(): void {
    this.leaveMatch();
    this.refresh();
  }

  /** The picked teams where the next FIGHT would start them. */
  protected idleScene(): ArenaScene {
    return this.idle;
  }

  /** The line for the toolbar: which teams fight, and how the match stands. */
  message(): string {
    const status = this.watched.status();
    const names = this.watchingNames;
    if (status === null || names === null) return t('teamwatch.ready');
    return `${t('arena.vs', { first: names[0], second: names[1] })}   ${status}`;
  }

  /** Called every frame while the watching is shown. */
  update(): void {
    const { snapshot } = this.scene();
    const size = this.watchedSize();
    this.slots.forEach((slot, team) => {
      const machines = snapshot.robots.slice(team * size, (team + 1) * size);
      const alive = machines.filter((robot) => robot.alive).length;
      const castle = snapshot.bases[team] ?? '';
      const text = this.replay === null ? '' : t('teamwatch.status', { alive, size, castle });
      if (slot.status.textContent !== text) slot.status.textContent = text;
    });
    const result = this.replay?.snapshot.result ?? null;
    if (this.unannounced !== null && result !== null) this.announce();
  }

  /**
   * Plays the castle match in a share code, on its map, size and seed. Its
   * teams join the garage of teams, unless they are already there as they
   * are. True when it was played.
   */
  async importMatch(text: string): Promise<boolean> {
    const decoded = await decodeCastleMatch(text);
    if (!decoded.ok) {
      this.notice.show(t('arena.couldNotImport', { problem: decoded.problem }), true);
      return false;
    }
    const { rules, ...shared } = decoded.shared;
    return this.playShared(shared, rules);
  }

  /** Plays a shared castle match, keeping its teams that are new to the garage. True when it was played. */
  private playShared(shared: SharedCastleMatchFile, rules: string): boolean {
    const { teams, arenaId, teamSize, seed } = shared;
    const kept: string[] = [];
    let keepProblem: string | null = null;
    for (const team of teams) {
      if (this.entrants.some((entrant) => sameTeam(entrant, team))) continue;
      try {
        kept.push(...this.setting.keepTeams([team]));
      } catch (error) {
        keepProblem = describeError(error);
      }
    }
    this.refresh();
    const arena = findCastleArena(arenaId);
    this.setting.chooseArena(arena.id);
    // The toolbar follows the match: its size picker showing another number would belie what is playing.
    this.setting.chooseTeamSize(teamSize);
    const match: FoughtCastleMatch = { sides: [teams[0], teams[1]], arena, teamSize, seed };
    if (this.show(match)) this.unannounced = match;
    const keptText = keepProblem !== null ? t('arena.notKept', { reason: keepProblem }) : kept.length > 0 ? t('arena.keptAs', { names: kept.join(', ') }) : '';
    const unknownMap = arena.id === arenaId ? '' : t('arena.unknownMap', { map: arenaId, instead: arena.name });
    const otherRules = rules === RULES_VERSION ? '' : t('garage.otherRules', { rules: rules || t('share.unknown'), now: RULES_VERSION });
    this.notice.show(`${t('arena.received', { robots: teams.map((team) => team.name).join(t('arena.vsJoin')) })}${keptText}${unknownMap}${otherRules}`, keepProblem !== null);
    return true;
  }

  /** Plays the castle match of a match file, as a pasted code is played. */
  private openMatchFile(text: string): void {
    const read = readSharedFile(text);
    if (!read.ok || read.file.kind !== 'castle') {
      this.notice.show(t('file.couldNotOpen', { problem: read.ok ? t('share.notACastleMatch') : read.problem }), true);
      return;
    }
    this.playShared(read.file.match, read.file.rules);
  }

  private createSlot(team: number): SlotView {
    const select = createElement('select', 'lineup-select');
    select.setAttribute('aria-label', t('team.name', { team: ROBOT_IDS[team] }));
    select.addEventListener('change', () => {
      this.notice.clear();
      this.picked[team] = select.value;
      this.saveLineup();
      this.showEntrant(team);
      this.leaveMatch();
      this.idle = this.captureIdle();
    });
    return {
      preview: createRobotPreview(),
      select,
      parts: createElement('div', 'lineup-parts'),
      cost: createElement('span', 'lineup-cost'),
      status: createElement('span', 'lineup-status'),
    };
  }

  private slotElement(slot: SlotView, team: number): HTMLElement {
    const details = createElement('div', 'lineup-details');
    const choice = createElement('div', 'lineup-choice');
    choice.append(createElement('span', 'field-name', t('team.name', { team: ROBOT_IDS[team] })), slot.select);
    const figures = createElement('div', 'lineup-figures');
    figures.append(slot.cost, slot.status);
    details.append(choice, slot.parts, figures);
    const picture = createElement('div', 'lineup-picture');
    picture.append(slot.preview);
    const element = createElement('div', 'lineup-slot');
    element.append(picture, details);
    return element;
  }

  /** Shows the first machine's picture and the team's cost for the slot. */
  private showEntrant(team: number): void {
    const entrant = this.entrantIn(team);
    const slot = this.slots[team];
    const size = this.setting.teamSize();
    const loadouts = this.sideLoadouts(entrant, size);
    drawRobotPreview(slot.preview, loadouts[0], paletteOf(team * size, this.teamsNow()));
    slot.parts.textContent = t('teamwatch.machines', { count: size });
    const cost = teamCostOf(loadouts, size);
    const limit = teamCostLimitFor(size);
    slot.cost.textContent = t('arena.cost', { cost, limit });
    slot.cost.classList.toggle('over-limit', cost > limit);
  }

  private entrantIn(team: number): TeamEntrant {
    const entrant = this.entrants.find((candidate) => candidate.id === this.picked[team]);
    if (entrant === undefined) throw new Error(`No team "${this.picked[team]}"`);
    return entrant;
  }

  /** The machines a side fields: the saved loadouts, padded with the default kit up to the match's size. */
  private sideLoadouts(side: SavedTeam, size: number): SavedTeam['loadouts'] {
    return Array.from({ length: size }, (_, machine) => side.loadouts[machine] ?? TEAM_DEFAULT_LOADOUT);
  }

  private sideOf(entrant: SavedTeam, size: number): SavedTeam {
    return { name: entrant.name, source: entrant.source, loadouts: [...this.sideLoadouts(entrant, size)] };
  }

  private leaveMatch(): void {
    if (this.unannounced !== null) this.announce();
    this.watched.leave();
    this.watchingNames = null;
  }

  private captureIdle(): ArenaScene {
    const size = this.setting.teamSize();
    const definition = this.setting.arena();
    const sides = [this.entrantIn(0), this.entrantIn(1)].map((entrant) => this.sideOf(entrant, size));
    const loadouts = sides.flatMap((side) => side.loadouts);
    const stats = loadouts.map((loadout) => statsOf(loadout));
    const field = castleFieldConfig(definition, size, this.nextSeed);
    const { arena, teams = [], bases = [] } = field;
    const simulation = new Simulation({
      ...field,
      robots: stats.map((robotStats, index) => ({
        id: robotIdOf(index < size ? sides[0].name : sides[1].name, size, (index % size) + 1),
        brain: IDLE_BRAIN,
        stats: robotStats,
      })),
    });
    return { snapshot: captureSnapshot(simulation), arena, stats, loadouts, teams: [...teams], bases: [...bases], teamNames: sides.map((side) => side.name) };
  }

  private startFight(): void {
    this.notice.clear();
    const size = this.setting.teamSize();
    const match: FoughtCastleMatch = {
      sides: [this.sideOf(this.entrantIn(0), size), this.sideOf(this.entrantIn(1), size)],
      arena: this.setting.arena(),
      teamSize: size,
      seed: this.nextSeed,
    };
    this.nextSeed = randomSeed();
    this.idle = this.captureIdle();
    if (this.show(match)) this.unannounced = match;
  }

  /** Records the castle match and plays it from the start. False, with the reasons on the list, when it cannot be fought. */
  private show(match: FoughtCastleMatch): boolean {
    if (this.unannounced !== null) this.announce();
    const prepared = prepareCastleFight([match.sides[0], match.sides[1]], match.arena, match.teamSize, match.seed);
    if (!prepared.ok) {
      this.addResult(createElement('div', 'result problem', prepared.problems.join('\n')));
      return false;
    }
    this.watchingNames = this.teamNamesOf(match.sides);
    this.watched.watch(prepared.fight, this.setting.speed(), this.watchingNames);
    return true;
  }

  /** Puts the result of the match being shown on the list. Pressing the entry shows the match again. */
  private announce(): void {
    const { unannounced: match } = this;
    const { replay } = this.watched;
    this.unannounced = null;
    if (match === null || replay === null) return;
    const { recording } = replay;
    const result = finalResult(recording);
    if (result === null) return;

    this.fights++;
    const names = this.teamNamesOf(match.sides);
    const outcome =
      result.winnerTeam === null || result.winnerTeam === undefined
        ? t('arena.drew', { first: names[0], second: names[1] })
        : t('arena.beat', { winner: names[result.winnerTeam], loser: names[1 - result.winnerTeam] });
    const text = resultLine(this.fights, outcome, result, recording, match.arena.name);
    const entry = createButton('result fought', text, t('arena.showAgain.title'), () => this.show(match));
    this.addResult(this.shareRow(entry, match));
  }

  /** A result's entry with the match's share code a press away. */
  private shareRow(entry: HTMLElement, match: FoughtCastleMatch): HTMLElement {
    return this.shareableRow(entry, async () => {
      const shared: SharedCastleMatchFile = {
        teams: [copyTeam(match.sides[0]), copyTeam(match.sides[1])],
        arenaId: match.arena.id,
        teamSize: match.teamSize,
        seed: match.seed,
      };
      const code = await encodeCastleMatch(shared);
      const names = shared.teams.map((team) => team.name).join(t('arena.vsJoin'));
      return {
        code,
        link: { url: shareLink('castle', code, window.location.href), title: t('share.matchTitle', { names }), text: t('share.matchText', { names }) },
        saveFile: () => downloadText(fileName(shared.teams.map((team) => team.name).join('-vs-')), castleMatchFileText(shared)),
      };
    });
  }

  private addResult(entry: HTMLElement): void {
    prependResult(this.results, entry);
  }

  private watchedSize(): number {
    const names = this.fightNames();
    return names.length > 0 ? names.length / 2 : this.setting.teamSize();
  }

  private teamNamesOf(sides: readonly [SavedTeam, SavedTeam]): [string, string] {
    // Two teams of one name are told apart, as the arena tells robots apart.
    return sides[0].name === sides[1].name ? [sides[0].name, `${sides[1].name} (2)`] : [sides[0].name, sides[1].name];
  }

  private teamsNow(): number[] {
    const size = this.setting.teamSize();
    return Array.from({ length: size * 2 }, (_, index) => Math.floor(index / size));
  }

  private readLineup(): void {
    this.picked = restorePicked(this.picked, readLineup(this.setting.storage, LINEUP_KEY)?.picked);
  }

  private saveLineup(): void {
    saveLineup(this.setting.storage, LINEUP_KEY, { picked: this.picked });
  }
}

