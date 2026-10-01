import type { DebugEvent } from '../debug/debug_event';
import { createElement } from './dom';
import { formatTimestamp } from './format';

/** How close to the bottom (px) the view must be to keep following new rows. */
const FOLLOW_THRESHOLD = 4;
const FUTURE_CLASS = 'future';
const SELECTED_CLASS = 'selected';

/**
 * Renders debug events, one row each. Rows appear as playback first reaches
 * their tick; rows later than the displayed tick are dimmed. Clicking a row
 * reports its event.
 */
export class DebugLogView {
  private source: readonly DebugEvent[] | null = null;
  private rows: HTMLElement[] = [];
  /** Index of the first dimmed row; rows from here on are later than the displayed tick. */
  private futureFrom = 0;
  private selected: HTMLElement | null = null;

  constructor(
    private readonly container: HTMLElement,
    onSelect: (event: DebugEvent) => void,
  ) {
    container.addEventListener('click', (click) => {
      const row = click.target instanceof Element ? click.target.closest<HTMLElement>('.log-row') : null;
      const index = row === null ? -1 : this.rows.indexOf(row);
      if (row === null || index < 0 || this.source === null) return;
      this.select(row);
      onSelect(this.source[index]);
    });
  }

  /**
   * `events` must be ordered by tick. Shows those up to `reachedTick` and dims
   * those after `currentTick`. Starts over when given a different list.
   */
  update(events: readonly DebugEvent[], reachedTick: number, currentTick: number): void {
    if (events !== this.source) {
      this.container.replaceChildren();
      this.source = events;
      this.rows = [];
      this.futureFrom = 0;
      this.selected = null;
    }
    this.appendUpTo(events, reachedTick);
    this.dimAfter(events, currentTick);
  }

  private appendUpTo(events: readonly DebugEvent[], reachedTick: number): void {
    const first = this.rows.length;
    let end = first;
    while (end < events.length && events[end].tick <= reachedTick) end++;
    if (end === first) return;

    const { scrollHeight, scrollTop, clientHeight } = this.container;
    const following = scrollHeight - scrollTop - clientHeight < FOLLOW_THRESHOLD;
    const fragment = document.createDocumentFragment();
    // New rows start out dimmed if any dimmed row precedes them; dimAfter() then settles the boundary.
    const dimmed = this.futureFrom < first;
    for (let index = first; index < end; index++) {
      const row = createRow(events[index]);
      row.classList.toggle(FUTURE_CLASS, dimmed);
      this.rows.push(row);
      fragment.append(row);
    }
    if (!dimmed) this.futureFrom = end;
    this.container.append(fragment);
    if (following) this.container.scrollTop = this.container.scrollHeight;
  }

  private dimAfter(events: readonly DebugEvent[], currentTick: number): void {
    let boundary = this.futureFrom;
    while (boundary > 0 && events[boundary - 1].tick > currentTick) {
      boundary--;
      this.rows[boundary].classList.add(FUTURE_CLASS);
    }
    while (boundary < this.rows.length && events[boundary].tick <= currentTick) {
      this.rows[boundary].classList.remove(FUTURE_CLASS);
      boundary++;
    }
    this.futureFrom = boundary;
  }

  private select(row: HTMLElement): void {
    this.selected?.classList.remove(SELECTED_CLASS);
    row.classList.add(SELECTED_CLASS);
    this.selected = row;
  }
}

function createRow(event: DebugEvent): HTMLElement {
  const row = createElement('div', `log-row log-${event.type}`);
  row.append(
    createElement('span', 'log-time', `[${formatTimestamp(event.timestamp)}]`),
    createElement('span', 'log-robot', event.robotId ?? ''),
    createElement('span', 'log-type', event.type.toUpperCase()),
    createElement('span', 'log-message', event.message),
  );
  return row;
}
