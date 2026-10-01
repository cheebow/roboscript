import { acceptCompletion, closeBracketsKeymap, completionStatus } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { type Diagnostic, forEachDiagnostic, setDiagnostics } from '@codemirror/lint';
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
import { parse } from '../ai/parser';
import { withoutComment } from '../ai/reference';
import type { ScriptError } from '../ai/script_error';
import { roboscriptAssist } from './roboscript_assist';
import { roboscriptHighlight } from './roboscript_highlight';

const INDENT = '    ';
/** How long after the last edit new errors are pointed out. Errors that are put right go away at once. */
const CHECK_DELAY_MS = 500;

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

/** Lines marked as faulty by the last RUN, until they are put right. */
const errorLines = lineHighlight('cm-error-line');
/** Lines the program has already run since the displayed tick. */
const executedLines = lineHighlight('cm-executed-line');
/** The line the program runs next. */
const currentLine = lineHighlight('cm-current-line');

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
    // Line numbers and the margin can be clicked to toggle breakpoints.
    '.cm-gutterElement': { cursor: 'pointer' },
    '.cm-breakpoint-gutter': { width: '14px' },
    '.cm-breakpoint-gutter .cm-gutterElement': { color: 'var(--error)', textAlign: 'center' },
    '.cm-executed-line': { backgroundColor: 'var(--executed-line)' },
    '.cm-current-line': { backgroundColor: 'var(--current-line)' },
    '.cm-error-line': { backgroundColor: 'var(--error-line)' },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy var(--error)',
      textUnderlineOffset: '3px',
    },
    '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--selection)' },
    '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'var(--error-line)' },
    // Suggestions, explanations and error messages.
    '.cm-tooltip': {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border)',
      color: 'var(--text)',
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--font-size)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-family)', maxHeight: '16em' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '1px 8px', lineHeight: '1.5' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--selection)', color: 'var(--text)' },
    '.cm-completionDetail': { marginLeft: '2ch', color: 'var(--muted)', fontStyle: 'normal' },
    '.cm-tooltip.cm-completionInfo': { maxWidth: '36ch', padding: '4px 8px', lineHeight: '1.5' },
    '.cm-word-info': { maxWidth: '44ch', padding: '4px 8px', lineHeight: '1.5' },
    '.cm-diagnostic': { padding: '4px 8px', lineHeight: '1.5' },
    '.cm-diagnostic-error': { borderLeft: '3px solid var(--error)' },
  },
  { dark: true },
);

/**
 * The RoboScript editor: line numbers, undo/redo, highlighting, help while
 * writing (suggestions, explanations, indentation, errors underlined shortly
 * after typing), breakpoints (click the margin or a line number), and marks
 * for faulty lines, the lines already run and the line to run next.
 */
export class CodeEditor {
  private readonly view: EditorView;
  private checkTimer: number | null = null;
  /** What each per-frame highlight currently shows, to skip updates that change nothing. */
  private readonly shown = new Map<LineHighlight, string>();

  /** `onChange` is called with the new text after every edit. */
  constructor(parent: HTMLElement, source: string, onChange: (source: string) => void) {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        extensions: [
          breakpoints,
          gutter({
            class: 'cm-breakpoint-gutter',
            markers: (view) => view.state.field(breakpoints),
            domEventHandlers: { mousedown: toggleBreakpointOnLine },
          }),
          lineNumbers({ domEventHandlers: { mousedown: toggleBreakpointOnLine } }),
          history(),
          drawSelection(),
          indentUnit.of(INDENT),
          EditorState.tabSize.of(INDENT.length),
          // Tab picks the selected suggestion while a list is open, and indents otherwise.
          keymap.of([
            { key: 'Tab', run: acceptCompletion },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          roboscriptHighlight(),
          roboscriptAssist(),
          executedLines.field,
          currentLine.field,
          errorLines.field,
          theme,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            this.check(false);
            this.checkSoon();
            onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    this.check(true);
  }

  get source(): string {
    return this.view.state.doc.toString();
  }

  /** Replaces the whole text. The change can be undone like any edit. */
  setSource(source: string): void {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: source } });
  }

  /**
   * Marks the given 1-based lines as faulty, replacing earlier marks. The mark
   * of a line goes away once the line is found free of errors after an edit.
   */
  showErrorLines(lines: readonly number[]): void {
    this.view.dispatch({ effects: errorLines.set.of(lines) });
    this.check(true);
  }

  /** Points out new errors once typing has paused, and not while a list of suggestions is open on a half-typed word. */
  private checkSoon(): void {
    if (this.checkTimer !== null) window.clearTimeout(this.checkTimer);
    this.checkTimer = window.setTimeout(() => {
      if (completionStatus(this.view.state) === null) this.check(true);
      else this.checkSoon();
    }, CHECK_DELAY_MS);
  }

  /**
   * Underlines the code of the lines with an error, and takes the faulty mark
   * off the lines that have none. Without `includeNew`, only lines already
   * underlined are kept up to date, so nothing new shows up in mid-word.
   */
  private check(includeNew: boolean): void {
    if (includeNew && this.checkTimer !== null) {
      window.clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    const { state } = this.view;
    const underlined = new Set<number>();
    forEachDiagnostic(state, (_diagnostic, from) => underlined.add(state.doc.lineAt(from).number));
    const marked = this.linesOf(state.field(errorLines.field));
    if (!includeNew && underlined.size === 0 && marked.length === 0) return;

    const { errors } = parse(state.doc.toString());
    const shown = includeNew ? errors : errors.filter((error) => underlined.has(error.line));
    const faulty = new Set(errors.map((error) => error.line));
    const stillMarked = marked.filter((line) => faulty.has(line));
    this.view.dispatch(
      setDiagnostics(
        state,
        shown.map((error) => this.diagnosticOf(error)),
      ),
      stillMarked.length === marked.length ? {} : { effects: errorLines.set.of(stillMarked) },
    );
  }

  /** The error as an underline under the code of its line: without the indentation and the comment. */
  private diagnosticOf(error: ScriptError): Diagnostic {
    const { doc } = this.view.state;
    const line = doc.line(Math.min(Math.max(error.line, 1), doc.lines));
    const code = withoutComment(line.text);
    const from = line.from + (code.length - code.trimStart().length);
    const to = line.from + code.trimEnd().length;
    return { from: Math.min(from, to), to, severity: 'error', message: error.message };
  }

  /** The 1-based lines that carry a mark of the given set. */
  private linesOf(marks: RangeSet<Decoration | GutterMarker>): number[] {
    const { doc } = this.view.state;
    const lines: number[] = [];
    marks.between(0, doc.length, (from) => {
      lines.push(doc.lineAt(from).number);
    });
    return lines;
  }

  /** Marks the given 1-based lines as executed. Cheap to call every frame. */
  showExecutedLines(lines: readonly number[]): void {
    this.showLines(executedLines, lines);
  }

  /** Marks the 1-based line the program runs next, or none. Cheap to call every frame. */
  showCurrentLine(line: number | null): void {
    this.showLines(currentLine, line === null ? [] : [line]);
  }

  /** The 1-based lines that currently have a breakpoint. */
  breakpointLines(): number[] {
    return this.linesOf(this.view.state.field(breakpoints));
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
