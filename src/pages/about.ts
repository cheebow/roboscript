// The introduction to the game (about.html): what it is, for someone who
// wants to know before they play. The numbers come from the game's own data,
// so they never fall behind it.
import '../style.css';
import './pages.css';
import debugGif from '../../docs/images/debug.gif';
import { ARENAS } from '../data/arenas';
import { CHALLENGES } from '../challenge/challenges';
import { PARTS } from '../data/parts';
import { TEMPLATES } from '../data/templates';
import { RECIPES } from '../help/recipes';
import { createElement } from '../ui/dom';
import { type PageText, inLanguage, startPage } from './page';

const TITLE: PageText = {
  en: 'RoboScript: write your robot\'s AI, send it into battle, and debug it',
  ja: 'RoboScript: ロボットの AI をプログラムで書いて、戦わせて、デバッグするゲーム',
};

const SAMPLE = `loop
    if enemy_visible
        aim enemy
        fire
    else
        turn enemy
        drive forward`;

/** The parts of the sample, coloured as the editor colours them. */
function sampleCode(): HTMLElement {
  const kinds: Record<string, string> = {
    loop: 'control', if: 'control', else: 'control',
    aim: 'command', fire: 'command', turn: 'command', drive: 'command',
    enemy: 'value', forward: 'value',
    enemy_visible: 'variable',
  };
  const code = createElement('pre', 'about-code');
  for (const part of SAMPLE.split(/([A-Za-z_][A-Za-z0-9_]*|\d+)/)) {
    if (part === '') continue;
    const kind = /^\d/.test(part) ? 'number' : kinds[part];
    if (kind === undefined) code.append(part);
    else {
      const span = createElement('span', '', part);
      span.style.color = `var(--syntax-${kind})`;
      code.append(span);
    }
  }
  return code;
}

interface Pillar {
  title: PageText;
  text: PageText;
}

const PILLARS: readonly Pillar[] = [
  {
    title: { en: 'Write it in a small language', ja: '小さな言語で書く' },
    text: {
      en: 'if, loops, variables, functions and sensors: a language you can read at a glance. The editor suggests the words and explains them; the tutorial starts from nothing.',
      ja: 'if・繰り返し・変数・関数とセンサーだけの、読めば分かる言語です。エディタが語を補完して説明し、チュートリアルはゼロから始まります。',
    },
  },
  {
    title: { en: 'Send it into battle', ja: '戦わせる' },
    text: {
      en: 'You never steer: everything the robot does comes from the program. The same robots, map and seed always make the same match, so a shared match replays exactly, for anyone.',
      ja: '試合中の操作はありません。ロボットの動きは、すべてプログラムが決めます。同じロボット・マップ・seed なら必ず同じ試合になるので、共有した試合は誰の手元でも同じに再生されます。',
    },
  },
  {
    title: { en: 'Wind back and debug', ja: '巻き戻してデバッグする' },
    text: {
      en: 'A match is recorded whole: step a line at a time, backwards too, and jump to the moments a line ran. Watch the variables and sensors as they were on any tick.',
      ja: '試合はまるごと記録されます。1 行ずつ進めるのも、戻すのも、その行が実行された瞬間へ飛ぶのも自由です。どの tick の変数とセンサーでも、そのまま見られます。',
    },
  },
];

function features(): PageText[] {
  return [
    { en: 'A step-by-step tutorial', ja: 'ゼロから学べるチュートリアル' },
    { en: `${CHALLENGES.length} challenges with stars to collect`, ja: `星を集めるチャレンジ ${CHALLENGES.length} 問` },
    { en: `${TEMPLATES.length} built-in robots to read and fight`, ja: `読める・戦える内蔵ロボット ${TEMPLATES.length} 台` },
    { en: `${PARTS.length} parts to build with, under a cost limit`, ja: `コストの中で組む ${PARTS.length} 種のパーツ` },
    { en: `${ARENAS.length} maps, leagues and tournaments`, ja: `${ARENAS.length} つのマップ、リーグ戦とトーナメント` },
    { en: `${RECIPES.length} recipes: short programs to copy and change`, ja: `写して直せるレシピ ${RECIPES.length} 個` },
    { en: 'Share a robot or a match as a link', ja: 'ロボットも試合も、リンクで共有' },
    { en: 'In English and Japanese', ja: '日本語と英語' },
    { en: 'Runs in the browser, works offline', ja: 'ブラウザで動き、オフラインでも遊べる' },
  ];
}

export function renderAbout(): HTMLElement {
  const main = createElement('main', 'page-main');

  const hero = createElement('div', 'about-hero');
  const title = createElement('h1', 'about-title', 'ROBOSCRIPT');
  const tagline = createElement('p', 'about-tagline', inLanguage({
    en: 'A game where you write your robot\'s AI in a small programming language, send it into battle, and debug it.',
    ja: 'ロボットの AI をプログラムで書いて、戦わせて、デバッグするゲーム。',
  }));
  const play = createElement('a', 'about-play', inLanguage({ en: 'PLAY IN THE BROWSER', ja: 'ブラウザで遊ぶ' }));
  play.href = './';
  const noInstall = createElement('p', 'about-no-install', inLanguage({
    en: 'Nothing to install: it opens and plays in the browser.',
    ja: 'インストールは要りません。開くだけで遊べます。',
  }));
  hero.append(title, tagline, play, noInstall);

  const shot = createElement('img', 'about-shot');
  shot.src = debugGif;
  shot.alt = inLanguage({
    en: 'A match plays while the debugger steps through the program a line at a time',
    ja: 'デバッガでプログラムを 1 行ずつ追いながら、試合が再生される様子',
  });

  const pillars = createElement('div', 'about-pillars');
  PILLARS.forEach((pillar, index) => {
    const card = createElement('section', 'about-pillar');
    card.append(createElement('h2', '', inLanguage(pillar.title)), createElement('p', '', inLanguage(pillar.text)));
    if (index === 0) card.append(sampleCode());
    pillars.append(card);
  });

  const featuresTitle = createElement('h2', 'about-section-title', inLanguage({ en: 'What is in the box', ja: 'できること' }));
  const list = createElement('ul', 'about-features');
  for (const feature of features()) list.append(createElement('li', '', inLanguage(feature)));

  const readFirst = createElement('div', 'about-read-first');
  const readText = createElement('span', '', inLanguage({
    en: 'Want to read before you play? The whole help, the guide to the language and the recipes are on a page of their own: ',
    ja: '先に中身を読みたい人へ。ヘルプ・言語の解説・レシピ集を、そのまま読めるページがあります: ',
  }));
  const readLink = createElement('a', '', inLanguage({ en: 'the help page', ja: 'ヘルプのページ' }));
  readLink.href = './help.html';
  readFirst.append(readText, readLink);

  main.append(hero, shot, pillars, featuresTitle, list, readFirst);
  return main;
}

export function startAbout(): void {
  startPage(TITLE, renderAbout);
}
