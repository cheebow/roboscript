// The book on a page of its own (book.html): a read-through introduction and
// strategy guide, chapter after chapter, with a table of contents at the side.
import '../style.css';
import './pages.css';
import { BOOK, CHAPTERS } from '../book/chapters';
import { createFigure, createTimeline } from '../book/figures';
import { createSceneFrame, readingsRows, timelineRows } from '../book/scenes';
import { SHOTS } from '../book/shots';
import type { BookBlock, BookChapter } from '../book/types';
import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import { HELP } from '../help/topics';
import { currentLanguage } from '../i18n/language';
import type { Text } from '../tutorial/types';
import { createElement } from '../ui/dom';
import { renderMarkup } from '../ui/markup';
import { type PageText, inLanguage, startPage } from './page';

const TITLE: PageText = {
  en: 'The RoboScript book: from your first program to winning',
  ja: 'RoboScript の本: はじめてのプログラムから勝ち方まで',
};

const HELP_TOPICS = new Map(HELP.flatMap((section) => section.topics).map((topic) => [topic.id, topic]));

/** "Chapter 3: Time goes in ticks". */
export function chapterHeading(chapter: BookChapter): string {
  const number = CHAPTERS.indexOf(chapter) + 1;
  return inLanguage({ en: `Chapter ${number}: ${chapter.title.en}`, ja: `第 ${number} 章 ${chapter.title.ja}` });
}

function figure(picture: Element, caption: Text): HTMLElement {
  const element = createElement('figure', 'book-figure');
  element.append(picture, createElement('figcaption', 'book-caption', inLanguage(caption)));
  return element;
}

/** A table of sensor readings: a row for each tick. Numbers are rounded, as the eye reads them. */
function readingsTable(sensors: readonly string[], ticks: readonly number[], rows: (boolean | number)[][]): HTMLElement {
  const table = createElement('table', 'markup-table book-readings');
  const head = createElement('tr', '');
  head.append(createElement('th', '', 'tick'), ...sensors.map((sensor) => createElement('th', '', sensor)));
  table.append(head);
  rows.forEach((values, at) => {
    const row = createElement('tr', '');
    row.append(createElement('td', '', `${ticks[at]}`), ...values.map((value) => createElement('td', '', typeof value === 'boolean' ? `${value}` : `${Math.round(value)}`)));
    table.append(row);
  });
  return table;
}

function renderBlock(block: BookBlock): HTMLElement {
  switch (block.kind) {
    case 'text':
      return renderMarkup(inLanguage(block.text));
    case 'code':
      return createElement('pre', 'markup-code book-code', block.code.replace(/\n$/, ''));
    case 'scene':
      return figure(createSceneFrame(block.scene, inLanguage(block.caption)), block.caption);
    case 'timeline':
      return figure(createTimeline(block.timeline.program, timelineRows(block.timeline)), block.caption);
    case 'figure':
      return figure(createFigure(block.figure), block.caption);
    case 'readings':
      return figure(readingsTable(block.readings.sensors, block.readings.ticks, readingsRows(block.readings)), block.caption);
    case 'error': {
      const compiled = compileScript(block.program);
      if (compiled.ok) throw new Error(`A program of the book meant to be wrong compiles: ${block.program}`);
      const shown = createElement('div', 'book-error');
      shown.append(
        createElement('pre', 'markup-code book-code', block.program.replace(/\n$/, '')),
        ...compiled.errors.map((error) => createElement('div', 'book-error-message', formatError(error))),
      );
      return figure(shown, block.caption);
    }
    case 'shot': {
      const image = createElement('img', 'book-shot');
      image.src = SHOTS[block.shot];
      image.alt = inLanguage(block.caption);
      image.loading = 'lazy';
      return figure(image, block.caption);
    }
    case 'see': {
      const english = currentLanguage() === 'en';
      const see = createElement('p', 'book-see', english ? 'More in the help: ' : 'くわしくはヘルプの');
      block.topics.forEach((id, at) => {
        const topic = HELP_TOPICS.get(id);
        if (topic === undefined) throw new Error(`The book points to a help topic there is not: ${id}`);
        const link = createElement('a', '', english ? topic.title.en : `「${topic.title.ja}」`);
        link.href = `./help.html#${id}`;
        if (english && at > 0) see.append(', ');
        see.append(link);
      });
      see.append(english ? '.' : 'を見てください。');
      return see;
    }
  }
}

/** The whole book as one page: the contents at the side, then every chapter under its own anchor. */
export function renderBookPage(): HTMLElement {
  const page = createElement('div', 'help-page book-page');
  const nav = createElement('nav', 'help-page-nav book-nav');
  const content = createElement('main', 'help-page-content book-content');

  content.append(createElement('h1', 'about-section-title', inLanguage({ en: 'The RoboScript book', ja: 'RoboScript の本' })));

  for (const part of BOOK) {
    nav.append(createElement('h2', '', inLanguage(part.title)));
    content.append(createElement('h2', 'book-part-title', inLanguage(part.title)));
    for (const chapter of part.chapters) {
      const link = createElement('a', '', chapterHeading(chapter));
      link.href = `#${chapter.id}`;
      nav.append(link);

      const article = createElement('section', 'help-page-topic book-chapter');
      article.id = chapter.id;
      article.append(createElement('h2', '', chapterHeading(chapter)), ...chapter.blocks.map(renderBlock));
      const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1];
      if (next !== undefined) {
        const onward = createElement('a', 'book-next', inLanguage({ en: `Next: ${chapterHeading(next)} →`, ja: `次へ: ${chapterHeading(next)} →` }));
        onward.href = `#${next.id}`;
        article.append(onward);
      }
      content.append(article);
    }
  }
  page.append(nav, content);
  return page;
}

export function startBookPage(): void {
  startPage(TITLE, renderBookPage);
}
