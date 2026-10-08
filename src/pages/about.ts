// The introduction to the game (about.html): what it is, for someone who
// wants to know before they play. The numbers come from the game's own data,
// so they never fall behind it.
import '../style.css';
import './pages.css';
import debugGif from '../../docs/images/debug.gif';
import { ARENAS } from '../data/arenas';
import { MAX_TEAM_SIZE } from '../data/castle';
import { CHALLENGES } from '../challenge/challenges';
import { COST_LIMIT, PARTS } from '../data/parts';
import { TEAM_TEMPLATES } from '../data/team_templates';
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

/** One program, a whole team: each machine reads its own number and takes its part. */
const TEAM_SAMPLE = `if self_id == 1
    label GUARD
    face base
else
    face enemy_base
    drive forward`;

/** The words of the samples, by how the editor colours them. */
const KINDS: Record<string, string> = {
  loop: 'control', if: 'control', else: 'control',
  aim: 'command', fire: 'command', turn: 'command', drive: 'command', face: 'command', label: 'command',
  enemy: 'value', forward: 'value', base: 'value', enemy_base: 'value',
  enemy_visible: 'variable', self_id: 'variable',
};

/** A sample, coloured as the editor colours it. */
function sampleCode(sample: string): HTMLElement {
  const code = createElement('pre', 'about-code');
  for (const part of sample.split(/([A-Za-z_][A-Za-z0-9_]*|\d+)/)) {
    if (part === '') continue;
    const kind = /^\d/.test(part) ? 'number' : KINDS[part];
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
  /** A short program shown under the text. */
  sample?: string;
  text: PageText;
}

const PILLARS: readonly Pillar[] = [
  {
    title: { en: 'Program it', ja: 'プログラミングする' },
    sample: SAMPLE,
    text: {
      en: 'You write the robot\'s moves in a programming language made for this game. There is little to learn: if, loop, variables, functions and the sensors. Read a program and you know what the robot will do. When in doubt, the editor offers the words that fit, with what they mean.',
      ja: 'ロボットの動きは、このゲームのためのプログラミング言語で書きます。覚えるのは if や loop、変数、関数、センサーくらい。プログラムを読めば、ロボットが何をするか分かります。迷ったら、エディタが次に書ける語を意味つきで出してくれます。',
    },
  },
  {
    title: { en: 'Send it into battle', ja: '戦わせる' },
    text: {
      en: 'Your program alone drives the robot: there is no steering during a match. Win or lose, the reason is somewhere in the code. The same setup always makes the same match, so a shared link replays it exactly on anyone\'s screen.',
      ja: 'ロボットを動かすのはプログラムだけ。試合中の操作はありません。勝っても負けても、理由は必ずコードの中にあります。同じ条件なら必ず同じ試合になるので、リンクで共有した試合は、相手の画面でもそっくりそのまま再生されます。',
    },
  },
  {
    title: { en: 'Lead a team', ja: 'チームで戦う' },
    sample: TEAM_SAMPLE,
    text: {
      en: `In the team battle one program drives a whole team, up to ${MAX_TEAM_SIZE} robots a side. Each robot knows its own number (self_id), so one program can split the roles; teammates keep in touch by radio, with everyone or with one by name. Bring the enemy base down to win — and as long as your own base stands, you are still in the match.`,
      ja: `チームバトルでは、1 本のプログラムで最大 ${MAX_TEAM_SIZE} 台のチームを動かします。機体はそれぞれ自分の番号（self_id）を知っているので、1 本のプログラムで役割を分けられます。味方とは無線でつながり、全員にも、名指しで 1 台にも送れます。相手の基地を落とせば勝ち。自分の基地が立っているかぎり、全滅しても負けではありません。`,
    },
  },
  {
    title: { en: 'Wind back and debug', ja: '巻き戻してデバッグする' },
    text: {
      en: 'The whole match is recorded. Pause it, step a line at a time — backwards too — or jump to the moments a line ran, with the variables and the sensors as they were right then. "Why did it lose?" has an answer you can walk to.',
      ja: '試合はまるごと記録されています。止めて 1 行ずつ進めるのも、戻すのも、気になる行が実行された瞬間へ飛ぶのも自由。そのときの変数とセンサーの値もそのまま見えるので、「なんで負けたの？」まで追いかけられます。',
    },
  },
];

function features(): PageText[] {
  return [
    { en: 'A tutorial that starts from zero', ja: 'ゼロから学べるチュートリアル' },
    { en: `${CHALLENGES.length} challenges, with stars to collect`, ja: `チャレンジ ${CHALLENGES.length} 問（星を集めよう）` },
    { en: `${TEMPLATES.length} built-in robots, their programs open to read`, ja: `内蔵ロボット ${TEMPLATES.length} 台（プログラムも読めます）` },
    { en: `Team battles of up to ${MAX_TEAM_SIZE} a side, with ${TEAM_TEMPLATES.length} built-in teams and commentary`, ja: `チームバトル（最大 ${MAX_TEAM_SIZE} 対 ${MAX_TEAM_SIZE}、内蔵チーム ${TEAM_TEMPLATES.length} 組、実況つき観戦）` },
    { en: `${PARTS.length} parts to build from, within a cost of ${COST_LIMIT}`, ja: `パーツ ${PARTS.length} 種（コスト ${COST_LIMIT} の中で組みます）` },
    { en: `${ARENAS.length} maps, leagues and tournaments`, ja: `マップ ${ARENAS.length} つ、リーグ戦とトーナメント` },
    { en: `${RECIPES.length} recipes to copy and make your own`, ja: `レシピ ${RECIPES.length} 個（写して、直して、自分のものに）` },
    { en: 'Share robots and matches as links', ja: 'ロボットも試合も、リンクひとつで共有' },
    { en: 'In Japanese and English', ja: '日本語と英語に対応' },
    { en: 'Runs in the browser, offline too', ja: 'ブラウザで動いて、オフラインでも遊べる' },
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
  for (const pillar of PILLARS) {
    const card = createElement('section', 'about-pillar');
    card.append(createElement('h2', '', inLanguage(pillar.title)), createElement('p', '', inLanguage(pillar.text)));
    if (pillar.sample !== undefined) card.append(sampleCode(pillar.sample));
    pillars.append(card);
  }

  const featuresTitle = createElement('h2', 'about-section-title', inLanguage({ en: 'What is in the box', ja: 'できること' }));
  const list = createElement('ul', 'about-features');
  for (const feature of features()) list.append(createElement('li', '', inLanguage(feature)));

  const readFirst = createElement('div', 'about-read-first');
  const readText = createElement('span', '', inLanguage({
    en: 'Want to know what is inside before you play? How to play, the guide to the language and the recipes can all be read without opening the game: ',
    ja: '遊ぶ前に中身を知りたいときは、こちらへ。使い方も、スクリプトの解説も、レシピ集も、ゲームを開かずに読めます: ',
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
