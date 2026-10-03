import { createElement } from './dom';

/** A fixed list of name/value rows whose values are refreshed in place. */
export class FieldList {
  private readonly values: HTMLElement[];

  /** `names` are the labels; a `{ name, title }` carries a tooltip besides (e.g. the word a translated label stands for). */
  constructor(container: HTMLElement, names: readonly (string | { name: string; title: string })[]) {
    const list = createElement('div', 'field-list');
    this.values = names.map((entry) => {
      const { name, title } = typeof entry === 'string' ? { name: entry, title: '' } : entry;
      const row = createElement('div', 'field');
      const value = createElement('span', 'field-value');
      const label = createElement('span', 'field-name', name);
      if (title !== '') label.title = title;
      row.append(label, value);
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
