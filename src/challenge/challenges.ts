import { CENTER_BLOCK } from '../data/arenas/center_block';
import { OPEN_FIELD } from '../data/arenas/open_field';
import { PILLARS } from '../data/arenas/pillars';
import { AGGRESSIVE_BOT } from '../data/templates/aggressive_bot';
import { COWARD_BOT } from '../data/templates/coward_bot';
import { DUMB_BOT } from '../data/templates/dumb_bot';
import { SENTRY_BOT } from '../data/templates/sentry_bot';
import { STRAFE_BOT } from '../data/templates/strafe_bot';
import { DUEL, SHELTER, SHOT_AT, SNIPE, TARGET_BOT } from '../tutorial/stages';
import type { Challenge } from './types';

/** The code every challenge starts with: it stands still, and clears none of them. */
const START = `# Write a program that clears the challenge.
loop
    wait
`;

/** Looks for the enemy round obstacles; once it sees it, stands still, aims and fires. */
const HUNTER = `loop
    if enemy_visible
        drive stop
        if aim_angle > 2 or aim_angle < -2
            aim enemy
        else
            fire
    else
        drive forward
        if blocked
            turn left
        wait
`;

/** The hunter that also drives at where a hit came from: for an enemy it cannot see. */
const HIT_HUNTER = `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else if enemy_visible
        drive stop
        if aim_angle > 2 or aim_angle < -2
            aim enemy
        else
            fire
    else if hit
        face hit
        drive forward
    else
        drive forward
        if blocked
            turn left
        wait
`;

/** Every challenge, from the easiest. */
export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'first-win',
    title: { en: 'First win', ja: 'はじめての勝利' },
    brief: {
      en: 'Beat the sparring partner. It shoots back, but it is slow to aim, and its Pistol has a short range.',
      ja: '練習相手に勝ちましょう。相手も撃ち返してきます。ただし狙いをつけるのが遅く、銃は射程の短い Pistol です。',
    },
    stage: { ...DUEL, seed: 101 },
    goal: { kind: 'win' },
    stars: [{ kind: 'lines', max: 12 }, { kind: 'hp', min: 150 }],
    start: START,
    answer: HUNTER,
  },
  {
    id: 'pistol',
    title: { en: 'Pistol only', ja: 'ピストル 1 丁' },
    brief: {
      en: 'Beat DumbBot with a Pistol. Its range is only 300 and its shots scatter, so get in close before you fire.',
      ja: 'Pistol で DumbBot に勝ちましょう。射程は 300 しかなく、弾もばらけやすいので、近づいてから撃ちます。',
    },
    stage: { arena: OPEN_FIELD, bot: DUMB_BOT, seed: 102 },
    goal: { kind: 'win' },
    parts: { gun: 'pistol' },
    stars: [{ kind: 'hp', min: 80 }, { kind: 'seconds', max: 40 }],
    start: START,
    answer: HUNTER,
  },
  {
    id: 'untouchable',
    title: { en: 'Untouchable', ja: '1 発も受けるな' },
    brief: {
      en: 'BRAVO stands 480 away and shoots, with a range of 400. Destroy it without taking a single hit: choose parts that reach further than it does.',
      ja: 'BRAVO は 480 離れた所から動かずに撃ってきます。射程は 400 です。1 発も当たらずに BRAVO を壊しましょう。BRAVO より遠くまで届くパーツを選びます。',
    },
    stage: { ...SNIPE, seed: 103 },
    goal: { kind: 'destroy' },
    require: [{ kind: 'noHit' }],
    stars: [{ kind: 'lines', max: 4 }, { kind: 'seconds', max: 20 }],
    start: START,
    answer: 'loop\n    aim enemy\n    fire\n',
    answerParts: { gun: 'cannon', sensor: 'scope' },
  },
  {
    id: 'short-route',
    title: { en: 'Short and sweet', ja: '短いコードで' },
    brief: {
      en: 'Drive round the block to the goal, with a program of 10 lines or fewer.',
      ja: 'ブロックを回り込んで、ゴールまで行きましょう。プログラムは 10 行以内で書きます。',
    },
    stage: {
      arena: CENTER_BLOCK,
      bot: TARGET_BOT,
      goal: { x: 60, y: 540, radius: 60 },
      seed: 104,
    },
    goal: { kind: 'reach' },
    require: [{ kind: 'lines', max: 10 }],
    stars: [{ kind: 'lines', max: 5 }, { kind: 'seconds', max: 15 }],
    start: START,
    answer: 'loop\n    drive forward\n    if blocked\n        turn left\n    wait\n',
  },
  {
    id: 'speed-sentry',
    title: { en: 'Against the clock', ja: '時間との勝負' },
    brief: {
      en: 'Destroy SentryBot within 45 seconds. It stops once you are in range, and aims where you are going.',
      ja: 'SentryBot を 45 秒以内に倒しましょう。SentryBot は射程に入ると止まり、こちらが動いていく先を狙って撃ってきます。',
    },
    stage: { arena: OPEN_FIELD, bot: SENTRY_BOT, seed: 105 },
    goal: { kind: 'win' },
    require: [{ kind: 'seconds', max: 45 }],
    stars: [{ kind: 'seconds', max: 30 }, { kind: 'hp', min: 100 }],
    start: START,
    answer: HUNTER,
  },
  {
    id: 'hide-and-heal',
    title: { en: 'Hide and heal', ja: '隠れて回復' },
    brief: {
      en: 'BRAVO stands still and shoots. Hide where it cannot see you, rest, and get back 60 HP or more in all.',
      ja: 'BRAVO は動かずに撃ってきます。BRAVO から見えない場所に隠れて休み、HP を合計 60 以上回復しましょう。',
    },
    stage: { ...SHELTER, seed: 106 },
    goal: { kind: 'recover' },
    require: [{ kind: 'recovered', min: 60 }],
    stars: [{ kind: 'recovered', min: 80 }, { kind: 'lines', max: 10 }],
    start: START,
    answer: `loop
    if hidden
        drive stop
        wait
    else if hp < 130
        face cover
        drive forward
        wait
    else
        aim enemy
        fire
`,
  },
  {
    id: 'guard-wall',
    title: { en: 'Iron guard', ja: '鉄壁のガード' },
    brief: {
      en: 'Beat BRAVO, which stands close by and shoots. On the way, guard against 3 hits or more.',
      ja: '近くで動かずに撃ってくる BRAVO に勝ちましょう。それまでに、3 回以上ガードで弾を受けます。',
    },
    stage: { ...SHOT_AT, seed: 107 },
    goal: { kind: 'win' },
    require: [{ kind: 'guarded', min: 3 }],
    stars: [{ kind: 'guarded', min: 4 }, { kind: 'hp', min: 60 }],
    start: START,
    answer: `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else if aim_angle > 2 or aim_angle < -2
        aim enemy
    else
        fire
`,
  },
  {
    id: 'short-sight',
    title: { en: 'Short sight', ja: '近眼のロボット' },
    brief: {
      en: 'Beat CowardBot with the Short sensor, which sees only 300 away. Finding it is the first step.',
      ja: 'Short センサーで CowardBot に勝ちましょう。Short は 300 までしか見えません。まずは敵を見つけることからです。',
    },
    stage: { arena: OPEN_FIELD, bot: COWARD_BOT, seed: 108 },
    goal: { kind: 'win' },
    parts: { sensor: 'short' },
    stars: [{ kind: 'hp', min: 60 }, { kind: 'seconds', max: 30 }],
    start: START,
    answer: HIT_HUNTER,
  },
  {
    id: 'strafe-buster',
    title: { en: 'Strafe buster', ja: '横走りを止めろ' },
    brief: {
      en: 'Beat StrafeBot. It drives sideways across your fire and aims where you are going. Your parts are up to you.',
      ja: 'StrafeBot に勝ちましょう。StrafeBot は横に走って弾をよけながら、こちらが動いていく先を狙ってきます。パーツは自由に選べます。',
    },
    stage: { arena: PILLARS, bot: STRAFE_BOT, seed: 109 },
    goal: { kind: 'win' },
    stars: [{ kind: 'hp', min: 150 }, { kind: 'seconds', max: 30 }],
    start: START,
    answer: HUNTER,
  },
  {
    id: 'light-body',
    title: { en: 'Light and fast', ja: '軽さで勝負' },
    brief: {
      en: 'Beat AggressiveBot with the Light body: only 160 HP, but fast.',
      ja: 'Light の車体で AggressiveBot に勝ちましょう。HP は 160 しかありませんが、速く走れます。',
    },
    stage: { arena: OPEN_FIELD, bot: AGGRESSIVE_BOT, seed: 110 },
    goal: { kind: 'win' },
    parts: { body: 'light' },
    stars: [{ kind: 'hp', min: 60 }, { kind: 'seconds', max: 35 }],
    start: START,
    answer: HUNTER,
  },
  {
    id: 'sharpshooter',
    title: { en: 'Sharpshooter', ja: '狙撃手' },
    brief: {
      en: 'Beat DumbBot in 15 shots or fewer. Make every shot count.',
      ja: '15 発以内で DumbBot に勝ちましょう。1 発もむだにできません。',
    },
    stage: { arena: OPEN_FIELD, bot: DUMB_BOT, seed: 111 },
    goal: { kind: 'win' },
    require: [{ kind: 'shots', max: 15 }],
    stars: [{ kind: 'shots', max: 8 }, { kind: 'hp', min: 150 }],
    start: START,
    answer: HUNTER,
    answerParts: { gun: 'cannon', sensor: 'scope' },
  },
  {
    id: 'final',
    title: { en: 'The last test', ja: '最後の試練' },
    brief: {
      en: 'Beat SentryBot with 40 HP or more left. Use everything you have learnt.',
      ja: 'HP を 40 以上残して SentryBot に勝ちましょう。これまでに覚えたことを全部使います。',
    },
    stage: { arena: CENTER_BLOCK, bot: SENTRY_BOT, seed: 112 },
    goal: { kind: 'win' },
    require: [{ kind: 'hp', min: 40 }],
    stars: [{ kind: 'hp', min: 100 }, { kind: 'seconds', max: 40 }],
    start: START,
    answer: HUNTER,
  },
];
