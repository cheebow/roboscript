import type { Snapshot } from '../debug/snapshot';
import { t } from '../i18n/messages';
import { createElement } from './dom';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber, formatSeconds } from './format';

const fieldNames = () => [
  t('inspector.id'),
  t('inspector.hp'),
  t('inspector.x'),
  t('inspector.y'),
  t('inspector.rotation'),
  t('inspector.gun'),
  t('inspector.drive'),
  t('inspector.label'),
  t('inspector.target'),
  t('inspector.targetDistance'),
  t('inspector.ammo'),
  t('inspector.guards'),
  t('inspector.cooldown'),
];

/** Shows the state of one robot at the displayed tick; the tabs choose which. */
export class Inspector {
  private selectedIndex = 0;
  private readonly fields: FieldList;
  private readonly tabs: HTMLButtonElement[];

  constructor(tabsContainer: HTMLElement, fieldsContainer: HTMLElement, robotIds: readonly string[]) {
    this.fields = new FieldList(fieldsContainer, fieldNames());
    this.tabs = robotIds.map((id, index) => {
      const tab = createElement('button', 'tab', id);
      tab.type = 'button';
      tab.addEventListener('click', () => this.select(index));
      return tab;
    });
    tabsContainer.replaceChildren(...this.tabs);
    this.select(this.selectedIndex);
  }

  /** Index of the robot being inspected. */
  get selected(): number {
    return this.selectedIndex;
  }

  update(snapshot: Snapshot): void {
    const robot = snapshot.robots[this.selectedIndex];
    const enemy = snapshot.robots.find((other) => other.id === robot.targetId);
    this.fields.set([
      robot.id,
      String(robot.hp),
      formatNumber(robot.x),
      formatNumber(robot.y),
      formatNumber(robot.rotation),
      formatNumber(robot.gunHeading),
      robot.driving.toUpperCase(),
      robot.label,
      robot.enemyVisible && enemy !== undefined ? enemy.id : NO_VALUE,
      robot.enemyVisible ? formatNumber(robot.enemyDistance) : NO_VALUE,
      String(robot.ammo),
      String(robot.guards),
      formatSeconds(robot.cooldown),
    ]);
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.tabs.forEach((tab, tabIndex) => tab.classList.toggle('selected', tabIndex === index));
  }
}
