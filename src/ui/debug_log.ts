import type { DebugEvent } from '../debug/debug_event';
import { createElement } from './dom';

const TIME_DECIMALS = 3;
/** Width of the time before padding, e.g. "02.130". */
const TIME_WIDTH = 6;
/** How close to the bottom (px) the view must be to keep following new rows. */
const FOLLOW_THRESHOLD = 4;

/** Renders a growing list of debug events, one row each. */
export class DebugLogView {
  private source: readonly DebugEvent[] | null = null;
  private shown = 0;

  constructor(private readonly container: HTMLElement) {}

  /** Appends the events added since the last call; starts over when given a different list. */
  update(events: readonly DebugEvent[]): void {
    if (events !== this.source || events.length < this.shown) {
      this.container.replaceChildren();
      this.source = events;
      this.shown = 0;
    }
    if (this.shown === events.length) return;

    const { scrollHeight, scrollTop, clientHeight } = this.container;
    const following = scrollHeight - scrollTop - clientHeight < FOLLOW_THRESHOLD;
    const rows = document.createDocumentFragment();
    for (; this.shown < events.length; this.shown++) rows.append(createRow(events[this.shown]));
    this.container.append(rows);
    if (following) this.container.scrollTop = this.container.scrollHeight;
  }
}

function createRow(event: DebugEvent): HTMLElement {
  const row = createElement('div', `log-row log-${event.type}`);
  row.append(
    createElement('span', 'log-time', `[${formatTime(event.timestamp)}]`),
    createElement('span', 'log-robot', event.robotId ?? ''),
    createElement('span', 'log-type', event.type.toUpperCase()),
    createElement('span', 'log-message', event.message),
  );
  return row;
}

function formatTime(seconds: number): string {
  return seconds.toFixed(TIME_DECIMALS).padStart(TIME_WIDTH, '0');
}
