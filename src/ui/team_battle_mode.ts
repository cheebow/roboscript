import { prepareCastleFight, robotIdOf } from '../arena/castle_match';
import type { CommentaryLine } from '../arena/commentary';
import { randomSeed } from '../arena/seed';
import { type CastleArenaDefinition, findCastleArena } from '../data/arenas';
import { castleSpawnsFor } from '../data/arenas/castle_common';
import { TEAM_DEFAULT_LOADOUT, teamCostLimitFor } from '../data/castle';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { costOf, statsOf } from '../data/parts';
import { RULES_VERSION } from '../data/rules_version';
import { TEAM_TEMPLATES } from '../data/team_templates';
import type { ReplayManager } from '../debug/replay_manager';
import { captureSnapshot } from '../debug/snapshot';
import { type MessageKey, t } from '../i18n/messages';
import { type SavedTeam, copyTeam } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { decodeCastleMatch, encodeCastleMatch } from '../share/codec';
import { type SharedCastleMatchFile, acceptDrops, castleMatchFileText, chooseFile, downloadText, fileName, readSharedFile } from '../share/file';
import { shareLink } from '../share/link';
import { createIdleAction } from '../sim/ai_context';
import { Simulation } from '../sim/simulation';
import { formatReason } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import { createButton, createElement } from './dom';
import { describeError, formatSeconds } from './format';
import { Notice } from './notice';
import { createRobotPreview, drawRobotPreview } from './robot_preview';
import { createShareBox } from './share_box';
import { type ArenaScene, WatchedMatch } from './watched_match';

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

const GROUPS: readonly { origin: TeamEntrant['origin']; label: MessageKey }[] = [
  { origin: 'garage', label: 'arena.group.garage' },
  { origin: 'built-in', label: 'arena.group.builtIn' },
];

/**
 * The team battle's watching: two teams picked from the garage of teams and
 * the built-in ones fight a castle match, and the match is watched with its
 * commentary. No code is shown or edited here.
 */
export class TeamBattleMode {
  private readonly watched = new WatchedMatch();
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
  private readonly notice = new Notice();

  constructor(
    lineup: HTMLElement,
    results: HTMLElement,
    private readonly setting: TeamWatchSetting,
  ) {
    this.slots = [0, 1].map((team) => this.createSlot(team));
    const slotElements = this.slots.map((slot, team) => this.slotElement(slot, team));
    const fight = createButton('tool-button', t('arena.fight'), t('arena.fight.title'), () => this.startFight());
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(fight);
    const importInput = createElement('input', 'garage-name-input');
    importInput.type = 'text';
    importInput.placeholder = t('arena.import.placeholder');
    importInput.setAttribute('aria-label', t('arena.import.placeholder'));
    importInput.spellcheck = false;
    const importButton = createButton('tool-button', t('arena.import'), t('arena.import.title'), () => {
      void this.importMatch(importInput.value).then((played) => {
        if (played) importInput.value = '';
      });
    });
    importInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') importButton.click();
    });
    const openFile = createButton('tool-button', t('arena.openFile'), t('arena.openFile.title'), () =>
      chooseFile(
        (text) => this.openMatchFile(text),
        (problem) => this.notice.show(problem, true),
      ),
    );
    const importRow = createElement('div', 'lineup-import');
    importRow.append(importInput, importButton, openFile);
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
        loadouts: [TEAM_DEFAULT_LOADOUT, TEAM_DEFAULT_LOADOUT, TEAM_DEFAULT_LOADOUT],
        origin: 'built-in' as const,
      })),
    ];
    this.picked = this.picked.map((id, index) => (this.entrants.some((entrant) => entrant.id === id) ? id : DEFAULT_PICKED[index]));
    this.slots.forEach((slot, team) => {
      slot.select.replaceChildren(
        ...GROUPS.map(({ origin, label }) => {
          const group = document.createElement('optgroup');
          group.label = t(label);
          group.append(...this.entrants.filter((entrant) => entrant.origin === origin).map((entrant) => new Option(entrant.name, entrant.id)));
          return group;
        }).filter((group) => group.childElementCount > 0),
      );
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

  scene(): ArenaScene {
    return this.watched.scene(this.idle);
  }

  get replay(): ReplayManager | null {
    return this.watched.replay;
  }

  coverRoutes(): readonly boolean[] {
    return this.watched.coverRoutes();
  }

  commentary(): readonly CommentaryLine[] {
    return this.watched.commentary;
  }

  fightNames(): readonly string[] {
    return this.watched.fight?.names ?? [];
  }

  /** The line for the toolbar: which teams fight, and how the match stands. */
  message(): string {
    const status = this.watched.status();
    const names = this.watchingNames;
    if (status === null || names === null) return t('arena.ready');
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
    select.setAttribute('aria-label', t('arena.robot.label', { number: team + 1 }));
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
    choice.append(createElement('span', 'field-name', t('team.name', { team: team === 0 ? 'ALPHA' : 'BRAVO' })), slot.select);
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
    const cost = loadouts.reduce((sum, loadout) => sum + costOf(loadout), 0);
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
    const arena = { ...definition.arena, spawns: castleSpawnsFor(size) };
    const teams = loadouts.map((_, index) => Math.floor(index / size));
    const bases = definition.basesFor(size);
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.nextSeed,
      robots: stats.map((robotStats, index) => ({
        id: robotIdOf(index < size ? sides[0].name : sides[1].name, size, (index % size) + 1),
        brain: { decide: createIdleAction },
        stats: robotStats,
      })),
      teams,
      bases,
    });
    return { snapshot: captureSnapshot(simulation), arena, stats, loadouts, teams, bases, teamNames: sides.map((side) => side.name) };
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
    const result = recording.snapshots[recording.snapshots.length - 1].result;
    if (result === null) return;

    this.fights++;
    const names = this.teamNamesOf(match.sides);
    const outcome =
      result.winnerTeam === null || result.winnerTeam === undefined
        ? t('arena.drew', { first: names[0], second: names[1] })
        : t('arena.beat', { winner: names[result.winnerTeam], loser: names[1 - result.winnerTeam] });
    const seconds = (recording.snapshots.length - 1) / recording.tickRate;
    const text = t('arena.result', {
      number: this.fights,
      outcome,
      reason: formatReason(result.reason),
      seconds: formatSeconds(seconds),
      map: match.arena.name,
    });
    const entry = createButton('result fought', text, t('arena.showAgain.title'), () => this.show(match));
    this.addResult(this.shareableRow(entry, match));
  }

  /** A result's entry with a share button beside it; pressing the button shows the match's share code under the row. */
  private shareableRow(entry: HTMLElement, match: FoughtCastleMatch): HTMLElement {
    const row = createElement('div', 'result-row');
    const share = createButton('garage-action', t('share.button'), t('arena.share.title'));
    let box: HTMLElement | null = null;
    let making = false;
    share.addEventListener('click', () => {
      if (box !== null) {
        box.remove();
        box = null;
        return;
      }
      if (making) return;
      making = true;
      const shared: SharedCastleMatchFile = {
        teams: [copyTeam(match.sides[0]), copyTeam(match.sides[1])],
        arenaId: match.arena.id,
        teamSize: match.teamSize,
        seed: match.seed,
      };
      encodeCastleMatch(shared)
        .then((code) => {
          const saveFile = createButton('tool-button share-action', t('garage.saveFile'), t('arena.saveFile.title'), () =>
            downloadText(fileName(shared.teams.map((team) => team.name).join('-vs-')), castleMatchFileText(shared)),
          );
          const names = shared.teams.map((team) => team.name).join(t('arena.vsJoin'));
          const link = { url: shareLink('castle', code, window.location.href), title: t('share.matchTitle', { names }), text: t('share.matchText', { names }) };
          box = createShareBox(code, 'garage-share result-share', [saveFile], link);
          row.after(box);
        })
        .catch(() => {
          this.notice.show(t('arena.couldNotShare'), true);
        })
        .finally(() => {
          making = false;
        });
    });
    const line = createElement('div', 'result-line');
    line.append(entry, share);
    row.append(line);
    return row;
  }

  private addResult(entry: HTMLElement): void {
    this.results.prepend(entry);
    this.results.scrollTop = 0;
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
    try {
      const value: unknown = JSON.parse(this.setting.storage?.getItem(LINEUP_KEY) ?? 'null');
      if (typeof value !== 'object' || value === null) return;
      const { picked } = value as Record<string, unknown>;
      if (Array.isArray(picked)) {
        this.picked = this.picked.map((id, index) => (typeof picked[index] === 'string' ? (picked[index] as string) : id));
      }
    } catch {
      // Nothing usable kept: the line-up starts as it always did.
    }
  }

  private saveLineup(): void {
    try {
      this.setting.storage?.setItem(LINEUP_KEY, JSON.stringify({ version: 1, picked: this.picked }));
    } catch {
      // Storage may be full or blocked: the line-up is then kept until the page is left.
    }
  }
}

/** Whether the entrant is the team: the same name, program, and machines' parts. */
function sameTeam(entrant: SavedTeam, team: SavedTeam): boolean {
  if (entrant.name !== team.name || entrant.source !== team.source || entrant.loadouts.length !== team.loadouts.length) return false;
  return entrant.loadouts.every((loadout, index) => JSON.stringify(loadout) === JSON.stringify(team.loadouts[index]));
}
