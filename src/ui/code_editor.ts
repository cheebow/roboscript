import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state';
import {
  type BlockInfo,
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  drawSelection,
  gutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { roboscriptHighlight } from './roboscript_highlight';

const INDENT = '    ';

/**
 * A set of whole lines given a CSS class. The set is replaced through the
 * effect; in between, the marks follow their lines as the text is edited.
 */
function lineHighlight(className: string) {
  const set = StateEffect.define<readonly number[]>();
  const mark = Decoration.line({ class: className });
  const field = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(marks, transaction) {
      let next = marks.map(transaction.changes);
      for (const effect of transaction.effects) {
        if (!effect.is(set)) continue;
        const { doc } = transaction.state;
        const ranges = effect.value
          .filter((line) => line >= 1 && line <= doc.lines)
          .map((line) => mark.range(doc.line(line).from));
        next = Decoration.set(ranges, true);
      }
      return next;
    },
    provide: (self) => EditorView.decorations.from(self),
  });
  return { set, field };
}

type LineHighlight = ReturnType<typeof lineHighlight>;

/** Lines marked as faulty by the last RUN. */
const errorLines = lineHighlight('cm-error-line');
/** Lines the AI executed on the tick being displayed. */
const executedLines = lineHighlight('cm-executed-line');
/** Breakpoint lines that run on the next tick: where playback has stopped. */
const nextLines = lineHighlight('cm-next-line');

class BreakpointMarker extends GutterMarker {
  toDOM(): Node {
    return document.createTextNode('●');
  }
}

const breakpointMarker = new BreakpointMarker();
/** Toggles the breakpoint on the line starting at the given document position. */
const toggleBreakpoint = StateEffect.define<number>();

const breakpoints = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, transaction) {
    let next = markers.map(transaction.changes);
    if (transaction.docChanged) {
      // An edit can leave a marker in the middle of a line (e.g. when two
      // lines are joined); move every marker back to the start of its line.
      const { doc } = transaction.state;
      const starts = new Set<number>();
      next.between(0, doc.length, (from) => {
        starts.add(doc.lineAt(from).from);
      });
      next = RangeSet.of([...starts].sort((a, b) => a - b).map((start) => breakpointMarker.range(start)));
    }
    for (const effect of transaction.effects) {
      if (!effect.is(toggleBreakpoint)) continue;
      const lineStart = effect.value;
      let exists = false;
      next.between(lineStart, lineStart, () => {
        exists = true;
      });
      next = exists
        ? next.update({ filter: (from) => from !== lineStart })
        : next.update({ add: [breakpointMarker.range(lineStart)] });
    }
    return next;
  },
});

function toggleBreakpointOnLine(view: EditorView, line: BlockInfo): boolean {
  view.dispatch({ effects: toggleBreakpoint.of(line.from) });
  return true;
}

const theme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: 'var(--panel)', color: 'var(--text)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-family)', fontSize: 'var(--font-size)', lineHeight: '1.5' },
    '.cm-content': { caretColor: 'var(--text)' },
    '.cm-cursor': { borderLeftColor: 'var(--text)' },
    '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'var(--selection)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--panel)',
      color: 'var(--muted)',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-breakpoint-gutter': { width: '14px' },
    '.cm-breakpoint-gutter .cm-gutterElement': { color: 'var(--error)', textAlign: 'center' },
    '.cm-executed-line': { backgroundColor: 'var(--executed-line)' },
    '.cm-next-line': { backgroundColor: 'var(--next-line)' },
    '.cm-error-line': { backgroundColor: 'var(--error-line)' },
  },
  { dark: true },
);

/** Line numbers and the margin can be clicked to toggle breakpoints. */
const clickableGutterTheme = EditorView.theme({ '.cm-gutterElement': { cursor: 'pointer' } });

export interface CodeEditorOptions {
  /** Called with the new text after every edit. */
  onChange?: (source: string) => void;
  /** Shows the code without letting it be edited; no breakpoints. */
  readOnly?: boolean;
}

/**
 * The RoboScript editor: line numbers, undo/redo, highlighting, breakpoints
 * (click the margin or a line number), and error / executed line marks.
 * A read-only editor only shows highlighted code.
 */
export class CodeEditor {
  private readonly view: EditorView;
  /** What each per-frame highlight currently shows, to skip updates that change nothing. */
  private readonly shown = new Map<LineHighlight, string>();

  constructor(parent: HTMLElement, source: string, options: CodeEditorOptions = {}) {
    const { onChange } = options;
    const editing = options.readOnly
      ? [EditorState.readOnly.of(true), EditorView.editable.of(false), lineNumbers()]
      : [
          breakpoints,
          gutter({
            class: 'cm-breakpoint-gutter',
            markers: (view) => view.state.field(breakpoints),
            domEventHandlers: { mousedown: toggleBreakpointOnLine },
          }),
          lineNumbers({ domEventHandlers: { mousedown: toggleBreakpointOnLine } }),
          clickableGutterTheme,
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          executedLines.field,
          nextLines.field,
          errorLines.field,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange?.(update.state.doc.toString());
          }),
        ];
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        extensions: [
          ...editing,
          drawSelection(),
          indentUnit.of(INDENT),
          EditorState.tabSize.of(INDENT.length),
          roboscriptHighlight(),
          theme,
        ],
      }),
    });
  }

  get source(): string {
    return this.view.state.doc.toString();
  }

  /** Replaces the whole text. */
  setSource(source: string): void {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: source } });
  }

  /** Marks the given 1-based lines as faulty, replacing earlier marks. */
  showErrorLines(lines: readonly number[]): void {
    this.view.dispatch({ effects: errorLines.set.of(lines) });
  }

  /** Marks the given 1-based lines as executed. Cheap to call every frame. */
  showExecutedLines(lines: readonly number[]): void {
    this.showLines(executedLines, lines);
  }

  /** Marks the given 1-based lines as about to run. Cheap to call every frame. */
  showNextLines(lines: readonly number[]): void {
    this.showLines(nextLines, lines);
  }

  /** The 1-based lines that currently have a breakpoint. */
  breakpointLines(): number[] {
    const { doc } = this.view.state;
    const lines: number[] = [];
    this.view.state.field(breakpoints).between(0, doc.length, (from) => {
      lines.push(doc.lineAt(from).number);
    });
    return lines;
  }

  private showLines(highlight: LineHighlight, lines: readonly number[]): void {
    const key = lines.join(',');
    if (key === (this.shown.get(highlight) ?? '')) return;
    this.shown.set(highlight, key);
    this.view.dispatch({ effects: highlight.set.of(lines) });
  }

  /** Scrolls to the given 1-based line and selects it. */
  revealLine(lineNumber: number): void {
    const { doc } = this.view.state;
    if (lineNumber < 1 || lineNumber > doc.lines) return;
    const line = doc.line(lineNumber);
    this.view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    });
    this.view.focus();
  }
}
