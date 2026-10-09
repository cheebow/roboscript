// The help on a page of its own (help.html), for reading before playing: the
// same topics, word list and recipes as the game's help, from the same data,
// all on one page with anchors, so a topic can be linked to directly.
import '../style.css';
import './pages.css';
import { allWords } from '../ai/reference';
import { renderRecipes } from '../help/recipe_list';
import { HELP, RECIPES_TOPIC, WORDS_TOPIC } from '../help/topics';
import { renderWordList } from '../help/word_list';
import { createElement } from '../ui/dom';
import { local } from '../ui/tutorial_panel';
import { renderMarkup } from '../ui/markup';
import { type PageText, inLanguage, startPage } from './page';

const TITLE: PageText = {
  en: 'RoboScript help: how to play, and the guide to the language',
  ja: 'RoboScript ヘルプ: 使い方とスクリプトの解説',
};

/** The whole help as one page: a table of contents, then every topic under its own anchor. */
export function renderHelpPage(): HTMLElement {
  const page = createElement('div', 'help-page');
  const nav = createElement('nav', 'help-page-nav');
  const content = createElement('main', 'help-page-content');

  const intro = createElement('p', 'markup-paragraph', inLanguage({
    en: 'Everything the game\'s help says, on one page: read it before you play, or link to a topic. The same help is in the game, next to the editor.',
    ja: 'ゲームの中のヘルプと同じ内容を、1 ページで読めます。遊ぶ前に読むのにも、項目へのリンクにも。同じヘルプは、ゲームの中でもエディタの横で読めます。',
  }));
  content.append(createElement('h1', 'about-section-title', inLanguage({ en: 'RoboScript help', ja: 'RoboScript ヘルプ' })), intro);

  for (const section of HELP) {
    nav.append(createElement('h2', '', local(section.title)));
    for (const topic of section.topics) {
      const link = createElement('a', '', local(topic.title));
      link.href = `#${topic.id}`;
      nav.append(link);

      const article = createElement('section', 'help-page-topic');
      article.id = topic.id;
      article.append(createElement('h2', '', local(topic.title)));
      article.append(
        topic.id === WORDS_TOPIC ? renderWordList(allWords()) : topic.id === RECIPES_TOPIC ? renderRecipes() : renderMarkup(local(topic.body)),
      );
      content.append(article);
    }
  }
  page.append(nav, content);
  return page;
}

export function startHelpPage(): void {
  startPage(TITLE, renderHelpPage);
}
