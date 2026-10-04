import {
  type Entrant,
  builtInEntrants,
  fightNames,
  garageEntrants,
  inOrder,
  MAX_ENTRANTS,
  arenaFor,
  playArenaSeries,
  playRoyaleSeries,
  prepareFight,
} from '../arena/match';
import { type MessageKey, t } from '../i18n/messages';
import { randomSeed } from '../arena/seed';
import { ARENAS, type ArenaDefinition, findArena } from '../data/arenas';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { COST_LIMIT, SLOTS, costOf, partIn, statsOf } from '../data/parts';
import type { ReplayManager } from '../debug/replay_manager';
import { captureSnapshot } from '../debug/snapshot';
import { type SavedRobot, copyRobot } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { RULES_VERSION } from '../data/rules_version';
import { decodeMatch, encodeMatch } from '../share/codec';
import { type SharedMatch, acceptDrops, chooseFile, downloadText, fileName, matchFileText, readSharedFile } from '../share/file';
import { createIdleAction } from '../sim/ai_context';
import type { MatchResult } from '../sim/simulation';
import { Simulation } from '../sim/simulation';
import { formatReason } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import { createButton, createElement } from './dom';
import { Notice } from './notice';
import { createShareBox } from './share_box';
import { describeError, formatSeconds } from './format';
import { createRobotPreview, drawRobotPreview } from './robot_preview';
import { type ArenaScene, WatchedMatch } from './watched_match';
import type { CommentaryLine } from '../arena/commentary';

/** What the arena mode needs to know of the rest of the app. */
export interface ArenaSetting {
  /** The arena chosen in the toolbar. */
  arena(): ArenaDefinition;
  /** The saved robots, read afresh. */
  garage(): readonly SavedRobot[];
  /** The playback speed chosen under the battle view. */
  speed(): number;
  /** Makes the arena with the id the chosen one, in the toolbar as well. */
  chooseArena(id: string): void;
  /** Keeps the robots in the garage and returns the names they are kept under. Throws when it cannot. */
  keepRobots(robots: readonly SavedRobot[]): string[];
  /** Where the line-up is kept; null when storage is unavailable. */
  storage: KeyValueStorage | null;
}

const LINEUP_KEY = 'roboscript/arena.json';

/** What the battle view shows of the arena mode. */

/** A match that was fought, or is being shown: enough to fight it over again. */
interface FoughtMatch {
  entrants: Entrant[];
  arena: ArenaDefinition;
  seed: number;
}

/** How many robots a match can take: a duel, or a battle royale of three or four. */
const COUNTS = [2, 3, 4] as const;
/** The matches of one series. */
const SERIES_MATCHES = 20;
/** The entrants the slots start with: the first two are the pair the program screen starts with. */
const DEFAULT_ENTRANT_IDS = ['built-in:sample', 'built-in:dumb_bot', 'built-in:strafe_bot', 'built-in:sentry_bot'];
const GROUPS: readonly { origin: Entrant['origin']; label: MessageKey }[] = [
  { origin: 'garage', label: 'arena.group.garage' },
  { origin: 'built-in', label: 'arena.group.builtIn' },
];
const SHARE_LABEL = '⇪';

interface SlotView {
  preview: HTMLCanvasElement;
  select: HTMLSelectElement;
  parts: HTMLElement;
  cost: HTMLElement;
  /** HP and ammo in the match being shown. */
  status: HTMLElement;
  /** The robot's place, on its picture, once the match being shown is over. */
  badge: HTMLElement;
}

/**
 * The arena mode: two to four robots picked from the garage and the built-in
 * ones fight, and the match is watched. No code is shown or edited here. Keeps the
 * line-up, the match being shown and the list of results.
 */
export class ArenaMode {
  /** The match being shown; none until the first FIGHT. */
  private readonly watched = new WatchedMatch();

  private entrants: Entrant[] = [];
  /** The id of the entrant in each slot. */
  private picked: string[] = [...DEFAULT_ENTRANT_IDS];
  private readonly slots: SlotView[];
  private readonly slotElements: HTMLElement[];
  /** How many of the slots take part: two for a duel, three or four for a battle royale. */
  private count = 2;
  private readonly countButtons: HTMLButtonElement[];
  private readonly seriesButton: HTMLButtonElement;
  private readonly results: HTMLElement;
  private fights = 0;
  /** A match whose result goes on the list once it has been watched to its end. */
  private unannounced: FoughtMatch | null = null;
  /** The seed of the next FIGHT, drawn ahead so that the robots wait where that match will start. */
  private nextSeed = randomSeed();
  /** The picked robots where the next FIGHT will start them, shown while there is no match. */
  private idle: ArenaScene;
  /** What the last import or share did, or why it could not: under the line-up's buttons. */
  private readonly notice = new Notice();

  constructor(
    lineup: HTMLElement,
    results: HTMLElement,
    private readonly setting: ArenaSetting,
  ) {
    this.slots = Array.from({ length: MAX_ENTRANTS }, (_, index) => this.createSlot(index));
    this.slotElements = this.slots.map((slot, index) => this.slotElement(slot, index));
    const countRow = createElement('div', 'lineup-count');
    countRow.append(createElement('span', 'field-name', t('arena.count')));
    this.countButtons = COUNTS.map((count) => {
      const button = createButton('tool-button', `${count}`, t('arena.count.title', { count }), () => this.setCount(count));
      countRow.append(button);
      return button;
    });
    const fight = createButton('tool-button', t('arena.fight'), t('arena.fight.title'), () => this.startFight());
    this.seriesButton = createButton('tool-button', 
      t('arena.series', { count: SERIES_MATCHES }),
      t('arena.series.title', { count: SERIES_MATCHES }),
      () => this.playSeries(),
    );
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(fight, this.seriesButton);
    const importInput = createElement('input', 'garage-name-input');
    importInput.type = 'text';
    importInput.placeholder = t('arena.import.placeholder');
    importInput.setAttribute('aria-label', t('arena.import.placeholder'));
    importInput.spellcheck = false;
    const importButton = createButton('tool-button', t('arena.import'), t('arena.import.title'), () => {
      void this.importMatch(importInput.value).then((played) => {
        // Kept when it could not be played, to be put right.
        if (played) importInput.value = '';
      });
    });
    importInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') importButton.click();
    });
    const openFile = createButton('tool-button', t('arena.openFile'), t('arena.openFile.title'), () =>
      chooseFile((text) => this.openMatchFile(text), (problem) => this.notice.show(problem, true)),
    );
    const importRow = createElement('div', 'lineup-import');
    importRow.append(importInput, importButton, openFile);
    lineup.replaceChildren(countRow, ...this.slotElements, buttons, importRow, this.notice.element);
    acceptDrops(lineup, (text) => this.openMatchFile(text), { onProblem: (problem) => this.notice.show(problem, true) });

    this.results = results;
    results.dataset.empty = t('arena.results.empty');
    this.readLineup();
    this.refresh();
    this.idle = this.captureIdle();
    this.showCount();
  }

  /** Changes how many robots the next match takes. Leaves the match being shown. */
  private setCount(count: number): void {
    if (count === this.count) return;
    this.notice.clear();
    this.count = count;
    this.leaveMatch();
    this.idle = this.captureIdle();
    this.showCount();
    this.saveLineup();
  }

  /** The line-up kept from before: how many robots, and which in each slot. Robots no longer there are put right by refresh. */
  private readLineup(): void {
    try {
      const value: unknown = JSON.parse(this.setting.storage?.getItem(LINEUP_KEY) ?? 'null');
      if (typeof value !== 'object' || value === null) return;
      const { count, picked } = value as Record<string, unknown>;
      if ((COUNTS as readonly number[]).includes(count as number)) this.count = count as number;
      if (Array.isArray(picked)) {
        this.picked = this.picked.map((id, index) => (typeof picked[index] === 'string' ? (picked[index] as string) : id));
      }
    } catch {
      // Nothing usable kept: the line-up starts as it always did.
    }
  }

  private saveLineup(): void {
    try {
      this.setting.storage?.setItem(LINEUP_KEY, JSON.stringify({ version: 1, count: this.count, picked: this.picked }));
    } catch {
      // Storage may be full or blocked: the line-up is then kept until the page is left.
    }
  }

  /** Shows the slots that take part, and what only a duel can do. */
  private showCount(): void {
    this.slotElements.forEach((element, index) => {
      element.hidden = index >= this.count;
    });
    this.countButtons.forEach((button, index) => button.classList.toggle('selected', COUNTS[index] === this.count));
    this.seriesButton.title = t(this.count === 2 ? 'arena.series.title' : 'arena.royaleSeries.title', { count: SERIES_MATCHES });
  }

  /** Reads the garage again: robots saved or deleted since show up in, or go from, the line-up. */
  refresh(): void {
    this.entrants = [...garageEntrants(this.setting.garage()), ...builtInEntrants()];
    this.picked = this.picked.map((id, index) =>
      this.entrants.some((entrant) => entrant.id === id) ? id : DEFAULT_ENTRANT_IDS[index],
    );
    this.slots.forEach((slot, index) => {
      slot.select.replaceChildren(
        ...GROUPS.map(({ origin, label }) => {
          const group = document.createElement('optgroup');
          group.label = t(label);
          const options = this.entrants.filter((entrant) => entrant.origin === origin);
          group.append(...options.map((entrant) => new Option(entrant.name, entrant.id)));
          return group;
        }).filter((group) => group.childElementCount > 0),
      );
      slot.select.value = this.picked[index];
      this.showEntrant(index);
    });
    this.idle = this.captureIdle();
  }

  /** The chosen arena changed: the starting positions shown while there is no match are those of the new one. */
  arenaChanged(): void {
    this.idle = this.captureIdle();
  }

  /** What to draw: the match being shown, or the picked robots where they would start. */
  scene(): ArenaScene {
    return this.watched.scene(this.idle);
  }

  /** The replay of the match being shown; null until the first FIGHT. */
  get replay(): ReplayManager | null {
    return this.watched.replay;
  }

  /** Per robot of the match being shown, whether its program has to do with cover: the way there is drawn for those. */
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

  /** The line for the toolbar: who fights whom, and how it stands. */
  message(): string {
    const { fight } = this.watched;
    const status = this.watched.status();
    if (status === null || fight === null) return t('arena.ready');
    const lineup = fight.names.length === 2 ? t('arena.vs', { first: fight.names[0], second: fight.names[1] }) : fight.names.join(' / ');
    return `${lineup}   ${status}`;
  }

  /**
   * Plays the match in a share code, in its arena and with its seed. Its
   * robots join the line-up: a built-in robot or one already in the garage as
   * it is, any other kept in the garage first. Without a garage the match is
   * still played. True when it was played.
   */
  private async importMatch(text: string): Promise<boolean> {
    const decoded = await decodeMatch(text);
    if (!decoded.ok) {
      this.notice.show(t('arena.couldNotImport', { problem: decoded.problem }), true);
      return false;
    }
    return this.playShared(decoded.shared, decoded.shared.rules);
  }

  /** Plays the match of a match file, as a pasted match code is played. */
  private openMatchFile(text: string): void {
    const read = readSharedFile(text);
    if (!read.ok || read.file.kind !== 'match') {
      this.notice.show(t('file.couldNotOpen', { problem: read.ok ? t('file.notAMatch') : read.problem }), true);
      return;
    }
    this.playShared(read.file.match, read.file.rules);
  }

  /** Plays a shared match, keeping its robots that are new to the garage. True when it was played. */
  private playShared(shared: SharedMatch, rules: string): boolean {
    const { robots, arenaId, seed } = shared;
    const ids: string[] = [];
    const kept: string[] = [];
    let keepProblem: string | null = null;
    for (const robot of robots) {
      const same = this.entrants.find((entrant) => sameRobot(entrant, robot));
      if (same !== undefined) {
        ids.push(same.id);
        continue;
      }
      try {
        const [name] = this.setting.keepRobots([robot]);
        ids.push(`garage:${name}`);
        kept.push(name);
      } catch (error) {
        keepProblem = describeError(error);
      }
    }
    this.refresh();
    const known = ARENAS.some((arena) => arena.id === arenaId);
    const arena = findArena(arenaId);
    this.setting.chooseArena(arena.id);
    let entrants: Entrant[];
    if (keepProblem === null) {
      this.picked = [...ids, ...this.picked.slice(ids.length)];
      this.count = robots.length;
      this.saveLineup();
      this.showCount();
      this.slots.forEach((slot, index) => {
        slot.select.value = this.picked[index];
        this.showEntrant(index);
      });
      entrants = this.pickedEntrants();
    } else {
      // Not in the line-up, which only holds robots that can be picked again: played as they came.
      entrants = robots.map((robot, index) => ({ id: `code:${index}`, name: robot.name, origin: 'garage', loadout: robot.loadout, source: robot.source }));
    }
    const match: FoughtMatch = { entrants, arena, seed };
    if (this.show(match)) this.unannounced = match;
    const keptText = keepProblem !== null ? t('arena.notKept', { reason: keepProblem }) : kept.length > 0 ? t('arena.keptAs', { names: kept.join(', ') }) : '';
    const unknownMap = known ? '' : t('arena.unknownMap', { map: arenaId, instead: arena.name });
    const otherRules = rules === RULES_VERSION ? '' : t('garage.otherRules', { rules: rules || t('share.unknown'), now: RULES_VERSION });
    this.notice.show(`${t('arena.received', { robots: robots.map((robot) => robot.name).join(t('arena.vsJoin')) })}${keptText}${unknownMap}${otherRules}`, keepProblem !== null);
    return true;
  }

  /** A result's entry with a share button beside it; pressing the button shows the match's share code under the row. */
  private shareableRow(entry: HTMLElement, match: FoughtMatch): HTMLElement {
    const row = createElement('div', 'result-row');
    const share = createButton('garage-action', SHARE_LABEL, t('arena.share.title'));
    let box: HTMLElement | null = null;
    /** Set while the code is being made: a second press meanwhile is not a second request. */
    let making = false;
    share.addEventListener('click', () => {
      if (box !== null) {
        box.remove();
        box = null;
        return;
      }
      if (making) return;
      making = true;
      const robots = match.entrants.map((entrant) => copyRobot(entrant));
      encodeMatch({ robots, arenaId: match.arena.id, seed: match.seed })
        .then((code) => {
          const saveFile = createButton('tool-button share-action', t('garage.saveFile'), t('arena.saveFile.title'), () =>
            downloadText(fileName(`${robots.map((robot) => robot.name).join('-vs-')}`), matchFileText({ robots, arenaId: match.arena.id, seed: match.seed })),
          );
          box = createShareBox(code, 'garage-share result-share', [saveFile]);
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

  /** Called every frame while the arena mode is shown. */
  update(): void {
    const { snapshot, stats } = this.scene();
    this.slots.forEach((slot, index) => {
      const robot = snapshot.robots[index];
      const text =
        this.replay === null || robot === undefined
          ? ''
          : t('arena.status', { hp: robot.hp, maxHp: stats[index].maxHp, ammo: robot.ammo });
      if (slot.status.textContent !== text) slot.status.textContent = text;
      this.showPlace(slot, index);
    });
    const result = this.replay?.snapshot.result ?? null;
    if (this.unannounced !== null && result !== null) this.announce();
  }

  private createSlot(index: number): SlotView {
    const select = createElement('select', 'lineup-select');
    select.setAttribute('aria-label', t('arena.robot.label', { number: index + 1 }));
    select.addEventListener('change', () => {
      this.notice.clear();
      this.picked[index] = select.value;
      this.saveLineup();
      this.showEntrant(index);
      this.leaveMatch();
      this.idle = this.captureIdle();
    });
    return {
      preview: createRobotPreview(),
      select,
      parts: createElement('div', 'lineup-parts'),
      cost: createElement('span', 'lineup-cost'),
      status: createElement('span', 'lineup-status'),
      badge: createElement('span', 'place-badge'),
    };
  }

  /** The badge of the robot's place once the match being shown is over: gold, silver and bronze for the first three. */
  private showPlace(slot: SlotView, index: number): void {
    const result = this.replay?.snapshot.result ?? null;
    const name = this.watched.fight?.names[index];
    const place = result === null || name === undefined ? null : (result.places[name] ?? null);
    const text = place === null ? '' : `${place}`;
    if (slot.badge.textContent === text) return;
    slot.badge.replaceChildren(createElement('span', 'place-number', text));
    slot.badge.hidden = place === null;
    slot.badge.dataset.place = place === null ? '' : `${Math.min(place, 4)}`;
    slot.badge.title = place === null ? '' : t('arena.place', { place, name: name ?? '' });
  }

  private slotElement(slot: SlotView, index: number): HTMLElement {
    const details = createElement('div', 'lineup-details');
    const choice = createElement('div', 'lineup-choice');
    choice.append(createElement('span', 'field-name', `${index + 1}`), slot.select);
    const figures = createElement('div', 'lineup-figures');
    figures.append(slot.cost, slot.status);
    details.append(choice, slot.parts, figures);
    const picture = createElement('div', 'lineup-picture');
    slot.badge.hidden = true;
    picture.append(slot.preview, slot.badge);
    const element = createElement('div', 'lineup-slot');
    element.append(picture, details);
    return element;
  }

  private entrantIn(index: number): Entrant {
    const entrant = this.entrants.find((candidate) => candidate.id === this.picked[index]);
    if (entrant === undefined) throw new Error(`No entrant "${this.picked[index]}"`);
    return entrant;
  }

  private pickedEntrants(): Entrant[] {
    return Array.from({ length: this.count }, (_, index) => this.entrantIn(index));
  }

  /** The two entrants of a duel. */
  /** A series of three or four: every map in turn, each match with a seed (and so corners) of its own; places are counted. */
  private playRoyaleSeries(): void {
    const order = shuffled(ARENAS);
    const maps = Array.from({ length: SERIES_MATCHES }, (_, match) => order[match % order.length]);
    const fixtures = maps.map(({ arena }) => ({ arena, seed: randomSeed() }));
    const entrants = this.pickedEntrants();
    const played = playRoyaleSeries(entrants, fixtures);
    if (!played.ok) {
      this.addResult(createElement('div', 'result problem', played.problems.join('\n')));
      return;
    }
    const { names, places, ticks, counts } = played;
    const series = createElement('div', 'series');
    series.append(createElement('div', 'result series-title', t('arena.royaleSeriesTitle', { count: places.length, names: names.join(' / ') })));
    places.forEach((placed, index) => {
      const order = names.map((name, at) => ({ name, place: placed[at] })).sort((a, b) => a.place - b.place);
      const outcome = order.map(({ name, place }) => t('arena.place', { place, name })).join('  ');
      const seconds = formatSeconds(ticks[index] / MATCH_DEFAULTS.tickRate);
      const text = t('arena.seriesRow', { number: `${index + 1}`.padStart(2), outcome, reason: '', seconds, map: maps[index].name });
      const fought: FoughtMatch = { entrants, arena: maps[index], seed: fixtures[index].seed };
      const entry = createButton('result fought', text, t('arena.show.title'), () => this.show(fought));
      series.append(this.shareableRow(entry, fought));
    });
    // The robots by how often they won, then came second, and so on.
    const standing = names.map((name, at) => ({ name, counts: counts[at] })).sort((a, b) => {
      for (let place = 0; place < a.counts.length; place++) if (a.counts[place] !== b.counts[place]) return b.counts[place] - a.counts[place];
      return 0;
    });
    for (const { name, counts: placesOf } of standing) {
      const line = placesOf.map((count, place) => t('arena.placeCount', { place: place + 1, count })).join('  ');
      series.append(createElement('div', 'result series-total', `${name}  ${line}`));
    }
    this.addResult(series);
  }

  private pickedPair(): [Entrant, Entrant] {
    return [this.entrantIn(0), this.entrantIn(1)];
  }

  /** Shows the picture and the parts of the robot picked for the slot. */
  private showEntrant(index: number): void {
    const { loadout } = this.entrantIn(index);
    const slot = this.slots[index];
    drawRobotPreview(slot.preview, loadout, paletteOf(index));
    slot.parts.textContent = SLOTS.map((part) => partIn(loadout, part).name).join(' / ');
    const cost = costOf(loadout);
    slot.cost.textContent = t('arena.cost', { cost, limit: COST_LIMIT });
    slot.cost.classList.toggle('over-limit', cost > COST_LIMIT);
  }

  /** Stops showing the match, as the line-up is no longer the one that fought it. Its result still goes on the list. */
  private leaveMatch(): void {
    if (this.unannounced !== null) this.announce();
    this.watched.leave();
  }

  private captureIdle(): ArenaScene {
    const entrants = this.pickedEntrants();
    const names = fightNames(entrants);
    const arena = arenaFor(this.setting.arena().arena, this.nextSeed, entrants.length);
    const loadouts = entrants.map((entrant) => entrant.loadout);
    const stats = loadouts.map((loadout) => statsOf(loadout));
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.nextSeed,
      robots: names.map((id, index) => ({ id, brain: { decide: createIdleAction }, stats: stats[index] })),
    });
    return { snapshot: captureSnapshot(simulation), arena, stats, loadouts };
  }

  /** A match between the picked robots in the chosen arena, from where they were waiting. The next one gets a seed of its own. */
  private startFight(): void {
    this.notice.clear();
    const match: FoughtMatch = { entrants: this.pickedEntrants(), arena: this.setting.arena(), seed: this.nextSeed };
    this.nextSeed = randomSeed();
    this.idle = this.captureIdle();
    if (this.show(match)) this.unannounced = match;
  }

  /** Records the match and plays it from the start. False, with the reasons on the list, when it cannot be fought. */
  private show(match: FoughtMatch): boolean {
    // A match left before its end still counts: it was fought.
    if (this.unannounced !== null) this.announce();
    const prepared = prepareFight(match.entrants, match.arena.arena, match.seed);
    if (!prepared.ok) {
      this.addResult(createElement('div', 'result problem', prepared.problems.join('\n')));
      return false;
    }
    this.watched.watch(prepared.fight, this.setting.speed());
    return true;
  }

  /** Puts the result of the match being shown on the list. Pressing the entry shows the match again. */
  private announce(): void {
    const { unannounced: match } = this;
    const { replay, fight } = this.watched;
    this.unannounced = null;
    if (match === null || replay === null || fight === null) return;
    const { recording } = replay;
    const result = recording.snapshots[recording.snapshots.length - 1].result;
    if (result === null) return;

    this.fights++;
    const seconds = (recording.snapshots.length - 1) / recording.tickRate;
    const text = t('arena.result', { number: this.fights, outcome: describeOutcome(result, fight.names), reason: formatReason(result.reason), seconds: formatSeconds(seconds), map: match.arena.name });
    // Only a duel has a share code; the entry of a battle royale says so.
    const entry = createButton('result fought', text, t('arena.showAgain.title'), () => this.show(match));
    this.addResult(this.shareableRow(entry, match));
  }

  /** A series between the picked robots over all the maps, whichever is chosen in the toolbar. */
  private playSeries(): void {
    if (this.count > 2) {
      this.playRoyaleSeries();
      return;
    }
    // Two matches a map, one from each side; every map comes up before any comes up again,
    // in an order of its own each time. Each match has a seed, and so starting places, of its own.
    const order = shuffled(ARENAS);
    const maps = Array.from({ length: SERIES_MATCHES }, (_, match) => order[Math.floor(match / 2) % order.length]);
    const fixtures = maps.map(({ arena }, match) => ({ arena, seed: randomSeed(), first: sideOf(match) }));
    const entrants = this.pickedPair();
    const played = playArenaSeries(entrants, fixtures);
    if (!played.ok) {
      this.addResult(createElement('div', 'result problem', played.problems.join('\n')));
      return;
    }

    // One line for every match, in the order they were fought, and the count of wins at the end.
    const { names, matches, result } = played;
    const series = createElement('div', 'series');
    series.append(createElement('div', 'result series-title', t('arena.seriesTitle', { count: matches.length, first: names[0], second: names[1] })));
    matches.forEach((match, index) => {
      const outcome = match.winner === null ? t('arena.seriesRow.draw') : t('arena.seriesRow.won', { name: names[match.winner] });
      const reason = match.reason === 'destroyed' ? '' : t('arena.seriesReason', { reason: formatReason(match.reason) });
      const seconds = formatSeconds(match.ticks / MATCH_DEFAULTS.tickRate);
      const text = t('arena.seriesRow', { number: `${index + 1}`.padStart(2), outcome, reason, seconds, map: maps[index].name });
      const entry = createButton('result fought', text, t('arena.show.title'));
      const { seed, first } = fixtures[index];
      const fought: FoughtMatch = { entrants: inOrder(entrants, first), arena: maps[index], seed };
      entry.addEventListener('click', () => this.show(fought));
      series.append(this.shareableRow(entry, fought));
    });
    const draws = result.draws === 0 ? '' : t('arena.seriesDraws', { count: result.draws });
    const total = t('arena.seriesTotal', { first: names[0], firstWins: result.wins[0], secondWins: result.wins[1], second: names[1], draws });
    series.append(createElement('div', 'result series-total', total));
    this.addResult(series);
  }

  /** The newest result goes on top. */
  private addResult(entry: HTMLElement): void {
    this.results.prepend(entry);
    this.results.scrollTop = 0;
  }
}

/** The entrant that starts first in the match with the given number: they take turns. */
function sideOf(match: number): 0 | 1 {
  return match % 2 === 0 ? 0 : 1;
}

/** The items in a random order. */
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function describeOutcome(result: MatchResult, names: readonly string[]): string {
  if (names.length === 2) {
    const [first, second] = names;
    if (result.winnerId === null) return t('arena.drew', { first, second });
    return result.winnerId === first ? t('arena.beat', { winner: first, loser: second }) : t('arena.beat', { winner: second, loser: first });
  }
  // A battle royale: every robot by its place, the best first.
  const byPlace = [...names].sort((a, b) => (result.places[a] ?? 0) - (result.places[b] ?? 0));
  return byPlace.map((name) => t('arena.place', { place: result.places[name] ?? 0, name })).join('  ');
}

/** Whether the entrant is the robot: the same name, program and parts. */
function sameRobot(entrant: Entrant, robot: SavedRobot): boolean {
  return entrant.name === robot.name && entrant.source === robot.source && SLOTS.every((slot) => entrant.loadout[slot] === robot.loadout[slot]);
}
