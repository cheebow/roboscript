import { t } from '../i18n/messages';
import { createElement } from './dom';

export const COPYRIGHT = '© 2026 CHEEBOW';
export const SOURCE_URL = 'https://github.com/cheebow/roboscript';

/** The copyright and a link to the source on GitHub, opened in a new tab so the game stays where it is. */
export function createCredits(className: string): HTMLElement {
  const credits = createElement('div', `credits ${className}`);
  const source = createElement('a', 'credits-source', 'GitHub');
  source.href = SOURCE_URL;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.title = t('credits.source');
  credits.append(createElement('span', 'credits-copyright', COPYRIGHT), source);
  return credits;
}
