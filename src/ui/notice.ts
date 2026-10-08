import { t } from '../i18n/messages';
import { createElement } from './dom';

/** How long a notice stays before it fades, ms: long enough to read a sentence twice. */
const SHOWN_FOR = 8000;

/**
 * One line under a panel's controls that says what the last action there did,
 * or why it could not. What went well fades by itself; a problem is marked as
 * one and stays until the next notice, or until it is clicked away, so that
 * it is not gone before it is read.
 */
export class Notice {
  readonly element = createElement('div', 'notice');
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.element.setAttribute('role', 'status');
    this.element.hidden = true;
    this.element.addEventListener('click', () => this.clear());
  }

  /** Says what happened; `problem` when it did not go as asked. */
  show(text: string, problem = false): void {
    this.element.textContent = text;
    this.element.classList.toggle('problem', problem);
    this.element.hidden = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = problem ? null : setTimeout(() => this.clear(), SHOWN_FOR);
    this.element.title = problem ? t('notice.dismiss') : '';
  }

  clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.element.hidden = true;
    this.element.textContent = '';
  }
}
