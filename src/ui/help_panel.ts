import { allWords } from '../ai/reference';
import type { HelpSection, HelpTopic } from '../help/topics';
import { t } from '../i18n/messages';
import { createCredits } from './credits';
import { createButton, createElement } from './dom';
import { renderMarkup } from './markup';
import { local } from './tutorial_panel';

/** The help's text, loaded the first time the help is opened: it is the biggest part of the game, and most visits never need it. */
interface HelpText {
  sections: readonly HelpSection[];
  wordsTopic: string;
  renderWordList: typeof import('../help/word_list').renderWordList;
}

let loading: Promise<HelpText> | null = null;

/** The help's text; a load that failed (offline, before it was ever kept) is tried again the next time. */
export function loadHelpText(): Promise<HelpText> {
  loading ??= Promise.all([import('../help/topics'), import('../help/word_list')])
    .then(([topics, list]) => ({ sections: topics.HELP, wordsTopic: topics.WORDS_TOPIC, renderWordList: list.renderWordList }))
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

/**
 * The help, sliding in from the right: a table of contents, a search field and
 * the topic. Two parts: how to use the app, and the guide to RoboScript, whose
 * list of all the words is made from the language's own descriptions. The
 * editor stays in view and usable beside it. Its frame opens at once; its
 * text follows as soon as it is loaded.
 */
export class HelpPanel {
  private element: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private nav: HTMLElement | null = null;
  private search: HTMLInputElement | null = null;
  private text: HelpText | null = null;
  /** The topic shown last; null for the first topic of the help. */
  private shownTopic: string | null = null;

  get shown(): boolean {
    return this.element !== null;
  }

  /** Opens the help at a topic (the one shown last, if none is given). */
  open(topicId?: string): void {
    this.withText((text) => this.showTopic(text, topicId ?? this.shownTopic ?? text.sections[0].topics[0].id));
  }

  /** Opens the guide to the language at its start. */
  openGuide(): void {
    this.withText((text) => this.showTopic(text, text.sections[1].topics[0].id));
  }

  /** Opens the guide at a word of the language; at the guide's start when the word is not one. */
  openWord(word: string): void {
    this.withText((text) => {
      this.showTopic(text, text.wordsTopic);
      const entry = this.content?.querySelector<HTMLElement>(`[data-word="${CSS.escape(word)}"]`);
      if (entry === null || entry === undefined) {
        this.showTopic(text, text.sections[1].topics[0].id);
        return;
      }
      entry.classList.add('help-word-found');
      entry.scrollIntoView({ block: 'center' });
    });
  }

  /** Opens the frame, and does `then` with the text once it is in, unless the help was closed meanwhile. */
  private withText(then: (text: HelpText) => void): void {
    this.build();
    if (this.text !== null) {
      then(this.text);
      return;
    }
    const opened = this.element;
    loadHelpText().then(
      (text) => {
        if (this.element === null || this.element !== opened) return;
        this.fill(text);
        then(text);
      },
      () => {
        if (this.element !== opened) return;
        this.content?.replaceChildren(createElement('p', 'help-empty', t('help.couldNotLoad')));
      },
    );
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
    this.text = null;
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
      const { text } = this;
      if (text === null) return;
      if (search.value.trim() === '') this.showTopic(text, this.shownTopic ?? text.sections[0].topics[0].id);
      else this.showSearch(text, search.value.trim());
    });
    const close = createButton('tool-button', '✕', t('help.close'), () => this.close());
    const header = createElement('div', 'help-header');
    header.append(createElement('span', 'help-title', t('help.title')), search, close);

    const nav = createElement('nav', 'help-nav');
    const content = createElement('div', 'help-content');
    content.append(createElement('p', 'help-empty', t('help.loading')));
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

  /** Puts the loaded text's table of contents in the frame. */
  private fill(text: HelpText): void {
    this.text = text;
    const { nav, search } = this;
    if (nav === null || search === null) return;
    for (const section of text.sections) {
      nav.append(createElement('div', 'help-section', local(section.title)));
      for (const topic of section.topics) {
        const link = createButton('help-link', local(topic.title), '', () => {
          search.value = '';
          this.showTopic(text, topic.id);
        });
        link.dataset.topic = topic.id;
        nav.append(link);
      }
    }
    nav.append(createCredits('help-credits'));
  }

  private showTopic(text: HelpText, topicId: string): void {
    const topics = text.sections.flatMap((section) => section.topics);
    const topic = topics.find((each) => each.id === topicId) ?? topics[0];
    this.shownTopic = topic.id;
    if (this.content === null) return;
    const heading = createElement('h2', 'help-topic-title', local(topic.title));
    this.content.replaceChildren(heading, topic.id === text.wordsTopic ? text.renderWordList(allWords()) : renderMarkup(local(topic.body)));
    this.content.scrollTop = 0;
    for (const link of this.nav?.querySelectorAll<HTMLElement>('.help-link') ?? []) {
      link.classList.toggle('selected', link.dataset.topic === topic.id);
    }
  }

  /** The topics and the words that have the text in them. */
  private showSearch(help: HelpText, text: string): void {
    if (this.content === null) return;
    const needle = text.toLowerCase();
    const has = (value: string) => value.toLowerCase().includes(needle);
    const topics = help.sections.flatMap((section) => section.topics).filter(
      (topic) => topic.id !== help.wordsTopic && (has(local(topic.title)) || has(local(topic.body))),
    );
    const words = allWords().filter((word) => has(word.word) || has(word.hint) || has(word.summary));
    const parts: HTMLElement[] = [createElement('h2', 'help-topic-title', t('help.results', { text }))];
    if (topics.length === 0 && words.length === 0) parts.push(createElement('p', 'help-empty', t('help.nothing')));
    for (const topic of topics) parts.push(this.topicLink(help, topic));
    if (words.length > 0) parts.push(help.renderWordList(words));
    this.content.replaceChildren(...parts);
    for (const link of this.nav?.querySelectorAll<HTMLElement>('.help-link') ?? []) link.classList.remove('selected');
  }

  private topicLink(help: HelpText, topic: HelpTopic): HTMLElement {
    return createButton('help-result', local(topic.title), '', () => {
      if (this.search !== null) this.search.value = '';
      this.showTopic(help, topic.id);
    });
  }

}
