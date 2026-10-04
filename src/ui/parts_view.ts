import { COST_LIMIT, type Loadout, SLOTS, STANDARD_LOADOUT, type Slot, costOf, partIn, partsOf, statsOf } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import type { RobotPalette } from '../view/sprites';
import { type MessageKey, t } from '../i18n/messages';
import { partSummary } from '../i18n/parts';
import { createButton, createElement } from './dom';
import { createRobotPreview, drawRobotPreview } from './robot_preview';

/** One stat as the player reads it. */
interface StatRow {
  /** The key of the row's label. */
  name: MessageKey;
  value: (stats: RobotStats) => number;
  /** Written before the value, e.g. the sign of a deviation to either side. */
  prefix?: string;
  /** The key of the unit written after the value, or '' for none. */
  unit: MessageKey | '';
  /** Whether a robot is better off with more of it. */
  moreIsBetter: boolean;
}

const STAT_ROWS: readonly StatRow[] = [
  { name: 'stat.HP', value: (stats) => stats.maxHp, unit: '', moreIsBetter: true },
  { name: 'stat.MOVE_SPEED', value: (stats) => stats.moveSpeed, unit: 'unit.unitsPerSecond', moreIsBetter: true },
  { name: 'stat.ROTATE_SPEED', value: (stats) => stats.rotateSpeed, unit: 'unit.degreesPerSecond', moreIsBetter: true },
  { name: 'stat.TURRET_SPEED', value: (stats) => stats.turretSpeed, unit: 'unit.degreesPerSecond', moreIsBetter: true },
  { name: 'stat.SENSOR_RANGE', value: (stats) => stats.sensorRange, unit: '', moreIsBetter: true },
  { name: 'stat.SENSOR_ANGLE', value: (stats) => stats.sensorAngle, unit: 'unit.degrees', moreIsBetter: true },
  { name: 'stat.WEAPON_RANGE', value: (stats) => stats.weaponRange, unit: '', moreIsBetter: true },
  { name: 'stat.SHOT_DAMAGE', value: (stats) => stats.shotDamage, unit: '', moreIsBetter: true },
  { name: 'stat.SHOT_SPEED', value: (stats) => stats.shotSpeed, unit: 'unit.unitsPerSecond', moreIsBetter: true },
  { name: 'stat.SHOT_COOLDOWN', value: (stats) => stats.shotCooldown, unit: 'unit.seconds', moreIsBetter: false },
  { name: 'stat.SHOT_SPREAD', value: (stats) => stats.shotSpread, prefix: '±', unit: 'unit.degrees', moreIsBetter: false },
  { name: 'stat.MOVING_SPREAD', value: (stats) => stats.movingShotSpread, prefix: '±', unit: 'unit.degrees', moreIsBetter: false },
  { name: 'stat.AMMO', value: (stats) => stats.maxAmmo, unit: '', moreIsBetter: true },
  { name: 'stat.GUARDS', value: (stats) => stats.maxGuards, unit: '', moreIsBetter: true },
];

/** Stats come out of multiplications; this many decimals are shown. */
const DECIMALS = 2;

interface SlotRow {
  slot: Slot;
  options: { partId: string; button: HTMLButtonElement }[];
  summary: HTMLElement;
}

/**
 * One robot's config: what it looks like, the part in each of its slots, for
 * the player to choose, what the parts cost together, and the stats they add
 * up to, with what differs from a robot of standard parts marked.
 */
export class PartsView {
  private readonly preview = createRobotPreview();
  private readonly identity: HTMLElement[];
  private readonly slotRows: SlotRow[];
  private readonly cost: HTMLElement;
  private readonly stats: HTMLElement[];

  /** `onPick` is called with the part the player clicked; the view changes only when `show` is called. */
  constructor(container: HTMLElement, onPick: (slot: Slot, partId: string) => void) {
    const identity = createElement('div', 'field-list');
    this.identity = [t('config.id'), t('config.ai')].map((name) => addField(identity, name));
    const card = createElement('div', 'robot-card');
    card.append(this.preview, identity);

    const parts = createElement('div', 'parts');
    this.slotRows = SLOTS.map((slot) => {
      const row = createElement('div', 'part-slot');
      const options = partsOf(slot).map((part) => {
        const button = createButton('part-option', part.name, partSummary(part));
        button.append(createElement('span', 'part-cost', `${part.cost}`));
        button.addEventListener('click', () => onPick(slot, part.id));
        return { partId: part.id, button };
      });
      const choice = createElement('div', 'part-options');
      choice.append(...options.map((option) => option.button));
      const summary = createElement('div', 'part-summary');
      row.append(createElement('span', 'field-name', t(`slot.${slot}`)), choice, summary);
      // A slot whose parts all cost the same is chosen by what suits the program, not to save cost.
      const costs = new Set(partsOf(slot).map((part) => part.cost));
      if (costs.size === 1) row.append(createElement('div', 'part-note', t('config.sameCost', { cost: [...costs][0] })));
      parts.append(row);
      return { slot, options, summary };
    });
    const total = createElement('div', 'field-list');
    this.cost = addField(total, t('config.cost'));

    const stats = createElement('div', 'field-list');
    this.stats = STAT_ROWS.map((row) => addField(stats, t(row.name)));

    container.replaceChildren(card, parts, total, stats);
  }

  /** Shows the robot with the given parts, drawn in the given colours. `ai` names what drives it; the parts of `fixed` slots cannot be changed. */
  show(robotId: string, ai: string, loadout: Loadout, palette: RobotPalette, fixed: ReadonlySet<Slot> = NOTHING_FIXED): void {
    this.identity[0].textContent = robotId;
    this.identity[1].textContent = ai;
    drawRobotPreview(this.preview, loadout, palette);

    for (const { slot, options, summary } of this.slotRows) {
      for (const { partId, button } of options) {
        const selected = partId === loadout[slot];
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', `${selected}`);
        button.disabled = fixed.has(slot) && !selected;
      }
      summary.textContent = partSummary(partIn(loadout, slot));
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
      cell.textContent = `${row.prefix ?? ''}${format(value)}${row.unit === '' ? '' : t(row.unit)}${note}`;
      cell.classList.toggle('better', changed && difference > 0 === row.moreIsBetter);
      cell.classList.toggle('worse', changed && difference > 0 !== row.moreIsBetter);
    });
  }
}

const NOTHING_FIXED: ReadonlySet<Slot> = new Set();

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
