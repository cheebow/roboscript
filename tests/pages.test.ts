// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { allWords } from '../src/ai/reference';
import { CHALLENGES } from '../src/challenge/challenges';
import { TEAM_TEMPLATES } from '../src/data/team_templates';
import { HELP } from '../src/help/topics';
import { type Language, useLanguage } from '../src/i18n/language';
import { renderAbout } from '../src/pages/about';
import { renderHelpPage } from '../src/pages/help_page';

// The standalone pages: the introduction (about.html) and the help page (help.html).

function inLanguage(language: Language, render: () => HTMLElement): HTMLElement {
  useLanguage(language);
  try {
    return render();
  } finally {
    useLanguage('en');
  }
}

describe('the help page', () => {
  it.each(['en', 'ja'] as const)('carries every topic of the help under its own anchor, and every word, in %s', (language) => {
    const page = inLanguage(language, renderHelpPage);
    for (const topic of HELP.flatMap((section) => section.topics)) {
      expect(page.querySelector(`section[id="${topic.id}"]`), topic.id).not.toBeNull();
      expect(page.querySelector(`a[href="#${topic.id}"]`), topic.id).not.toBeNull();
    }
    for (const word of allWords()) {
      expect(page.querySelector(`[data-word="${word.word}"]`), word.word).not.toBeNull();
    }
  });

  it('shows the topics in the language asked for', () => {
    expect(inLanguage('ja', renderHelpPage).textContent).toContain('レシピ集');
    expect(inLanguage('en', renderHelpPage).textContent).toContain('Recipes');
  });
});

describe('the introduction', () => {
  it.each(['en', 'ja'] as const)('renders whole in %s, with the way into the game and the help', (language) => {
    const page = inLanguage(language, renderAbout);
    expect(page.querySelector('a.about-play')?.getAttribute('href')).toBe('./');
    expect(page.querySelector('a[href="./help.html"]')).not.toBeNull();
    expect(page.querySelectorAll('.about-pillar').length).toBe(4);
    const samples = [...page.querySelectorAll('.about-code')].map((code) => code.textContent ?? '');
    expect(samples[0]).toContain('enemy_visible');
    // The team battle has its own pillar, with the one program that splits a team's roles.
    expect(samples[1]).toContain('self_id');
    expect(page.querySelector('img.about-shot')?.getAttribute('alt')).not.toBe('');
  });

  it('takes its numbers from the game, so they never go stale', () => {
    const text = inLanguage('ja', renderAbout).textContent ?? '';
    expect(text).toContain(`チャレンジ ${CHALLENGES.length} 問`);
    expect(text).toContain(`内蔵チーム ${TEAM_TEMPLATES.length} 組`);
  });
});
