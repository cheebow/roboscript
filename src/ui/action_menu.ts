import { createElement } from './dom';

export interface MenuItem {
  id: string;
  label: string;
  /** Shown but not to be picked. */
  disabled?: boolean;
  /** Items of a submenu, opened from this item; the item itself is not picked. */
  items?: readonly MenuItem[];
}

const OPEN_ATTRIBUTE = 'aria-expanded';

/**
 * A button that opens a list of things to do, and does the one that is
 * picked. Unlike a selection box, it holds no choice: nothing is ticked, and
 * the same item can be picked again and again. An item may open a submenu
 * beside it.
 */
export class ActionMenu {
  private readonly list: HTMLElement;

  /** `container` holds the button; the list is added to it. `onPick` is called with the id of the item picked. */
  constructor(
    private readonly container: HTMLElement,
    private readonly button: HTMLButtonElement,
    items: readonly MenuItem[],
    private readonly onPick: (id: string) => void,
  ) {
    this.list = createElement('div', 'menu-list');
    this.list.setAttribute('role', 'menu');
    this.list.hidden = true;
    this.setItems(items);
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

  /** Puts these items in the list in place of the ones there. */
  setItems(items: readonly MenuItem[]): void {
    this.list.replaceChildren(...items.map((item) => this.entryOf(item)));
  }

  /** Shows or hides the whole menu, button and all. */
  set hidden(hidden: boolean) {
    if (hidden) this.close();
    this.container.hidden = hidden;
  }

  private entryOf(item: MenuItem): HTMLElement {
    const entry = createElement('button', 'menu-item', item.label);
    entry.type = 'button';
    entry.setAttribute('role', 'menuitem');
    entry.disabled = item.disabled === true;
    if (item.items === undefined) {
      entry.addEventListener('click', () => {
        this.close();
        this.onPick(item.id);
      });
      return entry;
    }
    // A submenu: shown beside the item while the pointer or the focus is on either.
    entry.classList.add('menu-parent');
    entry.setAttribute('aria-haspopup', 'menu');
    const sub = createElement('div', 'menu-list menu-sublist');
    sub.setAttribute('role', 'menu');
    sub.append(...item.items.map((child) => this.entryOf(child)));
    const wrapper = createElement('div', 'menu-sub');
    wrapper.append(entry, sub);
    return wrapper;
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
