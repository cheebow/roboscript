// What the standalone pages (the introduction and the help page) share:
// starting in the right language, the header with the links and the language
// toggle, and re-rendering when the language changes. The game itself knows
// nothing of these pages.
import { LANGUAGE_KEY, type Language, currentLanguage, detectLanguage, otherLanguage, useLanguage } from '../i18n/language';
import { createCredits } from '../ui/credits';
import { createButton, createElement } from '../ui/dom';

export interface PageText {
  en: string;
  ja: string;
}

/** The text in the language of the page. */
export function inLanguage(text: PageText): string {
  return text[currentLanguage()];
}

/**
 * Starts the page in the language the game keeps (so the game and the pages
 * stay in one language), renders it, and re-renders it when the toggle is
 * pressed. `render` gives the whole of the page below the header.
 */
export function startPage(title: PageText, render: () => HTMLElement): void {
  try {
    useLanguage(detectLanguage(window.localStorage.getItem(LANGUAGE_KEY), navigator.language));
  } catch {
    useLanguage(detectLanguage(null, navigator.language));
  }
  const show = () => {
    document.documentElement.lang = currentLanguage();
    document.title = inLanguage(title);
    document.body.replaceChildren(pageHeader(show), render(), pageFooter());
  };
  show();
}

/** The game, the two pages and the language toggle, along the top. */
function pageHeader(onLanguageChange: () => void): HTMLElement {
  const header = createElement('header', 'page-header');
  const home = createElement('a', 'page-title', 'ROBOSCRIPT');
  home.href = './about.html';
  const links = createElement('nav', 'page-links');
  for (const [href, text] of [
    ['./about.html', { en: 'About', ja: '紹介' }],
    ['./help.html', { en: 'Help', ja: 'ヘルプ' }],
    ['./', { en: 'Play', ja: '遊ぶ' }],
  ] as const) {
    const link = createElement('a', 'page-link', inLanguage(text));
    link.href = href;
    if (window.location.pathname.endsWith(href.slice(1)) && href !== './') link.classList.add('selected');
    links.append(link);
  }
  const language = createButton('tool-button page-language', currentLanguage() === 'en' ? '日本語' : 'English', '', () => {
    const next = otherLanguage(currentLanguage());
    useLanguage(next);
    saveLanguage(next);
    onLanguageChange();
  });
  header.append(home, links, language);
  return header;
}

function pageFooter(): HTMLElement {
  const footer = createElement('footer', 'page-footer');
  footer.append(createCredits('page-credits'));
  return footer;
}

function saveLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Storage may be blocked: the toggle still works for this visit.
  }
}
