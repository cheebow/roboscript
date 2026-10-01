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
import { type EditorView, hoverTooltip } from '@codemirror/view';
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
    apply: suggestion.addSpace ? applyWithSpace : undefined,
  };
}

/** Inserts the word and a space, and goes straight on to suggesting what follows it. */
function applyWithSpace(view: EditorView, completion: Completion, from: number, to: number): void {
  // Reuse a space that is already there rather than adding a second one.
  const end = view.state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to;
  view.dispatch({
    ...insertCompletionText(view.state, `${completion.label} `, from, end),
    annotations: pickedCompletion.of(completion),
  });
  startCompletion(view);
}

const explainOnHover = hoverTooltip((view, position) => {
  const description = describeAt(view.state.doc.toString(), position);
  if (description === null) return null;
  return {
    pos: description.from,
    end: description.to,
    above: true,
    create: () => ({ dom: createElement('div', 'cm-word-info', description.summary) }),
  };
});

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
    // Ahead of the language's own indentation, which has no rules.
    Prec.high(indentation),
    indentOnInput(),
    closeBrackets(),
    bracketMatching(),
  ];
}
