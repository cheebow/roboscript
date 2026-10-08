import { type MessageKey, t } from '../i18n/messages';
import { chooseFile } from '../share/file';
import { createButton, createElement } from './dom';

// The pieces the watching screens' line-ups share: the arena, the contest
// and the team battle all pick entrants from the garage and the built-in
// ones, and take shared matches in as codes and files.

/** Where a line-up's entrants come from, and the heading of each group in the pickers. */
export const ENTRANT_GROUPS: readonly { origin: 'garage' | 'built-in'; label: MessageKey }[] = [
  { origin: 'garage', label: 'arena.group.garage' },
  { origin: 'built-in', label: 'arena.group.builtIn' },
];

/** The entrants as a picker's option groups, the garage's first; a group with nothing in it is left out. */
export function entrantOptions(entrants: readonly { id: string; name: string; origin: 'garage' | 'built-in' }[]): HTMLOptGroupElement[] {
  return ENTRANT_GROUPS.map(({ origin, label }) => {
    const group = document.createElement('optgroup');
    group.label = t(label);
    group.append(...entrants.filter((entrant) => entrant.origin === origin).map((entrant) => new Option(entrant.name, entrant.id)));
    return group;
  }).filter((group) => group.childElementCount > 0);
}

/** The row that takes a shared match in: a code to paste and play, and a button that opens a match file. */
export function createImportRow(handlers: {
  /** Plays the pasted code; true when it was played (the field is then emptied). */
  importCode(code: string): Promise<boolean>;
  /** Plays the match of a file's text. */
  openFile(text: string): void;
  /** Says why a file could not be read. */
  problem(problem: string): void;
}): HTMLElement {
  const input = createElement('input', 'garage-name-input');
  input.type = 'text';
  input.placeholder = t('arena.import.placeholder');
  input.setAttribute('aria-label', t('arena.import.placeholder'));
  input.spellcheck = false;
  const importButton = createButton('tool-button', t('arena.import'), t('arena.import.title'), () => {
    void handlers.importCode(input.value).then((played) => {
      // Kept when it could not be played, to be put right.
      if (played) input.value = '';
    });
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') importButton.click();
  });
  const openFile = createButton('tool-button', t('arena.openFile'), t('arena.openFile.title'), () =>
    chooseFile(
      (text) => handlers.openFile(text),
      (problem) => handlers.problem(problem),
    ),
  );
  const row = createElement('div', 'lineup-import');
  row.append(input, importButton, openFile);
  return row;
}
