import { createElement } from './dom';

/** A fixed list of name/value rows whose values are refreshed in place. */
export class FieldList {
  private readonly values: HTMLElement[];

  constructor(container: HTMLElement, names: readonly string[]) {
    const list = createElement('div', 'field-list');
    this.values = names.map((name) => {
      const row = createElement('div', 'field');
      const value = createElement('span', 'field-value');
      row.append(createElement('span', 'field-name', name), value);
      list.append(row);
      return value;
    });
    container.replaceChildren(list);
  }

  /** Values are given in the same order as the names. */
  set(values: readonly string[]): void {
    values.forEach((text, index) => {
      const cell = this.values[index];
      if (cell.textContent !== text) cell.textContent = text;
    });
  }
}
