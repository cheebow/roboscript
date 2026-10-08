import { CENTER_BLOCK } from '../data/arenas/center_block';
import { CROSS } from '../data/arenas/cross';
import { OPEN_FIELD } from '../data/arenas/open_field';
import { PILLARS } from '../data/arenas/pillars';
import { AGGRESSIVE_BOT } from '../data/templates/aggressive_bot';
import { COWARD_BOT } from '../data/templates/coward_bot';
import { DUMB_BOT } from '../data/templates/dumb_bot';
import { SENTRY_BOT } from '../data/templates/sentry_bot';
import { STRAFE_BOT } from '../data/templates/strafe_bot';
import { CASTLE_RUSH, CASTLE_TURTLE } from '../data/team_templates';
import { DUEL, SHELTER, SHOT_AT, SNIPE, TARGET_BOT, castleStage } from '../tutorial/stages';
import { CHAMPION, CHAMPION_LOADOUT } from './champion';
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
    title: { en: 'Putting it all together', ja: '総仕上げ' },
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
  {
    id: 'champion',
    title: { en: 'Beat the champion', ja: '最強ロボに勝て' },
    brief: {
      en: 'The champion beats every built-in robot in nine matches out of ten or more. It carries Heavy, Rapid and Short, guards the moment a bullet hits, hunts you down when you hide, and closes in when you drive across its fire. Shoot it out face to face and you lose: look for its weak spot in its parts.',
      ja: '最強ロボ「チャンピオン」は、内蔵ロボットのどれにも 9 割以上勝ちます。Heavy・Rapid・Short を積み、当たる瞬間にガードし、隠れても追いかけてきて、横に走れば近づいてきます。正面から撃ち合っても勝てません。弱点は、積んでいるパーツから探しましょう。',
    },
    stage: { arena: CROSS, bot: CHAMPION, botLoadout: CHAMPION_LOADOUT, seed: 121 },
    goal: { kind: 'win' },
    stars: [{ kind: 'hp', min: 100 }, { kind: 'seconds', max: 30 }],
    start: START,
    answer: SENTRY_BOT,
    answerParts: { legs: 'sprint', gun: 'cannon', sensor: 'scope' },
  },
  {
    id: 'castle-solo',
    title: { en: 'Castle for one', ja: 'ひとり城攻め' },
    brief: {
      en: 'A castle match of one robot a side. The enemy runs straight for your castle: stop it on the way, or out-race it to its own. Either way, win.',
      ja: '片側 1 台の城攻めです。相手はまっすぐこちらの城へ走ってきます。途中で止めるか、先に向こうの城を落とすか。どちらでも、勝ちましょう。',
    },
    stage: castleStage(1, CASTLE_RUSH, 131, { bot: { gun: 'pistol' } }),
    goal: { kind: 'win' },
    stars: [{ kind: 'seconds', max: 30 }, { kind: 'hp', min: 120 }],
    start: START,
    answer: `loop
    if blocked
        turn left
    else if enemy_visible and enemy_distance < weapon_range - 50
        label FIGHT
        drive stop
        aim enemy
        fire
    else if enemy_base_distance < weapon_range - 50
        label SIEGE
        drive stop
        face enemy_base
        aim ahead
        fire
    else
        label MARCH
        face enemy_base
        drive forward
        wait
`,
  },
  {
    id: 'castle-hold',
    title: { en: 'The unbroken castle', ja: '鉄壁の城' },
    brief: {
      en: 'Three rushers are coming for your castle. Once they have it in range they shell it and ignore you, so waiting at the walls is too late: go out and meet them. Win — and for the stars, hardly let them scratch the castle.',
      ja: '3 台の突撃が、こちらの城へ向かってきます。城を射程にとらえた敵は、こちらを無視して城を撃ち続けます。城壁で待っていては手遅れです。前へ出て迎え撃ちましょう。星の条件は、城をほとんど削らせないことです。',
    },
    // Both teams field light bodies and pistols: three machines inside the team's cost limit, on even terms.
    stage: castleStage(3, CASTLE_RUSH, 132, { bot: { body: 'light', gun: 'pistol' }, player: { body: 'light', gun: 'pistol' } }),
    goal: { kind: 'win' },
    // Of the castle's 200: at most two hits through for a star, at most one for both.
    stars: [{ kind: 'castleHp', min: 150 }, { kind: 'castleHp', min: 180 }],
    start: START,
    answer: `loop
    if enemy_visible and enemy_distance < weapon_range
        label FIGHT
        drive stop
        aim enemy
        fire
    else if enemy_base_distance > 600
        label ADVANCE
        face enemy_base
        drive forward
        wait
    else
        label HOLD
        drive stop
        aim enemy
        wait
`,
  },
  {
    id: 'castle-fall',
    title: { en: 'Bring the castle down', ja: '城を落とせ' },
    brief: {
      en: 'Two defenders sit by their castle and never leave it. Killing them ends nothing you need: the challenge is cleared only when their CASTLE falls. Short-sighted as they are, a long gun can shell the castle from beyond their eyes.',
      ja: '2 台の守りが城のそばに座り込んでいます。倒すだけでは足りません。この課題は、相手の「城」を落として初めてクリアです。守りは目が短いので、長い銃なら見つからない距離から城を撃てます。',
    },
    stage: castleStage(2, CASTLE_TURTLE, 133, { bot: { sensor: 'short' } }),
    goal: { kind: 'win' },
    require: [{ kind: 'castleDestroyed' }],
    stars: [{ kind: 'seconds', max: 45 }, { kind: 'noHit' }],
    parts: { body: 'light', gun: 'cannon', sensor: 'short' },
    start: START,
    answer: `loop
    if blocked
        turn left
    else if enemy_base_distance < weapon_range - 50
        label SIEGE
        drive stop
        face enemy_base
        aim ahead
        fire
    else
        label MARCH
        face enemy_base
        drive forward
        wait
`,
  },
];
