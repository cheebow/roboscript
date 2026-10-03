import type { KeyValueStorage } from '../project/project_store';

/** The sizes the player has set by dragging; null for the default. */
export interface Layout {
  /** px, the width of the editor column. */
  editorWidth: number | null;
  /** px, the height of the bottom row (DEBUG LOG, INSPECTOR, WATCH). */
  bottomHeight: number | null;
}

export const LAYOUT_KEY = 'roboscript/layout.json';
/** Widths of the fixed parts of the grid (src/style.css): the project column, the toolbar row, a splitter. */
const PROJECT_WIDTH = 180;
const TOOLBAR_HEIGHT = 34;
const SPLITTER_SIZE = 6;
/** The least room each part keeps however the splitters are dragged. */
export const EDITOR_MIN_WIDTH = 320;
export const BATTLE_MIN_WIDTH = 300;
export const BOTTOM_MIN_HEIGHT = 120;
export const TOP_MIN_HEIGHT = 200;

/** The editor width that fits the window: at least the minimum, and leaving the battle view its minimum. */
export function clampEditorWidth(width: number, appWidth: number): number {
  const most = appWidth - PROJECT_WIDTH - SPLITTER_SIZE - BATTLE_MIN_WIDTH;
  return Math.round(Math.max(EDITOR_MIN_WIDTH, Math.min(width, most)));
}

/** The bottom row height that fits the window: at least its minimum, and leaving the top row its minimum. */
export function clampBottomHeight(height: number, appHeight: number): number {
  const most = appHeight - TOOLBAR_HEIGHT - SPLITTER_SIZE - TOP_MIN_HEIGHT;
  return Math.round(Math.max(BOTTOM_MIN_HEIGHT, Math.min(height, most)));
}

/** The layout kept in storage; defaults for anything missing or unreadable. */
export function readLayout(text: string | null): Layout {
  const none: Layout = { editorWidth: null, bottomHeight: null };
  if (text === null) return none;
  try {
    const saved: unknown = JSON.parse(text);
    if (typeof saved !== 'object' || saved === null) return none;
    const { editorWidth, bottomHeight } = saved as Record<string, unknown>;
    return {
      editorWidth: typeof editorWidth === 'number' && Number.isFinite(editorWidth) ? editorWidth : null,
      bottomHeight: typeof bottomHeight === 'number' && Number.isFinite(bottomHeight) ? bottomHeight : null,
    };
  } catch {
    return none;
  }
}

export function writeLayout(layout: Layout): string {
  return JSON.stringify(layout);
}

/**
 * The two splitters of the program screen: dragging the one beside the editor
 * sets its width, dragging the one under the top row sets the height of the
 * bottom row. A double-click puts a size back to its default. Sizes are kept
 * in storage and set again at the next start.
 */
export class Splitters {
  private layout: Layout;

  constructor(
    private readonly app: HTMLElement,
    vertical: HTMLElement,
    horizontal: HTMLElement,
    private readonly storage: KeyValueStorage | null,
  ) {
    this.layout = readLayout(storage?.getItem(LAYOUT_KEY) ?? null);
    this.apply();
    this.attach(vertical, (event) => {
      const width = event.clientX - this.app.getBoundingClientRect().left - PROJECT_WIDTH - SPLITTER_SIZE / 2;
      this.layout.editorWidth = clampEditorWidth(width, this.app.clientWidth);
    }, () => {
      this.layout.editorWidth = null;
    });
    this.attach(horizontal, (event) => {
      const height = this.app.getBoundingClientRect().bottom - event.clientY - SPLITTER_SIZE / 2;
      this.layout.bottomHeight = clampBottomHeight(height, this.app.clientHeight);
    }, () => {
      this.layout.bottomHeight = null;
    });
  }

  private attach(splitter: HTMLElement, drag: (event: PointerEvent) => void, reset: () => void): void {
    splitter.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);
      splitter.classList.add('dragging');
    });
    splitter.addEventListener('pointermove', (event) => {
      if (!splitter.hasPointerCapture(event.pointerId)) return;
      drag(event);
      this.apply();
    });
    const end = (event: PointerEvent) => {
      if (!splitter.hasPointerCapture(event.pointerId)) return;
      splitter.releasePointerCapture(event.pointerId);
      splitter.classList.remove('dragging');
      this.save();
    };
    splitter.addEventListener('pointerup', end);
    splitter.addEventListener('pointercancel', end);
    splitter.addEventListener('dblclick', () => {
      reset();
      this.apply();
      this.save();
    });
  }

  /** Puts the sizes on the grid, keeping each within what fits the window now. */
  private apply(): void {
    const { editorWidth, bottomHeight } = this.layout;
    const width = editorWidth === null ? null : clampEditorWidth(editorWidth, this.app.clientWidth);
    const height = bottomHeight === null ? null : clampBottomHeight(bottomHeight, this.app.clientHeight);
    this.setVariable('--editor-width', width);
    this.setVariable('--bottom-height', height);
  }

  private setVariable(name: string, pixels: number | null): void {
    if (pixels === null) this.app.style.removeProperty(name);
    else this.app.style.setProperty(name, `${pixels}px`);
  }

  private save(): void {
    try {
      this.storage?.setItem(LAYOUT_KEY, writeLayout(this.layout));
    } catch {
      // Storage may be full or blocked: the sizes still hold until the page is left.
    }
  }
}
