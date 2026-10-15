import type { Text } from '../tutorial/types';
import { TEAM_DEFAULT_LOADOUT, castleHpFor, teamCostLimitFor } from '../data/castle';
import { COST_LIMIT, costOf } from '../data/parts';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { SAMPLE_AI } from '../data/templates/sample';
import { BEHIND, CORNER, FAR, HIDDEN, MOVING, QUARTER, RANGE, SHELTER, SHOT_AT, TRACK } from '../tutorial/stages';
import {
  AIM_AHEAD,
  AIM_AT_ENEMY,
  AIM_WHILE_RELOADING,
  ANY_GUN,
  COUNT_HITS,
  DRIVE_ON,
  FACE_BEHIND,
  FIRE_FIRST,
  FIRST_PROGRAM,
  GROW_1,
  GROW_2,
  GROW_3,
  GROW_4,
  GROW_HIDE,
  GUARD_AT_HIT,
  GUARD_FIRST,
  GUARD_ON_SIGHT,
  GUARD_ON_TOP,
  GUARD_UNDER,
  HIDE_AND_REST,
  JUST_LOOK,
  KEEP_FIRING,
  LONG_TURN,
  MISSING_INDENT,
  MISSPELT,
  NEVER_SET,
  NO_ACTION_LOOP,
  NO_GUARD,
  ONE_SHOT,
  SAMPLE_SOONER,
  SEARCH_AND_SHOOT,
  SEARCH_AND_SHOOT_IN_FUNCTIONS,
  SHOOT_ON_THE_MOVE,
  STUCK,
  TICK_BY_TICK,
  TIMED_DRIVE,
  TRACK_NO_ACTION,
  TURN_AND_CHECK,
  TURN_FIRST,
  TURN_THEN_DRIVE,
  TWO_TICK_LOOP,
  UNSTUCK,
  UNTIL_SEEN,
  VALUE_THAT_TAKES_TIME,
  WITHIN_RANGE,
} from './examples';
import { matchCount } from './matchups';
import { BROADSIDE } from './stages';
import type { BookBlock, BookChapter, BookPart, Matchup, Replay } from './types';

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
      'ALPHA（右）が撃った 1 発が、的（左）へ飛んでいるところ。この本では、プログラムを動かす自分のロボットを ALPHA と呼ぶ。',
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
| \`aim enemy\` | 砲塔（車体の上の銃）だけを敵の方へ回す |
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
      'The same five lines (the numbers are line numbers): an ordinary program runs them all at once; a robot\'s runs a few of them each tick. Why 2 and 3 share a tick comes next.',
      '同じ 5 行（数字は行番号）でも、ふつうのプログラムは一度に全部進み、ロボットのプログラムは tick ごとに少しずつ進む。2 と 3 が同じ tick になるわけは、次の節で。',
    ) },
    text(
      `## One action, and the tick is over

How far the program gets in one tick follows a short rule:

- \`turn\`, \`aim\`, \`face\`, \`fire\`, \`guard\` and \`wait\` are **actions**. When the program runs an action, that tick is over. The next tick starts from the next line.
- \`drive\`, \`if\`, \`set\`, \`label\`, \`loop\` and the like **take no time**. The program goes on to the next line in the same tick. (\`if\`, \`set\` and \`label\` come in later chapters.)

Here it is with a real program.`,
      `## 行動を 1 つしたら、その tick は終わり

1 tick でどこまで進むかは、次の決まりで決まります。

- \`turn\`、\`aim\`、\`face\`、\`fire\`、\`guard\`、\`wait\` は **行動** です。行動を 1 つ実行すると、その tick は終わりです。次の tick は、その次の行から始まります。
- \`drive\`、\`if\`、\`set\`、\`label\`、\`loop\` などは **時間がかかりません**。同じ tick のまま次の行へ進みます。（\`if\`、\`set\`、\`label\` はあとの章で出てきます。）

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
      `## true か false か、と数

センサーには 2 種類あります。

- true（はい）か false（いいえ）で答えるもの: \`enemy_visible\`（敵が見えている）、\`blocked\`（前がふさがっている）、\`bullet_incoming\`（当たるコースの弾が来ている）、\`hit\`（撃たれた）など
- 数を表すもの: \`enemy_distance\`（敵までの距離）、\`enemy_angle\`（敵のいる方向）、\`hp\`（自分の HP）、\`reload\`（次に撃てるまでの秒数）など

よく使うのはこのあたりです。全部の一覧はヘルプにあります。`,
    ),
    text(
      `## Values that change

Try it with a robot that just stands there. Its program only waits and uses no sensors at all, yet the sensors are still read every tick.

The table below comes from a real match against a target that drives about. It shows three of ALPHA's sensors, \`enemy_visible\`, \`enemy_distance\` and \`enemy_angle\`, every few ticks. While debugging you can see the same values in the watch.`,
      `## 変わっていく値

何もせずに立っているロボットで試してみます。プログラムは待つだけで、センサーは使っていません。それでもセンサーの値は、毎 tick 読み直されています。

下の表は、動き回る的を相手に本物の試合をして、ALPHA のセンサーのうち \`enemy_visible\`、\`enemy_distance\`、\`enemy_angle\` の 3 つを、何 tick かおきに書き出したものです。デバッグ中なら、同じ値をウォッチで見られます。`,
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
      '的（左上）は障害物の陰にいるので、ALPHA（右下）からは見えない。enemy_visible は false。',
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
| \`ammo == 0\` | no bullets left (there are only so many) |
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
| \`ammo == 0\` | 弾を撃ち尽くした（弾の数には限りがある） |
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
- \`guard\` が先の方は、弾が来るたびに \`guard\` します。ただ \`guard\` は 1 試合に 4 回までで、使うたびに、自分が次に撃てるのが少し遅くなります。この相手には撃ち負けました。

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
      `The number after \`return\` is the value of the function. \`weapon_range\` is a sensor: how far the gun's bullets reach (its range). \`margin()\` is how much room is left before the edge of the gun's range: above 0, the enemy is in range. The robot drives until it is, then stops and shoots.`,
      `\`return\` のあとに書いた数が、関数の値になります。\`weapon_range\` は、銃の弾が届く距離（射程）を表すセンサーです。\`margin()\` は「射程まであとどれだけ余裕があるか」で、プラスなら敵が射程に入っています。射程に入るまで走り、入ったら止まって撃ちます。`,
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
      '行動の入った関数を条件に使うと、このエラーが出る。',
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

When you wonder why a line never runs, put a ◆ on it and on the lines before it, and see how far the program gets. Where it stops getting, look in Watch at the condition just before.

Chapter 15 goes through the debugger, the log and the analysis on a real match.`,
      `## 道具のまとめ

| 道具 | 使いどころ |
|---|---|
| ログ | 何が起きたかを時間順に見る。行を押すと、その時点へ移る |
| \`label\` | 今どの道を通っているかを、ロボットの下に出す |
| ウォッチ | 変数とセンサーの今の値を見る |
| \`1▶\` | 1 行ずつ進める |
| \`1▷\` | 呼んだ関数の中は一気に進めて、次の行で止まる |
| 行番号を押す（◆） | その行が次に実行される時点へ移る。もう一度押すと外れる |

「この行がなぜ実行されないのか」と思ったら、その行とその手前の行に ◆ を付けて、どこまで来ているかを見てください。来ていない行があれば、その手前の条件がどうなっているかをウォッチで確かめます。

第 15 章では、本物の試合を使って、デバッガ・ログ・分析をひととおり使います。`,
    ),
    text(
      `## End of Part 1

That is all of Part 1. With ticks, sensors, \`if\`, variables, functions and debugging, you can write any robot. Part 2 uses them to work out how to win.`,
      `## 第 1 部のおわりに

第 1 部はここまでです。tick、センサー、\`if\`、変数、関数、デバッグがそろえば、どんなロボットでも書けます。第 2 部では、これを使って勝つための作戦を考えます。`,
    ),
    { kind: 'see', topics: ['debugging-help', 'errors'] },
  ],
};

/** The built-in robots Part 2 talks about, in the order of the game's list. */
export const RIVALS = ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot', 'cover_bot', 'hit_and_hide_bot', 'strafe_bot', 'sentry_bot'] as const;

/** Where and how the book's tables of results are played. */
export const MATCHUP_ARENAS = ['center_block', 'open_field', 'pillars'] as const;
export const MATCHUP_SEEDS = [1, 2] as const;

/** A built-in robot against the seven others. */
export function matchupOf(robot: (typeof RIVALS)[number]): Matchup {
  return { robot, opponents: RIVALS.filter((other) => other !== robot), arenas: MATCHUP_ARENAS, seeds: MATCHUP_SEEDS };
}

/** A section of Chapter 9: a built-in robot, what it does and whom it beats, its program, and its matches. */
function rival(robot: (typeof RIVALS)[number], en: string, ja: string): BookBlock[] {
  return [text(en, ja), { kind: 'template', template: robot }, { kind: 'matchup', matchup: matchupOf(robot) }];
}

const BUILT_IN_ROBOTS: BookChapter = {
  id: 'built-in-robots',
  title: { en: 'Reading the built-in robots', ja: '内蔵ロボットを読む' },
  blocks: [
    text(
      `The game comes with built-in robots, each with a strategy of its own. You can send them into the ARENA, or load one as a template and change it. This chapter looks at eight of them: how each fights, and whom it beats and loses to.

Their programs are shown as the game has them, folded away because they are long. Open one and read it: it uses nothing but what Part 1 covered.`,
      `ゲームには、作戦の違う内蔵ロボットが入っています。アリーナで戦わせたり、テンプレートとして読み込んで書きかえたりできます。この章では 8 体を取り上げて、それぞれの戦い方と、得意な相手・苦手な相手を見ていきます。

プログラムは、ゲームに入っているものをそのまま載せています。長いので畳んであります。開いて読んでみてください。第 1 部で見た書き方だけでできています。`,
    ),
    text(
      `## No robot beats them all

To start with the conclusion: there is no robot that beats every other. These four, for one, go round like rock, paper, scissors.`,
      `## どれにでも勝つロボットはいない

先に結論を言うと、どの相手にも勝つロボットはいません。たとえば次の 4 体は、じゃんけんのように回っています。`,
    ),
    { kind: 'figure', figure: 'rivals', caption: caption(
      'Each beats the one its arrow points to.',
      '矢印の先の相手に勝ち越す。',
    ) },
    text(
      `Under each robot below is a button, **Play the matches**. Press it, and this page plays that robot against the other seven, right here: on ${MATCHUP_ARENAS.length} maps, with ${MATCHUP_SEEDS.length} seeds, from both starting places — ${MATCHUP_ARENAS.length * MATCHUP_SEEDS.length * 2} matches against each. The same matches always come out the same.`,
      `下の各ロボットの節にある「試合をして確かめる」を押すと、そのロボットとほかの 7 体を、このページの中で実際に戦わせます。マップ ${MATCHUP_ARENAS.length} つで、seed を ${MATCHUP_SEEDS.length} つ、スタート位置を入れかえて、相手 1 体あたり ${MATCHUP_ARENAS.length * MATCHUP_SEEDS.length * 2} 試合です。同じ試合は、何度やっても同じ結果になります。`,
    ),
    ...rival(
      'dumb_bot',
      `## DumbBot

Drives at the enemy and shoots once close. When it loses sight of the enemy it heads for where it saw it last, and if it stays lost, it goes round obstacles the other way.

The plainest strategy of all. Coming straight on, it does well against CoverBot, which waits behind cover. Against robots that shoot from a distance or keep moving, it loses.`,
      `## DumbBot

敵に向かって走り、近づいたら撃ちます。見失ったら最後に見た場所へ向かい、それでも見つからなければ、障害物を回り込む向きを変えます。

いちばん素直な作戦です。まっすぐ寄っていくので、物陰で待つ CoverBot には強く出ます。離れて撃つ相手や、動き回る相手には勝てません。`,
    ),
    ...rival(
      'aggressive_bot',
      `## AggressiveBot

Never stops: it charges the enemy and shoots on the move. Right up against the enemy, it stops pushing and only shoots.

Shots fired on the move stray a long way (Chapter 10), so few of them hit. Of the eight, it has the worst record. The one robot it beats more often than not is HitAndHideBot, which spends its time hiding.`,
      `## AggressiveBot

止まらずに突っ込み、走りながら撃ちます。敵にくっついたら、押すのをやめて撃つだけになります。

走りながら撃つ弾は大きくぶれる（第 10 章）ので、なかなか当たりません。8 体の中でいちばん成績のよくないロボットです。勝ち越せるのは、隠れてばかりいる HitAndHideBot くらいです。`,
    ),
    ...rival(
      'coward_bot',
      `## CowardBot

When the enemy comes close, it backs away as it shoots. With its back to a wall or an obstacle, it stands and fights.

Against DumbBot and AggressiveBot, which charge in, it keeps its distance and shoots, and wins. But its shots on the move stray too, and against robots that shoot calmly it loses.`,
      `## CowardBot

敵が近づくと、後ろへ下がりながら撃ちます。背中が壁や障害物に付いたら、そこで踏みとどまって撃ち合います。

突っ込んでくる DumbBot や AggressiveBot には、距離を取りながら撃てるので勝ちます。ただ、下がりながら撃つ弾もぶれるので、落ち着いて撃ってくる相手には負けます。`,
    ),
    ...rival(
      'guard_bot',
      `## GuardBot

DumbBot with a defence: it guards on the very tick a bullet hits, and when it is shot from somewhere it cannot see, it turns that way.

\`guard\` works only four times a match, so it saves them for the moment they count (Chapter 11). It beats many robots, DumbBot, CowardBot and CoverBot among them. But it cannot beat StrafeBot and SentryBot, which aim where it is going.`,
      `## GuardBot

DumbBot に守りを足したものです。弾が当たるその tick にだけ \`guard\` し、見えない相手に撃たれたら、そちらを向きます。

\`guard\` は 1 試合に 4 回までなので、いちばん効く瞬間にだけ使っています（第 11 章）。DumbBot、CowardBot、CoverBot など、多くの相手に勝ち越します。ただ、移動先を狙って撃つ StrafeBot と SentryBot には勝てません。`,
    ),
    ...rival(
      'cover_bot',
      `## CoverBot

Fights from a distance, and when it is hurt, hides behind the nearest obstacle and gets its HP back (Chapter 11).

SentryBot and StrafeBot shoot from where they are, and can do nothing while it hides: CoverBot beats them. What it is bad against is a robot that follows it to its hiding place, as DumbBot and GuardBot do.`,
      `## CoverBot

離れて撃ち合い、傷ついたら近くの物陰に隠れて HP を回復します（第 11 章）。

その場から撃ってくる SentryBot や StrafeBot は、隠れられると手が出せず、CoverBot が勝ち越します。苦手なのは、隠れ場所まで追いかけてくる DumbBot と GuardBot です。`,
    ),
    ...rival(
      'hit_and_hide_bot',
      `## HitAndHideBot

Fires one shot, runs for cover and rests there, then comes out to look for the enemy again. It shows itself only to shoot.

It does well against robots that stand off and trade shots: SentryBot, StrafeBot and CowardBot. It loses more than it wins against GuardBot, CoverBot and AggressiveBot.`,
      `## HitAndHideBot

1 発撃つと物陰へ逃げ込んで休み、また探しに出ます。姿を見せるのは撃つときだけです。

離れて撃ち合う相手、とくに SentryBot、StrafeBot、CowardBot には強く出ます。GuardBot、CoverBot、AggressiveBot には少し負け越します。`,
    ),
    ...rival(
      'strafe_bot',
      `## StrafeBot

Once in range, it turns its body side-on to the enemy and drives to and fro across it, shooting, while its gun aims where the enemy will be (Chapter 10). As it moves sideways, a shot at where it is now passes behind it.

It beats DumbBot, AggressiveBot, CowardBot and GuardBot by a wide margin. But it loses to SentryBot, which aims where it is going, and to CoverBot and HitAndHideBot, which hide.`,
      `## StrafeBot

射程まで近づいたら、車体を敵に対して横向きにして、行ったり来たりしながら撃ちます。砲塔は敵の移動先を狙います（第 10 章）。横に動き続けるので、今いる場所を狙った弾は後ろを通り過ぎていきます。

DumbBot、AggressiveBot、CowardBot、GuardBot には大きく勝ち越します。ところが、移動先を狙ってくる SentryBot と、隠れる CoverBot、HitAndHideBot には負け越します。`,
    ),
    ...rival(
      'sentry_bot',
      `## SentryBot

Closes in to range, then stops and shoots at where the enemy will be. Shot from somewhere it cannot see, it turns that way.

Standing still, its shots hardly stray, and it can hit even StrafeBot on the move. What it is bad against is robots that hide when they are shot at: CoverBot and HitAndHideBot.`,
      `## SentryBot

射程まで近づいたら止まり、敵の移動先を狙って撃ちます。見えない相手に撃たれたら、そちらを向きます。

止まって撃つので弾がぶれず、動き回る StrafeBot にも当てられます。苦手なのは、撃たれると隠れてしまう CoverBot と HitAndHideBot です。`,
    ),
    text(
      `## Every strategy has a weak spot

When you make a robot of your own, think about which robots you want it to beat. It makes the strategy easier to choose.`,
      `## どの作戦にも弱点がある

自分のロボットを作るときは、どの相手に勝ちたいのかを考えると、作戦を決めやすくなります。`,
    ),
    { kind: 'see', topics: ['arena-screen'] },
  ],
};

const SHOOTING: BookChapter = {
  id: 'shooting',
  title: { en: 'Shooting', ja: '撃ち合いの基本' },
  blocks: [
    text(
      `A shot that misses misses for one of two reasons, nearly always: the enemy was not where it was aimed, or the shot strayed.`,
      `撃った弾が外れる理由は、だいたい 2 つです。狙った場所に敵がいなかったか、弾がぶれたかです。`,
    ),
    text(
      `## Aim where a moving enemy is going

\`aim enemy\` points the gun at the enemy as it is now. But while the bullet flies, a moving enemy moves on. \`aim lead\` points it at where the enemy will be when the bullet gets there, if it keeps moving as it is.`,
      `## 動く敵は、移動先を狙う

\`aim enemy\` は、砲塔を今の敵の方へ向けます。でも弾が届くまでの間に、動いている敵は先へ進んでしまいます。\`aim lead\` は、敵が今の動きを続けたとき、弾が届くころにいる場所へ向けます。`,
    ),
    code(AIM_AT_ENEMY),
    code(AIM_AHEAD),
    text(
      `A robot standing still shot at a target driving about, once each way:

- \`aim enemy\`: 27 shots, 3 hits
- \`aim lead\`: 13 shots, 10 hits, and the target was down

\`lead\` reckons on the enemy going straight on. Against a robot that turns as it goes, it can miss too.`,
      `止まったまま、動き回る的を 2 通りで撃たせてみました。

- \`aim enemy\`: 27 発撃って、当たったのは 3 発
- \`aim lead\`: 13 発撃って 10 発当たり、的を倒した

\`lead\` は、敵がまっすぐ進み続けるものとして計算します。曲がりながら動く相手には、外れることもあります。`,
    ),
    text(
      `## Shots stray

A shot does not fly exactly where it is aimed, but a little off. With the standard gun, standing still, it strays up to ${ROBOT_DEFAULTS.shotSpread} degrees either side. If the body moved in that tick, it strays up to ${ROBOT_DEFAULTS.movingShotSpread} degrees: ${ROBOT_DEFAULTS.movingShotSpread / ROBOT_DEFAULTS.shotSpread} times as far.`,
      `## 弾はぶれる

弾は狙った方向ぴったりではなく、少しずれて飛びます。標準の銃なら、止まって撃てば左右に ${ROBOT_DEFAULTS.shotSpread} 度まで。その tick に車体が動いていると、${ROBOT_DEFAULTS.movingShotSpread / ROBOT_DEFAULTS.shotSpread} 倍の ${ROBOT_DEFAULTS.movingShotSpread} 度までずれます。`,
    ),
    { kind: 'figure', figure: 'spread', caption: caption(
      'How far a shot can stray at an enemy (the circle) 350 away, to scale. Standing, it always stays within the enemy\'s width; on the move, it goes well outside.',
      '350 離れた敵（丸）を撃ったときに、弾がずれる範囲（縮尺どおり）。止まっていれば必ず敵の幅に収まるが、走りながらだと大きくはみ出す。',
    ) },
    code(SHOOT_ON_THE_MOVE),
    { kind: 'scene', scene: { stage: BROADSIDE, program: SHOOT_ON_THE_MOVE, tick: 100 }, caption: caption(
      'Shooting on the move at the target (left): the shots fan out, and most go wide.',
      '走りながら的（左）を撃っているところ。弾が広がって飛び、ほとんどが外れていく。',
    ) },
    text(
      `A target standing still, shot at while driving past it and while standing:

- Standing: 12 shots, 10 hits
- Driving: 24 shots, 3 hits

To shoot on the move, put Walker or Hover legs on: shots on the move stray less with them (Chapter 12).`,
      `止まっている的を、止まって撃つのと、横を走りながら撃つのとで比べました。

- 止まって撃つ: 12 発中 10 発
- 走りながら撃つ: 24 発中 3 発

走りながら撃ちたいなら、脚を Walker か Hover にすると、ぶれが小さくなります（第 12 章）。`,
    ),
    text(
      `## Range and distance

A bullet goes no further than the gun's range (${ROBOT_DEFAULTS.weaponRange} for the standard gun). Within it, the further the enemy, the longer the bullet takes, and the wider a strayed shot misses by. Up close is easier to hit — for the enemy as well.`,
      `## 射程と距離

弾は射程（標準の銃で ${ROBOT_DEFAULTS.weaponRange}）より先へは飛びません。射程の中でも、遠いほど弾が届くまでに時間がかかり、ぶれも広がります。近ければ当てやすくなりますが、それは相手も同じです。`,
    ),
    text(
      `## While the gun is not ready

After a shot, the gun needs time before the next (${ROBOT_DEFAULTS.shotCooldown} seconds for the standard gun). A \`fire\` in that time fires nothing and only uses up the tick (Chapter 3). With \`reload\`, the robot can do something else until it is ready.`,
      `## 撃てない間にできること

銃は 1 発撃つと、次に撃てるまで間があきます（標準の銃で ${ROBOT_DEFAULTS.shotCooldown} 秒）。その間の \`fire\` は弾が出ず、tick を使うだけです（第 3 章）。\`reload\` を見れば、撃てるようになるまで別のことができます。`,
    ),
    code(AIM_WHILE_RELOADING),
    text(
      `While it cannot shoot, it keeps the aim right with \`aim lead\` every tick, and fires on the tick it can.`,
      `撃てない間は毎 tick \`aim lead\` で狙いを合わせ続け、撃てるようになった tick に撃ちます。`,
    ),
    text(
      `## The gun and the body turn apart

\`aim\` turns only the gun. It aims whichever way the body faces, so the body can stay pointed where it wants to drive. StrafeBot drives side-on to the enemy while its gun aims where the enemy is going.`,
      `## 砲塔と車体は別々に回る

\`aim\` が回すのは砲塔だけです。車体の向きと関係なく狙えるので、車体は走りたい方へ向けたまま撃てます。StrafeBot は、車体を横向きにして走りながら、砲塔で敵の移動先を狙っています。`,
    ),
    { kind: 'see', topics: ['moving'] },
  ],
};

const DEFENCE: BookChapter = {
  id: 'defence',
  title: { en: 'Defence and recovery', ja: '守りと回復' },
  blocks: [
    text(
      `Not being hit matters as much as hitting. This chapter looks at three ways to defend: guarding, turning to whoever shot you, and hiding to recover.`,
      `当てるのと同じくらい、当たらないことも大事です。この章では、守りの手を 3 つ見ます。\`guard\`、撃たれた方を向くこと、隠れて回復することです。`,
    ),
    text(
      `## Guard at the moment of the hit

\`guard\` halves the damage of a bullet that hits on that tick. But it works only ${ROBOT_DEFAULTS.maxGuards} times a match, and each one puts off the next shot by ${ROBOT_DEFAULTS.guardRecovery} seconds.

When to use it makes all the difference. Here are three robots, each trading shots with one that keeps shooting:`,
      `## guard は当たる瞬間に

\`guard\` すると、その tick に当たった弾のダメージが半分になります。ただし 1 試合に ${ROBOT_DEFAULTS.maxGuards} 回までで、使うたびに、自分が次に撃てるのが ${ROBOT_DEFAULTS.guardRecovery} 秒遅くなります。

いつ使うかで、結果が大きく変わります。撃ち続けてくる相手に、3 通りのロボットで撃ち合わせてみました。`,
    ),
    code(NO_GUARD),
    code(GUARD_ON_SIGHT),
    code(GUARD_AT_HIT),
    text(
      `- **No guard**: they shoot each other down on the same tick. A draw.
- **Guard as soon as a bullet comes** (\`bullet_incoming\`): a bullet seen is not yet a bullet that hits, so guarding then saves nothing. It wasted all four guards, its shots were put off, and it lost.
- **Guard only just before the hit** (\`bullet_distance < 36\`): it won, with 10 HP left.

A small difference decided the match. \`bullet_distance\` is how far the nearest bullet on course to hit you is. A bullet goes about 13 a tick, so 36 means it hits in about 3 ticks. GuardBot uses this number too.`,
      `- **guard しない**: 撃ち合って、同じ tick に倒れて引き分け。
- **弾が来たらすぐ guard**（\`bullet_incoming\`）: 弾が見えても、その tick に当たるわけではないので、ダメージは減りません。4 回を無駄に使い、撃つのも遅れて、負けました。
- **当たる直前だけ guard**（\`bullet_distance < 36\`）: HP を 10 残して勝ちました。

ほんの少しの差で、勝ち負けが分かれました。\`bullet_distance\` は、当たるコースの弾のうち、いちばん近いものまでの距離です。弾は 1 tick に約 13 進むので、36 は「あと 3 tick ほどで当たる」近さです。GuardBot もこの数を使っています。`,
    ),
    text(
      `## Turn to whoever shot you

Sometimes the shot comes from an enemy you cannot see. \`hit\` is true on the tick you are hit, and \`turn hit\` or \`face hit\` turns you the way the bullet came from. That is how GuardBot and SentryBot find an enemy shooting from behind cover.`,
      `## 撃たれた方を向く

見えない相手から撃たれることもあります。\`hit\` は撃たれた tick に true になり、\`turn hit\` や \`face hit\` で、弾が来た方へ向けます。GuardBot と SentryBot は、こうして物陰から撃ってくる相手を探します。`,
    ),
    text(
      `## Hide and recover

Stay still for half a second where no enemy can see you, and your HP comes back at 20 a second. Moving, or being seen, stops it.

You need not find a hiding place yourself: the sensors tell you.

- \`cover_visible\`: there is a hiding place to go to
- \`turn cover\`: turns towards the way to it
- \`hidden\`: no enemy can see you now`,
      `## 隠れて回復する

敵のだれからも見えない場所で 0.5 秒止まっていると、HP が 1 秒に 20 ずつ回復します。動いたり見つかったりすると止まります。

隠れ場所は自分で探さなくても、センサーが教えてくれます。

- \`cover_visible\`: 行ける隠れ場所がある
- \`turn cover\`: 隠れ場所への道の方へ回る
- \`hidden\`: 今、敵のだれからも見えていない`,
    ),
    code(HIDE_AND_REST),
    text(
      `It trades shots with a robot that keeps shooting, and below 140 HP heads for cover. Once out of sight, it stops and rests. In the match, its HP went down to 100, and came all the way back to 200 behind the block.`,
      `撃ち続けてくる相手と撃ち合い、HP が 140 を切ったら物陰へ向かいます。見えなくなったら止まって休みます。試合では HP が 100 まで減りましたが、物陰で 200 まで戻しました。`,
    ),
    { kind: 'scene', scene: { stage: SHELTER, program: HIDE_AND_REST, tick: 280 }, caption: caption(
      'ALPHA resting behind the block (right), out of the shooter\'s sight, getting its HP back.',
      'ALPHA が物陰（右の四角）の後ろで、相手から見えないように休み、HP を回復しているところ。',
    ) },
    text(
      `## Where recovering helps, and where it does not

In a one-on-one match, hiding to recover works well. It is why CoverBot and HitAndHideBot beat robots that shoot from where they stand (Chapter 9).

In the base battle (Chapter 14) it is of little use. The bases decide who wins, a base never recovers, and a robot in hiding cannot shoot at a base.`,
      `## 回復が効く場面、効かない場面

1 対 1 では、隠れて回復する手がよく効きます。CoverBot や HitAndHideBot が、その場から撃ってくる相手に強いのはこのためです（第 9 章）。

基地戦（第 14 章）では、あまり役に立ちません。勝ち負けは基地の HP で決まり、基地は回復しないうえ、隠れている間は基地を撃てないからです。`,
    ),
    { kind: 'see', topics: ['moving', 'rules'] },
  ],
};

const PARTS_CHAPTER: BookChapter = {
  id: 'parts',
  title: { en: 'Choosing parts', ja: 'パーツ選び' },
  blocks: [
    text(
      `A robot takes a part in each of four places: body, legs, gun and sensor. On the PROGRAM screen, open a robot's \`config\` to choose them.`,
      `ロボットには、車体・脚・銃・センサーの 4 か所にパーツを付けられます。プログラムの画面で、ロボットの \`config\` を開くと選べます。`,
    ),
    text(
      `## The cost limit

Each part has a cost, and the four together may cost at most ${COST_LIMIT}. Every standard part costs 3, so a robot of standard parts is at the limit exactly. To put on a part of cost 4, you have to take a part of cost 2 somewhere else.`,
      `## コストの上限

パーツにはコストがあり、4 つの合計は ${COST_LIMIT} までです。標準のパーツはどれもコスト 3 なので、全部標準でちょうど ${COST_LIMIT} になります。コスト 4 のパーツを付けたければ、どこかをコスト 2 のパーツにしなければなりません。`,
    ),
    text(`## Body`, `## 車体`),
    { kind: 'parts', slot: 'body' },
    text(
      `Light drives and turns faster, with less HP; Heavy is the other way round. To last in a long exchange, Heavy; for a strategy of moving about, Light.`,
      `Light は速く走れて曲がるのも速い代わりに、HP が少なくなります。Heavy はその逆です。撃ち合いで粘りたいなら Heavy、動き回る作戦なら Light が合います。`,
    ),
    text(`## Legs`, `## 脚`),
    { kind: 'parts', slot: 'legs' },
    text(
      `Sprint is good at going straight, Pivot at turning. Walker is slow, but its shots on the move hardly stray. Hover is fast and its shots stray less too, but it cannot stop at once: it slides, and drifts after it turns.`,
      `Sprint は直進が、Pivot は旋回が得意です。Walker は遅い代わりに、走りながら撃っても弾がほとんどぶれません。Hover は速くてぶれも少なめですが、すぐには止まれず、曲がったあとも少し流れます。`,
    ),
    text(`## Gun`, `## 銃`),
    { kind: 'parts', slot: 'gun' },
    text(
      `In damage a second, Rapid and Cannon beat the standard gun. But a Rapid shot is weak and strays easily, and a Cannon's bullets are slow, which makes a moving enemy hard to hit. Pistol has a short range, and costs 2 for it.`,
      `1 秒あたりのダメージでは、Rapid と Cannon が標準より上です。ただ Rapid は 1 発が弱くてぶれやすく、Cannon は弾が遅いので、動く敵には当てにくくなります。Pistol は射程が短く、そのぶんコストが 2 です。`,
    ),
    text(`## Sensor`, `## センサー`),
    { kind: 'parts', slot: 'sensor' },
    text(
      `Short sees all round, but no further than 300. Scope sees far, but only the 120 degrees ahead: with it, the robot has to turn its body to look for the enemy.`,
      `Short は周りぐるりが見えますが、300 より遠くは見えません。Scope は遠くまで見えますが、前の 120 度だけです。Scope を付けたら、敵を探すときに車体を回す必要があります。`,
    ),
    text(
      `## Fit the program to the parts

When you change the parts, change the program to suit. Put on a Cannon for its long range while the program still closes in to 300 before shooting, and the Cannon's strength is wasted. With the sensors \`weapon_range\`, \`sensor_range\` and \`max_speed\`, you can write a program that suits any parts.`,
      `## プログラムをパーツに合わせる

パーツを替えたら、プログラムも合わせます。射程の長い Cannon を付けたのに、プログラムが「300 まで近づいてから撃つ」のままでは、長所が生きません。センサーの \`weapon_range\`、\`sensor_range\`、\`max_speed\` を使うと、どのパーツにも合うプログラムが書けます。`,
    ),
    code(ANY_GUN),
    text(
      `With \`weapon_range\` in place of a number such as 300, it stops at the range of whatever gun it carries, Pistol or Cannon.`,
      `300 のような数の代わりに \`weapon_range\` を使っているので、Pistol でも Cannon でも、付けている銃の射程で止まります。`,
    ),
    { kind: 'see', topics: ['parts-help'] },
  ],
};

function challenge(id: string, ...hints: [string, string][]): BookBlock {
  return { kind: 'challenge', challenge: id, hints: hints.map(([en, ja]) => ({ en, ja })) };
}

const CHALLENGES_CHAPTER: BookChapter = {
  id: 'challenges',
  title: { en: 'Clearing the challenges', ja: 'チャレンジ攻略' },
  blocks: [
    text(
      `The challenges are matches with conditions. Choose CHALLENGE on the start menu to play them.

This chapter gives hints for each one, each hint telling more than the one before. Think with the first, and open the next when you are stuck. An example answer is in the game itself: "Show an example answer" on the challenge screen.

Every number below comes from playing the challenge.`,
      `チャレンジは、条件つきの試合です。起動メニューの「チャレンジ」から遊べます。

この章では、チャレンジごとにヒントを書きます。ヒントは後ろほどくわしくなります。まず 1 つ目で考えて、行き詰まったら次を開いてください。答えのプログラムは、ゲームのチャレンジ画面の「解答例を見る」にあります。

ここに出てくる数は、どれも実際にチャレンジを試した結果です。`,
    ),
    text(
      `## Worth knowing for any of them

- **Closing in is not always the way.** Against several of them, a robot that drove at the enemy lost, and one that stood still and shot won. Shots on the move go wide (Chapter 10), and some robots come to you anyway.
- **Look at the tables of Chapter 9.** A built-in robot that beats your opponent has a program worth reading.`,
      `## どのチャレンジにも効くこと

- **近づけばいいとは限りません。** いくつかのチャレンジで、相手に向かって走っていくロボットは負け、止まって撃つロボットは勝ちました。走りながらの弾はぶれますし（第 10 章）、向こうから来てくれる相手もいます。
- **第 9 章の対戦表を見ましょう。** 相手に勝ち越している内蔵ロボットがいれば、そのプログラムが参考になります。`,
    ),
    text(`## One on one`, `## 1 対 1`),
    challenge(
      'first-win',
      [
        `The sparring partner does not come to you. Stand and shoot, and the match ends in a draw.`,
        `練習相手は、こちらへは来ません。その場で撃っているだけだと、引き分けで終わります。`,
      ],
      [
        `Drive about while you cannot see it, and stop and shoot once you can: the shape of Chapter 5. On its own, though, that drives into a wall and stays there (Chapter 8). Turn when the way is blocked.`,
        `見えないうちは走って探し、見えたら止まって撃ちます。第 5 章の形です。ただ、それだけだと壁にぶつかって止まったままになります（第 8 章）。前がふさがったら曲がりましょう。`,
      ],
      [
        `Aim before you fire. \`aim_angle\` is how far (in degrees) the turret points off the enemy; 0 is dead on. \`aim enemy\` until \`aim_angle\` is between -2 and 2, then \`fire\`.`,
        `撃つ前に狙いを合わせます。\`aim_angle\` は、砲塔の向きと敵の方向のずれ（度）で、0 なら狙いがぴったりです。\`aim_angle\` が -2 から 2 の間に入るまで \`aim enemy\`、入ったら \`fire\` です。`,
      ],
    ),
    challenge(
      'pistol',
      [
        `DumbBot comes to you. There is no need to go to it.`,
        `DumbBot は自分から近づいてきます。こちらから行く必要はありません。`,
      ],
      [
        `A robot that drove at DumbBot lost. Stand still, and shoot once it is in range.`,
        `試しにこちらから近づいていくロボットで戦ったら、負けました。止まって待ち、射程に入ってきたら撃ちましょう。`,
      ],
    ),
    challenge(
      'untouchable',
      [
        `The standard gun reaches 400. The other robot, BRAVO, is 480 away: out of its range.`,
        `標準の銃の射程は 400 です。480 先にいる相手の BRAVO には届きません。`,
      ],
      [
        `A Cannon reaches 520. But it costs 4: to stay within the cost limit, take a part of cost 2 somewhere else (Chapter 12).`,
        `射程 520 の Cannon なら届きます。ただ Cannon はコスト 4 なので、ほかのどこかをコスト 2 のパーツにしないと、上限を超えます（第 12 章）。`,
      ],
      [
        `BRAVO does not move, so you need not move either. Aiming and firing takes 3 lines.`,
        `BRAVO は動かないので、こちらも動く必要はありません。狙って撃つだけなら 3 行です。`,
      ],
    ),
    challenge(
      'short-route',
      [
        `The goal is beyond the block. Turn whenever you run into something, and you find your way round.`,
        `ゴールは障害物の向こうです。ぶつかったら曲がる、を繰り返せば回り込めます。`,
      ],
      [
        `\`blocked\` tells you the way ahead is blocked (Chapter 4). It takes 5 lines, turning left or turning right.`,
        `前がふさがっているかは \`blocked\` で分かります（第 4 章）。5 行で書けます。左に曲がっても右に曲がっても着きます。`,
      ],
    ),
    challenge(
      'speed-sentry',
      [
        `It is a race against the clock, but rushing in does not pay. SentryBot shoots at where you are going: a robot that drove at it lost.`,
        `時間との勝負ですが、急いで近づくのは逆効果です。SentryBot は、こちらが動いていく先を狙って撃ちます。近づいていくロボットは負けました。`,
      ],
      [
        `Stand still and trade shots, and you win in about 10 seconds.`,
        `止まって撃ち合えば、10 秒ほどで勝てます。`,
      ],
    ),
    challenge(
      'hide-and-heal',
      [
        `HP comes back only while you stand still where no enemy can see you (Chapter 11).`,
        `HP が戻るのは、敵のだれからも見えない場所で止まっているときだけです（第 11 章）。`,
      ],
      [
        `\`face cover\` turns you to a hiding place, and \`drive forward\` takes you there. \`hidden\` tells you when you are out of sight.`,
        `\`face cover\` で隠れ場所の方を向き、\`drive forward\` で行けます。見えなくなったかどうかは \`hidden\` で分かります。`,
      ],
      [
        `With full HP there is nothing to get back: a robot that hid from the start did not clear it. Trade shots first, and hide once your HP is down.`,
        `HP が満タンのままでは回復しません。初めから隠れたロボットは、クリアできませんでした。撃ち合って HP が減ってから隠れます。`,
      ],
    ),
    challenge(
      'guard-wall',
      [
        `Guard only just before the hit (Chapter 11): \`bullet_incoming and bullet_distance < 36\`.`,
        `guard は当たる直前に（第 11 章）。\`bullet_incoming and bullet_distance < 36\` が目安です。`,
      ],
      [
        `The program of Chapter 11 that guards just before the hit wins here, but guards fewer than 3 times. Its \`else\` has \`aim enemy\` and \`fire\` one after the other, two ticks in which it does not look at the bullets (Chapter 3).`,
        `第 11 章の「当たる直前だけ guard」のプログラムでも勝てますが、guard は 3 回に届きませんでした。\`else\` の中に \`aim enemy\` と \`fire\` が続けて書いてあるので、その 2 tick の間は弾を確かめていないからです（第 3 章）。`,
      ],
      [
        `Do one action a time round the loop, and it looks at the bullets every tick: \`aim enemy\` if the aim is off, \`fire\` if it is on, split with \`if\`.`,
        `loop の 1 周で行動を 1 つだけにすると、毎 tick 弾を確かめられます。狙いがずれていたら \`aim enemy\`、合っていたら \`fire\` と、\`if\` で分けます。`,
      ],
    ),
    challenge(
      'short-sight',
      [
        `CowardBot keeps its distance, and the Short sensor sees only 300 away: you can be shot by an enemy you cannot see. A robot that only shoots what it sees lost.`,
        `CowardBot は離れようとします。Short センサーは 300 までしか見えないので、見えない相手から撃たれることがあります。見えたら撃つ、だけのロボットは負けました。`,
      ],
      [
        `\`hit\` is true on the tick you are hit. Turn the way the bullet came from with \`face hit\`, and drive that way (Chapter 11).`,
        `撃たれた tick には \`hit\` が true になります。\`face hit\` で弾の来た方を向き、そちらへ走りましょう（第 11 章）。`,
      ],
    ),
    challenge(
      'strafe-buster',
      [
        `In the tables of Chapter 9, the robot that beats StrafeBot is SentryBot. Read its program.`,
        `第 9 章の対戦表で、StrafeBot に勝ち越していたのは SentryBot です。そのプログラムを読んでみましょう。`,
      ],
      [
        `A shot at where a robot driving across is now passes behind it. Shoot at where it is going, with \`aim lead\` (Chapter 10). SentryBot's program as it is won in about 11 seconds.`,
        `横に走る相手の今いる場所を撃っても、弾は後ろを通り過ぎます。\`aim lead\` で行く先を狙いましょう（第 10 章）。SentryBot のプログラムをそのまま使うと、11 秒ほどで勝てました。`,
      ],
      [
        `Another way: 3 lines that only stand, aim and fire won without taking a single hit. It took 37 seconds, though.`,
        `別の手もあります。動かずに狙って撃つだけの 3 行でも、1 発も受けずに勝てました。ただし 37 秒かかります。`,
      ],
    ),
    challenge(
      'light-body',
      [
        `AggressiveBot heads straight for you. A robot that drove at it lost.`,
        `AggressiveBot は、まっすぐこちらへ向かってきます。こちらから近づいていくロボットは負けました。`,
      ],
      [
        `Stand still and shoot it as it comes, and you win, though with only 40 HP left.`,
        `止まって待ち、来たところを撃てば勝てます。ただ、HP は 40 しか残りませんでした。`,
      ],
      [
        `Light suits a strategy of moving about (Chapter 12). With StrafeBot's program, it won with 140 HP left.`,
        `Light は動き回る作戦に向いています（第 12 章）。StrafeBot のプログラムを使うと、HP を 140 残して勝てました。`,
      ],
    ),
    challenge(
      'sharpshooter',
      [
        `DumbBot has 200 HP, and a shot of the standard gun does 20: 10 of your 15 shots must hit. Stand still, and fire only once the aim is on (Chapter 10).`,
        `DumbBot の HP は 200、標準の銃は 1 発 20 なので、15 発のうち 10 発を当てる必要があります。止まって、狙いが合ってから撃ちましょう（第 10 章）。`,
      ],
      [
        `A Cannon shot does 45, so 5 hits are enough. Clear it in 8 shots or fewer for a star (a harder extra goal beyond clearing); with a Cannon it did. It costs 4: take a part of cost 2 somewhere else (Chapter 12).`,
        `1 発 45 の Cannon なら、5 発当てれば倒せます。8 発以内でクリアすると星がもらえます（星は、クリア条件より難しいおまけの目標）。Cannon では 8 発以内に収まりました。コスト 4 なので、どこかをコスト 2 のパーツにします（第 12 章）。`,
      ],
    ),
    challenge(
      'final',
      [
        `SentryBot stops once you are in range, and shoots at where you are going (Chapter 9). A robot that drove at it lost.`,
        `SentryBot は射程に入ると止まって、こちらの行く先を狙います（第 9 章）。近づいていくロボットは負けました。`,
      ],
      [
        `Stand still and trade shots, and you win, but with 40 HP left: only just enough.`,
        `止まって撃ち合えば勝てますが、残る HP はちょうど 40。ぎりぎりです。`,
      ],
      [
        `In Chapter 9, the robot that beats SentryBot is CoverBot. Fight hiding and recovering as it does, and it won with 162 HP left.`,
        `第 9 章で、SentryBot に勝ち越していたのは CoverBot でした。CoverBot のように隠れて回復しながら戦うと、HP を 162 残して勝てました。`,
      ],
    ),
    challenge(
      'champion',
      [
        `The champion's sensor is Short: it sees nothing further than 300 away.`,
        `チャンピオンのセンサーは Short です。300 より遠くは見えません。`,
      ],
      [
        `With a Cannon, reaching 520, and a Scope, seeing far, you can shoot it from where it cannot see you. But once hit, it comes the way the shot came from.`,
        `射程 520 の Cannon と、遠くまで見える Scope を付ければ、見えない所から撃てます。ただ、撃たれたチャンピオンは、弾の来た方へ向かってきます。`,
      ],
      [
        `Its body is Heavy, slow to drive. SentryBot's program with Sprint legs, a Cannon and a Scope won. Without the Sprint legs, it lost.`,
        `チャンピオンの車体は Heavy で、走るのが遅いです。SentryBot のプログラムに、Sprint の脚と Cannon と Scope を付けたら勝てました。脚を Sprint にしないと負けました。`,
      ],
    ),
    text(
      `## Base battles

In these four, your team is the same program running on each machine. Chapter 14 says more about the base battle.`,
      `## 基地戦

この 4 つは基地戦です。チームのロボットは、どれも同じプログラムで動きます。基地戦については第 14 章でくわしく書きます。`,
    ),
    challenge(
      'castle-solo',
      [
        `The enemy runs straight for your base. \`face enemy_base\` turns you towards its base, for the race the other way.`,
        `相手はまっすぐこちらの基地へ走ってきます。こちらも相手の基地へ向かうなら、\`face enemy_base\` でそちらを向けます。`,
      ],
      [
        `Once \`enemy_base_distance\` is less than \`weapon_range\`, stop and shoot the base: \`face enemy_base\`, then \`aim ahead\` (turn the turret to where the body faces) and \`fire\`. If the enemy comes close on the way, deal with it first.`,
        `\`enemy_base_distance\` が \`weapon_range\` より小さくなったら、止まって基地を撃ちます。\`face enemy_base\` で向いて、\`aim ahead\`（砲塔を車体の正面に向ける）と \`fire\` です。途中で相手が近くに来たら、先にそちらと撃ち合いましょう。`,
      ],
    ),
    challenge(
      'castle-hold',
      [
        `An enemy with your base in range shoots only the base. By the time it is at the walls, it is too late.`,
        `基地を射程に入れた敵は、基地しか撃ちません。基地の前まで来られてからでは間に合いません。`,
      ],
      [
        `While \`enemy_base_distance\` is large, go forward; at some point, stop and wait there. Shoot an enemy once it is in range.`,
        `\`enemy_base_distance\` が大きいうちは前へ出て、ある所まで来たら止まって待ちます。敵が射程に入ったら撃ちます。`,
      ],
    ),
    challenge(
      'castle-fall',
      [
        `The defenders' Short sensors see 300 away. Your Cannon reaches 520.`,
        `守りの 2 台は Short センサーで、300 より遠くは見えません。こちらの Cannon は 520 まで届きます。`,
      ],
      [
        `You need not fight the defenders at all. Head for their base, and stop and shoot it once it is in range. That way the base fell without a single hit taken.`,
        `守りと撃ち合う必要はありません。基地へ向かい、射程に入ったら止まって基地を撃ちます。こうすると、1 発も受けずに基地を落とせました。`,
      ],
    ),
    challenge(
      'base-call-by-name',
      [
        `Your three machines run the same program. \`self_id\` tells each which number it is: split the jobs with it (Chapter 14).`,
        `3 台は同じプログラムで動きます。\`self_id\` で自分が何番かが分かるので、それで役割を分けます（第 14 章）。`,
      ],
      [
        `When the keeper sees an enemy, it calls one machine home with \`signal 1 to 2\`: only machine 2 gets it, as \`ally_signal\`. A \`signal\` without \`to\` reaches everyone.`,
        `守りが敵を見つけたら、\`signal 1 to 2\` で 1 台だけを呼び戻します。受け取るのは 2 番だけで、\`ally_signal\` に入ります。\`to\` を付けない \`signal\` は全員に届きます。`,
      ],
      [
        `The team program BaseCaptain is written this way.`,
        `内蔵のチームプログラム BaseCaptain が、この形で書かれています。`,
      ],
    ),
  ],
};

/** The team templates the base battle tables play against. */
export const TEAMS = ['castle_rush', 'castle_split', 'castle_call', 'base_captain', 'castle_turtle', 'castle_rally', 'castle_runner', 'castle_formation', 'castle_decoy'] as const;
export const TEAM_ARENAS = ['castle_plain', 'castle_lanes', 'castle_bastion'] as const;
export const TEAM_SIZE = 3;

/** A team template against all the others, 3 a side. */
export function teamMatchupOf(team: (typeof TEAMS)[number]): Matchup {
  return { robot: team, opponents: TEAMS.filter((other) => other !== team), arenas: TEAM_ARENAS, seeds: MATCHUP_SEEDS, teamSize: TEAM_SIZE };
}

const BASE_BATTLE: BookChapter = {
  id: 'base-battle',
  title: { en: 'Base battle strategies', ja: '基地戦の作戦' },
  blocks: [
    text(
      `In the base battle, teams of 1 to 5 robots a side each defend a base. Choose TEAM BATTLE on the start menu: PROGRAM to write and try a team, WATCH to pit teams against each other.`,
      `基地戦では、片側 1〜5 台のチームが、それぞれ自分の基地を守って戦います。起動メニューの「チーム戦」から入ります。「プログラム」でチームを書いて試し、「観戦」でチーム同士を戦わせます。`,
    ),
    text(
      `## What decides the match

- A team loses when its base's HP reaches 0. That alone: with every robot destroyed, a team is still in the match while its base stands.
- At time up, the team whose base has more HP left wins. With the bases even, the HP of the robots still standing decides.
- A base has ${castleHpFor(TEAM_SIZE)} HP. Only the enemy's bullets wear it down, each by the damage of the shot.
- The parts of a team share one cost limit: 10 × robots + 2, ${teamCostLimitFor(TEAM_SIZE)} for ${TEAM_SIZE}. Every machine starts with a Light body and a Pistol, cost ${costOf(TEAM_DEFAULT_LOADOUT)}.

So the base, not the robots, is what to aim at. Destroying every enemy robot does not win on its own; and shelling the base can win even while the enemy is still all there.`,
      `## 勝ち負けの決まり方

- 基地の HP が 0 になったチームの負けです。負けはそれだけで、ロボットが全部やられても、基地が残っていれば試合は続きます。
- 時間切れのときは、基地の HP が多く残っている方の勝ちです。基地の HP が同じなら、残っているロボットの HP の合計で決まります。
- 基地の HP は ${castleHpFor(TEAM_SIZE)} です。削れるのは敵の弾だけで、当たった弾の威力だけ減ります。
- パーツのコストは、チーム全体で 1 つの上限です。10 × 台数 + 2 で、${TEAM_SIZE} 台なら ${teamCostLimitFor(TEAM_SIZE)}。どの機体も最初は車体 Light・銃 Pistol で、コスト ${costOf(TEAM_DEFAULT_LOADOUT)} です。

ねらうのはロボットではなく基地です。敵のロボットを全部倒しても、それだけでは勝てません。逆に、敵がそろっていても、基地を撃ち続ければ勝てます。`,
    ),
    text(
      `## One program, three robots

A team has one program, and every machine runs its own copy of it. Written as it is, all three do the same thing. To give them different jobs, use \`self_id\`: the machine's number, 1, 2 or 3.

BaseSplit leaves machine 1 at home to guard the base, and sends the others to attack:`,
      `## 1 本のプログラムで 3 台を動かす

チームのプログラムは 1 本で、どの機体も同じプログラムを自分の分だけ実行します。そのままでは 3 台とも同じ動きです。役割を分けるには \`self_id\` を使います。機体の番号で、1、2、3 のどれかです。

BaseSplit は、1 番を基地の守りに残し、ほかの 2 台で攻めます。`,
    ),
    { kind: 'template', template: 'castle_split' },
    text(
      `\`if self_id == 1\` splits the program in two: the guard's part above, the attackers' below. \`base_distance\` and \`face base\` are about your own base, \`enemy_base_distance\` and \`face enemy_base\` about the enemy's.`,
      `\`if self_id == 1\` で、プログラムを 2 つに分けています。上が守りの分、下が攻めの分です。\`base_distance\` と \`face base\` は自分の基地を、\`enemy_base_distance\` と \`face enemy_base\` は敵の基地を指します。`,
    ),
    text(
      `## Telling each other

A machine sees only what its own sensor sees. To pass on what it has found, it uses the team's radio. \`signal 1\` puts the number 1 on the radio, and from the next tick every machine reads it as \`ally_signal\`. What a number means is up to you.

BaseCall uses it to gather: whoever sees an enemy sends \`signal 1\`, and the others head for it.`,
      `## 知らせ合う

機体に見えるのは、自分のセンサーに映るものだけです。見つけたことを仲間に伝えるには、チームの無線を使います。\`signal 1\` で無線に 1 という数を流すと、次の tick から全員の \`ally_signal\` が 1 になります。数の意味は自分で決めます。

BaseCall はこれで集まります。敵を見つけた機体が \`signal 1\` を流し、ほかの機体がそこへ向かいます。`,
    ),
    { kind: 'template', template: 'castle_call' },
    text(
      `\`signal\` alone reaches everyone. \`signal 1 to 2\` reaches machine 2 alone. BaseCaptain's keeper calls only machine 2 home when an enemy comes, and the rest keep attacking: the way to clear the challenge "Call by name" (Chapter 13).`,
      `\`signal\` だけだと全員に届きます。\`signal 1 to 2\` なら 2 番だけに届きます。BaseCaptain の守りは、敵が来たら 2 番だけを呼び戻し、残りは攻め続けます。第 13 章のチャレンジ「名指しで呼べ」の解き方です。`,
    ),
    { kind: 'template', template: 'base_captain' },
    text(
      `## Attack or defend

The team programs each show one way of fighting.

| Team | How it fights |
|---|---|
| BaseRush | All three run for the enemy base and shell it. Enemies in the way are shot. |
| BaseRunner | Nothing but the base: it never shoots a robot. |
| BaseTurtle | All three wall in their own base. At time up the base decides, so the enemy has to come. |
| BaseSplit | Machine 1 guards, the others attack. |
| BaseCall | Gathers on whoever sees an enemy. |
| BaseRally | Attacks while the team is whole; once one falls, the rest go home to defend. |

As with the robots of Chapter 9, no team beats them all. Played 3 a side, these three go round in a ring:`,
      `## 攻めるか、守るか

チームのプログラムは、それぞれ 1 つの戦い方の見本です。

| チーム | 戦い方 |
|---|---|
| BaseRush | 3 台で敵の基地へ走って撃つ。じゃまな敵は撃つ |
| BaseRunner | 基地だけをねらい、ロボットは撃たない |
| BaseTurtle | 3 台で自分の基地を囲んで守る。時間切れは基地の HP で決まるので、敵は来るしかない |
| BaseSplit | 1 番が守り、ほかが攻める |
| BaseCall | 敵を見つけた機体のところへ集まる |
| BaseRally | そろっている間は攻め、1 台やられたら全員で戻って守る |

第 9 章のロボットと同じで、どのチームにも勝つチームはありません。3 対 3 で戦わせると、この 3 つは、じゃんけんのような三すくみになります。`,
    ),
    { kind: 'figure', figure: 'team-rivals', caption: caption(
      'Played 3 a side, each team won all 12 of its matches against the next: BaseRunner against BaseTurtle, BaseTurtle against BaseSplit, BaseSplit against BaseRunner.',
      '3 対 3 で、どの組も 12 戦全勝だった。BaseRunner は BaseTurtle に、BaseTurtle は BaseSplit に、BaseSplit は BaseRunner に勝つ。',
    ) },
    text(
      `- **BaseRunner beats BaseTurtle.** On most maps the base fell within about 15 seconds. On Castle Lanes the runners were all shot down, but they had taken 60 off the base first: at time up, the base with more HP left won. Even with no robot left, a team can win.
- **BaseTurtle beats BaseSplit.** Every match ran to time up with both bases untouched. The attackers were shot down before they reached the base, and the turtles had more HP left.
- **BaseSplit beats BaseRunner.** The runners never shoot back. They sometimes wore BaseSplit's base down, but were all destroyed every time, and their own base fell first.

Press the button to play the matches yourself:`,
      `- **BaseRunner は BaseTurtle に勝つ。** たいていのマップで、15 秒ほどで基地が落ちました。Castle Lanes では BaseRunner が全滅しましたが、その前に基地を 60 削っていたので、時間切れで基地の HP が多い BaseRunner の勝ちです。ロボットが残っていなくても勝てます。
- **BaseTurtle は BaseSplit に勝つ。** どの試合も、どちらの基地も無傷のまま時間切れでした。攻めの 2 台は基地にたどり着く前に倒され、残ったロボットの HP で BaseTurtle が上回りました。
- **BaseSplit は BaseRunner に勝つ。** BaseRunner は撃ち返しません。BaseSplit の基地が削られることもありましたが、BaseRunner は毎回全滅し、先に自分の基地を落とされました。

ボタンを押すと、実際に試合をして確かめられます。`,
    ),
    { kind: 'matchup', matchup: teamMatchupOf('castle_runner') },
    { kind: 'matchup', matchup: teamMatchupOf('castle_turtle') },
    { kind: 'matchup', matchup: teamMatchupOf('castle_split') },
    text(
      `BaseCall beats most teams: gathering on whoever sees an enemy, it fights with more machines than the enemy has there. Against BaseRunner, which never shoots, it loses more than it wins.`,
      `BaseCall は、たいていのチームに勝ち越します。敵を見つけた機体のところへ集まるので、その場では敵より多い数で戦えます。ただ、撃ってこない BaseRunner には負け越します。`,
    ),
    { kind: 'matchup', matchup: teamMatchupOf('castle_call') },
    text(
      `## Hints for your own team

- Decide first what to aim at: the enemy base, or the enemy robots.
- Defending only does not lose at time up, but someone who shells the base from outside your range beats it.
- Recovering by hiding is of little use here (Chapter 11). A base never recovers.
- Parts can differ from machine to machine. Give one machine a Cannon to shell the base from far, for example, and keep the cost down elsewhere.`,
      `## 自分のチームを作るときに

- まず、ねらうのは敵の基地か、敵のロボットかを決めます。
- 守るだけなら時間切れで負けにくいのですが、射程の外から基地を撃ってくる相手には負けます。
- 隠れて回復する手は、ここではあまり効きません（第 11 章）。基地は回復しません。
- パーツは機体ごとに変えられます。たとえば 1 台だけ Cannon にして遠くから基地を撃たせ、ほかでコストを抑える、という手もあります。`,
    ),
    { kind: 'see', topics: ['team-screen', 'team-words'] },
  ],
};

/** The match Chapter 15 looks into: the game's Sample loses to DumbBot by one shot. */
export const LOST_MATCH: Replay = { program: SAMPLE_AI, bravo: 'dumb_bot', arena: 'open_field', seed: 1 };
/** The same match with the Sample changed. */
export const WON_MATCH: Replay = { ...LOST_MATCH, program: SAMPLE_SOONER };

/** A robot of Chapter 15 against DumbBot. */
export function againstDumbBot(name: Text, source: string): Matchup {
  return { robot: { name, source }, opponents: ['dumb_bot'], arenas: MATCHUP_ARENAS, seeds: MATCHUP_SEEDS };
}

/** The two cases of Chapter 15, played as the match above. */
export const TRACK_CASE: Replay = { ...LOST_MATCH, program: TRACK_NO_ACTION };
export const GUARD_CASE: Replay = { ...LOST_MATCH, program: GUARD_UNDER };
export const GUARD_FIXED: Replay = { ...LOST_MATCH, program: GUARD_ON_TOP };
/** The log of the first case is shown where the robot fires, a tick after DumbBot. */
export const TRACK_CASE_SHOWN = 61;
/** The analysis of the second is shown where the first shot hits it. */
export const GUARD_CASE_SHOWN = 79;

const SAMPLE_NAME: Text = { en: 'Sample', ja: 'Sample' };
const TRACK_NO_ACTION_NAME: Text = { en: "Case 1's robot", ja: '実例 1 のロボット' };
const TURN_FIRST_NAME: Text = { en: 'Case 1 mended', ja: '実例 1 を直したロボット' };
const GUARD_UNDER_NAME: Text = { en: "Case 2's robot", ja: '実例 2 のロボット' };
const GUARD_ON_TOP_NAME: Text = { en: 'Case 2 mended', ja: '実例 2 を直したロボット' };
const SOONER_NAME: Text = { en: 'Sample with attack(320)', ja: 'attack(320) にした Sample' };

const FINDING_OUT: BookChapter = {
  id: 'finding-out',
  title: { en: 'Finding out why it lost', ja: '負けた理由を探す' },
  blocks: [
    text(
      `A lost match always has a reason. The game has three tools for finding it.

| Tool | What it tells you |
|---|---|
| Analysis | how the whole match went, and where one robot got ahead |
| Log | what happened, in order |
| Debugger | at one moment, which lines ran, and what the variables and sensors held |

Use them in that order: the analysis to see roughly where, the log to see what happened there, and the debugger to find the line behind it. This chapter first does that with one match, then puts it into steps, and goes through two more cases.`,
      `負けた試合には、かならず理由があります。ゲームには、それを探す道具が 3 つあります。

| 道具 | 分かること |
|---|---|
| 分析 | 試合全体のようす。どこで差がついたか |
| ログ | 何が、どの順に起きたか |
| デバッガ | ある瞬間に、どの行が動いたか。変数やセンサーがどんな値だったか |

使う順もこのとおりです。分析で大まかな場所の見当をつけ、ログでそこで何が起きたかを確かめ、デバッガで原因の行を見つけます。この章では、まず 1 つの試合でこの順に使ってみます。そのあと手順にまとめて、実例をあと 2 つ見ます。`,
    ),
    text(
      `## The match

The game's own Sample (as ALPHA) against DumbBot (as BRAVO), on Open Field, with seed 1. The Sample drives up to the enemy and fires, much as DumbBot does. Yet it hardly ever wins.`,
      `## 例の試合

ゲームに最初から入っている Sample（ALPHA）と、DumbBot（BRAVO）の試合です。マップは Open Field、seed は 1 です。Sample は DumbBot と同じように、敵に近づいて撃ちます。なのに、ほとんど勝てません。`,
    ),
    { kind: 'template', template: 'sample' },
    { kind: 'matchup', matchup: againstDumbBot(SAMPLE_NAME, SAMPLE_AI) },
    text(
      `To watch the same match in the game:

- Open \`index.html?seed=1\`: with \`?seed=1\` at the end, every match gets seed 1.
- Choose the one-robot PROGRAM in the start menu.
- In ALPHA's main.bot, choose Sample from LOAD TEMPLATE; in BRAVO's, DumbBot.
- Set the map to Open Field, and press DEBUG.`,
      `同じ試合は、ゲームでも見られます。

- \`index.html?seed=1\` を開く。最後に \`?seed=1\` を付けると、どの試合も seed 1 になります。
- 起動メニューで、個人戦の「プログラム」を選ぶ。
- ALPHA の main.bot で「テンプレート」から Sample を、BRAVO の main.bot で DumbBot を選ぶ。
- マップを Open Field にして、「デバッグ」を押す。`,
    ),
    text(
      `## Analysis: where did it fall behind?

After a match, the ANALYSIS tab beside the log shows this. Here it is for our match.`,
      `## 分析：どこで差がついたか

試合のあと、ログのとなりの「分析」タブを開くと、次のような表とグラフが出ます。例の試合の分析です。`,
    ),
    { kind: 'replay', replay: LOST_MATCH, tick: 75, panel: { kind: 'analysis' }, caption: caption(
      'The analysis of the match. Press the chart or a dot on the map, and the picture above goes to that moment.',
      '例の試合の分析。グラフや地図の点を押すと、上の絵がその時点に変わる。',
    ) },
    text(
      `| Column | What it counts |
|---|---|
| hits | shots that hit / shots fired |
| dealt | damage done to the enemy |
| taken | damage taken |
| guarded | hits taken while guarding |
| recovered | HP got back by resting out of sight |
| driven | how far the robot drove |
| enemy in sight | of the time it was standing, how much of it it could see the enemy |

The Sample fired 10 and hit with 9; DumbBot fired 10 and hit with all 10. They aim about as well as each other: the difference is one shot. A shot takes 20, so 10 shots bring a robot down, and the one that starts firing first gets its tenth shot in first.

On the chart of HP, ALPHA's line goes down first. Press where it first drops: the picture shows the moment DumbBot's first shot hit, while the Sample had not hit yet.

The analysis is not only on the program screen. When you watch a match in the arena, a contest or the team battle, the ANALYSIS button above the battle view opens it.

What to suspect when the numbers look like this:

| You see | Suspect |
|---|---|
| few hits | firing on the move, or at an enemy going sideways (Chapter 10) |
| little time with the enemy in sight | the way it looks for the enemy: it loses it behind cover |
| much damage taken, nothing guarded | no \`guard\` (Chapter 11), or the program never gets to it (Case 2 below) |
| very far driven | going round and round the same place |`,
      `| 列 | 数えているもの |
|---|---|
| 命中 | 当たった数 / 撃った数 |
| 与ダメージ | 敵に与えたダメージ |
| 被ダメージ | 受けたダメージ |
| ガード | ガード中に受けた弾の数 |
| 回復 | 隠れて取りもどした HP |
| 走行距離 | 走った長さ |
| 敵が見えた時間 | 生きていた時間のうち、敵が見えていた割合 |

Sample は 10 発撃って 9 発、DumbBot は 10 発撃って 10 発当てました。狙いの良さは同じくらいで、差は 1 発です。弾 1 発で 20 減るので、10 発当てれば倒せます。先に撃ち始めた方が、先に 10 発目を当てます。

HP の推移のグラフでは、ALPHA の線が先に下がります。最初に下がったところを押してみてください。DumbBot の最初の弾が当たった瞬間で、Sample の弾はまだ当たっていません。

分析はプログラム画面だけのものではありません。アリーナ・大会・基地戦の観戦で見ている試合も、戦闘画面の上の「分析」ボタンで開けます。

数字がこうなっていたら、ここを疑います。

| こう見えたら | 疑うところ |
|---|---|
| 命中が少ない | 動きながら撃っている。横に動く敵を撃っている（第 10 章） |
| 敵が見えた時間が短い | 敵の探し方。物陰で見失っている |
| 被ダメージが多いのに、ガードが 0 | \`guard\` を使っていない（第 11 章）。または、guard の行まで来ていない（この章の実例 2） |
| 走行距離がとても長い | 同じ所をぐるぐる回っている |`,
    ),
    text(
      `## Log: what happened, in order

The log is on the program screen, bottom left. Here is the start of our match.`,
      `## ログ：何がどの順に起きたか

ログは、プログラム画面の左下にあります。例の試合のはじめの部分です。`,
    ),
    { kind: 'replay', replay: LOST_MATCH, tick: 60, panel: { kind: 'log', until: 100 }, caption: caption(
      'The first seconds of the log. Press a row, and the picture goes to that moment; rows after it are pale.',
      '例の試合のはじめのログ。行を押すと、上の絵がその時点に変わる。それより後の行は薄くなる。',
    ) },
    text(
      `A row is one thing that happened: when (in seconds), which robot, what kind of thing, and what.

| Kind | When |
|---|---|
| SENSOR | the robot comes to see the enemy (enemy detected), or loses it (enemy lost); it starts or stops recovering in hiding |
| AI | its \`label\` changes (label TRACK -> ATTACK) |
| ACTION | it turns, drives, fires… An action that goes on from the same line shows once, and again only after a second without it. Every \`fire\` shows |
| HIT | a shot hits: damage is what it took, hp what is left; (guarded) if it was guarding |
| WARNING | the program has got into trouble: see below |
| SYSTEM | the start of the match (its seed), and the end (who won, and how) |
| ERROR | the program is written wrong, and does not run |

In our match, at 2.000 seconds DumbBot goes from TRACK to ATTACK and fires. The Sample fires first at 2.500, and at that same moment DumbBot's first shot hits it (hp=180). DumbBot started firing half a second sooner.

In the game, pressing a row goes to that moment, and the line that did it turns yellow in the editor.

The warnings are worth knowing:

| Warning | What happened | What to do |
|---|---|---|
| program finished | the program got to its last line and stopped | put it all in a \`loop\` (Chapter 1) |
| too many lines without an action | 1000 lines went by without an action: the robot does nothing that tick | put an action on every way through the loop (Chapter 3) |
| program stopped: its calls went too deep | functions called functions too deep | do not let functions call each other round |
| out of ammo | no shots left (there are only so many) | do not waste shots from too far to hit |
| out of guards | every \`guard\` used up | guard just before a hit (Chapter 11) |
| signal to N: no teammate has that number | in a base battle, a \`signal\` to a number nobody has | check the number (Chapter 14) |`,
      `1 行が 1 つの出来事です。左から、時刻（秒）、ロボット、種類、内容です。

| 種類 | 出るとき |
|---|---|
| センサー | 敵が見えた（enemy detected）、見えなくなった（enemy lost）。隠れて回復し始めた、やめた |
| AI | \`label\` が変わった（label TRACK -> ATTACK） |
| 行動 | 回った、走った、撃った、など。同じ行の同じ行動が続くときは最初だけ出て、1 秒以上あいたらまた出る。\`fire\` は毎回出る |
| 命中 | 弾が当たった。damage は受けたダメージ、hp は残り。ガード中なら (guarded) |
| 警告 | プログラムが困ったことになった。下の表 |
| システム | 試合の始まり（seed）と終わり（勝ったロボットと、決まり方） |
| エラー | 書きまちがいで、プログラムが動かない |

例の試合では、2.000 秒に DumbBot の label が TRACK から ATTACK に変わり、撃ち始めます。Sample が最初に撃つのは 2.500 秒で、その同じ時刻に DumbBot の最初の弾が当たっています（hp=180）。DumbBot の方が 0.5 秒早く撃ち始めていました。

ゲームでは、ログの行を押すとその時点へ移り、その出来事を起こした行がエディタで黄色になります。

警告は、知っておくと役に立ちます。

| 警告の文 | 何が起きたか | どうするか |
|---|---|---|
| program finished | プログラムが最後の行まで行って止まった | 全体を \`loop\` に入れる（第 1 章） |
| too many lines without an action | 行動のないまま 1000 行を超えた。その tick は何もしない | loop のどの道にも行動を入れる（第 3 章） |
| program stopped: its calls went too deep | 関数が関数を呼んで、深くなりすぎた | 関数どうしが呼び合わないようにする |
| out of ammo | 弾がなくなった（弾の数には限りがある） | 届かない所や外れやすい所から撃って、むだにしない |
| out of guards | \`guard\` を使い切った | 当たる直前だけ guard する（第 11 章） |
| signal to N: no teammate has that number | 基地戦で、いない番号に \`signal\` した | 番号を確かめる（第 14 章） |`,
    ),
    text(
      `## Debugger: the program at one moment

Press DEBUG instead of RUN, and the screen shows what the program is doing. The picture is a match of two Samples, stopped with a ◆ on line 15.`,
      `## デバッガ：その瞬間のプログラムを見る

「実行」の代わりに「デバッグ」を押すと、プログラムが何をしているかが画面に出ます。下の絵は、Sample どうしの試合を、15 行目に ◆ を付けて止めたところです。`,
    ),
    { kind: 'shot', shot: 'debugger', caption: caption(
      'The program screen while debugging. The numbers are explained below.',
      'デバッグ中のプログラム画面。番号の説明は下の表。',
    ) },
    text(
      `| | Part | What it is for |
|---|---|---|
| 1 | DEBUG | plays the whole match first, then shows it from the start. RUN can be paused and stepped a tick at a time too, but 2 to 6 show only while debugging |
| 2 | The message | with a ◆ on a line: how many times it runs in the match, and which of them this is |
| 3 | Numbers left of the lines | in how many ticks the line ran in this match. A line without one never ran |
| 4 | ◆ | press a line number to put it on: the match goes to the next time that line runs. Press again to take it off |
| 5 | Yellow and green lines | yellow is the line that runs next; pale green, the lines already run in this tick |
| 6 | Marks on the field | the \`label\` under each robot. The robot looked at sees the tinted ground; while it sees the enemy, a line runs to it and a frame goes round it; once it loses it, a cross marks where it was last seen |
| 7 | The buttons | PLAY / PAUSE (Space). \`◀1\` \`1▶\` go one line back or on (← →); in RUN, one tick. \`1▷\` runs through a function the line calls. \`◀◆\` \`◆▶\` go to the last or next time the ◆ line runs |
| 8 | Seek bar | drag to any moment. Every time the ◆ line runs is marked on it |
| 9 | ANALYSIS tab | the analysis in place of the log |
| 10 | Log | rows after the moment shown are pale |
| 11 | INSPECTOR | where the robot is, its HP, heading, drive, label, shots left, guards left, time to the next shot… ALPHA / BRAVO above it pick the robot to look at, for this, the marks and the watch |
| 12 | WATCH | the variables and the sensors. A function's parameter shows as \`attack.distance\`. While paused, a sensor shows what the yellow line will read |

\`1▶\` follows the robot whose main.bot is open in the editor.`,
      `| | 部分 | 使いどころ |
|---|---|---|
| 1 | 「デバッグ」 | 試合を最後まで計算してから、最初から見せる。「実行」でも一時停止や 1 tick ずつの移動はできるが、2〜6 はデバッグのときだけ出る |
| 2 | 上のメッセージ | ◆ を付けた行が、この試合で何回実行され、今が何回目か |
| 3 | 行番号の左の数字 | その行が、この試合で何 tick 実行されたか。数字のない行は、一度も実行されていない |
| 4 | ◆ | 行番号を押すと付く。その行が次に実行される時点へ移る。もう一度押すと外れる |
| 5 | 黄色の行と緑の行 | 黄色は次に実行する行。薄い緑は、今の tick ですでに通った行 |
| 6 | 戦闘画面の印 | ロボットの下に \`label\`。見ているロボットの見える範囲に色が付き、敵が見えている間は敵への線と、敵を囲む枠が出る。見失うと、最後に見た場所に × |
| 7 | ボタン | 再生・一時停止（スペース）。\`◀1\` \`1▶\` は 1 行戻る・進む（← →）。「実行」では 1 tick。\`1▷\` は、その行が呼ぶ関数の中を一気に進める。\`◀◆\` \`◆▶\` は ◆ の行が前に・次に実行される時点へ |
| 8 | 再生位置 | つまんで好きな時点へ動かす。◆ の行が実行された時点に印が出る |
| 9 | 「分析」タブ | ログの代わりに分析を出す |
| 10 | ログ | 今より後の行は薄く出る |
| 11 | 状態 | 位置、HP、向き、走行、ラベル、弾、ガード、次弾まで、など。上の ALPHA / BRAVO で、見るロボットを選ぶ。戦闘画面の印とウォッチも、そのロボットのものになる |
| 12 | ウォッチ | 変数とセンサーの値。関数の引数は \`attack.distance\` のように出る。一時停止中のセンサーは、黄色の行がこれから読む値 |

\`1▶\` で進むのは、エディタで main.bot を開いている方のロボットです。`,
    ),
    text(
      `## Using it on our match

The log said DumbBot fires at 2.000 seconds, and the Sample only at 2.500. What was the Sample doing in between?

- Put a ◆ on line 15 (\`fire\`). The match goes to 2.500 seconds: the first time the Sample fires.
- Press DumbBot's first \`fire\` row in the log, at 2.000 seconds.
- Go on with \`1▶\`. The Sample reads line 12, \`if enemy_distance < distance\`, and goes on to the \`else\`, lines 16 to 18: it keeps driving.
- Look at the watch there: \`attack.distance\` is 250, and the distance to the enemy is just under 300.`,
      `## 例の試合で使ってみる

ログによれば、DumbBot は 2.000 秒に撃ち始め、Sample は 2.500 秒まで撃っていません。その間、Sample は何をしていたのでしょう。

- 15 行目（\`fire\`）の行番号を押して、◆ を付ける。試合は 2.500 秒へ移る。Sample が初めて撃つ時点です。
- ログで、2.000 秒の DumbBot の最初の \`fire\` の行を押す。
- \`1▶\` で進める。Sample は 12 行目の \`if enemy_distance < distance\` を読んで、\`else\` の側（16〜18 行目）へ進む。まだ走り続けています。
- そこでウォッチを見る。\`attack.distance\` は 250、敵までの距離は 300 を少し切ったところです。`,
    ),
    { kind: 'replay', replay: LOST_MATCH, tick: 60, caption: caption(
      'At 2.000 seconds: DumbBot (BRAVO) has stopped and fires; the Sample (ALPHA) is still driving in.',
      '2.000 秒。DumbBot（BRAVO）は止まって撃ち始めた。Sample（ALPHA）はまだ近づいている。',
    ) },
    text(
      `That is the reason. DumbBot fires from closer than 300; the Sample waits until it is closer than 250. While it drives the last 50, it is shot at and cannot shoot back.

The line to change is the one that calls \`attack\`, in the \`loop\` at the end: make \`attack(250)\` into \`attack(320)\`.`,
      `これが理由です。DumbBot は 300 より近ければ撃ちます。Sample は 250 より近づくまで撃ちません。最後の 50 を進む間、撃たれるだけで撃ち返せないのです。

直すのは、最後の \`loop\` の中で \`attack\` を呼んでいる行です。\`attack(250)\` を \`attack(320)\` に変えます。`,
    ),
    text(
      `Why not 300, the same as DumbBot? Try it: of the 12 matches, 10 are draws. The two start firing at the same moment and go down at the same moment. With 320, the Sample fires first.`,
      `DumbBot と同じ 300 ではだめなのでしょうか。試すと、12 試合のうち 10 試合が引き分けになります。同時に撃ち始めて、同時に倒れるのです。320 にすると、Sample の方が先に撃ちます。`,
    ),
    { kind: 'matchup', matchup: againstDumbBot(SOONER_NAME, SAMPLE_SOONER) },
    { kind: 'replay', replay: WON_MATCH, tick: 57, panel: { kind: 'analysis' }, caption: caption(
      'The same match with attack(320). Now it is DumbBot whose HP goes down first.',
      'attack(320) にした同じ試合。今度は DumbBot の HP が先に下がる。',
    ) },
    text(
      `## How to look

What we just did, as steps:

| Step | What to do |
|---|---|
| 1. The same match | make the lost match one you can watch again: the same map, the same seed |
| 2. Analysis | look for the numbers that differ from the enemy's |
| 3. Log | see what happened around the moments those numbers come from |
| 4. Debugger | see which lines were running then |
| 5. Mend and check | change one thing, and compare on the same match and the same table of matches |

Change only one thing: change two, and you cannot tell which of them did it. Compare on the same match: with another seed, you cannot tell whether your change did it or the match just went differently.

To ask someone else, or an AI, press **COPY** in the heading of the log. It copies the match as text: the map and seed, the numbers of the analysis, both programs and the whole log. Paste that, and ask why it lost.`,
      `## 探し方の手順

ここまでのやり方を、手順にまとめておきます。

| 手順 | すること |
|---|---|
| 1. 同じ試合を出す | 負けた試合を、同じマップ・同じ seed でもう一度見られるようにする |
| 2. 分析 | 相手とちがう数字を探す |
| 3. ログ | その数字に関わる時刻に、何が起きたかを見る |
| 4. デバッガ | そのとき、どの行が動いていたかを見る |
| 5. 直して確かめる | 1 か所だけ直して、同じ試合と同じ対戦表で比べる |

直すのは 1 か所だけにします。2 か所いっぺんに変えると、どちらが効いたのか分かりません。比べるのは同じ試合で。seed が変わると、直したから変わったのか、試合の流れが変わっただけなのかが分かりません。

人や AI に聞くときは、ログの見出しの **コピー** を押します。マップと seed、分析の数字、両方のプログラム、ログの全部が、文字でコピーされます。それを貼り付けて、なぜ負けたのか聞いてみましょう。`,
    ),
    text(
      `## From what you see to where to look

Some odd ways to move, and what is often behind them:

| You see | Often | Where to look |
|---|---|---|
| it sees the enemy, but does not turn to it or fire | it goes round a way with no action: past 1000 lines, it does nothing that tick (Chapter 3) | the warning too many lines without an action in the log; no action among the green lines |
| it does not get away when shot at | it is in the middle of a line that takes many ticks, such as \`turn left 90\`, and does not look around (Chapter 3) | the number left of that line is bigger than you thought: one go counts many ticks |
| what is inside an if never happens | an if above it takes those ticks first (Chapter 5) | no number left of the line. Look in the watch at the condition of the if above |
| a variable never changes | its \`set\` is on a way the program never goes | the number left of the \`set\` line, and the value in the watch |
| it starts firing later than the enemy | one more action, such as a turn, before it fires | the times of the first \`fire\` rows in the log |

The next two cases are both in this table.`,
      `## 症状から見当をつける

動きがおかしいとき、よくある原因です。

| こう見えたら | よくある原因 | 確かめるところ |
|---|---|---|
| 敵が見えているのに、向きを変えない・撃たない | 行動のない道を回っている。1000 行を超えると、その tick は何もしない（第 3 章） | ログの警告 too many lines without an action。緑の行に、行動の行がない |
| 撃たれても逃げない | \`turn left 90\` のような何 tick も続く行の途中で、周りを確かめていない（第 3 章） | その行の左の数字が、思ったより大きい。1 回で何 tick も数える |
| ある if の中が動かない | 上の if が先につかまえている（第 5 章） | 行番号の左に数字がない。上の if の条件をウォッチで見る |
| 変数が変わらない | \`set\` の行が、通らない道にある | \`set\` の行の左の数字。ウォッチの値 |
| 撃ち始めが相手より遅い | 撃つ前に、向きを変えるなどの行動が 1 つ多い | ログで、最初の \`fire\` の時刻を比べる |

次の 2 つの実例は、どちらもこの表に出てきます。`,
    ),
    text(
      `## Case 1: it does not turn to the enemy on the way in

A robot written after DumbBot. When it sees the enemy, it drives up to it if it is further than 300, and stops and fires if it is closer.`,
      `## 実例 1：近づく間、敵の方を向かない

DumbBot をまねて書いたロボットです。敵が見えたら、300 より遠ければ近づき、近ければ止まって撃ちます。`,
    ),
    code(TRACK_NO_ACTION),
    { kind: 'matchup', matchup: againstDumbBot(TRACK_NO_ACTION_NAME, TRACK_NO_ACTION) },
    text(
      `It does what DumbBot does, or so it seems; yet it wins 1 of 12. Let us look into it on the same Open Field, seed 1. To play it in the game, write it into ALPHA's main.bot, and do the rest as for the match above.

The analysis says 9 hits of 10 against 10 of 10: again one shot apart. Now the log:`,
      `DumbBot と同じことをしているはずなのに、12 試合で 1 勝しかできません。例の試合と同じ Open Field、seed 1 で調べます。ゲームで試すときは、ALPHA の main.bot にこのプログラムを書き、あとは例の試合と同じ手順です。

分析では、命中は 9/10 と 10/10。今度も差は 1 発です。次はログです。`,
    ),
    { kind: 'replay', replay: TRACK_CASE, tick: TRACK_CASE_SHOWN, panel: { kind: 'log', until: 90 }, caption: caption(
      'The first seconds. A warning at 0.033 seconds, as soon as the match starts.',
      'はじめのログ。試合が始まってすぐ、0.033 秒に警告が出ている。',
    ) },
    text(
      `Two things stand out:

- At 0.033 seconds, the warning too many lines without an action.
- At 2.000 seconds, when DumbBot starts firing, our robot is only now turning to the enemy (turn enemy). It fires on the next tick, at 2.033.

On to the debugger. Stop anywhere while it is driving in (TRACK), and look:

- The pale green lines, run in this tick: lines 1 to 3 and 8 to 10. Not one of them is an action. The program goes round and round them, and after 1000 lines the tick ends with nothing done.
- The numbers left of the lines: 59 for lines 9 and 10, the ticks it was driving in. Lines 11 and on have none.
- ROTATION in the inspector: 180 all the way in. It never turns.

The way in (TRACK) has no action. The robot still drives, as \`drive forward\` is a setting, so it looks all right; but nothing turns it to the enemy. Once it is closer than 300, it turns first, and fires a tick later. DumbBot turns to the enemy (\`turn enemy\`) on every tick of its way in, so it fires on the very tick the enemy comes closer than 300. One tick sooner, it gets its tenth shot in first.

To mend it, move \`turn enemy\` up above the if (line 3). Now both ways have an action, and the warning is gone.`,
      `目につくのは 2 つです。

- 0.033 秒に、警告 too many lines without an action（行動のないまま行が多すぎる）。
- 2.000 秒、DumbBot が撃ち始めたとき、こちらはやっと turn enemy で敵の方を向いている。撃つのは次の tick、2.033 秒。

デバッガで見てみます。近づいている途中（TRACK）のどこかで止めてください。

- 薄い緑の行（今の tick に通った行）は、1〜3 行目と 8〜10 行目。行動の行が 1 つもありません。プログラムはここをぐるぐる回り、1000 行を超えたところで、何もしないままその tick が終わります。
- 行番号の左の数字は、9 行目と 10 行目が 59。近づいていた tick の数です。11 行目から下には数字がありません。
- 状態の「向き」は、近づく間ずっと 180 のまま。一度も向きを変えていません。

近づく道（TRACK）には、行動がないのです。\`drive forward\` は設定なので走り続け、見た目はちゃんと近づいています。でも、敵の方を向く行がありません。300 を切ってから向きを変え、撃つのはその次の tick です。DumbBot は近づく間も毎 tick \`turn enemy\` しているので、300 を切ったその tick に撃てます。1 tick 早い方が、先に 10 発目を当てます。

直すには、\`turn enemy\` を if の前（3 行目）に出します。これでどちらの道にも行動が入り、警告も出なくなります。`,
    ),
    code(TURN_FIRST),
    { kind: 'matchup', matchup: againstDumbBot(TURN_FIRST_NAME, TURN_FIRST) },
    text(
      `Now 10 of the 12 are draws. It no longer loses, but it does not win either: it fires at 2.000 seconds, on the same tick as DumbBot, and the two go down together.`,
      `12 試合のうち 10 試合が引き分けになりました。負けなくはなりましたが、勝てません。DumbBot と同じ 2.000 秒に撃ち始めて、同時に倒れるのです。`,
    ),
    text(
      `## Case 2: the guard that never happens

To get out of the draws, we add a guard to the mended robot (Chapter 11): when a bullet is about to hit, guard.`,
      `## 実例 2：guard が一度も動かない

引き分けから抜け出すために、実例 1 で直したロボットに guard を足しました（第 11 章）。弾が当たる直前なら guard します。`,
    ),
    code(GUARD_UNDER),
    { kind: 'matchup', matchup: againstDumbBot(GUARD_UNDER_NAME, GUARD_UNDER) },
    text(
      `Just as before: 1 win, 1 loss, 10 draws. The analysis of the match:`,
      `結果は足す前とまったく同じで、1 勝 1 敗 10 引き分けです。分析を見ます。`,
    ),
    { kind: 'replay', replay: GUARD_CASE, tick: GUARD_CASE_SHOWN, panel: { kind: 'analysis' }, caption: caption(
      'The analysis, shown at the first hit. Nothing in guarded.',
      '最初の弾が当たった時点の分析。ガードは 0。',
    ) },
    text(
      `guarded is 0: it never guarded. There is no guard row in the log either. In the debugger:

- Line 11, \`else if bullet_incoming…\`, has no number on its left. Not only the \`guard\` on line 12: the if itself was never read.
- Go to 2.600 seconds, a tick before the first hit, and look in the watch: \`bullet_incoming\` is true, and so is \`enemy_visible\`.

A bullet comes when the enemy fires, and then the enemy is in sight. So the if of line 2, \`if enemy_visible\`, takes all those ticks, and the program never gets to line 11. All 10 times a bullet came closer than 36, the enemy was in sight.

To mend it, put the if of the guard at the top.`,
      `ガードの列が 0 です。一度も guard していません。ログにも guard の行がありません。デバッガで見ます。

- 11 行目の \`else if bullet_incoming…\` の左に、数字がない。12 行目の \`guard\` どころか、その if さえ一度も読まれていません。
- 最初の弾が当たる 1 tick 前、2.600 秒に合わせてウォッチを見る。\`bullet_incoming\` は true、\`enemy_visible\` も true です。

弾が飛んでくるのは、敵が撃ったとき。そのとき敵は見えています。だから 2 行目の \`if enemy_visible\` が先につかまえて、11 行目まで来ないのです。弾が 36 より近くまで来た 10 回とも、敵は見えていました。

直すには、guard の if を一番上に置きます。`,
    ),
    code(GUARD_ON_TOP),
    { kind: 'matchup', matchup: againstDumbBot(GUARD_ON_TOP_NAME, GUARD_ON_TOP) },
    { kind: 'replay', replay: GUARD_FIXED, tick: GUARD_CASE_SHOWN, panel: { kind: 'analysis' }, caption: caption(
      'With the guard on top, the same match: one guarded, and 10 HP left at the end.',
      'guard を一番上にした同じ試合。ガードが 1 になり、最後に HP が 10 残る。',
    ) },
    text(
      `9 wins and 3 losses. In our match it guarded once: the first shot, at 2.633 seconds, took 10 instead of 20. The rest went as before, and DumbBot went down first, leaving us 10 HP. That one guard is all the difference.

It may guard 4 times, and guarded once. How to guard more often? Compare it with GuardBot's program (Chapter 9).`,
      `9 勝 3 敗です。例の試合では、2.633 秒の最初の弾を guard で受けて、ダメージが 20 から 10 になりました。あとは同じように撃ち合い、DumbBot が先に倒れて、こちらは HP 10 で残ります。差はこの 1 回の guard だけです。

guard は 4 回まで使えるのに、使えたのは 1 回でした。もっと使うにはどうすればよいか、GuardBot のプログラム（第 9 章）と比べてみてください。`,
    ),
    text(
      `## In short

- The analysis tells you where to look; the log, what happened there; the debugger, which line made it happen.
- A line with no number on its left never ran. The warning about too many lines points to a way with no action.
- Change one thing, and play the same matches again to see what it did. The next chapter grows a robot that way.`,
      `## まとめ

- 分析でどこを見るかを決め、ログでそこで何が起きたかを確かめ、デバッガでどの行が起こしたかを見つける。
- 行番号の左に数字がない行は、一度も通っていない。行が多すぎるという警告は、行動のない道があるしるし。
- 直すのは 1 か所だけ。同じ試合をもう一度して、何が変わったかを確かめる。次の章では、このやり方でロボットを育てていきます。`,
    ),
    { kind: 'see', topics: ['log-help', 'debugging-help', 'program-screen', 'keys'] },
  ],
};

const ROUND_1: Text = { en: 'Round 1', ja: '1 回目' };

/** A robot of the growing chapter against the rivals of Chapter 9. */
export function growMatchupOf(name: Text, source: string): Matchup {
  return { robot: { name, source }, opponents: RIVALS, arenas: MATCHUP_ARENAS, seeds: MATCHUP_SEEDS };
}

const GROWING: BookChapter = {
  id: 'growing',
  title: { en: 'Growing your own strategy', ja: '自分の作戦を育てる' },
  blocks: [
    text(
      `A strong robot is seldom written in one go. Write a simple one, let it fight, see where it loses, and change one thing. Then let it fight again. This chapter follows a robot through that, round by round.`,
      `強いロボットは、一度には書けません。単純なものを書いて戦わせ、どこで負けるかを見て、1 か所だけ直す。そしてまた戦わせる。この章では、1 台のロボットをそうやって育てていきます。`,
    ),
    text(
      `## Round 1: find it and shoot

To start, the robot of Chapter 13's hints: it drives about until it sees the enemy, then stops, aims and fires.`,
      `## 1 回目: 見つけて撃つ

最初は、第 13 章のヒントにも出てきた形です。敵が見えるまで走り回り、見えたら止まって、狙って撃ちます。`,
    ),
    code(GROW_1),
    text(
      `Against the 8 built-in robots of Chapter 9, in the same ${matchCount(growMatchupOf(ROUND_1, GROW_1))} matches as there:`,
      `第 9 章と同じ ${matchCount(growMatchupOf(ROUND_1, GROW_1))} 試合で、内蔵ロボット 8 体と戦わせてみます。`,
    ),
    { kind: 'matchup', matchup: growMatchupOf(ROUND_1, GROW_1) },
    text(
      `It won 56. Look at what it lost: StrafeBot, CoverBot and HitAndHideBot. StrafeBot drives across its fire, so it is the first to deal with.`,
      `56 勝しました。負けた相手を見ます。StrafeBot、CoverBot、HitAndHideBot です。まず、横に走って弾をよける StrafeBot から手を付けます。`,
    ),
    text(
      `## Round 2: shoot where it is going

A robot driving across is missed by a shot at where it is now (Chapter 10). Change \`aim enemy\` to \`aim lead\`, and \`aim_angle\` to \`lead_angle\` (how far the turret points off where the enemy will be) with it:`,
      `## 2 回目: 行く先を撃つ

横に走る相手は、今いる場所を撃っても当たりません（第 10 章）。\`aim enemy\` を \`aim lead\` に、それに合わせて \`aim_angle\` を \`lead_angle\`（砲塔の向きと、弾が届くころに敵がいる場所とのずれ）にします。`,
    ),
    code(GROW_2),
    { kind: 'matchup', matchup: growMatchupOf({ en: 'Round 2', ja: '2 回目' }, GROW_2) },
    text(
      `Against StrafeBot it went from 5 wins to 11, and 63 in all. Nothing it beat before was lost.`,
      `StrafeBot には 5 勝から 11 勝になり、全部で 63 勝。前に勝てていた相手には、変わらず勝てています。`,
    ),
    text(
      `## Round 3: guard

Now add the guard of Chapter 11, just before a hit. It goes first in the loop, so that it is looked at on every tick:`,
      `## 3 回目: guard する

次は、第 11 章の「当たる直前の guard」を足します。毎 tick 確かめるように、loop のいちばん上に置きます。`,
    ),
    code(GROW_3),
    { kind: 'matchup', matchup: growMatchupOf({ en: 'Round 3', ja: '3 回目' }, GROW_3) },
    text(
      `68 wins. A little better against several robots, and the first wins against HitAndHideBot.`,
      `68 勝。いくつかの相手に少しずつ強くなり、HitAndHideBot から初めて勝ちを取りました。`,
    ),
    text(
      `## Round 4: go to whoever shot you

HitAndHideBot shoots, then hides out of sight. Shot by an enemy it cannot see, this robot only drives on. Make it turn the way the shot came from, and go there:`,
      `## 4 回目: 撃ってきた方へ行く

HitAndHideBot は撃っては見えない所へ隠れます。このロボットは、見えない相手に撃たれても走り回るだけです。撃たれたら弾の来た方を向いて、そちらへ行くようにします。`,
    ),
    code(GROW_4),
    { kind: 'matchup', matchup: growMatchupOf({ en: 'Round 4', ja: '4 回目' }, GROW_4) },
    text(
      `Against HitAndHideBot, from 2 wins to 9, and 76 in all. In four rounds, 56 has become 76.`,
      `HitAndHideBot には 2 勝から 9 勝、全部で 76 勝になりました。4 回で、56 勝が 76 勝です。`,
    ),
    text(
      `## A change that made it worse

CoverBot it still never beats. CoverBot hides and recovers, so this one tried the same: below 100 HP, hide and rest until back over 180.`,
      `## 弱くなった直し方

CoverBot には、まだ 1 度も勝てません。CoverBot は隠れて回復するので、こちらもまねをしてみました。HP が 100 を切ったら隠れて、180 を超えるまで休みます。`,
    ),
    code(GROW_HIDE),
    { kind: 'matchup', matchup: growMatchupOf({ en: 'The hiding one', ja: '隠れる版' }, GROW_HIDE) },
    text(
      `61 wins: fewer than before. The table says where: AggressiveBot, beaten every time before, now wins nearly every match. It chases a robot that goes off to hide, and shoots it in the back.

Not every change makes a robot stronger. Change one thing at a time, and let it fight the same matches again: then you can tell which change did what. Throw away a change that does not help.`,
      `61 勝で、前より減りました。表を見ると、どこで減ったかが分かります。前は全勝していた AggressiveBot に、ほとんど負けています。隠れに行くロボットを追いかけて、後ろから撃ってくるからです。

直せば必ず強くなるわけではありません。1 回に 1 か所だけ直して、同じ試合でもう一度戦わせる。そうすれば、どの直しが何を変えたかが分かります。効かなかった直しは、元に戻します。`,
    ),
    text(
      `## The game's tools for it

| Tool | Use it to |
|---|---|
| Arena, SERIES | play 20 matches against one robot at once, over every map, and count the wins |
| ANALYSIS | see a match in numbers: shots hit, damage taken, HP over time, where the hits landed (Chapter 15) |
| DEBUG | follow a lost match line by line, to see what the robot was thinking (Chapters 8 and 15) |
| Garage | keep each version under a name of its own, to go back to or play against |
| Contest | play many robots at once, in a league or a tournament |
| Sharing | give a robot to someone, and play theirs |`,
      `## 育てるための道具

| 道具 | 使いみち |
|---|---|
| アリーナの「連戦」 | 1 体の相手と、全マップで 20 試合をまとめて戦わせ、勝ち数を数える |
| 分析 | 試合を数字で見る。命中、受けたダメージ、HP の推移、当たった場所（第 15 章） |
| デバッグ | 負けた試合を 1 行ずつ追って、ロボットが何を考えていたかを見る（第 8 章、第 15 章） |
| ガレージ | 直すたびに名前を変えて保存しておく。戻したり、新旧で戦わせたりできる |
| 大会 | たくさんのロボットを、リーグ戦かトーナメントで一度に戦わせる |
| 共有 | 自分のロボットを人に渡し、人のロボットと戦う |`,
    ),
    text(
      `## On from here

This robot still loses to CoverBot. How would you beat it? Look at CoverBot's program in Chapter 9, and try something. When it wins, put it in a contest against the built-in robots, and then against a friend's.`,
      `## ここから先は

このロボットは、まだ CoverBot に勝てません。どうすれば勝てるでしょう。第 9 章で CoverBot のプログラムを読んで、試してみてください。勝てるようになったら、大会で内蔵ロボットと戦わせ、それから友だちのロボットとも戦わせてみましょう。`,
    ),
    { kind: 'see', topics: ['arena-screen', 'contest-screen', 'garage-help', 'sharing'] },
  ],
};

export const BOOK: readonly BookPart[] = [
  {
    id: 'part-1',
    title: { en: 'Part 1: Thinking in programs', ja: '第 1 部 プログラムで考える' },
    chapters: [WHAT_A_PROGRAM_IS, MAKING_IT_MOVE, TICKS, LOOKING_AROUND, IF, REMEMBERING, FUNCTIONS, DEBUGGING],
  },
  {
    id: 'part-2',
    title: { en: 'Part 2: Strategies for winning', ja: '第 2 部 勝つための作戦' },
    chapters: [BUILT_IN_ROBOTS, SHOOTING, DEFENCE, PARTS_CHAPTER, CHALLENGES_CHAPTER, BASE_BATTLE, FINDING_OUT, GROWING],
  },
];

/** Every chapter, in the order of the book. */
export const CHAPTERS: readonly BookChapter[] = BOOK.flatMap((part) => part.chapters);
