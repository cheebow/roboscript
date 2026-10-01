import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, drawSelection, gutter, keymap, lineNumbers } from '@codemirror/view';
import { roboscriptHighlight } from './roboscript_highlight';

const INDENT = '    ';

const setErrorLines = StateEffect.define<readonly number[]>();
const errorLine = Decoration.line({ class: 'cm-error-line' });

/** Lines marked as faulty by the last RUN. The marks follow their lines as the text is edited. */
const errorLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLines)) continue;
      const { doc } = transaction.state;
      const ranges = effect.value
        .filter((line) => line >= 1 && line <= doc.lines)
        .map((line) => errorLine.range(doc.line(line).from));
      next = Decoration.set(ranges, true);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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
    // Empty for now: the margin where breakpoints will be set.
    '.cm-breakpoint-gutter': { width: '14px' },
    '.cm-error-line': { backgroundColor: 'var(--error-line)' },
  },
  { dark: true },
);

/** The RoboScript editor: line numbers, undo/redo, highlighting and error-line marks. */
export class CodeEditor {
  private readonly view: EditorView;

  constructor(parent: HTMLElement, source: string, onChange: (source: string) => void) {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        extensions: [
          gutter({ class: 'cm-breakpoint-gutter' }),
          lineNumbers(),
          history(),
          drawSelection(),
          indentUnit.of(INDENT),
          EditorState.tabSize.of(INDENT.length),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          roboscriptHighlight(),
          errorLines,
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
  }

  get source(): string {
    return this.view.state.doc.toString();
  }

  /** Marks the given 1-based lines as faulty, replacing earlier marks. */
  showErrorLines(lines: readonly number[]): void {
    this.view.dispatch({ effects: setErrorLines.of(lines) });
  }
}
