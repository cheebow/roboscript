import type { Text } from '../tutorial/types';
import { BEHIND, QUARTER, RANGE, TRACK } from '../tutorial/stages';
import {
  DRIVE_ON,
  FACE_BEHIND,
  FIRST_PROGRAM,
  KEEP_FIRING,
  LONG_TURN,
  NO_ACTION_LOOP,
  ONE_SHOT,
  TICK_BY_TICK,
  TURN_THEN_DRIVE,
  TWO_TICK_LOOP,
} from './examples';
import type { BookBlock, BookChapter, BookPart } from './types';

// The text of the book. Each chapter is a run of blocks; the text blocks use
// the little markup of the help (see renderMarkup). A number the text gives
// about a program of examples.ts is checked by tests/book.test.ts.
//
// The Japanese is written as Japanese, not as a translation of the English:
// short sentences, plain words, nothing said that the reader can see anyway.

function text(en: string, ja: string): BookBlock {
  return { kind: 'text', text: { en, ja } };
}

function code(source: string): BookBlock {
  return { kind: 'code', code: source };
}

function caption(en: string, ja: string): Text {
  return { en, ja };
}

const WHAT_A_PROGRAM_IS: BookChapter = {
  id: 'what-a-program-is',
  title: { en: 'What a program is', ja: 'プログラムってなに？' },
  blocks: [
    text(
      `In RoboScript you cannot steer your robot during a match. It moves by the **program** you wrote before the match.

A program is like a recipe. You cut the onion, fry it, add salt, in that order from the top; a robot runs its program from the top line down in the same way.`,
      `RoboScript では、試合中にロボットを操作できません。ロボットは、試合の前に書いておいた **プログラム** のとおりに動きます。

プログラムは、料理のレシピのようなものです。「玉ねぎを切る」「炒める」「塩を入れる」と上から順に進めるように、ロボットもプログラムを上の行から順に実行します。`,
    ),
    text(
      `## It does what is written, and nothing else

A cook turns the heat down when the pan starts to burn, without being told. A robot does not. It does nothing that is not written, and it never notices what you forgot to write.

In return, when a robot does something odd, the cause is always somewhere in its program. Finding it and fixing it is what the game is about.`,
      `## 書いたことしかしない

人なら、鍋が焦げそうになれば言われなくても火を弱めます。ロボットはそうはいきません。書いていないことはしないし、書き忘れたことにも気づきません。

そのかわり、ロボットがおかしな動きをしたら、原因は必ずプログラムのどこかにあります。そこを見つけて直すのが、このゲームのおもしろさです。`,
    ),
    text(
      `## A first program

A program of three lines:`,
      `## はじめてのプログラム

3 行だけのプログラムです。`,
    ),
    code(FIRST_PROGRAM),
    text(
      `- \`loop\`: repeat the two lines below, for ever
- \`turn enemy\`: turn towards the enemy
- \`fire\`: shoot

It turns towards the enemy and shoots, again and again until the match is over. The lines inside \`loop\` start with four spaces.`,
      `- \`loop\`: 下の 2 行をずっと繰り返す
- \`turn enemy\`: 敵の方へ回る
- \`fire\`: 撃つ

敵の方へ回って撃つ、を試合が終わるまで繰り返します。\`loop\` の中の行は、頭に半角スペースを 4 つ入れて書きます。`,
    ),
    text(
      `## Same program, same match

With the same robots, the same map and the same **seed** (the number at the top right of the battle view), a match comes out exactly the same every time. Change one line, run the match again, and whatever is different was made by that line. That is how you improve a robot a little at a time.`,
      `## 同じプログラムなら、同じ試合

ロボット、マップ、**seed**（戦闘画面の右上に出ている数）が同じなら、試合は何度やってもまったく同じになります。1 行直して試合をやり直したとき、何かが変わったら、それはその 1 行のせいです。だから少しずつ直していけます。`,
    ),
    { kind: 'shot', shot: 'program', caption: caption(
      'The program screen: the editor in the middle, the match on the right, the log (what happened in the match) below.',
      'プログラムの画面。真ん中がエディタ、右が試合、下がログ（試合で起きたことの記録）。',
    ) },
    text(
      `## How to read this book

Part 1 explains how a program runs and how a robot looks around and decides what to do. Part 2 is about winning: how the built-in robots fight, the parts, the challenges.

Every program in the book works as it is. Write it into the editor of the PROGRAM screen and press RUN. Then change it a little and see what happens: that is the quickest way to learn.`,
      `## この本の読み方

第 1 部では、プログラムがどう実行されるか、ロボットがどうやって周りを見て動きを決めるかを説明します。第 2 部は勝つための話です。内蔵ロボットの戦い方、パーツ、チャレンジを取り上げます。

本に出てくるプログラムは、どれもそのまま動きます。ゲームの「プログラム」画面のエディタに書き写して「実行」を押してみてください。少し書きかえて、どう変わるか試すと早く身につきます。`,
    ),
    { kind: 'see', topics: ['welcome', 'program-screen', 'basics'] },
  ],
};

const MAKING_IT_MOVE: BookChapter = {
  id: 'making-it-move',
  title: { en: 'Making it move', ja: '動かしてみる' },
  blocks: [
    text(
      `## One line, one shot

The shortest program is one line.`,
      `## 1 行で 1 発

いちばん短いプログラムは 1 行です。`,
    ),
    code(ONE_SHOT),
    text(
      `The robot fires once and then does nothing more: after that one line, the program is over. The log says so.`,
      `ロボットは 1 発撃って、あとは何もしません。1 行で、プログラムが終わってしまうからです。ログにも、プログラムが終わったことが出ます。`,
    ),
    { kind: 'scene', scene: { stage: RANGE, program: ONE_SHOT, tick: 12 }, caption: caption(
      'The one shot of ALPHA (right) on its way to the target (left).',
      'ALPHA（右）が撃った 1 発が、的（左）へ飛んでいるところ。',
    ) },
    text(
      `## Keep shooting: loop

To keep shooting, put \`fire\` inside a \`loop\`.`,
      `## 撃ち続ける: loop

撃ち続けたいときは、\`fire\` を \`loop\` の中に入れます。`,
    ),
    code(KEEP_FIRING),
    { kind: 'scene', scene: { stage: RANGE, program: KEEP_FIRING, tick: 40 }, caption: caption(
      'With loop it keeps shooting: the first shot has hit, the second is on its way.',
      'loop があるので撃ち続けます。1 発目はもう当たり、2 発目が飛んでいます。',
    ) },
    text(
      `## Commands

The commands that make a robot move:

| Command | What it does |
|---|---|
| \`turn left\` / \`turn right\` | turns the body a little (6 degrees) |
| \`turn left 90\` | turns the body 90 degrees |
| \`turn enemy\` | turns the body towards the enemy |
| \`aim enemy\` | turns only the gun towards the enemy |
| \`fire\` | shoots |
| \`guard\` | braces: a bullet that hits does half the damage |
| \`wait\` | waits a moment |
| \`drive forward\` / \`drive backward\` / \`drive stop\` | drives forward / backward / stops |`,
      `## 命令

ロボットを動かす命令です。

| 命令 | すること |
|---|---|
| \`turn left\` / \`turn right\` | 車体を少し（6 度）回す |
| \`turn left 90\` | 車体を 90 度回す |
| \`turn enemy\` | 車体を敵の方へ回す |
| \`aim enemy\` | 砲塔だけを敵の方へ回す |
| \`fire\` | 撃つ |
| \`guard\` | 身構える（当たった弾のダメージが半分になる） |
| \`wait\` | 少し待つ |
| \`drive forward\` / \`drive backward\` / \`drive stop\` | 前へ走る / 後ろへ走る / 止まる |`,
    ),
    text(
      `## Driving is a setting

\`drive\` is a little different from the other commands. It does not drive a set distance: it switches driving on, and the robot keeps going until it is stopped (or hits a wall). So this one line is enough to drive on and on.`,
      `## 走るのは「設定」

\`drive\` だけは、ほかの命令と少し違います。決まった距離を走るのではなく、「走る」状態に切りかえるだけです。止めるまで（または壁にぶつかるまで）走り続けます。なので、次の 1 行だけでも、ロボットはずっと走っていきます。`,
    ),
    code(DRIVE_ON),
    { kind: 'scene', scene: { stage: TRACK, program: DRIVE_ON, tick: 90 }, caption: caption(
      'Three seconds in. The program ended long ago, but ALPHA is still driving.',
      '3 秒後。プログラムはとっくに終わっていますが、ALPHA は走り続けています。',
    ) },
    text(
      `Two commands one after another run in that order. This program turns left 90 degrees, then drives straight on.`,
      `命令を 2 つ並べると、その順に実行します。これは、左に 90 度回ってから、まっすぐ走るプログラムです。`,
    ),
    code(TURN_THEN_DRIVE),
    { kind: 'scene', scene: { stage: QUARTER, program: TURN_THEN_DRIVE, tick: 75 }, caption: caption(
      'ALPHA started facing right, turned left to face up, and is driving to the goal.',
      'ALPHA は右向きで始まり、左に回って上を向き、ゴールへ走っています。',
    ) },
    text(
      `## When a line is wrong

Write a word the game does not know, or forget the spaces in front of a line inside \`loop\`, and the match does not start. The line turns red, and the log says what is wrong. Fix it and press RUN again.`,
      `## 書きまちがえたら

知らない言葉を書いたり、\`loop\` の中の行の字下げを忘れたりすると、試合は始まりません。その行が赤くなり、どこがおかしいかがログに出ます。直してから、もう一度「実行」を押してください。`,
    ),
    { kind: 'see', topics: ['moving', 'errors'] },
  ],
};

const TICKS: BookChapter = {
  id: 'ticks',
  title: { en: 'Time goes in ticks', ja: '時間は tick で進む' },
  blocks: [
    text(
      `The most important chapter of Part 1. A robot's program does not run the way ordinary programs do. Once this is clear, most of the puzzling things a robot does make sense.`,
      `第 1 部でいちばん大事な章です。ロボットのプログラムは、ふつうのプログラムと進み方が違います。ここが分かると、ロボットの「なんで？」の多くが説明できるようになります。`,
    ),
    text(
      `## An ordinary program runs at once

An ordinary program, such as a calculator or a web page, runs from start to end in one go. Thousands of lines take no time at all.

A robot's program runs a little at a time, **along with the clock of the match**. Match time goes in **ticks**: 30 ticks make a second. In each tick, each robot does one action. Like a flip book, the ticks one after another make the match.`,
      `## ふつうのプログラムは一瞬で終わる

電卓やウェブページのような、ふつうのプログラムは、始めから終わりまで一気に進みます。何千行あっても一瞬です。

ロボットのプログラムは、**試合の時計に合わせて** 少しずつ進みます。試合の時間は **tick**（ティック）という単位で進み、30 tick が 1 秒です。ロボットは 1 tick ごとに 1 つずつ行動します。パラパラ漫画のように、tick が積み重なって試合になります。`,
    ),
    { kind: 'figure', figure: 'program-vs-tick', caption: caption(
      'The same five lines: an ordinary program runs them all at once; a robot\'s runs a few of them each tick.',
      '同じ 5 行でも、ふつうのプログラムは一度に全部進み、ロボットのプログラムは tick ごとに少しずつ進む。',
    ) },
    text(
      `## One action, and the tick is over

How far the program gets in one tick follows a short rule:

- \`turn\`, \`aim\`, \`face\`, \`fire\`, \`guard\` and \`wait\` are **actions**. When the program runs an action, that tick is over. The next tick starts from the next line.
- \`drive\`, \`if\`, \`set\`, \`label\`, \`loop\` and the like **take no time**. The program goes on to the next line in the same tick.

Here it is with a real program.`,
      `## 行動を 1 つしたら、その tick は終わり

1 tick でどこまで進むかは、次の決まりで決まります。

- \`turn\`、\`aim\`、\`face\`、\`fire\`、\`guard\`、\`wait\` は **行動** です。行動を 1 つ実行すると、その tick は終わりです。次の tick は、その次の行から始まります。
- \`drive\`、\`if\`、\`set\`、\`label\`、\`loop\` などは **時間がかかりません**。同じ tick のまま次の行へ進みます。

実際のプログラムで見てみましょう。`,
    ),
    code(TICK_BY_TICK),
    { kind: 'timeline', timeline: { stage: RANGE, program: TICK_BY_TICK, ticks: 6 }, caption: caption(
      'Which line ran on which tick in a real match. A filled dot is the action that ended the tick; a hollow one took no time.',
      '本物の試合で、どの行がどの tick に実行されたかを表にしたもの。● はその tick を終えた行動、○ は時間のかからない行。',
    ) },
    text(
      `Column by column:

- **Tick 1**: line 1, \`turn left\`. An action, so the tick ends here.
- **Tick 2**: line 2, \`drive forward\`, takes no time, so the program goes on to \`fire\` on line 3. It starts driving and shoots in the same tick.
- **Tick 3**: line 4, \`wait\`.
- **Tick 4**: line 5, \`turn right\`. The last line: the program ends here.
- **Tick 5 on**: no line is left to run. The robot still drives, though: \`drive forward\` set it going and nothing stopped it.`,
      `表を左の列から見ていきます。

- **tick 1**: 1 行目の \`turn left\`。行動なので、ここでこの tick は終わり。
- **tick 2**: 2 行目の \`drive forward\` は時間がかからないので、そのまま 3 行目の \`fire\` まで進む。走り出すのと撃つのが同じ tick。
- **tick 3**: 4 行目の \`wait\`。
- **tick 4**: 5 行目の \`turn right\`。最後の行なので、プログラムはここで終わり。
- **tick 5 以降**: 実行する行はもうありません。それでもロボットは走り続けます。\`drive forward\` で走り出したまま、止める命令がないからです。`,
    ),
    text(
      `## What happens in one tick

Every tick, all the robots go through the same steps in the same order.`,
      `## 1 tick の中で起きること

どの tick も、全部のロボットが同じ順番で進みます。`,
    ),
    { kind: 'figure', figure: 'tick-steps', caption: caption(
      'One tick: every robot looks, every program thinks, and then all of them move and shoot together.',
      '1 tick の流れ。全員が周りを見て、全員のプログラムが考えてから、全員がいっせいに動いて撃つ。',
    ) },
    text(
      `Two things follow:

- **A robot sees what was there at the start of the tick.** The sensors (Chapter 4) are read before the program runs. If the robot turns in this tick, it sees the result in the next.
- **Nobody moves first.** All the robots move together, so a robot cannot see what the enemy does in this tick and dodge it. It can react only in the next.`,
      `ここから分かることが 2 つあります。

- **ロボットが見ているのは、その tick の始めの様子です。** センサー（第 4 章）はプログラムより先に読まれます。この tick で向きを変えても、それが見えるのは次の tick です。
- **先に動く方はいません。** 全員がいっせいに動くので、敵がこの tick にすることを見てからよけることはできません。反応できるのは次の tick です。`,
    ),
    text(
      `## Lines that take many ticks

Some actions take more than a tick. \`turn left 90\` turns 6 degrees a tick (with standard legs), so turning 90 degrees takes 15 ticks, half a second. All that time, the program stays on this one line.`,
      `## 何 tick もかかる行

1 tick では終わらない行動もあります。\`turn left 90\` は 1 tick に 6 度ずつ（標準の脚の場合）回るので、90 度回るのに 15 tick（0.5 秒）かかります。その間、プログラムはずっとこの 1 行にいます。`,
    ),
    code(LONG_TURN),
    { kind: 'timeline', timeline: { stage: RANGE, program: LONG_TURN, ticks: 17 }, caption: caption(
      'Line 1 runs for 15 ticks; fire comes only on tick 16.',
      '1 行目が 15 tick 続いて、16 tick 目にやっと fire。',
    ) },
    text(
      `\`face enemy\` is the same: it keeps turning until the robot faces the enemy. With the enemy right behind, that is half a turn: 30 ticks, a whole second.

**While such a line runs, the program goes no further.** For that second the robot can neither shoot nor guard, and does not notice a bullet coming. Usually that does not matter, but in a close fight a second is long.

\`turn enemy\` turns for one tick only. Put it in a \`loop\` with other lines, and the robot turns a little at a time while it checks its surroundings every tick. Which of the two you use changes how strong a robot is; Chapter 5 comes back to this.`,
      `\`face enemy\` も同じで、敵の方を向くまで回り続けます。敵が真後ろにいれば半回転で 30 tick、まる 1 秒です。

**こういう行を実行している間は、プログラムが先へ進みません。** その 1 秒、ロボットは撃つことも身構えることもできず、弾が飛んできても気づきません。ふだんは問題になりませんが、近くで撃ち合っているときの 1 秒は長いです。

\`turn enemy\` なら 1 tick だけ回ります。ほかの行といっしょに \`loop\` に入れておけば、少しずつ向きを変えながら、tick ごとに周りを確かめられます。どちらを使うかで、ロボットの強さが変わってきます。この話は第 5 章でもう一度します。`,
    ),
    { kind: 'scene', scene: { stage: BEHIND, program: FACE_BEHIND, tick: 15 }, caption: caption(
      'Half a second into face enemy: ALPHA has turned 90 degrees towards the target behind it, and can do nothing else until it is round.',
      'face enemy の途中（0.5 秒後）。ALPHA は後ろの的の方へ 90 度回ったところで、回り終わるまでほかのことはできない。',
    ) },
    text(
      `## A round of a loop

The \`loop\` line itself takes no time. How long a round takes depends on how many actions are inside.`,
      `## loop の 1 周にかかる時間

\`loop\` の行そのものは時間がかかりません。1 周にかかる時間は、中にある行動の数で決まります。`,
    ),
    code(TWO_TICK_LOOP),
    { kind: 'timeline', timeline: { stage: RANGE, program: TWO_TICK_LOOP, ticks: 6 }, caption: caption(
      'Two actions, so two ticks a round: a tick to turn, a tick to shoot, by turns.',
      '行動が 2 つなので、1 周に 2 tick。回る tick と撃つ tick が交互に来る。',
    ) },
    text(
      `And a \`loop\` with no action in it?`,
      `では、中に行動がない \`loop\` はどうなるでしょう。`,
    ),
    code(NO_ACTION_LOOP),
    text(
      `\`drive forward\` takes no time, so the program goes round and round the \`loop\` within one tick, and the tick never ends. So the game cuts it off after 1000 lines without an action: the robot does nothing that tick, and the log shows a warning. (Driving is a setting, so the robot keeps driving.)

**Always put at least one action in a \`loop\`.** If there is nothing to do, \`wait\` is enough.`,
      `\`drive forward\` は時間がかからないので、プログラムは 1 tick の中で \`loop\` を回り続け、tick が終わりません。そこでゲームは、行動のないまま 1000 行進んだところで打ち切り、その tick は何もしなかったことにします。ログには警告が出ます。（走るのは「設定」なので、ロボットは走り続けています。）

**\`loop\` の中には、必ず行動を 1 つは入れましょう。** することがなければ \`wait\` で十分です。`,
    ),
    text(
      `## From shot to hit

Bullets take time too. A bullet goes 400 a second, so a target 350 away is hit about 0.8 seconds (24 ticks) after the shot. By then a moving enemy may be somewhere else.

And after a shot, the standard gun cannot shoot again for 0.8 seconds. A \`fire\` in that time fires nothing, and the tick goes by.`,
      `## 撃ってから当たるまで

弾が飛ぶのにも時間がかかります。弾は 1 秒に 400 進むので、350 離れた的に当たるのは、撃ってから約 0.8 秒（24 tick）後です。その間に、動いている敵は場所を変えているかもしれません。

また、標準の銃は 1 発撃つと 0.8 秒たたないと次を撃てません。その間に \`fire\` を実行しても弾は出ず、tick だけが過ぎます。`,
    ),
    text(
      `## Watching ticks in the game

Run a match with DEBUG and you can follow how the program goes. The yellow line runs next; the pale green lines ran in the current tick. The \`1▶\` button goes on one line at a time while debugging, and one tick at a time otherwise. Step through your own program a tick at a time, and you will soon get used to it.`,
      `## ゲームの中で tick を見る

「デバッグ」で試合をすると、プログラムがどう進むかを追いかけられます。黄色の行は次に実行する行、薄い緑の行は今の tick で実行した行です。\`1▶\` ボタンを押すと、デバッグ中は 1 行ずつ、それ以外のときは 1 tick ずつ進みます。自分のプログラムを 1 tick ずつ進めてみると、すぐに慣れます。`,
    ),
    { kind: 'shot', shot: 'debug', caption: caption(
      'Debugging: the yellow line runs next; the green lines ran in this tick.',
      'デバッグ中の画面。黄色が次に実行する行、緑がこの tick で実行した行。',
    ) },
    text(
      `## In short

- A match goes in ticks: 30 make a second.
- Each tick, the program runs on until it does one action.
- \`drive\`, \`if\`, \`set\`, \`label\` and \`loop\` take no time.
- \`drive\` is a setting: the robot keeps driving while it does other actions.
- \`turn left 90\` and \`face enemy\` take many ticks, and the program does nothing else meanwhile.
- Every \`loop\` needs an action in it.
- A robot sees what was there at the start of the tick.`,
      `## まとめ

- 試合は tick で進む。30 tick で 1 秒。
- プログラムは、1 tick ごとに行動を 1 つするところまで進む。
- \`drive\`、\`if\`、\`set\`、\`label\`、\`loop\` は時間がかからない。
- \`drive\` は設定。ほかの行動をしている間も走り続ける。
- \`turn left 90\` や \`face enemy\` は何 tick もかかり、その間ほかのことはしない。
- \`loop\` の中には必ず行動を入れる。
- ロボットが見ているのは、その tick の始めの様子。`,
    ),
    { kind: 'see', topics: ['basics', 'rules', 'debugging-help'] },
  ],
};

export const BOOK: readonly BookPart[] = [
  {
    id: 'part-1',
    title: { en: 'Part 1: Thinking in programs', ja: '第 1 部 プログラムで考える' },
    chapters: [WHAT_A_PROGRAM_IS, MAKING_IT_MOVE, TICKS],
  },
];

/** Every chapter, in the order of the book. */
export const CHAPTERS: readonly BookChapter[] = BOOK.flatMap((part) => part.chapters);
