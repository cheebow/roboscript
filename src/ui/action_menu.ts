import { createElement } from './dom';

export interface MenuItem {
  id: string;
  label: string;
}

const OPEN_ATTRIBUTE = 'aria-expanded';

/**
 * A button that opens a list of things to do, and does the one that is
 * picked. Unlike a selection box, it holds no choice: nothing is ticked, and
 * the same item can be picked again and again.
 */
export class ActionMenu {
  private readonly list: HTMLElement;

  /** `container` holds the button; the list is added to it. `onPick` is called with the id of the item picked. */
  constructor(
    private readonly container: HTMLElement,
    private readonly button: HTMLButtonElement,
    items: readonly MenuItem[],
    onPick: (id: string) => void,
  ) {
    this.list = createElement('div', 'menu-list');
    this.list.setAttribute('role', 'menu');
    this.list.hidden = true;
    for (const item of items) {
      const entry = createElement('button', 'menu-item', item.label);
      entry.type = 'button';
      entry.setAttribute('role', 'menuitem');
      entry.addEventListener('click', () => {
        this.close();
        onPick(item.id);
      });
      this.list.append(entry);
    }
    container.append(this.list);

    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute(OPEN_ATTRIBUTE, 'false');
    button.addEventListener('click', () => (this.list.hidden ? this.open() : this.close()));
    // A click anywhere else, or Escape, puts the list away.
    document.addEventListener('mousedown', (event) => {
      if (event.target instanceof Node && !container.contains(event.target)) this.close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  /** Shows or hides the whole menu, button and all. */
  set hidden(hidden: boolean) {
    if (hidden) this.close();
    this.container.hidden = hidden;
  }

  private open(): void {
    this.list.hidden = false;
    this.button.setAttribute(OPEN_ATTRIBUTE, 'true');
  }

  private close(): void {
    this.list.hidden = true;
    this.button.setAttribute(OPEN_ATTRIBUTE, 'false');
  }
}
