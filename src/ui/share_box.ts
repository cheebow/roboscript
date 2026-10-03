import { t } from '../i18n/messages';
import { createButton, createElement } from './dom';

/**
 * A share code to copy: the code on a line of its own, chosen whole when
 * clicked, and under it a button to copy it with any others given.
 */
export function createShareBox(code: string, className: string, others: readonly HTMLButtonElement[] = []): HTMLElement {
  const field = createElement('input', 'garage-share-field');
  field.type = 'text';
  field.readOnly = true;
  field.value = code;
  field.setAttribute('aria-label', t('share.field'));
  field.addEventListener('focus', () => field.select());
  const copy = createButton('tool-button share-action', t('garage.copy'), t('garage.copy.title'), () => {
    field.select();
    navigator.clipboard?.writeText(code).catch(() => {
      // Left selected: the player can copy it by hand.
    });
  });
  const line = createElement('div', 'garage-share-line');
  line.append(field);
  const actions = createElement('div', 'garage-share-line');
  actions.append(copy, ...others);
  const box = createElement('div', className);
  box.append(line, actions);
  return box;
}
