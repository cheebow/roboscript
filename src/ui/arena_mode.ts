import {
  type Entrant,
  type Fight,
  builtInEntrants,
  fightNames,
  garageEntrants,
  playArenaSeries,
  prepareFight,
} from '../arena/match';
import { ARENAS, type ArenaDefinition } from '../data/arenas';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, REPLAY_TAIL_TICKS } from '../data/match_defaults';
import { COST_LIMIT, type Loadout, SLOTS, costOf, partIn, statsOf } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import { recordMatch } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import { type Snapshot, captureSnapshot } from '../debug/snapshot';
import type { SavedRobot } from '../project/garage';
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
/** The rounds of one series: with a match from each side in every round, twice as many matches. */
const SERIES_ROUNDS = 10;
const MAX_SEED = 0x7fffffff;
/** The entrants the slots start with: the pair the program screen starts with. */
const DEFAULT_ENTRANT_IDS = ['built-in:sample', 'built-in:dumb_bot'];
const GROUPS: readonly { origin: Entrant['origin']; label: string }[] = [
  { origin: 'garage', label: 'GARAGE' },
  { origin: 'built-in', label: 'BUILT-IN' },
];
const READY_MESSAGE = 'Pick two robots and press FIGHT.';

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
  /** The starting positions of the picked robots, shown while there is no match. */
  private idle: ArenaScene;

  constructor(
    lineup: HTMLElement,
    results: HTMLElement,
    private readonly setting: ArenaSetting,
  ) {
    this.slots = Array.from({ length: SLOT_COUNT }, (_, index) => this.createSlot(index));
    const fight = this.createButton('FIGHT', 'Play one match, with a new seed every time', () => this.startFight());
    const series = this.createButton(
      `SERIES ×${SERIES_ROUNDS * 2}`,
      `Play ${SERIES_ROUNDS * 2} matches without showing them, over all the maps and half from each side, and count the wins`,
      () => this.playSeries(),
    );
    const buttons = createElement('div', 'lineup-buttons');
    buttons.append(fight, series);
    lineup.replaceChildren(...this.slots.map((slot, index) => this.slotElement(slot, index)), buttons);

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
    const { replay, fight } = this;
    if (replay === null || fight === null) return READY_MESSAGE;
    const { result } = replay.snapshot;
    const status = result !== null ? `${formatResult(result)} (${result.reason})` : replay.playing ? 'PLAYING' : 'PAUSED';
    return `${fight.names.join(' vs ')}   ${status}`;
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
    const { arena } = this.setting.arena();
    const loadouts = entrants.map((entrant) => entrant.loadout);
    const stats = loadouts.map((loadout) => statsOf(loadout));
    const simulation = new Simulation({
      arena,
      tickRate: MATCH_DEFAULTS.tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed: MATCH_DEFAULTS.seed,
      robots: [
        { id: names[0], brain: { decide: createIdleAction }, stats: stats[0] },
        { id: names[1], brain: { decide: createIdleAction }, stats: stats[1] },
      ],
    });
    return { snapshot: captureSnapshot(simulation), arena, stats, loadouts };
  }

  /** A match between the picked robots in the chosen arena, with a seed of its own. */
  private startFight(): void {
    const match: FoughtMatch = { entrants: this.pickedEntrants(), arena: this.setting.arena(), seed: randomSeed() };
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
    this.addResult(entry);
  }

  /** A series between the picked robots over all the maps, whichever is chosen in the toolbar. */
  private playSeries(): void {
    // Every map comes up once before any comes up twice, in an order of its own each time.
    const maps = shuffled(ARENAS);
    const rounds = Array.from({ length: SERIES_ROUNDS }, (_, round) => ({
      arena: maps[round % maps.length].arena,
      seed: randomSeed(),
    }));
    const played = playArenaSeries(this.pickedEntrants(), rounds);
    if (!played.ok) {
      this.addResult(createElement('div', 'result problem', played.problems.join('\n')));
      return;
    }
    const { names, result } = played;
    const draws = result.draws === 0 ? '' : `, ${result.draws} ${result.draws === 1 ? 'draw' : 'draws'}`;
    const text = `SERIES ×${result.matches}  ${names[0]} ${result.wins[0]} – ${result.wins[1]} ${names[1]}${draws}\n    all ${maps.length} maps`;
    this.addResult(createElement('div', 'result', text));
  }

  /** The newest result goes on top. */
  private addResult(entry: HTMLElement): void {
    this.results.prepend(entry);
    this.results.scrollTop = 0;
  }
}

function randomSeed(): number {
  return 1 + Math.floor(Math.random() * MAX_SEED);
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
