/** The languages the screen can be shown in. The programs, their words and the log stay in English. */
export type Language = 'en' | 'ja';

export const LANGUAGES: readonly Language[] = ['en', 'ja'];
export const LANGUAGE_KEY = 'roboscript/language';

let current: Language = 'en';

export function currentLanguage(): Language {
  return current;
}

/** Makes the language the one every text is taken from, from now on. */
export function useLanguage(language: Language): void {
  current = language;
}

/** The language to start in: the one kept in storage, else the browser's if it is one of ours, else English. */
export function detectLanguage(saved: string | null, browserLanguage: string | undefined): Language {
  if (saved !== null && isLanguage(saved)) return saved;
  const browser = (browserLanguage ?? '').toLowerCase();
  return browser === 'ja' || browser.startsWith('ja-') ? 'ja' : 'en';
}

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** The other language: what the toggle switches to. */
export function otherLanguage(language: Language): Language {
  return language === 'en' ? 'ja' : 'en';
}
