import { COST_LIMIT, type Loadout, SLOTS, STANDARD_LOADOUT, type Slot, costOf, partIn, partsOf, statsOf } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import { createElement } from './dom';

/** One stat as the player reads it. */
interface StatRow {
  name: string;
  value: (stats: RobotStats) => number;
  /** Written before the value, e.g. the sign of a deviation to either side. */
  prefix?: string;
  unit: string;
  /** Whether a robot is better off with more of it. */
  moreIsBetter: boolean;
}

const STAT_ROWS: readonly StatRow[] = [
  { name: 'HP', value: (stats) => stats.maxHp, unit: '', moreIsBetter: true },
  { name: 'MOVE_SPEED', value: (stats) => stats.moveSpeed, unit: ' units/sec', moreIsBetter: true },
  { name: 'ROTATE_SPEED', value: (stats) => stats.rotateSpeed, unit: ' deg/sec', moreIsBetter: true },
  { name: 'TURRET_SPEED', value: (stats) => stats.turretSpeed, unit: ' deg/sec', moreIsBetter: true },
  { name: 'SENSOR_RANGE', value: (stats) => stats.sensorRange, unit: '', moreIsBetter: true },
  { name: 'SENSOR_ANGLE', value: (stats) => stats.sensorAngle, unit: ' deg', moreIsBetter: true },
  { name: 'WEAPON_RANGE', value: (stats) => stats.weaponRange, unit: '', moreIsBetter: true },
  { name: 'SHOT_DAMAGE', value: (stats) => stats.shotDamage, unit: '', moreIsBetter: true },
  { name: 'SHOT_SPEED', value: (stats) => stats.shotSpeed, unit: ' units/sec', moreIsBetter: true },
  { name: 'SHOT_COOLDOWN', value: (stats) => stats.shotCooldown, unit: ' sec', moreIsBetter: false },
  { name: 'SHOT_SPREAD', value: (stats) => stats.shotSpread, prefix: '±', unit: ' deg', moreIsBetter: false },
  { name: 'AMMO', value: (stats) => stats.maxAmmo, unit: '', moreIsBetter: true },
  { name: 'GUARDS', value: (stats) => stats.maxGuards, unit: '', moreIsBetter: true },
];

/** Stats come out of multiplications; this many decimals are shown. */
const DECIMALS = 2;

interface SlotRow {
  slot: Slot;
  options: { partId: string; button: HTMLButtonElement }[];
  summary: HTMLElement;
}

/**
 * One robot's config: the part in each of its slots, for the player to
 * choose, what the parts cost together, and the stats they add up to, with
 * what differs from a robot of standard parts marked.
 */
export class PartsView {
  private readonly identity: HTMLElement[];
  private readonly slotRows: SlotRow[];
  private readonly cost: HTMLElement;
  private readonly stats: HTMLElement[];

  /** `onPick` is called with the part the player clicked; the view changes only when `show` is called. */
  constructor(container: HTMLElement, onPick: (slot: Slot, partId: string) => void) {
    const identity = createElement('div', 'field-list');
    this.identity = ['ID', 'AI'].map((name) => addField(identity, name));

    const parts = createElement('div', 'parts');
    this.slotRows = SLOTS.map((slot) => {
      const row = createElement('div', 'part-slot');
      const options = partsOf(slot).map((part) => {
        const button = createElement('button', 'part-option', part.name);
        button.type = 'button';
        button.title = part.summary;
        button.append(createElement('span', 'part-cost', `${part.cost}`));
        button.addEventListener('click', () => onPick(slot, part.id));
        return { partId: part.id, button };
      });
      const choice = createElement('div', 'part-options');
      choice.append(...options.map((option) => option.button));
      const summary = createElement('div', 'part-summary');
      row.append(createElement('span', 'field-name', slot.toUpperCase()), choice, summary);
      parts.append(row);
      return { slot, options, summary };
    });
    const total = createElement('div', 'field-list');
    this.cost = addField(total, 'COST');

    const stats = createElement('div', 'field-list');
    this.stats = STAT_ROWS.map((row) => addField(stats, row.name));

    container.replaceChildren(identity, parts, total, stats);
  }

  /** Shows the robot with the given parts. `ai` names what drives it. */
  show(robotId: string, ai: string, loadout: Loadout): void {
    this.identity[0].textContent = robotId;
    this.identity[1].textContent = ai;

    for (const { slot, options, summary } of this.slotRows) {
      for (const { partId, button } of options) {
        const selected = partId === loadout[slot];
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', `${selected}`);
      }
      summary.textContent = partIn(loadout, slot).summary;
    }

    const cost = costOf(loadout);
    this.cost.textContent = `${cost} / ${COST_LIMIT}`;
    this.cost.classList.toggle('over-limit', cost > COST_LIMIT);

    const stats = statsOf(loadout);
    const standard = statsOf(STANDARD_LOADOUT);
    STAT_ROWS.forEach((row, index) => {
      const cell = this.stats[index];
      const value = row.value(stats);
      const difference = value - row.value(standard);
      const changed = Math.abs(difference) >= 10 ** -DECIMALS / 2;
      const note = changed ? `  (${difference > 0 ? '+' : '−'}${format(Math.abs(difference))})` : '';
      cell.textContent = `${row.prefix ?? ''}${format(value)}${row.unit}${note}`;
      cell.classList.toggle('better', changed && difference > 0 === row.moreIsBetter);
      cell.classList.toggle('worse', changed && difference > 0 !== row.moreIsBetter);
    });
  }
}

/** Adds a name/value row to the list and returns the element that holds its value. */
function addField(list: HTMLElement, name: string): HTMLElement {
  const row = createElement('div', 'field');
  const value = createElement('span', 'field-value');
  row.append(createElement('span', 'field-name', name), value);
  list.append(row);
  return value;
}

/** At most DECIMALS decimals, without trailing zeros. */
function format(value: number): string {
  return `${Number(value.toFixed(DECIMALS))}`;
}
