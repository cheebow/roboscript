import type { Simulation } from '../sim/simulation';
import { createElement } from './dom';
import { FieldList } from './field_list';
import { NO_VALUE, formatNumber, formatSeconds } from './format';

const FIELD_NAMES = [
  'ID',
  'HP',
  'X',
  'Y',
  'ROTATION',
  'STATE',
  'TARGET',
  'TARGET_DISTANCE',
  'AMMO',
  'COOLDOWN',
] as const;

/** Shows the live state of one robot; the tabs choose which. */
export class Inspector {
  private selectedIndex = 0;
  private readonly fields: FieldList;
  private readonly tabs: HTMLButtonElement[];

  constructor(tabsContainer: HTMLElement, fieldsContainer: HTMLElement, robotIds: readonly string[]) {
    this.fields = new FieldList(fieldsContainer, FIELD_NAMES);
    this.tabs = robotIds.map((id, index) => {
      const tab = createElement('button', 'tab', id);
      tab.type = 'button';
      tab.addEventListener('click', () => this.select(index));
      return tab;
    });
    tabsContainer.replaceChildren(...this.tabs);
    this.select(this.selectedIndex);
  }

  update(simulation: Simulation): void {
    const robot = simulation.robots[this.selectedIndex];
    const enemy = simulation.robots.find((other) => other !== robot);
    const { enemyVisible, enemyDistance } = robot.sensorReading;
    this.fields.set([
      robot.id,
      String(robot.hp),
      formatNumber(robot.position.x),
      formatNumber(robot.position.y),
      formatNumber(robot.rotation),
      robot.state,
      enemyVisible && enemy !== undefined ? enemy.id : NO_VALUE,
      enemyVisible ? formatNumber(enemyDistance) : NO_VALUE,
      String(robot.weapon.ammo),
      formatSeconds(robot.weapon.cooldownTicks / simulation.tickRate),
    ]);
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.tabs.forEach((tab, tabIndex) => tab.classList.toggle('selected', tabIndex === index));
  }
}
