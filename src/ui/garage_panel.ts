import { createElement } from './dom';

export interface GarageHandlers {
  /** Keep the robot at the given spawn index under the name as typed, which may not be a usable name. */
  save(name: string, robotIndex: number): void;
  /** Put the robot kept under the name in place of the robot at the given spawn index. */
  load(name: string, robotIndex: number): void;
  remove(name: string): void;
}

const REMOVE_LABEL = '×';
const CONFIRM_LABEL = 'sure?';
const ARMED_CLASS = 'armed';
const EMPTY_NOTE = 'No robots saved yet.';

/**
 * The garage: a name to type and a button per robot to save it under that
 * name, then the saved robots, each with buttons to load it into either robot
 * and to delete it. Deleting takes two presses of its button.
 */
export class GaragePanel {
  private readonly nameInput: HTMLInputElement;
  private readonly rows = createElement('div', 'garage-rows');
  /** The delete button that was pressed once and waits for the second press. */
  private armed: HTMLButtonElement | null = null;

  constructor(
    container: HTMLElement,
    private readonly robotIds: readonly string[],
    private readonly handlers: GarageHandlers,
  ) {
    this.nameInput = createElement('input', 'garage-name-input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'name';
    this.nameInput.setAttribute('aria-label', 'Name to save a robot under');
    this.nameInput.spellcheck = false;

    const saveButtons = createElement('div', 'garage-save-buttons');
    robotIds.forEach((robotId, robotIndex) => {
      const button = createElement('button', 'tool-button', `SAVE ${robotId}`);
      button.type = 'button';
      button.title = `Keep ${robotId}, its code and its parts, under the name above`;
      button.addEventListener('click', () => handlers.save(this.nameInput.value, robotIndex));
      saveButtons.append(button);
    });
    const save = createElement('div', 'garage-save');
    save.append(this.nameInput, saveButtons);
    container.replaceChildren(save, this.rows);

    // A press anywhere but on the waiting delete button calls the deletion off.
    document.addEventListener('mousedown', (event) => {
      if (event.target !== this.armed) this.disarm();
    });
  }

  /** Lists the saved robots by the given names. */
  show(names: readonly string[]): void {
    this.armed = null;
    if (names.length === 0) {
      this.rows.replaceChildren(createElement('div', 'garage-empty', EMPTY_NOTE));
      return;
    }
    this.rows.replaceChildren(...names.map((name) => this.rowOf(name)));
  }

  private rowOf(name: string): HTMLElement {
    const row = createElement('div', 'garage-row');
    const label = createElement('button', 'garage-name', name);
    label.type = 'button';
    label.title = 'Put this name in the name field';
    label.addEventListener('click', () => {
      this.nameInput.value = name;
    });
    row.append(label);

    this.robotIds.forEach((robotId, robotIndex) => {
      const load = createElement('button', 'garage-action', robotId[0]);
      load.type = 'button';
      load.title = `Load ${name} into ${robotId}: replaces its code and its parts`;
      load.addEventListener('click', () => this.handlers.load(name, robotIndex));
      row.append(load);
    });

    const remove = createElement('button', 'garage-action', REMOVE_LABEL);
    remove.type = 'button';
    remove.title = `Delete ${name}`;
    remove.addEventListener('click', () => {
      if (this.armed === remove) {
        this.handlers.remove(name);
        return;
      }
      this.disarm();
      this.armed = remove;
      remove.textContent = CONFIRM_LABEL;
      remove.classList.add(ARMED_CLASS);
    });
    row.append(remove);
    return row;
  }

  private disarm(): void {
    if (this.armed === null) return;
    this.armed.textContent = REMOVE_LABEL;
    this.armed.classList.remove(ARMED_CLASS);
    this.armed = null;
  }
}
