import type { RobotSnapshot } from '../debug/snapshot';
import { type MessageKey, t } from '../i18n/messages';
import type { KeyValueStorage } from '../project/project_store';
import { createButton, createElement } from './dom';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber } from './format';

/** Which sections of the watch the player folded, kept across visits. */
const FOLDED_KEY = 'roboscript/watch.json';

const SENSOR_NAMES = [
  'enemy_visible',
  'enemy_distance',
  'enemy_angle',
  'aim_angle',
  'lead_angle',
  'gun_angle',
  'weapon_range',
  'enemy_speed',
  'enemy_heading',
  'reload',
  'blocked',
  'blocked_behind',
  'touching_enemy',
  'hidden',
  'hp',
  'ammo',
  'guards',
  'label',
  'last_seen_x',
  'last_seen_y',
  'bullet_incoming',
  'bullet_distance',
  'bullet_angle',
  'hit',
  'hit_angle',
  'cover_visible',
  'cover_distance',
  'cover_angle',
  'wall_ahead',
  'wall_behind',
  'wall_left',
  'wall_right',
] as const;

/** Shown with the values a program reads, but not words of RoboScript: a program cannot read them. */
const NOT_WORDS: ReadonlySet<string> = new Set(['label', 'last_seen_x', 'last_seen_y']);

/** The words of a team match, shown only while the robot is on a team. */
const TEAM_SENSOR_NAMES = [
  'self_id',
  'allies_alive',
  'enemies_alive',
  'ally_signal',
  'ally_signal_from',
  'ally_distance',
  'ally_angle',
  'ally_hp',
  'touching_ally',
  'base_hp',
  'base_distance',
  'base_angle',
  'enemy_base_hp',
  'enemy_base_distance',
  'enemy_base_angle',
] as const;

/**
 * Shows what one robot's program can read at the displayed moment, under the
 * names used in RoboScript: the program's own variables, then the sensor
 * values, with the robot's label and where it last saw the enemy besides.
 */
export class WatchPanel {
  private readonly sensors: FieldList;
  private readonly teamSensors: FieldList;
  private readonly teamContainer = createElement('div', 'watch-sensors');
  /** The team section, heading and all: there only while the robot is on a team. */
  private readonly teamSection: HTMLElement;
  private readonly folded: Set<string>;
  private readonly variablesContainer = createElement('div', 'watch-variables');
  private variables: FieldList | null = null;
  private variableNames = '';

  /** `robotName` is the element that says whose values are shown. */
  constructor(
    container: HTMLElement,
    private readonly robotName: HTMLElement,
    private readonly storage: KeyValueStorage | null = null,
  ) {
    this.folded = readFolded(storage);
    const sensorsContainer = createElement('div', 'watch-sensors');
    this.teamSection = this.section('team', 'watch.section.team', this.teamContainer);
    // The program's own variables are what the player looks for first: always open. The long lists below fold.
    container.replaceChildren(this.variablesContainer, this.teamSection, this.section('sensors', 'watch.section.sensors', sensorsContainer));
    // In Japanese the labels are short translations; the word itself is the tooltip, so the program's word can still be found.
    this.sensors = new FieldList(
      sensorsContainer,
      SENSOR_NAMES.map((word) => ({ name: t(`watch.${word}`), title: NOT_WORDS.has(word) ? t('watch.notAWord') : word })),
    );
    this.teamSensors = new FieldList(
      this.teamContainer,
      TEAM_SENSOR_NAMES.map((word) => ({ name: t(`watch.${word}`), title: word })),
    );
    this.teamSection.hidden = true;
  }

  /** A foldable section: a heading that folds and unfolds the body under it, remembered for next time. */
  private section(id: string, label: MessageKey, body: HTMLElement): HTMLElement {
    const heading = createButton('watch-section', '', t('watch.section.fold'));
    const show = () => {
      const folded = this.folded.has(id);
      body.hidden = folded;
      heading.textContent = `${folded ? '▸' : '▾'} ${t(label)}`;
      heading.setAttribute('aria-expanded', String(!folded));
    };
    heading.addEventListener('click', () => {
      if (this.folded.has(id)) this.folded.delete(id);
      else this.folded.add(id);
      show();
      try {
        this.storage?.setItem(FOLDED_KEY, JSON.stringify({ version: 1, folded: [...this.folded] }));
      } catch {
        // Storage may be full or blocked: the folding holds until the page is left.
      }
    });
    show();
    const section = createElement('div', 'watch-section-block');
    section.append(heading, body);
    return section;
  }

  update(robot: RobotSnapshot, variables: Readonly<Record<string, number>>): void {
    if (this.robotName.textContent !== robot.id) this.robotName.textContent = robot.id;
    this.showTeam(robot);
    const { lastSeen, incomingBullet, cover } = robot;
    this.sensors.set([
      String(robot.enemyVisible),
      formatNumber(robot.enemyDistance),
      formatNumber(robot.enemyAngle),
      formatNumber(robot.aimAngle),
      formatNumber(robot.leadAngle),
      formatNumber(robot.gunAngle),
      String(robot.weaponRange),
      formatNumber(robot.enemySpeed),
      formatNumber(robot.enemyHeading),
      formatNumber(robot.cooldown),
      String(robot.blocked),
      String(robot.blockedBehind),
      String(robot.touchingEnemy),
      String(robot.hidden),
      String(robot.hp),
      String(robot.ammo),
      String(robot.guards),
      robot.label,
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.x),
      lastSeen === null ? NO_VALUE : formatNumber(lastSeen.y),
      String(incomingBullet !== null),
      formatNumber(incomingBullet?.distance ?? 0),
      formatNumber(incomingBullet?.angle ?? 0),
      String(robot.hit),
      formatNumber(robot.hitAngle),
      String(cover !== null),
      formatNumber(cover?.distance ?? 0),
      formatNumber(cover?.angle ?? 0),
      formatNumber(robot.wallAhead),
      formatNumber(robot.wallBehind),
      formatNumber(robot.wallLeft),
      formatNumber(robot.wallRight),
    ]);
    this.showVariables(variables);
  }

  /** The team words, while the robot is on a team; the rows disappear outside a team match. */
  private showTeam(robot: RobotSnapshot): void {
    const sense = robot.teamSense;
    const hidden = sense === null;
    if (this.teamSection.hidden !== hidden) this.teamSection.hidden = hidden;
    if (sense === null) return;
    this.teamSensors.set([
      String(robot.selfId ?? 1),
      String(sense.alliesAlive),
      String(sense.enemiesAlive),
      formatNumber(sense.allySignal),
      formatNumber(sense.allySignalFrom),
      formatNumber(sense.allyDistance),
      formatNumber(sense.allyAngle),
      formatNumber(sense.allyHp),
      String(sense.touchingAlly),
      formatNumber(sense.baseHp),
      formatNumber(sense.baseDistance),
      formatNumber(sense.baseAngle),
      formatNumber(sense.enemyBaseHp),
      formatNumber(sense.enemyBaseDistance),
      formatNumber(sense.enemyBaseAngle),
    ]);
  }

  /** The rows are rebuilt only when the set of variables changes; otherwise only the values are refreshed. */
  private showVariables(variables: Readonly<Record<string, number>>): void {
    const names = Object.keys(variables).sort();
    const key = names.join(' ');
    if (key !== this.variableNames) {
      this.variableNames = key;
      this.variables = names.length === 0 ? null : new FieldList(this.variablesContainer, names);
      if (names.length === 0) this.variablesContainer.replaceChildren();
    }
    this.variables?.set(names.map((name) => formatVariable(variables[name])));
  }
}

/** Whole numbers as they are; others with a few decimals. */
function formatVariable(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

/** The sections folded on an earlier visit; none when nothing usable is kept. */
function readFolded(storage: KeyValueStorage | null): Set<string> {
  try {
    const value: unknown = JSON.parse(storage?.getItem(FOLDED_KEY) ?? 'null');
    const folded = typeof value === 'object' && value !== null ? (value as { folded?: unknown }).folded : undefined;
    return new Set(Array.isArray(folded) ? folded.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}
