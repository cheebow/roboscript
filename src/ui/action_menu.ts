import { createButton, createElement } from './dom';

export interface MenuItem {
  id: string;
  label: string;
  /** Its tooltip: what picking it does, when the label does not say it all. */
  title?: string;
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
    listenOnce();
  }

  /** Puts these items in the list in place of the ones there. */
  setItems(items: readonly MenuItem[]): void {
    this.list.replaceChildren(...items.map((item) => this.entryOf(item)));
  }

  /**
   * A menu in a panel: its button looks like the panel's other buttons, as wide
   * as its place, and its list opens under it. `element` goes into the panel.
   */
  static inPanel(label: string, title: string, onPick: (id: string) => void): { element: HTMLElement; menu: ActionMenu } {
    const element = createElement('div', 'menu panel-menu');
    const button = createButton('tool-button panel-menu-button', label, title);
    element.append(button);
    return { element, menu: new ActionMenu(element, button, [], onPick) };
  }

  /** Shows or hides the whole menu, button and all. */
  set hidden(hidden: boolean) {
    if (hidden) this.close();
    this.container.hidden = hidden;
  }

  private entryOf(item: MenuItem): HTMLElement {
    const entry = createButton('menu-item', item.label);
    entry.setAttribute('role', 'menuitem');
    entry.disabled = item.disabled === true;
    if (item.title !== undefined) entry.title = item.title;
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
    openMenus.add(this);
  }

  private close(): void {
    this.list.hidden = true;
    this.button.setAttribute(OPEN_ATTRIBUTE, 'false');
    openMenus.delete(this);
  }

  /** Puts the list away after a click outside the menu, or Escape. */
  static closeOnOutside(event: Event): void {
    for (const menu of [...openMenus]) {
      const inside = event.target instanceof Node && menu.container.contains(event.target);
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !inside) menu.close();
    }
  }
}

/** The menus with their list out. */
const openMenus = new Set<ActionMenu>();
let listening = false;

/** One pair of listeners on the page serves every menu, however many are made. */
function listenOnce(): void {
  if (listening) return;
  listening = true;
  document.addEventListener('mousedown', (event) => ActionMenu.closeOnOutside(event));
  document.addEventListener('keydown', (event) => ActionMenu.closeOnOutside(event));
}
