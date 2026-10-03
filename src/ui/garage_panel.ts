import { createElement } from './dom';
import { t } from '../i18n/messages';
import { acceptDrops, chooseFile } from '../share/file';

export interface GarageHandlers {
  /** Keep the robot at the given spawn index under the name as typed, which may not be a usable name. */
  save(name: string, robotIndex: number): void;
  /** Put the robot kept under the name in place of the robot at the given spawn index. */
  load(name: string, robotIndex: number): void;
  remove(name: string): void;
  /** The share code of the robot kept under the name; null when there is none. */
  share(name: string): Promise<string | null>;
  /** Keep the robot in the pasted share code. */
  importCode(text: string): void;
  /** Save the robot kept under the name as a file. */
  saveFile(name: string): void;
  /** Keep the robot in the text of a robot file. */
  importFile(text: string): void;
}

const REMOVE_LABEL = '×';
const ARMED_CLASS = 'armed';
const SHARE_LABEL = '⇪';

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
  /** The robot whose share code is shown under its row, if any, and the code. */
  private sharing: string | null = null;
  private shared: string | null = null;

  constructor(
    container: HTMLElement,
    private readonly robotIds: readonly string[],
    private readonly handlers: GarageHandlers,
  ) {
    this.nameInput = createElement('input', 'garage-name-input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = t('garage.name.placeholder');
    this.nameInput.setAttribute('aria-label', 'Name to save a robot under');
    this.nameInput.spellcheck = false;

    const saveButtons = createElement('div', 'garage-save-buttons');
    robotIds.forEach((robotId, robotIndex) => {
      const button = createElement('button', 'tool-button', t('garage.save', { robot: robotId }));
      button.type = 'button';
      button.title = t('garage.save.title', { robot: robotId });
      button.addEventListener('click', () => handlers.save(this.nameInput.value, robotIndex));
      saveButtons.append(button);
    });
    const save = createElement('div', 'garage-save');
    save.append(this.nameInput, saveButtons);

    this.importInput = createElement('input', 'garage-name-input');
    this.importInput.type = 'text';
    this.importInput.placeholder = t('garage.import.placeholder');
    this.importInput.setAttribute('aria-label', 'Share code of a robot to keep');
    this.importInput.spellcheck = false;
    const importButton = createElement('button', 'tool-button', t('garage.import'));
    importButton.type = 'button';
    importButton.title = t('garage.import.title');
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
    const openFile = createElement('button', 'tool-button', t('garage.openFile'));
    openFile.type = 'button';
    openFile.title = t('garage.openFile.title');
    openFile.addEventListener('click', () => chooseFile((text) => handlers.importFile(text)));
    const fileRow = createElement('div', 'garage-import');
    fileRow.append(openFile);
    container.replaceChildren(save, this.rows, importRow, fileRow);
    acceptDrops(container, (text) => handlers.importFile(text));

    // A press anywhere but on the waiting delete button calls the deletion off.
    document.addEventListener('mousedown', (event) => {
      if (event.target !== this.armed) this.disarm();
    });
  }

  /** Lists the saved robots by the given names. */
  show(names: readonly string[]): void {
    this.armed = null;
    if (names.length === 0) {
      this.rows.replaceChildren(createElement('div', 'garage-empty', t('garage.empty')));
      return;
    }
    if (this.sharing !== null && !names.includes(this.sharing)) this.closeShare();
    this.rows.replaceChildren(
      ...names.flatMap((name) => (name === this.sharing && this.shared !== null ? [this.rowOf(name), this.shareBox(name, this.shared)] : [this.rowOf(name)])),
    );
  }

  /** Shows the share code of the robot under its row, or puts it away when shown already. */
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

  private shareBox(name: string, code: string): HTMLElement {
    const field = createElement('input', 'garage-share-field');
    field.type = 'text';
    field.readOnly = true;
    field.value = code;
    field.setAttribute('aria-label', 'Share code');
    field.addEventListener('focus', () => field.select());
    const copy = createElement('button', 'garage-action', t('garage.copy'));
    copy.type = 'button';
    copy.title = t('garage.copy.title');
    copy.addEventListener('click', () => {
      field.select();
      navigator.clipboard?.writeText(code).catch(() => {
        // Left selected: the player can copy it by hand.
      });
    });
    const saveFile = createElement('button', 'garage-action', t('garage.saveFile'));
    saveFile.type = 'button';
    saveFile.title = t('garage.saveFile.title', { name });
    saveFile.addEventListener('click', () => this.handlers.saveFile(name));
    // The code on a line of its own, the buttons under it: the panel is narrow.
    const line = createElement('div', 'garage-share-line');
    line.append(field);
    const actions = createElement('div', 'garage-share-line');
    actions.append(copy, saveFile);
    const box = createElement('div', 'garage-share');
    box.append(line, actions);
    return box;
  }

  private rowOf(name: string): HTMLElement {
    const row = createElement('div', 'garage-row');
    const label = createElement('button', 'garage-name', name);
    label.type = 'button';
    label.title = t('garage.name.title');
    label.addEventListener('click', () => {
      this.nameInput.value = name;
    });
    row.append(label);

    this.robotIds.forEach((robotId, robotIndex) => {
      const load = createElement('button', 'garage-action', robotId[0]);
      load.type = 'button';
      load.title = t('garage.load.title', { name, robot: robotId });
      load.addEventListener('click', () => this.handlers.load(name, robotIndex));
      row.append(load);
    });

    const share = createElement('button', 'garage-action', SHARE_LABEL);
    share.type = 'button';
    share.title = t('garage.share.title', { name });
    share.addEventListener('click', () => {
      void this.toggleShare(name, [...this.rows.querySelectorAll('.garage-name')].map((label) => label.textContent ?? ''));
    });
    row.append(share);
    const remove = createElement('button', 'garage-action', REMOVE_LABEL);
    remove.type = 'button';
    remove.title = t('garage.delete.title', { name });
    remove.addEventListener('click', () => {
      if (this.armed === remove) {
        this.handlers.remove(name);
        return;
      }
      this.disarm();
      this.armed = remove;
      remove.textContent = t('garage.delete.confirm');
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
