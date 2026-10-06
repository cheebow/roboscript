import { allWords } from '../ai/reference';
import { renderWordList } from '../help/word_list';
import { HELP, type HelpTopic, WORDS_TOPIC } from '../help/topics';
import { t } from '../i18n/messages';
import { createCredits } from './credits';
import { createButton, createElement } from './dom';
import { renderMarkup } from './markup';
import { local } from './tutorial_panel';

/**
 * The help, sliding in from the right: a table of contents, a search field and
 * the topic. Two parts: how to use the app, and the guide to RoboScript, whose
 * list of all the words is made from the language's own descriptions. The
 * editor stays in view and usable beside it.
 */
export class HelpPanel {
  private element: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private nav: HTMLElement | null = null;
  private search: HTMLInputElement | null = null;
  private shownTopic = HELP[0].topics[0].id;

  get shown(): boolean {
    return this.element !== null;
  }

  /** Opens the help at a topic (the one shown last, if none is given). */
  open(topicId?: string): void {
    this.build();
    this.showTopic(topicId ?? this.shownTopic);
  }

  /** Opens the guide at a word of the language; at the guide's start when the word is not one. */
  openWord(word: string): void {
    this.build();
    this.showTopic(WORDS_TOPIC);
    const entry = this.content?.querySelector<HTMLElement>(`[data-word="${CSS.escape(word)}"]`);
    if (entry === null || entry === undefined) {
      this.showTopic(HELP[1].topics[0].id);
      return;
    }
    entry.classList.add('help-word-found');
    entry.scrollIntoView({ block: 'center' });
  }

  toggle(): void {
    if (this.shown) this.close();
    else this.open();
  }

  close(): void {
    this.element?.remove();
    this.element = null;
    this.content = null;
    this.nav = null;
    this.search = null;
  }

  private build(): void {
    if (this.element !== null) return;
    const element = createElement('aside', 'help');
    element.id = 'help';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', t('help.title'));

    const search = createElement('input', 'help-search');
    search.type = 'search';
    search.placeholder = t('help.search');
    search.setAttribute('aria-label', t('help.search'));
    search.addEventListener('input', () => {
      if (search.value.trim() === '') this.showTopic(this.shownTopic);
      else this.showSearch(search.value.trim());
    });
    const close = createButton('tool-button', '✕', t('help.close'), () => this.close());
    const header = createElement('div', 'help-header');
    header.append(createElement('span', 'help-title', t('help.title')), search, close);

    const nav = createElement('nav', 'help-nav');
    for (const section of HELP) {
      nav.append(createElement('div', 'help-section', local(section.title)));
      for (const topic of section.topics) {
        const link = createButton('help-link', local(topic.title), '', () => {
          search.value = '';
          this.showTopic(topic.id);
        });
        link.dataset.topic = topic.id;
        nav.append(link);
      }
    }
    nav.append(createCredits('help-credits'));
    const content = createElement('div', 'help-content');
    const body = createElement('div', 'help-body');
    body.append(nav, content);
    element.append(header, body);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    });
    document.body.append(element);
    this.element = element;
    this.content = content;
    this.nav = nav;
    this.search = search;
  }

  private showTopic(topicId: string): void {
    const topic = HELP.flatMap((section) => section.topics).find((each) => each.id === topicId) ?? HELP[0].topics[0];
    this.shownTopic = topic.id;
    if (this.content === null) return;
    const heading = createElement('h2', 'help-topic-title', local(topic.title));
    this.content.replaceChildren(heading, topic.id === WORDS_TOPIC ? renderWordList(allWords()) : renderMarkup(local(topic.body)));
    this.content.scrollTop = 0;
    for (const link of this.nav?.querySelectorAll<HTMLElement>('.help-link') ?? []) {
      link.classList.toggle('selected', link.dataset.topic === topic.id);
    }
  }

  /** The topics and the words that have the text in them. */
  private showSearch(text: string): void {
    if (this.content === null) return;
    const needle = text.toLowerCase();
    const has = (value: string) => value.toLowerCase().includes(needle);
    const topics = HELP.flatMap((section) => section.topics).filter(
      (topic) => topic.id !== WORDS_TOPIC && (has(local(topic.title)) || has(local(topic.body))),
    );
    const words = allWords().filter((word) => has(word.word) || has(word.hint) || has(word.summary));
    const parts: HTMLElement[] = [createElement('h2', 'help-topic-title', t('help.results', { text }))];
    if (topics.length === 0 && words.length === 0) parts.push(createElement('p', 'help-empty', t('help.nothing')));
    for (const topic of topics) parts.push(this.topicLink(topic));
    if (words.length > 0) parts.push(renderWordList(words));
    this.content.replaceChildren(...parts);
    for (const link of this.nav?.querySelectorAll<HTMLElement>('.help-link') ?? []) link.classList.remove('selected');
  }

  private topicLink(topic: HelpTopic): HTMLElement {
    return createButton('help-result', local(topic.title), '', () => {
      if (this.search !== null) this.search.value = '';
      this.showTopic(topic.id);
    });
  }

}
