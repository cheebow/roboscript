import type { Snapshot } from '../debug/snapshot';
import { t } from '../i18n/messages';
import { createButton } from './dom';
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
  private tabs: HTMLButtonElement[] = [];

  /** `onPick` is called when the player picks a tab themself, not when `select` is called. */
  constructor(
    private readonly tabsContainer: HTMLElement,
    fieldsContainer: HTMLElement,
    robotIds: readonly string[],
    private readonly onPick?: (index: number) => void,
  ) {
    this.fields = new FieldList(fieldsContainer, fieldNames());
    this.setRobots(robotIds);
  }

  /** Puts these robots' tabs in place of the ones there, and starts on the first. */
  setRobots(robotIds: readonly string[]): void {
    this.tabs = robotIds.map((id, index) =>
      createButton('tab', id, '', () => {
        this.select(index);
        this.onPick?.(index);
      }),
    );
    this.tabsContainer.replaceChildren(...this.tabs);
    this.select(0);
  }

  /** Index of the robot being inspected. */
  get selected(): number {
    return this.selectedIndex;
  }

  update(snapshot: Snapshot): void {
    const robot = snapshot.robots[this.selectedIndex] ?? snapshot.robots[0];
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

  select(index: number): void {
    if (index < 0 || index >= this.tabs.length) return;
    this.selectedIndex = index;
    this.tabs.forEach((tab, tabIndex) => tab.classList.toggle('selected', tabIndex === index));
  }
}
