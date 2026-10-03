import type { CommentaryLine } from '../arena/commentary';
import { createElement } from './dom';

/** How many lines of the commentary show at once: the newest at the bottom, the older ones fading. */
const SHOWN_LINES = 3;

/** The commentary over the bottom of the battle view, in step with the replay. */
export class CommentaryView {
  readonly element = createElement('div', 'commentary');
  /** What is shown now, to leave the page alone on frames where nothing changes. */
  private shown: readonly CommentaryLine[] = [];

  constructor() {
    this.element.setAttribute('aria-live', 'polite');
  }

  /** Shows the lines said up to the tick; nothing at all when `on` is false. */
  update(lines: readonly CommentaryLine[], tick: number, on: boolean): void {
    let said = 0;
    while (on && said < lines.length && lines[said].tick <= tick) said++;
    const shown = lines.slice(Math.max(0, said - SHOWN_LINES), said);
    if (shown.length === this.shown.length && shown.every((line, index) => line === this.shown[index])) return;
    this.shown = shown;
    this.element.replaceChildren(
      ...shown.map((line, index) => {
        const row = createElement('div', 'commentary-line', line.text);
        // The newest line is the one to read; the ones before it fade.
        row.dataset.age = `${shown.length - 1 - index}`;
        return row;
      }),
    );
  }
}
