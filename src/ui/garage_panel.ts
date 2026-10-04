import { createButton, createElement } from './dom';
import { MAX_NAME_LENGTH, garageName } from '../project/garage';
import { t } from '../i18n/messages';
import { acceptDrops, chooseFile } from '../share/file';
import { RobotIntake } from './robot_intake';
import { createShareBox } from './share_box';
import { shareLink } from '../share/link';

export interface GarageHandlers {
  /** Keep the robot at the given spawn index under the name as typed, which may not be a usable name. */
  save(name: string, robotIndex: number): void;
  /** Put the robot kept under the name in place of the robot at the given spawn index. */
  load(name: string, robotIndex: number): void;
  remove(name: string): void;
  /** The share code of the robot kept under the name; null when there is none. */
  share(name: string): Promise<string | null>;
  /** Keep the robot in the pasted share code; true when it was kept. */
  importCode(text: string): Promise<boolean>;
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
 * name, then the saved robots, each with buttons to load it into either
 * robot, to share it (as a code or a file) and to delete it, and last a menu
 * to take in a robot someone shared. Deleting takes two presses of its button.
 */
export class GaragePanel {
  private readonly nameInput: HTMLInputElement;
  private readonly rows = createElement('div', 'garage-rows');
  /** The delete button that was pressed once and waits for the second press. */
  private armed: HTMLButtonElement | null = null;
  /** The robot whose share code is shown under its row, if any, and the code. */
  private sharing: string | null = null;
  private shared: string | null = null;
  /** Set while a share code is being made. */
  private making = false;
  /** What the waiting button said before it was pressed once. */
  private armedLabel = '';
  /** The names last shown. */
  private names: readonly string[] = [];

  constructor(
    container: HTMLElement,
    private readonly robotIds: readonly string[],
    private readonly handlers: GarageHandlers,
  ) {
    this.nameInput = createElement('input', 'garage-name-input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = t('garage.name.placeholder');
    this.nameInput.setAttribute('aria-label', t('garage.name.label'));
    this.nameInput.spellcheck = false;
    this.nameInput.maxLength = MAX_NAME_LENGTH;
    this.nameInput.title = t('garage.name.limit', { max: MAX_NAME_LENGTH });

    const saveButtons = createElement('div', 'garage-save-buttons');
    robotIds.forEach((robotId, robotIndex) => {
      const label = t('garage.save', { robot: robotId });
      const button = createButton('tool-button', label, t('garage.save.title', { robot: robotId }));
      button.addEventListener('click', () => {
        // Saving over a robot kept under the same name takes a second press, as deleting does.
        const name = garageName(this.nameInput.value);
        if (name !== null && this.names.includes(name) && this.armed !== button) {
          this.arm(button, t('garage.save.confirm'));
          return;
        }
        this.disarm();
        handlers.save(this.nameInput.value, robotIndex);
      });
      saveButtons.append(button);
    });
    const save = createElement('div', 'garage-save');
    save.append(this.nameInput, saveButtons);

    const intake = new RobotIntake(
      { label: t('garage.intake'), title: t('garage.intake.title'), submit: t('garage.import'), submitTitle: t('garage.import.title') },
      (code) => handlers.importCode(code),
      () => chooseFile((text) => handlers.importFile(text)),
    );
    intake.setItems([{ id: 'file', label: t('garage.openFile'), title: t('garage.openFile.title') }]);
    intake.element.classList.add('garage-intake');
    container.replaceChildren(save, this.rows, intake.element);
    acceptDrops(container, (text) => handlers.importFile(text));

    // A press anywhere but on the waiting button calls it off.
    document.addEventListener('mousedown', (event) => {
      if (event.target !== this.armed) this.disarm();
    });
  }

  /** Lists the saved robots by the given names. */
  show(names: readonly string[]): void {
    this.armed = null;
    this.names = names;
    if (this.sharing !== null && !names.includes(this.sharing)) this.closeShare();
    if (names.length === 0) {
      this.rows.replaceChildren(createElement('div', 'garage-empty', t('garage.empty')));
      return;
    }
    this.rows.replaceChildren(
      ...names.flatMap((name) => (name === this.sharing && this.shared !== null ? [this.rowOf(name), this.shareBox(name, this.shared)] : [this.rowOf(name)])),
    );
  }

  /** Shows the share code of the robot under its row, or puts it away when shown already. */
  private async toggleShare(name: string): Promise<void> {
    if (this.sharing === name) {
      this.closeShare();
    } else {
      // The code is made in the background: a second press meanwhile is not a second request.
      if (this.making) return;
      this.making = true;
      try {
        const shared = await this.handlers.share(name).catch(() => null);
        if (shared === null) return;
        this.sharing = name;
        this.shared = shared;
      } finally {
        this.making = false;
      }
    }
    this.show(this.names);
  }

  private closeShare(): void {
    this.sharing = null;
    this.shared = null;
  }

  private shareBox(name: string, code: string): HTMLElement {
    const saveFile = createButton('tool-button share-action', t('garage.saveFile'), t('garage.saveFile.title', { name }), () => this.handlers.saveFile(name));
    const link = { url: shareLink('robot', code, window.location.href), title: t('share.robotTitle', { name }) };
    return createShareBox(code, 'garage-share', [saveFile], link);
  }


  private rowOf(name: string): HTMLElement {
    const row = createElement('div', 'garage-row');
    const label = createButton('garage-name', name, t('garage.name.title'));
    label.addEventListener('click', () => {
      this.nameInput.value = name;
    });
    row.append(label);

    this.robotIds.forEach((robotId, robotIndex) => {
      const load = createButton('garage-action', robotId[0], t('garage.load.title', { name, robot: robotId }), () => this.handlers.load(name, robotIndex));
      row.append(load);
    });

    const share = createButton('garage-action', SHARE_LABEL, t('garage.share.title', { name }));
    share.addEventListener('click', () => {
      void this.toggleShare(name);
    });
    row.append(share);
    const remove = createButton('garage-action', REMOVE_LABEL, t('garage.delete.title', { name }));
    remove.addEventListener('click', () => {
      if (this.armed === remove) {
        this.handlers.remove(name);
        return;
      }
      this.arm(remove, t('garage.delete.confirm'));
    });
    row.append(remove);
    return row;
  }

  /** Makes the button wait for a second press, saying what that press will do. */
  private arm(button: HTMLButtonElement, asking: string): void {
    this.disarm();
    this.armed = button;
    this.armedLabel = button.textContent ?? '';
    button.textContent = asking;
    button.classList.add(ARMED_CLASS);
  }

  private disarm(): void {
    if (this.armed === null) return;
    this.armed.textContent = this.armedLabel;
    this.armed.classList.remove(ARMED_CLASS);
    this.armed = null;
  }
}
