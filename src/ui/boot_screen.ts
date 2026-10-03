import { ARENAS } from '../data/arenas';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { PARTS, SLOTS } from '../data/parts';
import { TEMPLATES } from '../data/templates';
import { RULES_VERSION } from '../data/rules_version';
import { type MessageKey, t } from '../i18n/messages';
import type { KeyValueStorage } from '../project/project_store';
import { createElement } from './dom';

/** What can be started from the boot menu. */
export type BootChoice = 'tutorial' | 'program' | 'arena' | 'contest' | 'language';
const CHOICES: readonly BootChoice[] = ['tutorial', 'program', 'arena', 'contest', 'language'];

export const BOOT_KEY = 'roboscript/boot.json';

/** ms between the lines of the start-up text: slower the first time, to be read; quicker after. */
const FIRST_LINE_DELAY = 110;
const LINE_DELAY = 22;

interface BootLine {
  /** The thing checked, padded with dots up to its result. */
  label: string;
  result: string;
}

/**
 * The start-up screen: lines like a computer's start-up check, then a menu of
 * what to start. Shown when the page opens, and again from the ⏻ button. Any
 * key or click skips the lines.
 */
export class BootScreen {
  private element: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cursor = 0;
  private items: HTMLButtonElement[] = [];
  private menu: HTMLElement | null = null;

  constructor(
    private readonly storage: KeyValueStorage | null,
    private readonly onChoose: (choice: BootChoice) => void,
    /** Choices that cannot be picked yet, shown dimmed. */
    private readonly unavailable: ReadonlySet<BootChoice> = new Set(),
  ) {}

  get shown(): boolean {
    return this.element !== null;
  }

  show(): void {
    if (this.element !== null) return;
    const saved = this.readSaved();
    const element = createElement('div', 'boot');
    element.id = 'boot';
    element.tabIndex = -1;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', t('boot.title'));
    const log = createElement('div', 'boot-log');
    element.append(log);
    document.body.append(element);
    this.element = element;
    element.focus();

    const lines = this.lines();
    const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const delay = saved.last === null ? FIRST_LINE_DELAY : LINE_DELAY;
    let shownLines = 0;
    const finish = () => {
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
      while (shownLines < lines.length) log.append(this.lineElement(lines[shownLines++]));
      if (this.menu === null) this.showMenu(saved.last);
    };
    const next = () => {
      if (shownLines >= lines.length) {
        finish();
        return;
      }
      log.append(this.lineElement(lines[shownLines++]));
      this.timer = setTimeout(next, delay);
    };
    element.addEventListener('keydown', (event) => {
      if (this.menu === null) {
        event.preventDefault();
        finish();
        return;
      }
      this.onKey(event);
    });
    element.addEventListener('mousedown', () => {
      if (this.menu === null) finish();
    });
    if (quiet) finish();
    else next();
  }

  hide(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.element?.remove();
    this.element = null;
    this.menu = null;
    this.items = [];
  }

  /**
   * The start-up text: a title, then each thing the game is made of, checked.
   * Always in English, as a computer's start-up text is; only the menu below it follows the language of the screen.
   */
  private lines(): (BootLine | string)[] {
    const slots = SLOTS.map((slot) => slot.toUpperCase()).join(' / ');
    return [
      `ROBOSCRIPT BIOS   rules ${RULES_VERSION}`,
      '',
      { label: 'CPU   RoboScript interpreter', result: 'OK' },
      { label: `MEM   program memory, ${MATCH_DEFAULTS.lineBudget} lines a tick`, result: 'OK' },
      { label: `PARTS ${slots}`, result: `${PARTS.length} found` },
      { label: `ARENA ${ARENAS.length} maps`, result: 'OK' },
      { label: `BOTS  ${TEMPLATES.length} built-in robots`, result: 'OK' },
      { label: `CLOCK ${MATCH_DEFAULTS.tickRate} ticks a second`, result: 'OK' },
      '',
      'Ready.',
    ];
  }

  private lineElement(line: BootLine | string): HTMLElement {
    if (typeof line === 'string') return createElement('div', line === '' ? 'boot-line blank' : 'boot-line boot-heading', line);
    const row = createElement('div', 'boot-line');
    row.append(createElement('span', 'boot-label', line.label), createElement('span', 'boot-dots'), createElement('span', 'boot-ok', line.result));
    return row;
  }

  private showMenu(last: BootChoice | null): void {
    if (this.element === null) return;
    const menu = createElement('div', 'boot-menu');
    menu.setAttribute('role', 'menu');
    menu.append(createElement('div', 'boot-menu-title', t('boot.menu')));
    this.items = CHOICES.map((choice, index) => {
      const item = createElement('button', 'boot-item');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.disabled = this.unavailable.has(choice);
      item.append(
        createElement('span', 'boot-item-mark', '▶'),
        createElement('span', 'boot-item-name', t(`boot.choice.${choice}` as MessageKey)),
        createElement('span', 'boot-item-what', t(`boot.choice.${choice}.what` as MessageKey)),
      );
      item.addEventListener('mouseenter', () => this.moveTo(index));
      item.addEventListener('click', () => this.choose(choice));
      menu.append(item);
      return item;
    });
    const help = createElement('div', 'boot-help', t('boot.help'));
    this.element.append(menu, help);
    this.menu = menu;
    // The cursor starts on what was started last time; the first time, on the tutorial.
    const start = last ?? 'tutorial';
    const at = CHOICES.indexOf(start);
    this.moveTo(this.items[at]?.disabled === false ? at : this.items.findIndex((item) => !item.disabled));
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      let at = this.cursor;
      for (let tries = 0; tries < this.items.length; tries++) {
        at = (at + step + this.items.length) % this.items.length;
        if (!this.items[at].disabled) break;
      }
      this.moveTo(at);
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.choose(CHOICES[this.cursor]);
    } else {
      // A digit picks that line of the menu.
      const number = Number.parseInt(event.key, 10);
      if (number >= 1 && number <= CHOICES.length && !this.items[number - 1].disabled) this.choose(CHOICES[number - 1]);
      else return;
    }
    event.preventDefault();
  }

  private moveTo(index: number): void {
    if (index < 0 || this.items[index]?.disabled) return;
    this.cursor = index;
    this.items.forEach((item, at) => item.classList.toggle('current', at === index));
  }

  private choose(choice: BootChoice): void {
    if (this.unavailable.has(choice)) return;
    if (choice !== 'language') this.save(choice);
    if (choice !== 'language') this.hide();
    this.onChoose(choice);
  }

  private readSaved(): { last: BootChoice | null } {
    try {
      const value: unknown = JSON.parse(this.storage?.getItem(BOOT_KEY) ?? 'null');
      const last = typeof value === 'object' && value !== null ? (value as { last?: unknown }).last : null;
      return { last: CHOICES.includes(last as BootChoice) ? (last as BootChoice) : null };
    } catch {
      return { last: null };
    }
  }

  private save(choice: BootChoice): void {
    try {
      this.storage?.setItem(BOOT_KEY, JSON.stringify({ version: 1, last: choice }));
    } catch {
      // Storage may be full or blocked: the menu then starts on the tutorial again next time.
    }
  }
}
