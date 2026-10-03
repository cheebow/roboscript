import { type MessageKey, t } from './messages';

/**
 * Puts the current language on the page's fixed texts: elements with a
 * `data-i18n` attribute get the text of that key, those with a
 * `data-i18n-title` the tooltip of that key. The HTML carries the English.
 */
export function translateStatic(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n as MessageKey;
    element.textContent = t(key);
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const key = element.dataset.i18nTitle as MessageKey;
    element.title = t(key);
  }
}
