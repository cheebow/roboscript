import {
  type Entrant,
  type Fight,
  builtInEntrants,
  fightNames,
  garageEntrants,
  inOrder,
  playArenaSeries,
  prepareFight,
} from '../arena/match';
import { randomSeed } from '../arena/seed';
import { scatterSpawns } from '../arena/spawns';
import { ARENAS, type ArenaDefinition, findArena } from '../data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, REPLAY_TAIL_TICKS } from '../data/match_defaults';
import { COST_LIMIT, type Loadout, SLOTS, costOf, partIn, statsOf } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import { recordMatch } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import { type Snapshot, captureSnapshot } from '../debug/snapshot';
import type { SavedRobot } from '../project/garage';
import { RULES_VERSION } from '../data/rules_version';
import { decodeMatch, encodeMatch } from '../share/codec';
import { createIdleAction } from '../sim/ai_context';
import type { MatchResult } from '../sim/simulation';
import { Simulation } from '../sim/simulation';
import type { Arena } from '../sim/types';
import { formatResult } from '../view/battle_view';
import { paletteOf } from '../view/sprites';
import { createElement } from './dom';
import { formatSeconds } from './format';
import { createRobotPreview, drawRobotPreview } from './robot_preview';

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
}

/** What the battle view shows of the arena mode. */
export interface ArenaScene {
  snapshot: Snapshot;
  arena: Arena;
  stats: readonly RobotStats[];
  loadouts: readonly Loadout[];
}

/** A match that was fought, or is being shown: enough to fight it over again. */
interface FoughtMatch {
  entrants: [Entrant, Entrant];
  arena: ArenaDefinition;
  seed: number;
}

const SLOT_COUNT = 2;
/** The matches of one series. */
const SERIES_MATCHES = 20;
/** The entrants the slots start with: the pair the program screen starts with. */
const DEFAULT_ENTRANT_IDS = ['built-in:sample', 'built-in:dumb_bot'];
const GROUPS: readonly { origin: Entrant['origin']; label: string }[] = [
  { origin: 'garage', label: 'GARAGE' },
  { origin: 'built-in', label: 'BUILT-IN' },
];
const READY_MESSAGE = 'Pick two robots and press FIGHT.';
const SHARE_LABEL = '⇪';
const IMPORT_PLACEHOLDER = 'paste a match share code';

interface SlotView {
  preview: HTMLCanvasElement;
  select: HTMLSelectElement;
  parts: HTMLElement;
  cost: HTMLElement;
  /** HP and ammo in the match being shown. */
  status: HTMLElement;
}

/**
 * The arena mode: two robots picked from the garage and the built-in ones
 * fight, and the match is watched. No code is shown or edited here. Keeps the
 * line-up, the match being shown and the list of results.
 */
export class ArenaMode {
  /** The match being shown; null until the first FIGHT. */
  replay: ReplayManager | null = null;

  private entrants: Entrant[] = [];
  /** The id of the entrant in each slot. */
  private picked: string[] = [...DEFAULT_ENTRANT_IDS];
  private readonly slots: SlotView[];
  private readonly results: HTMLElement;
  private fights = 0;
  /** The fight being shown. */
  private fight: Fight | null = null;
  /** A match whose result goes on the list once it has been watched to its end. */
  private unannounced: FoughtMatch | null = null;
  /** The seed of the next FIGHT, drawn ahead so that the robots wait where that match will start. */
  private nextSeed = randomSeed();
  /** The picked robots where the next FIGHT will start them, shown while there is no match. */
  private idle: ArenaScene;
  /** What the last import did, or why it could not; shown in the toolbar until the next fight or pick. */
  private note: string | null = null;

  constructor(
    lineup: HTMLElement,
    results: HTMLElement,
    private readonly setting: ArenaSetting,
  ) {
    this.slots = Array.from({ length: SLOT_COUNT }, (_, index) => this.createSlot(index));
    const fight = this.createButton('FIGHT', 'Play one match, with a new seed every time', () => this.startFight());
    const series = this.createButton(
      `SERIES ×${SERIES_MATCHES}`,
      `Play ${SERIES_MATCHES} matches without showing them, over all the maps and half from each side, and count the wins`,
      () => this.playSeries(),
    );
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(fight, series);
    const importInput = createElement('input', 'garage-name-input');
    importInput.type = 'text';
    importInput.placeholder = IMPORT_PLACEHOLDER;
    importInput.setAttribute('aria-label', 'Share code of a match to play');
    importInput.spellcheck = false;
    const importButton = this.createButton('IMPORT', 'Play the match in the pasted share code, with its robots kept in the garage', () => {
      void this.importMatch(importInput.value);
      importInput.value = '';
    });
    importInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') importButton.click();
    });
    const importRow = createElement('div', 'lineup-import');
    importRow.append(importInput, importButton);
    lineup.replaceChildren(...this.slots.map((slot, index) => this.slotElement(slot, index)), buttons, importRow);

    this.results = results;
    this.refresh();
    this.idle = this.captureIdle();
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
          group.label = label;
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
    const { replay, fight } = this;
    if (replay === null || fight === null) return this.idle;
    const { recording } = replay;
    return { snapshot: replay.view, arena: recording.arena, stats: recording.stats, loadouts: fight.loadouts };
  }

  /** The line for the toolbar: who fights whom, and how it stands. */
  message(): string {
    const note = this.note === null ? '' : `   [${this.note}]`;
    const { replay, fight } = this;
    if (replay === null || fight === null) return `${READY_MESSAGE}${note}`;
    const { result } = replay.snapshot;
    const status = result !== null ? `${formatResult(result)} (${result.reason})` : replay.playing ? 'PLAYING' : 'PAUSED';
    return `${fight.names.join(' vs ')}   ${status}${note}`;
  }

  /** Plays the match in a share code: its robots go into the garage and the line-up, its arena is chosen, and its seed is used. */
  private async importMatch(text: string): Promise<void> {
    const decoded = await decodeMatch(text);
    if (!decoded.ok) {
      this.note = `could not import: ${decoded.problem}`;
      return;
    }
    const { robots, arenaId, seed, rules } = decoded.shared;
    let names: string[];
    try {
      names = this.setting.keepRobots(robots);
    } catch (error) {
      this.note = `could not keep the robots: ${error instanceof Error ? error.message : String(error)}`;
      return;
    }
    this.refresh();
    this.picked = names.map((name) => `garage:${name}`);
    this.slots.forEach((slot, index) => {
      slot.select.value = this.picked[index];
      this.showEntrant(index);
    });
    const known = ARENAS.some((arena) => arena.id === arenaId);
    const arena = findArena(arenaId);
    this.setting.chooseArena(arena.id);
    const match: FoughtMatch = { entrants: this.pickedEntrants(), arena, seed };
    const played = this.show(match);
    if (played) this.unannounced = match;
    const unknownMap = known ? '' : `. Its map "${arenaId}" is not here: ${arena.name} instead`;
    const otherRules = rules === RULES_VERSION ? '' : `. It was made under other rules (${rules || 'unknown'}, now ${RULES_VERSION}): it may not play out the same`;
    this.note = `${robots[0].name} vs ${robots[1].name} received, robots kept as ${names.join(' and ')}${unknownMap}${otherRules}`;
  }

  /** A result's entry with a share button beside it; pressing the button shows the match's share code under the row. */
  private shareableRow(entry: HTMLElement, match: FoughtMatch): HTMLElement {
    const row = createElement('div', 'result-row');
    const share = createElement('button', 'garage-action', SHARE_LABEL);
    share.type = 'button';
    share.title = 'Share this match: a code that plays it in someone else\'s arena';
    let box: HTMLElement | null = null;
    share.addEventListener('click', () => {
      if (box !== null) {
        box.remove();
        box = null;
        return;
      }
      const robots: [SavedRobot, SavedRobot] = [matchRobot(match.entrants[0]), matchRobot(match.entrants[1])];
      void encodeMatch({ robots, arenaId: match.arena.id, seed: match.seed }).then((code) => {
        box = shareBox(code);
        row.after(box);
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
      const text = this.replay === null ? '' : `HP ${robot.hp} / ${stats[index].maxHp}   AMMO ${robot.ammo}`;
      if (slot.status.textContent !== text) slot.status.textContent = text;
    });
    const result = this.replay?.snapshot.result ?? null;
    if (this.unannounced !== null && result !== null) this.announce();
  }

  private createSlot(index: number): SlotView {
    const select = createElement('select', 'lineup-select');
    select.setAttribute('aria-label', `Robot ${index + 1}`);
    select.addEventListener('change', () => {
      this.note = null;
      this.picked[index] = select.value;
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
    };
  }

  private slotElement(slot: SlotView, index: number): HTMLElement {
    const details = createElement('div', 'lineup-details');
    const choice = createElement('div', 'lineup-choice');
    choice.append(createElement('span', 'field-name', `${index + 1}`), slot.select);
    const figures = createElement('div', 'lineup-figures');
    figures.append(slot.cost, slot.status);
    details.append(choice, slot.parts, figures);
    const element = createElement('div', 'lineup-slot');
    element.append(slot.preview, details);
    return element;
  }

  private createButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = createElement('button', 'tool-button', label);
    button.type = 'button';
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  private entrantIn(index: number): Entrant {
    const entrant = this.entrants.find((candidate) => candidate.id === this.picked[index]);
    if (entrant === undefined) throw new Error(`No entrant "${this.picked[index]}"`);
    return entrant;
  }

  private pickedEntrants(): [Entrant, Entrant] {
    return [this.entrantIn(0), this.entrantIn(1)];
  }

  /** Shows the picture and the parts of the robot picked for the slot. */
  private showEntrant(index: number): void {
    const { loadout } = this.entrantIn(index);
    const slot = this.slots[index];
    drawRobotPreview(slot.preview, loadout, paletteOf(index));
    slot.parts.textContent = SLOTS.map((part) => partIn(loadout, part).name).join(' / ');
    const cost = costOf(loadout);
    slot.cost.textContent = `COST ${cost} / ${COST_LIMIT}`;
    slot.cost.classList.toggle('over-limit', cost > COST_LIMIT);
  }

  /** Stops showing the match, as the line-up is no longer the one that fought it. Its result still goes on the list. */
  private leaveMatch(): void {
    if (this.unannounced !== null) this.announce();
    this.replay = null;
    this.fight = null;
  }

  private captureIdle(): ArenaScene {
    const entrants = this.pickedEntrants();
    const names = fightNames(entrants);
    const arena = scatterSpawns(this.setting.arena().arena, this.nextSeed);
    const loadouts = entrants.map((entrant) => entrant.loadout);
    const stats = loadouts.map((loadout) => statsOf(loadout));
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: this.nextSeed,
      robots: [
        { id: names[0], brain: { decide: createIdleAction }, stats: stats[0] },
        { id: names[1], brain: { decide: createIdleAction }, stats: stats[1] },
      ],
    });
    return { snapshot: captureSnapshot(simulation), arena, stats, loadouts };
  }

  /** A match between the picked robots in the chosen arena, from where they were waiting. The next one gets a seed of its own. */
  private startFight(): void {
    this.note = null;
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
    this.fight = prepared.fight;
    this.replay = new ReplayManager(recordMatch(prepared.fight.config, EFFECT_LIFETIMES), {
      maxFrameTime: MATCH_DEFAULTS.maxFrameTime,
      tailTicks: REPLAY_TAIL_TICKS,
      speed: this.setting.speed(),
      focus: prepared.fight.names[0],
    });
    this.replay.restart();
    return true;
  }

  /** Puts the result of the match being shown on the list. Pressing the entry shows the match again. */
  private announce(): void {
    const { unannounced: match, replay, fight } = this;
    this.unannounced = null;
    if (match === null || replay === null || fight === null) return;
    const { recording } = replay;
    const result = recording.snapshots[recording.snapshots.length - 1].result;
    if (result === null) return;

    this.fights++;
    const seconds = (recording.snapshots.length - 1) / recording.tickRate;
    const text = `#${this.fights}  ${describeOutcome(result, fight.names)}\n    ${result.reason}, ${formatSeconds(seconds)} s, ${match.arena.name}`;
    const entry = createElement('button', 'result fought', text);
    entry.type = 'button';
    entry.title = 'Show this match again';
    entry.addEventListener('click', () => this.show(match));
    this.addResult(this.shareableRow(entry, match));
  }

  /** A series between the picked robots over all the maps, whichever is chosen in the toolbar. */
  private playSeries(): void {
    // Every map comes up once before any comes up twice, in an order of its own each time.
    // Two matches a map, one from each side; every map comes up before any comes up again.
    // Each match has a seed, and so starting places, of its own.
    const order = shuffled(ARENAS);
    const maps = Array.from({ length: SERIES_MATCHES }, (_, match) => order[Math.floor(match / 2) % order.length]);
    const fixtures = maps.map(({ arena }, match) => ({ arena, seed: randomSeed(), first: sideOf(match) }));
    const entrants = this.pickedEntrants();
    const played = playArenaSeries(entrants, fixtures);
    if (!played.ok) {
      this.addResult(createElement('div', 'result problem', played.problems.join('\n')));
      return;
    }

    // One line for every match, in the order they were fought, and the count of wins at the end.
    const { names, matches, result } = played;
    const series = createElement('div', 'series');
    series.append(createElement('div', 'result series-title', `SERIES ×${matches.length}  ${names.join(' vs ')}`));
    matches.forEach((match, index) => {
      const outcome = match.winner === null ? 'draw' : `${names[match.winner]} won`;
      const reason = match.reason === 'destroyed' ? '' : ` (${match.reason})`;
      const seconds = formatSeconds(match.ticks / MATCH_DEFAULTS.tickRate);
      const text = `${`${index + 1}`.padStart(2)}  ${outcome}${reason}, ${seconds} s, ${maps[index].name}`;
      const entry = createElement('button', 'result fought', text);
      entry.type = 'button';
      entry.title = 'Show this match';
      const { seed, first } = fixtures[index];
      const fought: FoughtMatch = { entrants: inOrder(entrants, first), arena: maps[index], seed };
      entry.addEventListener('click', () => this.show(fought));
      series.append(this.shareableRow(entry, fought));
    });
    const draws = result.draws === 0 ? '' : `, ${result.draws} ${result.draws === 1 ? 'draw' : 'draws'}`;
    const total = `${names[0]} ${result.wins[0]} – ${result.wins[1]} ${names[1]}${draws}`;
    series.append(createElement('div', 'result series-total', total));
    this.addResult(series);
  }

  /** The newest result goes on top. */
  private addResult(entry: HTMLElement): void {
    this.results.prepend(entry);
    this.results.scrollTop = 0;
  }
}

/** The robot an entrant was in a match: what a share code carries. */
function matchRobot(entrant: Entrant): SavedRobot {
  return { name: entrant.name, source: entrant.source, loadout: { ...entrant.loadout } };
}

/** A share code in a field, with a button that copies it. */
function shareBox(code: string): HTMLElement {
  const field = createElement('input', 'garage-share-field');
  field.type = 'text';
  field.readOnly = true;
  field.value = code;
  field.setAttribute('aria-label', 'Share code');
  field.addEventListener('focus', () => field.select());
  const copy = createElement('button', 'garage-action', 'COPY');
  copy.type = 'button';
  copy.title = 'Copy the share code to the clipboard';
  copy.addEventListener('click', () => {
    field.select();
    navigator.clipboard?.writeText(code).catch(() => {
      // Left selected: the player can copy it by hand.
    });
  });
  const line = createElement('div', 'garage-share-line');
  line.append(field, copy);
  const box = createElement('div', 'garage-share result-share');
  box.append(line);
  return box;
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

function describeOutcome(result: MatchResult, [first, second]: readonly [string, string]): string {
  if (result.winnerId === null) return `${first} and ${second} drew`;
  return result.winnerId === first ? `${first} beat ${second}` : `${second} beat ${first}`;
}
