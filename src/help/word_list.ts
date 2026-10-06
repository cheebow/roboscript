// The list of all the words of the language, as shown in the game's help
// panel and on the help page: each word with what it is, what it does, and a
// short program that uses it. Made from the language's own descriptions
// (src/ai/reference.ts), so it never falls behind the language.
import { type WordKind, type WordReference, describeWord } from '../ai/reference';
import { t } from '../i18n/messages';
import { createButton, createElement } from '../ui/dom';
import { WORD_EXAMPLES } from './word_examples';

/** The kinds of word in the list of all words, in the order they are shown. */
export const WORD_GROUPS: readonly WordKind[] = ['control', 'command', 'direction', 'sensor', 'builtin'];

/** The words, by kind: each with what it is, what it does, and a short program that uses it. Buttons at the top go to each kind. */
export function renderWordList(words: readonly WordReference[]): HTMLElement {
  const list = createElement('div', 'help-words');
  const jumps = createElement('div', 'help-word-jumps');
  list.append(jumps);
  for (const kind of WORD_GROUPS) {
    const ofKind = words.filter((word) => word.kind === kind);
    if (ofKind.length === 0) continue;
    const group = createElement('section', 'help-word-group');
    const title = t(`help.kind.${kind}` as 'help.kind.control');
    const heading = createElement('h3', 'help-word-group-title', title);
    group.append(heading, createElement('p', 'help-word-group-what', t(`help.kind.${kind}.what` as 'help.kind.control.what')));
    jumps.append(createButton('tool-button', title, '', () => heading.scrollIntoView({ block: 'start' })));
    for (const word of ofKind) {
      const entry = createElement('div', 'help-word');
      entry.dataset.word = word.word;
      const head = createElement('div', 'help-word-head');
      head.append(createElement('code', 'help-word-name', word.word), createElement('span', 'help-word-hint', word.hint));
      entry.append(head, createElement('p', 'help-word-summary', word.summary));
      const example = WORD_EXAMPLES[`${word.kind}:${word.word}`];
      if (example !== undefined) entry.append(exampleOf(example, word.word));
      group.append(entry);
    }
    list.append(group);
  }
  return list;
}

/** The example program, coloured as the editor colours it, with the word it shows picked out. */
function exampleOf(source: string, featured: string): HTMLElement {
  const code = createElement('pre', 'help-word-example');
  const parts = source.split(/([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)/);
  parts.forEach((part, index) => {
    if (part === '') return;
    // The split leaves the words and numbers at the odd places, what lies between them at the even ones.
    if (index % 2 === 0) {
      code.append(part);
      return;
    }
    const kind = /^\d/.test(part) ? 'number' : (describeWord(part)?.kind ?? 'name');
    code.append(createElement('span', `code-${kind}${part === featured ? ' code-featured' : ''}`, part));
  });
  return code;
}
