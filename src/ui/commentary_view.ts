import type { CommentaryLine } from '../arena/commentary';
import { createElement } from './dom';

/** The commentary over the bottom of the battle view, in step with the replay: the line being said, nothing else. */
export class CommentaryView {
  readonly element = createElement('div', 'commentary');
  /** What is shown now, to leave the page alone on frames where nothing changes. */
  private shown: CommentaryLine | null = null;

  constructor() {
    this.element.setAttribute('aria-live', 'polite');
  }

  /** Shows the newest line said by the tick; nothing at all when `on` is false. */
  update(lines: readonly CommentaryLine[], tick: number, on: boolean): void {
    let said = 0;
    while (on && said < lines.length && lines[said].tick <= tick) said++;
    const line = said > 0 ? lines[said - 1] : null;
    if (line === this.shown) return;
    this.shown = line;
    if (line === null) {
      this.element.replaceChildren();
      return;
    }
    const row = createElement('div', 'commentary-line', line.text);
    row.dataset.age = '0';
    this.element.replaceChildren(row);
  }
}
