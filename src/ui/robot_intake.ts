import { ActionMenu, type MenuItem } from './action_menu';
import { createElement } from './dom';
import { t } from '../i18n/messages';

export interface IntakeTexts {
  /** The menu button. */
  label: string;
  title: string;
  /** The button that takes the pasted code. */
  submit: string;
  submitTitle: string;
}

const CODE_ITEM = 'paste-code';

/**
 * A menu of ways to take in a robot, one of which is to paste a share code.
 * Picking that puts a field for the code where the menu button was, until the
 * code is taken, or the field is closed or left empty.
 */
export class RobotIntake {
  readonly element = createElement('div', 'robot-intake');
  private readonly menuHolder = createElement('div', 'menu panel-menu');
  private readonly menu: ActionMenu;
  private readonly codeRow = createElement('div', 'intake-code');
  private readonly input: HTMLInputElement;

  constructor(
    texts: IntakeTexts,
    /** Takes the pasted code; true when it was taken and the field can go. */
    private readonly onCode: (code: string) => boolean | Promise<boolean>,
    onPick: (id: string) => void,
  ) {
    const button = createElement('button', 'tool-button panel-menu-button', texts.label);
    button.type = 'button';
    button.title = texts.title;
    this.menuHolder.append(button);
    this.menu = new ActionMenu(this.menuHolder, button, [], (id) => (id === CODE_ITEM ? this.openCode() : onPick(id)));

    this.input = createElement('input', 'garage-name-input');
    this.input.type = 'text';
    this.input.placeholder = t('intake.code.placeholder');
    this.input.spellcheck = false;
    this.input.setAttribute('aria-label', t('intake.code.placeholder'));
    const submit = createElement('button', 'tool-button', texts.submit);
    submit.type = 'button';
    submit.title = texts.submitTitle;
    submit.addEventListener('click', () => void this.take());
    const close = createElement('button', 'garage-action', '×');
    close.type = 'button';
    close.title = t('intake.close.title');
    close.addEventListener('click', () => this.closeCode());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.take();
      if (event.key === 'Escape') this.closeCode();
    });
    // Left empty, the field goes away again.
    this.codeRow.addEventListener('focusout', (event) => {
      if (event.relatedTarget instanceof Node && this.codeRow.contains(event.relatedTarget)) return;
      if (this.input.value.trim() === '') this.closeCode();
    });
    this.codeRow.append(this.input, submit, close);
    this.codeRow.hidden = true;
    this.element.append(this.menuHolder, this.codeRow);
  }

  /** The other ways to take in a robot; "paste a share code" comes after them. */
  setItems(items: readonly MenuItem[]): void {
    this.menu.setItems([...items, { id: CODE_ITEM, label: t('intake.code') }]);
  }

  private openCode(): void {
    this.menuHolder.hidden = true;
    this.codeRow.hidden = false;
    this.input.focus();
  }

  private closeCode(): void {
    this.input.value = '';
    this.codeRow.hidden = true;
    this.menuHolder.hidden = false;
  }

  private async take(): Promise<void> {
    if (await this.onCode(this.input.value)) this.closeCode();
  }
}
