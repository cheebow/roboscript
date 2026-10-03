import { createElement } from './dom';

export interface GarageHandlers {
  /** Keep the robot at the given spawn index under the name as typed, which may not be a usable name. */
  save(name: string, robotIndex: number): void;
  /** Put the robot kept under the name in place of the robot at the given spawn index. */
  load(name: string, robotIndex: number): void;
  remove(name: string): void;
  /** The share code and URL of the robot kept under the name; null when there is none. */
  share(name: string): Promise<{ url: string; code: string } | null>;
  /** Keep the robot in the pasted share code or URL. */
  importCode(text: string): void;
}

const REMOVE_LABEL = '×';
const CONFIRM_LABEL = 'sure?';
const ARMED_CLASS = 'armed';
const EMPTY_NOTE = 'No robots saved yet.';
const SHARE_LABEL = '⇪';
const IMPORT_PLACEHOLDER = 'paste a share code or URL';

/**
 * The garage: a name to type and a button per robot to save it under that
 * name, then the saved robots, each with buttons to load it into either robot
 * and to delete it. Deleting takes two presses of its button.
 */
export class GaragePanel {
  private readonly nameInput: HTMLInputElement;
  private readonly rows = createElement('div', 'garage-rows');
  private readonly importInput: HTMLInputElement;
  /** The delete button that was pressed once and waits for the second press. */
  private armed: HTMLButtonElement | null = null;
  /** The robot whose share code is shown under its row, if any. */
  private sharing: string | null = null;
  private shared: { url: string; code: string } | null = null;

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

    this.importInput = createElement('input', 'garage-name-input');
    this.importInput.type = 'text';
    this.importInput.placeholder = IMPORT_PLACEHOLDER;
    this.importInput.setAttribute('aria-label', 'Share code or URL of a robot to keep');
    this.importInput.spellcheck = false;
    const importButton = createElement('button', 'tool-button', 'IMPORT');
    importButton.type = 'button';
    importButton.title = 'Keep the robot in the pasted share code or URL';
    const doImport = () => {
      handlers.importCode(this.importInput.value);
      this.importInput.value = '';
    };
    importButton.addEventListener('click', doImport);
    this.importInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') doImport();
    });
    const importRow = createElement('div', 'garage-import');
    importRow.append(this.importInput, importButton);
    container.replaceChildren(save, this.rows, importRow);

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
    if (this.sharing !== null && !names.includes(this.sharing)) this.closeShare();
    this.rows.replaceChildren(
      ...names.flatMap((name) => (name === this.sharing && this.shared !== null ? [this.rowOf(name), this.shareBox(this.shared)] : [this.rowOf(name)])),
    );
  }

  /** Shows the share code and URL of the robot under its row, or puts them away when shown already. */
  async toggleShare(name: string, names: readonly string[]): Promise<void> {
    if (this.sharing === name) {
      this.closeShare();
    } else {
      const shared = await this.handlers.share(name);
      if (shared === null) return;
      this.sharing = name;
      this.shared = shared;
    }
    this.show(names);
  }

  private closeShare(): void {
    this.sharing = null;
    this.shared = null;
  }

  private shareBox({ url, code }: { url: string; code: string }): HTMLElement {
    const box = createElement('div', 'garage-share');
    for (const [label, text] of [
      ['URL', url],
      ['CODE', code],
    ]) {
      const field = createElement('input', 'garage-share-field');
      field.type = 'text';
      field.readOnly = true;
      field.value = text;
      field.setAttribute('aria-label', `Share ${label}`);
      field.addEventListener('focus', () => field.select());
      const copy = createElement('button', 'garage-action', `COPY ${label}`);
      copy.type = 'button';
      copy.title = `Copy the ${label} to the clipboard`;
      copy.addEventListener('click', () => {
        field.select();
        navigator.clipboard?.writeText(text).catch(() => {
          // Left selected: the player can copy it by hand.
        });
      });
      const line = createElement('div', 'garage-share-line');
      line.append(field, copy);
      box.append(line);
    }
    return box;
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

    const share = createElement('button', 'garage-action', SHARE_LABEL);
    share.type = 'button';
    share.title = `Share ${name}: a code and a URL that put it in someone's garage`;
    share.addEventListener('click', () => {
      void this.toggleShare(name, [...this.rows.querySelectorAll('.garage-name')].map((label) => label.textContent ?? ''));
    });
    row.append(share);
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
