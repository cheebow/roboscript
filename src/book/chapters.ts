import type { Text } from '../tutorial/types';
import { BEHIND, CORNER, FAR, HIDDEN, MOVING, QUARTER, RANGE, SHOT_AT, TRACK } from '../tutorial/stages';
import {
  COUNT_HITS,
  DRIVE_ON,
  FACE_BEHIND,
  FIRE_FIRST,
  FIRST_PROGRAM,
  GUARD_FIRST,
  JUST_LOOK,
  KEEP_FIRING,
  LONG_TURN,
  MISSING_INDENT,
  MISSPELT,
  NEVER_SET,
  NO_ACTION_LOOP,
  ONE_SHOT,
  SEARCH_AND_SHOOT,
  SEARCH_AND_SHOOT_IN_FUNCTIONS,
  STUCK,
  TICK_BY_TICK,
  TIMED_DRIVE,
  TURN_AND_CHECK,
  TURN_THEN_DRIVE,
  TWO_TICK_LOOP,
  UNSTUCK,
  UNTIL_SEEN,
  VALUE_THAT_TAKES_TIME,
  WITHIN_RANGE,
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

const LOOKING_AROUND: BookChapter = {
  id: 'looking-around',
  title: { en: 'Looking around', ja: '周りを見る' },
  blocks: [
    text(
      `A program learns what is around the robot through its **sensors**. Under names such as \`enemy_visible\` (is the enemy in sight?) and \`enemy_distance\` (how far is it?) it reads how things are now.

The sensors are read again at the start of every tick (Chapter 3). The same \`enemy_distance\` has a new value as the ticks go by.`,
      `プログラムが周りの様子を知る手段が **センサー** です。\`enemy_visible\`（敵が見えているか）や \`enemy_distance\`（敵までの距離）のような名前で、今の様子を読めます。

センサーの値は、tick の始めに読み直されます（第 3 章）。同じ \`enemy_distance\` でも、tick が進めば値は変わります。`,
    ),
    text(
      `## Yes-or-no, and numbers

There are two kinds of sensor:

- Yes or no: \`enemy_visible\` (the enemy is in sight), \`blocked\` (the way ahead is blocked), \`bullet_incoming\` (a bullet is coming at you), \`hit\` (you were hit) and so on
- Numbers: \`enemy_distance\` (how far the enemy is), \`enemy_angle\` (which way it is), \`hp\` (your HP), \`reload\` (seconds until you can shoot again) and so on

These are the ones you will use most. The help lists them all.`,
      `## 本当かうそか、と数

センサーには 2 種類あります。

- 本当かうそかを表すもの: \`enemy_visible\`（敵が見えている）、\`blocked\`（前がふさがっている）、\`bullet_incoming\`（当たるコースの弾が来ている）、\`hit\`（撃たれた）など
- 数を表すもの: \`enemy_distance\`（敵までの距離）、\`enemy_angle\`（敵のいる方向）、\`hp\`（自分の HP）、\`reload\`（次に撃てるまでの秒数）など

よく使うのはこのあたりです。全部の一覧はヘルプにあります。`,
    ),
    text(
      `## Values that change

Here are the sensors of a robot that just stands there, read in a real match. The other robot drives about.`,
      `## 変わっていく値

何もせずに立っているロボットのセンサーを、本物の試合で読んでみます。相手は動き回る的です。`,
    ),
    code(JUST_LOOK),
    { kind: 'readings', readings: { stage: MOVING, program: JUST_LOOK, ticks: [1, 10, 20, 30, 40], sensors: ['enemy_visible', 'enemy_distance', 'enemy_angle'] }, caption: caption(
      'ALPHA\'s sensors as it watches a moving target, from a real match.',
      '動く的を見ている ALPHA のセンサーの値（本物の試合から）。',
    ) },
    text(
      `ALPHA does nothing, but the target moves, so the values change. A program decides what to do by watching values like these.`,
      `ALPHA は何もしていませんが、的が動くので値は変わっていきます。プログラムは、こうして変わる値を見て動きを決めます。`,
    ),
    text(
      `## Which way: the angle

\`enemy_angle\` says in degrees which way the enemy is, seen from where the body faces. Right is plus and left is minus; straight ahead is 0 and straight behind is 180 (or -180).`,
      `## 角度の測り方

\`enemy_angle\` は、車体の正面から見て敵がどちらにいるかを、度で表します。右がプラス、左がマイナスで、真正面が 0、真後ろが 180（または -180）です。`,
    ),
    { kind: 'figure', figure: 'angles', caption: caption(
      'How enemy_angle is measured: 0 where the body faces, plus to the right, minus to the left.',
      'enemy_angle の測り方。車体の正面が 0、右がプラス、左がマイナス。',
    ) },
    text(
      `It is measured from the robot's own heading, so when the robot turns, \`enemy_angle\` changes even if the enemy stands still.`,
      `自分の向きが基準なので、ロボットが回れば、敵が止まっていても \`enemy_angle\` は変わります。`,
    ),
    text(
      `## An enemy out of sight

The sensors see all the way round, but not through obstacles.`,
      `## 見えない敵

センサーは周りをぐるりと見渡せますが、障害物の向こうは見えません。`,
    ),
    { kind: 'scene', scene: { stage: HIDDEN, program: JUST_LOOK, tick: 1 }, caption: caption(
      'The target (top left) is behind the block, so ALPHA (bottom right) cannot see it: enemy_visible is false.',
      '的（左上）は障害物の陰にいるので、ALPHA（右下）からは見えない。enemy_visible はうそ（false）。',
    ) },
    text(
      `While the enemy is out of sight, \`enemy_distance\` and \`enemy_angle\` point to where it was last seen. If it has never been seen, they are 0.`,
      `見えていない間、\`enemy_distance\` と \`enemy_angle\` は、最後に見た場所を指します。一度も見ていなければ 0 です。`,
    ),
    { kind: 'see', topics: ['words'] },
  ],
};

const IF: BookChapter = {
  id: 'if',
  title: { en: 'If…', ja: 'もし〜なら' },
  blocks: [
    text(
      `Once the sensors tell you how things are, you make the robot act on it. That is what \`if\` is for.`,
      `センサーで様子が分かったら、それに合わせて動きを変えます。そのための書き方が \`if\` です。`,
    ),
    text(
      `## if and else`,
      `## if と else`,
    ),
    code(SEARCH_AND_SHOOT),
    text(
      `- \`if enemy_visible\`: if the enemy is in sight, run the three lines below
- \`else\`: if not, run the one line below

It drives on, checking every tick whether it can see the enemy, and when it can, it stops and shoots.`,
      `- \`if enemy_visible\`: 敵が見えていたら、下の 3 行を実行する
- \`else\`: 見えていなかったら、下の 1 行を実行する

走りながら毎 tick「見えるか」を確かめ、見えたら止まって撃ちます。`,
    ),
    { kind: 'scene', scene: { stage: HIDDEN, program: SEARCH_AND_SHOOT, tick: 200 }, caption: caption(
      'Past the block, ALPHA can see the target, so it has stopped and is shooting.',
      '障害物の横を抜けて的が見えたので、止まって撃っている。',
    ) },
    text(
      `\`loop\` with \`if\` inside is the basic shape of a robot's program: every tick it looks again, and picks the one action that fits.`,
      `\`loop\` の中に \`if\` を入れるのが、ロボットのプログラムの基本の形です。tick ごとに様子を確かめ直して、そのときに合った行動を 1 つ選びます。`,
    ),
    text(
      `## Writing conditions

| Condition | Means |
|---|---|
| \`enemy_distance < 300\` | the enemy is nearer than 300 |
| \`hp <= 100\` | HP is 100 or less |
| \`ammo == 0\` | no bullets left |
| \`reload != 0\` | the gun is not ready yet |
| \`enemy_visible and enemy_distance < 300\` | in sight, and nearer than 300 |
| \`blocked or hit\` | the way is blocked, or you were hit |
| \`not enemy_visible\` | not in sight |

\`==\` is "equals", and \`!=\` is "does not equal".`,
      `## 条件の書き方

| 書き方 | 意味 |
|---|---|
| \`enemy_distance < 300\` | 敵までの距離が 300 より小さい |
| \`hp <= 100\` | HP が 100 以下 |
| \`ammo == 0\` | 弾がもうない |
| \`reload != 0\` | まだ撃てない |
| \`enemy_visible and enemy_distance < 300\` | 見えていて、しかも 300 より近い |
| \`blocked or hit\` | 前がふさがっているか、撃たれた |
| \`not enemy_visible\` | 見えていない |

\`==\` は「等しい」、\`!=\` は「等しくない」です。`,
    ),
    text(
      `## while: repeat as long as

\`while\` repeats the lines inside as long as its condition holds. When it no longer does, the program goes on below.`,
      `## while: 当てはまる間だけ繰り返す

\`while\` は、条件が当てはまる間だけ中を繰り返します。当てはまらなくなったら、その下へ進みます。`,
    ),
    code(UNTIL_SEEN),
    text(
      `It drives until it sees the target, then stops and fires one shot. After that the program is over, and it does nothing more.`,
      `見えるまで走り、見えたら止まって 1 発だけ撃ちます。撃ったあとはプログラムが終わるので、何もしません。`,
    ),
    text(
      `## The order is the priority

With \`else if\` you can line up many conditions. They are checked from the top, and only the first that holds is run.`,
      `## 並べる順番が優先順位

\`else if\` を使うと、条件をいくつも並べられます。上から順に調べて、最初に当てはまったものだけを実行します。`,
    ),
    code(GUARD_FIRST),
    text(
      `Here are the same two conditions the other way round.`,
      `同じ 2 つの条件を、逆の順に並べたのがこちらです。`,
    ),
    code(FIRE_FIRST),
    text(
      `Against a robot that keeps shooting, the two come out quite differently:

- The one that shoots first always sees the enemy, so its \`guard\` never runs. It trades shots, and both robots fall on the same tick: a draw.
- The one that guards first guards whenever a bullet comes. But \`guard\` works only four times a match, and each one puts off its next shot a little. Against this robot it lost the exchange.

Which is better depends on the opponent. What matters here is that **changing the order alone makes a different robot**.`,
      `撃ち続けてくる相手と戦わせると、結果がはっきり分かれます。

- 撃つのが先の方は、敵がいつも見えているので、\`guard\` が一度も実行されません。撃ち合いになり、同じ tick に倒れて引き分けです。
- \`guard\` が先の方は、弾が来るたびに \`guard\` します。ただ \`guard\` は 1 試合に 4 回までで、使うたびに次の弾が少し遅れます。この相手には撃ち負けました。

どちらがいいかは相手しだいです。大事なのは、**順番を入れかえただけで、別のロボットになる** ことです。`,
    ),
    text(
      `## face and turn again

Chapter 3 said that \`face enemy\` can do nothing else until it has turned. With \`loop\` and \`if\`, the robot can check for bullets on every tick while it turns.`,
      `## もう一度 face と turn

第 3 章で、\`face enemy\` は回り終わるまでほかのことができないと書きました。\`loop\` と \`if\` を使えば、回りながら毎 tick 弾を確かめられます。`,
    ),
    code(TURN_AND_CHECK),
    { kind: 'timeline', timeline: { stage: BEHIND, program: TURN_AND_CHECK, ticks: 6 }, caption: caption(
      'Turning to a target right behind: every tick, it checks for bullets first, then turns.',
      '真後ろの的の方へ回っているところ。毎 tick、まず弾が来ていないかを確かめてから回っている。',
    ) },
    text(
      `\`face enemy\` would not check once in that whole second. This one checks every tick, so it can switch to \`guard\` the moment a bullet comes.`,
      `\`face enemy\` なら、その 1 秒の間に一度も弾を確かめません。こちらは tick ごとに確かめるので、弾が来たらすぐに \`guard\` に切りかえられます。`,
    ),
    { kind: 'see', topics: ['conditions'] },
  ],
};

const REMEMBERING: BookChapter = {
  id: 'remembering',
  title: { en: 'Remembering', ja: '覚えておく' },
  blocks: [
    text(
      `The sensors only tell you about now. To remember how things were, or to count something, you use **variables**.`,
      `センサーが教えてくれるのは「今」のことだけです。前の様子を覚えておいたり、何かを数えたりするには **変数** を使います。`,
    ),
    text(
      `## set`,
      `## set で覚える`,
    ),
    code(`set ticks = 0
set ticks = ticks + 1
`),
    text(
      `\`set\` keeps a number under a name. The first line puts 0 in \`ticks\`; the second puts in "\`ticks\` as it is now, plus 1".

- A variable holds a number, and only a number.
- A name is made of letters, digits and \`_\`, and starts with a letter (\`last_hp\`, say). The names of commands and sensors cannot be used.
- \`set\` takes no time.`,
      `\`set\` は、名前を付けて数を覚えておく命令です。1 行目で \`ticks\` に 0 を入れ、2 行目で「今の \`ticks\` に 1 を足した数」を入れています。

- 変数に入れられるのは数だけです。
- 名前は英字・数字・\`_\` で作り、英字から始めます（\`last_hp\` など）。命令やセンサーの名前は使えません。
- \`set\` は時間がかかりません。`,
    ),
    text(
      `## Counting ticks`,
      `## tick を数える`,
    ),
    code(TIMED_DRIVE),
    text(
      `Each round of \`while\` waits one tick and adds 1 to \`ticks\`. At 60 the \`while\` ends and the robot stops. 60 ticks are two seconds, so it drives for exactly two seconds.`,
      `\`while\` を 1 周するたびに \`wait\` で 1 tick たち、\`ticks\` が 1 増えます。60 になったら \`while\` を抜けて止まります。60 tick は 2 秒なので、ちょうど 2 秒走って止まるプログラムです。`,
    ),
    { kind: 'scene', scene: { stage: TRACK, program: TIMED_DRIVE, tick: 90 }, caption: caption(
      'Stopped after two seconds, 200 on from where it started.',
      '2 秒走り、出発点から 200 進んだところで止まっている。',
    ) },
    text(
      `## Comparing with the tick before`,
      `## 前の tick と比べる`,
    ),
    code(COUNT_HITS),
    text(
      `\`last_hp\` keeps the HP of the tick before. If \`hp\` is now lower, the robot was hit; it adds 1 to \`hits\` each time, and after the third hit it backs off.

The \`hit\` sensor would tell you about a hit too. A variable is used here to show how to remember how things were.`,
      `\`last_hp\` に前の tick の HP を覚えておき、今の \`hp\` の方が小さければ、撃たれたと分かります。そのたびに \`hits\` を 1 増やし、3 発当たったら後ろへ下がります。

撃たれたことは \`hit\` センサーでも分かります。ここでは、前の様子を覚えておくやり方を見せるために変数を使いました。`,
    ),
    { kind: 'scene', scene: { stage: SHOT_AT, program: COUNT_HITS, tick: 110 }, caption: caption(
      'Hit three times, ALPHA (right) is backing off.',
      '3 発当たったので、ALPHA（右）が後ろへ下がっている。',
    ) },
    text(
      `## Seeing them in Watch

While debugging, Watch (bottom right of the screen) shows the variables as they are now. Check there that a number goes up the way you meant.`,
      `## ウォッチで中身を見る

デバッグ中は、画面右下の「ウォッチ」に変数の今の値が出ます。数が思ったとおりに増えているか、ここで確かめられます。`,
    ),
    { kind: 'see', topics: ['values'] },
  ],
};

const FUNCTIONS: BookChapter = {
  id: 'functions',
  title: { en: 'Giving things names', ja: 'まとめて名前を付ける' },
  blocks: [
    text(
      `As a program grows, it gets hard to tell what each part does. A **function** puts a few lines together under a name.`,
      `プログラムが長くなってくると、どこで何をしているのか分かりにくくなります。何行かをひとまとめにして名前を付けられるのが **関数** です。`,
    ),
    text(
      `## def, and calling by name

Here is the program of Chapter 5 again, written with functions.`,
      `## def で作って、名前で呼ぶ

第 5 章のプログラムを、関数を使って書き直してみます。`,
    ),
    code(SEARCH_AND_SHOOT_IN_FUNCTIONS),
    text(
      `- The three lines under \`def attack()\` are a function called \`attack\`.
- A line \`attack()\` runs those three lines.

It plays exactly the same match as before (checked with a real one). But now the \`loop\` alone says what the robot does: attack when it sees the enemy, search when it does not. Write the \`()\` even when there is nothing in them.`,
      `- \`def attack()\` の下の 3 行が、\`attack\` という名前の関数です。
- \`attack()\` と書いた行で、その 3 行が実行されます。

動きは書き直す前とまったく同じです（本物の試合で確かめてあります）。それでも、\`loop\` の中を読むだけで「見えたら攻撃、見えなければ探す」と分かるようになりました。中に何もなくても \`()\` は付けます。`,
    ),
    text(
      `## Arguments

You can hand a function a number.`,
      `## 引数

関数に数を渡すこともできます。`,
    ),
    code(`def turn_by(degrees)
    turn right degrees

turn_by(90)
turn_by(-45)
`),
    text(
      `\`degrees\` is an **argument**: it holds the number written in the call.`,
      `\`degrees\` を **引数** といいます。呼ぶときに書いた数が入ります。`,
    ),
    text(
      `## A function that gives back a value`,
      `## 値を返す関数`,
    ),
    code(WITHIN_RANGE),
    text(
      `The number after \`return\` is the value of the function. \`margin()\` is how much room is left before the edge of the gun's range: above 0, the enemy is in range. The robot drives until it is, then stops and shoots.`,
      `\`return\` のあとに書いた数が、関数の値になります。\`margin()\` は「射程まであとどれだけ余裕があるか」で、プラスなら敵が射程に入っています。射程に入るまで走り、入ったら止まって撃ちます。`,
    ),
    { kind: 'scene', scene: { stage: FAR, program: WITHIN_RANGE, tick: 120 }, caption: caption(
      'ALPHA (right) stopped once the target was in range, and is shooting.',
      'ALPHA（右）は、的が射程に入ったところで止まって撃っている。',
    ) },
    text(
      `## A function that takes time cannot be a value

A function used as a value, as in the condition of an \`if\`, cannot have actions (\`wait\`, \`fire\` and so on) or \`loop\` in it: the tick would end in the middle of checking the condition.`,
      `## 時間のかかる関数は、値には使えない

\`if\` の条件のように値として使う関数には、行動（\`wait\` や \`fire\` など）や \`loop\` を入れられません。条件を調べている途中で tick が終わってしまうからです。`,
    ),
    { kind: 'error', program: VALUE_THAT_TAKES_TIME, caption: caption(
      'A function with an action in it, used in a condition.',
      '行動の入った関数を条件に使うと、こう言われる。',
    ) },
    text(
      `A function called as a line of its own, as \`attack()\` was, can have actions in it and take as many ticks as it likes.`,
      `\`attack()\` のように行として呼ぶ関数なら、行動を入れても、何 tick かかってもかまいません。`,
    ),
    { kind: 'see', topics: ['functions-help'] },
  ],
};

const DEBUGGING: BookChapter = {
  id: 'debugging',
  title: { en: 'When it does not do what you meant', ja: '思った通りに動かないとき' },
  blocks: [
    text(
      `A robot that does not do what you meant is an everyday thing. To fix it:

- First, think how it should move.
- Run a match, and find where it does something else.
- Then find out which lines of the program were running there.`,
      `ロボットが思ったとおりに動かないのは、いつものことです。直すときは、次の順に進めます。

- まず、どう動くはずかを考える。
- 試合をして、そのとおりにならないところを見つける。
- そこで、プログラムのどの行が動いていたかを調べる。`,
    ),
    text(
      `## Reading an error

When a program is written wrong, the match does not even start. The message in the log says which line is wrong, and how. Here are three common ones.`,
      `## エラーを読む

書き方がまちがっていると、試合はそもそも始まりません。ログに出るメッセージに、何行目の何がおかしいかが書いてあります。よくある 3 つを見てみましょう。`,
    ),
    { kind: 'error', program: MISSING_INDENT, caption: caption('The line inside loop is not indented.', 'loop の中の行を字下げし忘れた。') },
    { kind: 'error', program: MISSPELT, caption: caption('fire is misspelt.', 'fire のつづりをまちがえた。') },
    { kind: 'error', program: NEVER_SET, caption: caption('limit is never set.', 'limit に一度も set していない。') },
    text(
      `## Stuck at the wall

Harder are the programs that do start, but move oddly. Here is one.`,
      `## 壁で止まったまま

試合は始まるのに、動きがおかしい。こちらの方が手ごわい問題です。例を見てみます。`,
    ),
    code(STUCK),
    { kind: 'scene', scene: { stage: CORNER, program: STUCK, tick: 150 }, caption: caption(
      'It drove into the top wall, and stays there.',
      '上の壁にぶつかって、そのまま止まっている。',
    ) },
    text(
      `It sets off with \`drive forward\` and then only waits, so once it reaches the wall it stays there. Make it turn when the way is blocked:`,
      `\`drive forward\` で走り出したあとは待っているだけなので、壁にぶつかったら止まったままです。前がふさがったら向きを変えるようにします。`,
    ),
    code(UNSTUCK),
    { kind: 'scene', scene: { stage: CORNER, program: UNSTUCK, tick: 300 }, caption: caption(
      'At the wall it turned right, and is driving along it.',
      '壁にぶつかったら右へ回り、壁に沿って走っている。',
    ) },
    text(
      `## label: which way is it going?

The \`label TURN\` and \`label GO\` above change nothing about how the robot moves. While debugging, the name shows under the robot, so you can see at a glance which branch it is in.`,
      `## label で、今どこを通っているか見る

上の \`label TURN\` と \`label GO\` は、動きには何も影響しません。デバッグ中はロボットの下にその名前が出るので、今どちらの道を通っているかが一目で分かります。`,
    ),
    text(
      `## The tools

| Tool | What for |
|---|---|
| Log | what happened, in order. Click a row to go to that moment |
| \`label\` | shows under the robot which way the program is going |
| Watch | the variables and sensors as they are now |
| \`1▶\` | on one line at a time |
| \`1▷\` | goes through a called function in one go, and stops at the next line |
| Click a line number (◆) | goes to where that line runs next. Click again to take it off |

When you wonder why a line never runs, put a ◆ on it and on the lines before it, and see how far the program gets. Where it stops getting, look in Watch at the condition just before.`,
      `## 道具のまとめ

| 道具 | 使いどころ |
|---|---|
| ログ | 何が起きたかを時間順に見る。行を押すと、その時点へ移る |
| \`label\` | 今どの道を通っているかを、ロボットの下に出す |
| ウォッチ | 変数とセンサーの今の値を見る |
| \`1▶\` | 1 行ずつ進める |
| \`1▷\` | 呼んだ関数の中は一気に進めて、次の行で止まる |
| 行番号を押す（◆） | その行が次に実行される時点へ移る。もう一度押すと外れる |

「この行がなぜ実行されないのか」と思ったら、その行とその手前の行に ◆ を付けて、どこまで来ているかを見てください。来ていない行があれば、その手前の条件がどうなっているかをウォッチで確かめます。`,
    ),
    text(
      `## End of Part 1

That is all of Part 1. With ticks, sensors, \`if\`, variables, functions and debugging, you can write any robot. Part 2 uses them to work out how to win (it is still being written).`,
      `## 第 1 部のおわりに

第 1 部はここまでです。tick、センサー、\`if\`、変数、関数、デバッグがそろえば、どんなロボットでも書けます。第 2 部では、これを使って勝つための作戦を考えます（これから書きます）。`,
    ),
    { kind: 'see', topics: ['debugging-help', 'errors'] },
  ],
};

export const BOOK: readonly BookPart[] = [
  {
    id: 'part-1',
    title: { en: 'Part 1: Thinking in programs', ja: '第 1 部 プログラムで考える' },
    chapters: [WHAT_A_PROGRAM_IS, MAKING_IT_MOVE, TICKS, LOOKING_AROUND, IF, REMEMBERING, FUNCTIONS, DEBUGGING],
  },
];

/** Every chapter, in the order of the book. */
export const CHAPTERS: readonly BookChapter[] = BOOK.flatMap((part) => part.chapters);
