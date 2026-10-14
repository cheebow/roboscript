// The book on a page of its own (book.html): a read-through introduction and
// strategy guide, chapter after chapter, with a table of contents at the side.
import '../style.css';
import './pages.css';
import { BOOK, CHAPTERS } from '../book/chapters';
import { createFigure, createTimeline } from '../book/figures';
import type { MatchupProgress } from '../book/matchup_worker';
import { type MatchupRecord, matchCount } from '../book/matchups';
import { createSceneFrame, readingsRows, timelineRows } from '../book/scenes';
import { SHOTS } from '../book/shots';
import type { BookBlock, BookChapter, BookRobot, Matchup } from '../book/types';
import { CHALLENGES, describeCondition, describeGoal } from '../challenge';
import { type Loadout, PARTS, type Slot, STANDARD_LOADOUT, partsOf, statsOf } from '../data/parts';
import { findTeamTemplate } from '../data/team_templates';
import { findTemplate } from '../data/templates';
import { partSummary } from '../i18n/parts';
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

/** A built-in robot's program, folded away: it is long, and the text says what it does. */
function templateCode(id: string): HTMLElement {
  const template = findTemplate(id) ?? findTeamTemplate(id);
  if (template === undefined) throw new Error(`The book names a built-in robot there is not: ${id}`);
  const lines = template.source.replace(/\n$/, '').split('\n').length;
  const details = createElement('details', 'book-template');
  details.append(
    createElement('summary', '', inLanguage({ en: `${template.name}'s program (${lines} lines)`, ja: `${template.name} のプログラム（${lines} 行）` })),
    createElement('pre', 'markup-code book-code', template.source.replace(/\n$/, '')),
  );
  return details;
}

/** A robot's name: a template's, a team template's, or the book's own robot's. */
function nameOf(robot: string | BookRobot): string {
  if (typeof robot !== 'string') return inLanguage(robot.name);
  return findTemplate(robot)?.name ?? findTeamTemplate(robot)?.name ?? robot;
}

/**
 * A table of results, empty until the reader presses the button: then the
 * matches are played here, a few at a time between frames, and the table
 * fills in as they go.
 */
function matchupTable(matchup: Matchup): HTMLElement {
  const box = createElement('div', 'book-matchup');
  const count = matchCount(matchup);
  const arenas = matchup.arenas.length;
  const size = matchup.teamSize;
  const what = createElement('p', 'book-caption', inLanguage(size === undefined ? {
    en: `${nameOf(matchup.robot)} against each robot: ${arenas} maps × ${matchup.seeds.length} seeds × both starting places, ${count} matches in all.`,
    ja: `${nameOf(matchup.robot)} と各ロボットを、マップ ${arenas} つ × seed ${matchup.seeds.length} つ × 先手後手を入れかえて、全部で ${count} 試合。`,
  } : {
    en: `${nameOf(matchup.robot)} against each team, ${size} a side, every machine with a Light body and a Pistol: ${arenas} maps × ${matchup.seeds.length} seeds × both ends, ${count} matches in all.`,
    ja: `${nameOf(matchup.robot)} と各チームを、${size} 対 ${size}（どの機体も車体 Light・銃 Pistol）で、マップ ${arenas} つ × seed ${matchup.seeds.length} つ × 陣地を入れかえて、全部で ${count} 試合。`,
  }));
  const button = createElement('button', 'tool-button book-matchup-play', inLanguage({ en: 'Play the matches', ja: '試合をして確かめる' }));
  button.type = 'button';
  const table = createElement('table', 'markup-table book-matchup-table');
  const show = (records: readonly MatchupRecord[]) => {
    const head = createElement('tr', '');
    for (const title of [{ en: 'Opponent', ja: '相手' }, { en: 'Won', ja: '勝ち' }, { en: 'Lost', ja: '負け' }, { en: 'Drawn', ja: '引き分け' }]) {
      head.append(createElement('th', '', inLanguage(title)));
    }
    table.replaceChildren(head);
    for (const record of records) {
      const row = createElement('tr', record.wins > record.losses ? 'won' : record.losses > record.wins ? 'lost' : '');
      row.append(
        createElement('td', '', nameOf(record.opponent)),
        createElement('td', '', `${record.wins}`),
        createElement('td', '', `${record.losses}`),
        createElement('td', '', `${record.draws}`),
      );
      table.append(row);
    }
  };
  button.addEventListener('click', () => {
    button.disabled = true;
    // Played in a worker: a long match takes a second or so, and the page should not stop for it.
    const worker = new Worker(new URL('../book/matchup_worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<MatchupProgress>) => {
      const { played, records, done } = event.data;
      show(records);
      if (done) {
        worker.terminate();
        button.textContent = inLanguage({ en: `Played ${count} matches`, ja: `${count} 試合が終わりました` });
      } else {
        button.textContent = inLanguage({ en: `Playing… ${played} / ${count}`, ja: `試合中… ${played} / ${count}` });
      }
    };
    worker.postMessage(matchup);
  });
  box.append(what, button, table);
  return box;
}

/** The parts of a slot, with the numbers that tell them apart, from the game's own list of parts. */
function partsTable(slot: Slot): HTMLElement {
  type Column = { title: Text; value: (stats: ReturnType<typeof statsOf>) => string };
  const round = (value: number) => `${Math.round(value)}`;
  const columns: Record<Slot, Column[]> = {
    body: [
      { title: { en: 'HP', ja: 'HP' }, value: (stats) => round(stats.maxHp) },
      { title: { en: 'Speed', ja: '走る速さ' }, value: (stats) => round(stats.moveSpeed) },
      { title: { en: 'Turning', ja: '曲がる速さ' }, value: (stats) => round(stats.rotateSpeed) },
    ],
    legs: [
      { title: { en: 'Speed', ja: '走る速さ' }, value: (stats) => round(stats.moveSpeed) },
      { title: { en: 'Turning', ja: '曲がる速さ' }, value: (stats) => round(stats.rotateSpeed) },
      { title: { en: 'Spread on the move', ja: '走りながらのぶれ' }, value: (stats) => `±${Math.round(stats.movingShotSpread * 10) / 10}°` },
    ],
    gun: [
      { title: { en: 'Damage', ja: '威力' }, value: (stats) => round(stats.shotDamage) },
      { title: { en: 'Interval (s)', ja: '間隔（秒）' }, value: (stats) => `${stats.shotCooldown}` },
      { title: { en: 'Damage a second', ja: '1 秒あたり' }, value: (stats) => `${Math.round((stats.shotDamage / stats.shotCooldown) * 10) / 10}` },
      { title: { en: 'Range', ja: '射程' }, value: (stats) => round(stats.weaponRange) },
      { title: { en: 'Bullet speed', ja: '弾の速さ' }, value: (stats) => round(stats.shotSpeed) },
      { title: { en: 'Spread', ja: 'ぶれ' }, value: (stats) => `±${stats.shotSpread}° / ±${stats.movingShotSpread}°` },
      { title: { en: 'Ammo', ja: '弾数' }, value: (stats) => round(stats.maxAmmo) },
    ],
    sensor: [
      { title: { en: 'Range', ja: '見える距離' }, value: (stats) => round(stats.sensorRange) },
      { title: { en: 'Angle', ja: '見える角度' }, value: (stats) => `${stats.sensorAngle}°` },
    ],
  };
  const table = createElement('table', 'markup-table book-parts');
  const head = createElement('tr', '');
  head.append(createElement('th', '', inLanguage({ en: 'Part', ja: 'パーツ' })), createElement('th', '', inLanguage({ en: 'Cost', ja: 'コスト' })));
  for (const column of columns[slot]) head.append(createElement('th', '', inLanguage(column.title)));
  head.append(createElement('th', '', inLanguage({ en: 'In short', ja: 'ひとことで' })));
  table.append(head);
  for (const part of partsOf(slot)) {
    const stats = statsOf({ ...STANDARD_LOADOUT, [slot]: part.id });
    const row = createElement('tr', '');
    row.append(createElement('td', '', part.name), createElement('td', '', `${part.cost}`));
    for (const column of columns[slot]) row.append(createElement('td', '', column.value(stats)));
    row.append(createElement('td', 'book-parts-summary', partSummary(part)));
    table.append(row);
  }
  return table;
}

const SLOT_NAMES: Record<Slot, Text> = {
  body: { en: 'body', ja: '車体' },
  legs: { en: 'legs', ja: '脚' },
  gun: { en: 'gun', ja: '銃' },
  sensor: { en: 'sensor', ja: 'センサー' },
};

/** "gun Pistol, sensor Short". */
function partsNamed(parts: Partial<Loadout>): string {
  return Object.entries(parts)
    .map(([slot, id]) => `${inLanguage(SLOT_NAMES[slot as Slot])} ${PARTS.find((part) => part.slot === slot && part.id === id)?.name ?? id}`)
    .join(inLanguage({ en: ', ', ja: '、' }));
}

/**
 * A challenge as the game has it, and the hints: the first one in the open,
 * the others folded away, so that the reader takes no more than is needed.
 */
function challengeHints(id: string, hints: readonly Text[]): HTMLElement {
  const index = CHALLENGES.findIndex((challenge) => challenge.id === id);
  if (index < 0) throw new Error(`The book names a challenge there is not: ${id}`);
  const challenge = CHALLENGES[index];
  const box = createElement('section', 'book-challenge');
  const conditions = [describeGoal(challenge.goal), ...(challenge.require ?? []).map(describeCondition)].map(inLanguage);
  const terms = createElement('p', 'book-challenge-terms');
  terms.append(
    createElement('strong', '', inLanguage({ en: 'To clear: ', ja: 'クリア条件: ' })),
    conditions.join(inLanguage({ en: ', ', ja: '、' })),
  );
  if (challenge.parts !== undefined) {
    terms.append(createElement('br', ''), createElement('strong', '', inLanguage({ en: 'Fixed parts: ', ja: '固定パーツ: ' })), partsNamed(challenge.parts));
  }
  box.append(
    createElement('h3', '', inLanguage({ en: `${index + 1}. ${challenge.title.en}`, ja: `${index + 1}. ${challenge.title.ja}` })),
    createElement('p', 'book-challenge-brief', inLanguage(challenge.brief)),
    terms,
  );
  hints.forEach((hint, at) => {
    const label = inLanguage({ en: `Hint ${at + 1}`, ja: `ヒント ${at + 1}` });
    if (at === 0) {
      const first = createElement('div', 'book-hint');
      first.append(createElement('div', 'book-hint-label', label), renderMarkup(inLanguage(hint)));
      box.append(first);
    } else {
      const folded = createElement('details', 'book-hint');
      folded.append(createElement('summary', 'book-hint-label', label), renderMarkup(inLanguage(hint)));
      box.append(folded);
    }
  });
  return box;
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
    case 'template':
      return templateCode(block.template);
    case 'matchup':
      return matchupTable(block.matchup);
    case 'parts':
      return partsTable(block.slot);
    case 'challenge':
      return challengeHints(block.challenge, block.hints);
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
