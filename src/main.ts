import { LANGUAGE_KEY, detectLanguage, useLanguage } from './i18n/language';
import { translateStatic } from './i18n/static';
import { startApp } from './ui/app';

/** The language kept in storage, or null when there is none or storage is blocked. */
function savedLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

const language = detectLanguage(savedLanguage(), navigator.language);
useLanguage(language);
document.documentElement.lang = language;
translateStatic(document);
startApp();

// Installable and playable offline: a built game keeps its files with a service worker.
// Not while developing, where the files change at every save.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Without a service worker the game still works: only online.
    });
  });
}
