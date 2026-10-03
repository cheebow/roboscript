import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  autocompletion,
  closeBrackets,
  insertCompletionText,
  pickedCompletion,
  startCompletion,
} from '@codemirror/autocomplete';
import { bracketMatching, getIndentUnit, indentOnInput, indentService } from '@codemirror/language';
import { type Extension, Prec } from '@codemirror/state';
import { type EditorView, hoverTooltip, keymap } from '@codemirror/view';
import { t } from '../i18n/messages';
import { type Suggestion, completionsAt } from '../ai/completion';
import { indentFor } from '../ai/indentation';
import { describeAt } from '../ai/reference';
import { createElement } from './dom';

// Help while writing RoboScript: suggestions, explanations on hover and
// automatic indentation. What to suggest, explain and indent is decided in
// src/ai; this file only connects those decisions to the editor.

function suggest(context: CompletionContext): CompletionResult | null {
  const suggestions = completionsAt(context.state.doc.toString(), context.pos, context.explicit);
  if (suggestions === null) return null;
  // The options are already narrowed to what was typed, and in the order to show them.
  return { from: suggestions.from, filter: false, options: suggestions.options.map(toCompletion) };
}

function toCompletion(suggestion: Suggestion, index: number): Completion {
  return {
    label: suggestion.word,
    detail: suggestion.hint,
    info: suggestion.summary,
    boost: -index,
    apply: suggestion.insert === suggestion.word ? undefined : insertAndGoOn(suggestion.insert),
  };
}

/**
 * Puts in a word together with what must follow it (a space, or the
 * parenthesis of a call), and goes straight on to suggesting what comes next.
 */
function insertAndGoOn(text: string) {
  return (view: EditorView, completion: Completion, from: number, to: number): void => {
    // Reuse a space or parenthesis that is already there rather than adding a second one.
    const last = text[text.length - 1];
    const end = text.endsWith(')') || view.state.sliceDoc(to, to + 1) !== last ? to : to + 1;
    view.dispatch({
      ...insertCompletionText(view.state, text, from, end),
      annotations: pickedCompletion.of(completion),
    });
    startCompletion(view);
  };
}

/** Sent on the document, with a word of the language as its detail, to open the guide at that word. */
export const GUIDE_EVENT = 'roboscript:guide';

/** The words with an entry of their own in the guide: the language's, not the program's own names. */
const IN_THE_GUIDE = new Set(['control', 'command', 'direction', 'sensor']);

function openGuide(word: string): void {
  document.dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: word }));
}

const explainOnHover = hoverTooltip((view, position) => {
  const description = describeAt(view.state.doc.toString(), position);
  if (description === null) return null;
  return {
    pos: description.from,
    end: description.to,
    above: true,
    create: () => {
      const dom = createElement('div', 'cm-word-info', description.summary);
      if (IN_THE_GUIDE.has(description.kind)) {
        const more = createElement('button', 'cm-word-guide', t('editor.openGuide'));
        more.type = 'button';
        more.addEventListener('mousedown', (event) => {
          event.preventDefault();
          openGuide(description.word);
        });
        dom.append(more);
      }
      return { dom };
    },
  };
});

/** F1 opens the guide at the word under the cursor, or at its start. */
const guideKey = keymap.of([
  {
    key: 'F1',
    run: (view) => {
      const description = describeAt(view.state.doc.toString(), view.state.selection.main.head);
      openGuide(description !== null && IN_THE_GUIDE.has(description.kind) ? description.word : '');
      return true;
    },
  },
]);

const indentation = indentService.of((context, position) => {
  // On Enter, the line is treated as already broken at the cursor.
  const current = context.lineAt(position, 1);
  const above = context.state.doc.sliceString(0, current.from).split('\n');
  const lines = [...above, current.text];
  return indentFor(lines, lines.length - 1, getIndentUnit(context.state));
});

/** Suggestions while typing, explanations on hover, automatic indentation and bracket handling for RoboScript. */
export function roboscriptAssist(): Extension {
  return [
    autocompletion({ override: [suggest], icons: false }),
    explainOnHover,
    guideKey,
    // Ahead of the language's own indentation, which has no rules.
    Prec.high(indentation),
    indentOnInput(),
    closeBrackets(),
    bracketMatching(),
  ];
}
