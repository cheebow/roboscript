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
      `In RoboScript you never steer your robot. Before the match you write down what it should do, and in the match it does exactly that, by itself. That written list of what to do is a **program**.

A program is like a recipe. A recipe says "cut the onion, then fry it, then add salt", one step after another, and a cook follows it from the top. A robot follows its program from the top in the same way.`,
      `RoboScript では、試合中にロボットを操作しません。試合の前に「どう動くか」を書いておき、試合ではロボットがその通りに、ひとりで動きます。この「やることを書いたもの」が **プログラム** です。

プログラムは料理のレシピに似ています。レシピには「玉ねぎを切る」「炒める」「塩を入れる」と手順が順に書いてあり、料理する人は上から順にその通りに進めます。ロボットも、プログラムを上から順にその通りに進めます。`,
    ),
    text(
      `## A robot does what is written, and nothing else

There is one big difference from a cook. A cook who sees the pan is burning turns the heat down without being told. A robot never does anything that is not written. It does not guess what you meant, and it does not notice what you forgot to write.

That may sound hard, but it is what makes the game fun. When the robot does something odd, the reason is always somewhere in the program. Find it, fix it, and the robot gets better.`,
      `## 書いたことしかしない

料理する人とは、一つ大きく違うところがあります。人は、鍋が焦げそうなら言われなくても火を弱めます。ロボットは、書いていないことは決してしません。「たぶんこうしたいんだろう」と察してはくれないし、書き忘れたことに気づいてもくれません。

難しそうに聞こえますが、ここがこのゲームのおもしろいところです。ロボットが変な動きをしたら、その理由は必ずプログラムのどこかにあります。見つけて直せば、ロボットはそのぶん強くなります。`,
    ),
    text(
      `## Your first program

Here is a whole program. It is only three lines.`,
      `## はじめてのプログラム

これで一つのプログラムです。たった 3 行です。`,
    ),
    code(FIRST_PROGRAM),
    text(
      `Read it in words, from the top:

- \`loop\`: do the lines under me (the ones moved to the right) again and again, for ever.
- \`turn enemy\`: turn your body towards the enemy.
- \`fire\`: shoot.

So the robot turns towards the enemy, shoots, turns towards it again, shoots again, and so on until the match is over. The words of a program are English, in small letters. The lines inside \`loop\` start with four spaces; that is how the program shows which lines belong to it.`,
      `上から言葉に直すと、こうなります。

- \`loop\`: 下の、右に下げて書いた行を、ずっと繰り返す。
- \`turn enemy\`: 車体を敵の方へ回す。
- \`fire\`: 撃つ。

つまりこのロボットは、敵の方へ回って撃ち、また回って撃ち……と、試合が終わるまで続けます。プログラムの言葉は英語の小文字です。\`loop\` の中の行は、先頭に半角の空白を 4 つ入れて書きます。こうして「どの行が \`loop\` の中か」を表します。`,
    ),
    text(
      `## The same program, the same match

A match has no luck in it that you cannot see. With the same robots, the same map and the same **seed** (a number shown at the top right of the battle view), a match plays out exactly the same every time. So when you change one line and run the match again, whatever is different was made by that line. That is what lets you improve a robot step by step.`,
      `## 同じプログラムなら、同じ試合

試合には、見えない運はありません。同じロボット、同じマップ、同じ **seed**（戦闘画面の右上に出る数）なら、何度試合をしても、まったく同じ試合になります。ですから、1 行だけ直してもう一度試合をしたとき、違いが出たら、それはその 1 行のせいです。だから少しずつロボットを良くしていけます。`,
    ),
    { kind: 'shot', shot: 'program', caption: caption(
      'The program screen: the editor where you write (middle), the match (right) and the log of what happened (below).',
      'プログラムの画面。真ん中がプログラムを書くエディタ、右が試合、下が試合で起きたことの記録（ログ）です。',
    ) },
    text(
      `## How to read this book

Part 1 is about how to think in programs: what happens when a line runs, how a robot looks around and decides. Part 2 is about winning: how the built-in robots fight, the parts, the challenges.

Every program in the book really works. Open the PROGRAM screen of the game, write one into the editor and press RUN, and you will see what the book says. Changing it a little and seeing what happens is the quickest way to learn.`,
      `## この本の読み方

第 1 部は、プログラムでの考え方の話です。1 行を実行すると何が起きるか、ロボットがどうやって周りを見て決めるかを説明します。第 2 部は勝つための話で、内蔵ロボットの戦い方、パーツ、チャレンジを扱います。

本に出てくるプログラムは、どれも本当に動きます。ゲームの「プログラム」の画面を開いてエディタに書き写し、「実行」を押せば、本に書いてある通りになるのが見られます。少し書きかえて、何が変わるか試すのが一番の近道です。`,
    ),
    { kind: 'see', topics: ['welcome', 'program-screen', 'basics'] },
  ],
};

const MAKING_IT_MOVE: BookChapter = {
  id: 'making-it-move',
  title: { en: 'Making it move', ja: '動かしてみる' },
  blocks: [
    text(
      `## One line: one shot

The smallest program is a single line.`,
      `## 1 行で 1 発

一番小さいプログラムは、1 行だけです。`,
    ),
    code(ONE_SHOT),
    text(
      `The robot shoots once, straight ahead of its gun, and then stands still for the rest of the match. The program had one line; after it there is nothing more to do. The log says so: "program finished".`,
      `ロボットは砲塔の向いている方へ 1 発撃ち、あとは試合が終わるまで何もしません。プログラムは 1 行だけで、その先にはもうやることがないからです。ログにも「プログラムが終わった」と出ます。`,
    ),
    { kind: 'scene', scene: { stage: RANGE, program: ONE_SHOT, tick: 12 }, caption: caption(
      'ALPHA (right) has fired its one shot at the target. The bullet is on its way.',
      'ALPHA（右）が 1 発だけ撃ったところ。弾が的（左）へ向かって飛んでいます。',
    ) },
    text(
      `## Again and again: loop

To keep shooting, put \`fire\` inside a \`loop\`. The lines inside a \`loop\` are written four spaces in from it, and run again and again, for the whole match.`,
      `## 何度でも: loop

撃ち続けるには、\`fire\` を \`loop\` の中に入れます。\`loop\` の中の行は 4 つ下げて書き、試合の間ずっと繰り返されます。`,
    ),
    code(KEEP_FIRING),
    { kind: 'scene', scene: { stage: RANGE, program: KEEP_FIRING, tick: 40 }, caption: caption(
      'With loop, ALPHA keeps shooting: the first shot has hit, the next is on its way.',
      'loop があるので、ALPHA は撃ち続けます。最初の弾は当たり、次の弾が飛んでいます。',
    ) },
    text(
      `## The commands

These are the commands that make a robot do something. The words after them (\`left\`, \`enemy\`…) say which way.

| Command | What it does |
|---|---|
| \`turn left\` / \`turn right\` | turns the body a little (6 degrees) |
| \`turn left 90\` | turns the body 90 degrees, however long it takes |
| \`turn enemy\` | turns the body towards the enemy |
| \`aim enemy\` | turns only the gun on top towards the enemy |
| \`fire\` | shoots |
| \`guard\` | braces against a bullet: it does half the damage |
| \`wait\` | does nothing for a moment |
| \`drive forward\` / \`drive backward\` / \`drive stop\` | starts driving, or stops |`,
      `## 命令

ロボットに何かをさせる命令を並べます。後ろの言葉（\`left\`、\`enemy\` など）は、どちらへ、を表します。

| 命令 | すること |
|---|---|
| \`turn left\` / \`turn right\` | 車体を少し（6 度）回す |
| \`turn left 90\` | 車体を 90 度回す（回り切るまで続く） |
| \`turn enemy\` | 車体を敵の方へ回す |
| \`aim enemy\` | 上に載った砲塔だけを敵の方へ回す |
| \`fire\` | 撃つ |
| \`guard\` | 身構える。当たった弾のダメージが半分になる |
| \`wait\` | 少しの間、何もしない |
| \`drive forward\` / \`drive backward\` / \`drive stop\` | 前へ / 後ろへ走り出す、止まる |`,
    ),
    text(
      `## Driving goes on by itself

\`drive\` is a little different from the rest. It does not drive a set distance: it switches the driving on, and the robot keeps going until a \`drive stop\` (or a wall). So this one line is enough to drive across the field, even though the program ends at once.`,
      `## 走るのは「設定」

\`drive\` だけは、ほかの命令と少し違います。決まった距離を走るのではなく、「走る」に切りかえるだけです。\`drive stop\` を実行するまで（または壁にぶつかるまで）、ロボットは走り続けます。ですから、次の 1 行だけでも、プログラムはすぐに終わるのに、ロボットはフィールドを走っていきます。`,
    ),
    code(DRIVE_ON),
    { kind: 'scene', scene: { stage: TRACK, program: DRIVE_ON, tick: 90 }, caption: caption(
      'Three seconds in: the program ended at once, but ALPHA is still driving towards the goal.',
      '3 秒後。プログラムはとっくに終わっていますが、ALPHA はゴールに向かって走り続けています。',
    ) },
    text(
      `Put two commands one after another, and the robot does them in that order. This one turns a quarter turn to the left, then drives straight on.`,
      `命令を続けて書けば、その順に行います。次のプログラムは、左に 90 度回ってから、まっすぐ走ります。`,
    ),
    code(TURN_THEN_DRIVE),
    { kind: 'scene', scene: { stage: QUARTER, program: TURN_THEN_DRIVE, tick: 75 }, caption: caption(
      'ALPHA started facing right. It turned left, to face the top, and is driving up to the goal.',
      'ALPHA は右を向いて始まりました。左に回って上を向き、ゴールに向かって走っています。',
    ) },
    text(
      `## When a line is wrong

Write a word the game does not know, or forget the spaces in front of a line inside \`loop\`, and the match does not start. The line turns red and the log says what is wrong. That is not a failure: the game is telling you where to look. Fix the line and press RUN again.`,
      `## 書きまちがえたら

知らない言葉を書いたり、\`loop\` の中の行の前の空白を忘れたりすると、試合が始まりません。その行が赤くなり、ログに何がおかしいかが出ます。これは失敗ではなく、ゲームが「ここを見て」と教えてくれているのです。直してもう一度「実行」を押しましょう。`,
    ),
    { kind: 'see', topics: ['moving', 'errors'] },
  ],
};

const TICKS: BookChapter = {
  id: 'ticks',
  title: { en: 'Time goes in ticks', ja: '時間は tick で進む' },
  blocks: [
    text(
      `This chapter is the most important one in Part 1. It is about the biggest difference between a robot's program and the programs you may know, and once it is clear, many puzzling things a robot does make sense.`,
      `この章は、第 1 部で一番大事な章です。ロボットのプログラムと、ふつうのプログラムとの一番大きな違いの話です。ここが分かると、ロボットの「なんで？」という動きの多くに説明がつきます。`,
    ),
    text(
      `## An ordinary program runs at once

Most programs — a calculator, a web page, a game's own code — run from start to end as fast as the computer can: thousands of lines in a blink. Nobody can see the lines go by.

A robot's program is different. It runs **along with the clock of the match**. The match goes forward in small steps called **ticks**: 30 ticks make one second. In each tick, every robot does one thing, then everything moves on to the next tick. Like the pictures of a flip book, the ticks one after another make the match.`,
      `## ふつうのプログラムは一瞬で終わる

電卓、ウェブページ、ゲームそのものを動かすプログラムなど、ふつうのプログラムは、始めから終わりまで、コンピュータにできる限りの速さで進みます。何千行でも一瞬です。行が進んでいくのを目で見ることはできません。

ロボットのプログラムは違います。**試合の時計に合わせて** 進みます。試合は **tick**（ティック）という小さな区切りで進み、30 tick で 1 秒です。1 tick ごとに、どのロボットも 1 つのことをして、全体が次の tick へ進みます。パラパラ漫画の 1 枚 1 枚のように、tick が積み重なって試合になります。`,
    ),
    { kind: 'figure', figure: 'program-vs-tick', caption: caption(
      'The same five lines. An ordinary program runs them all at once; a robot runs them a few at a time, tick by tick.',
      '同じ 5 行でも、ふつうのプログラムは一度に全部進み、ロボットのプログラムは tick ごとに少しずつ進みます。',
    ) },
    text(
      `## One action ends the tick

Which lines run in one tick? The rule is short:

- The lines that make the robot do something — \`turn\`, \`aim\`, \`face\`, \`fire\`, \`guard\`, \`wait\` — are **actions**. When the program runs an action, **that tick is over**. The next tick goes on from the next line.
- The other lines — \`drive\`, \`if\`, \`set\`, \`label\`, \`loop\` and so on — **take no time**. After one of them, the program goes straight on to the next line, in the same tick.

So in each tick, the program runs on until it has done one action. Let us see it with a real program.`,
      `## 行動を 1 つしたら、その tick はおしまい

1 tick で、どこまで行が進むのでしょう。決まりは短いです。

- ロボットに何かをさせる行、つまり \`turn\`、\`aim\`、\`face\`、\`fire\`、\`guard\`、\`wait\` は **行動** です。行動を 1 つ実行すると、**その tick はおしまい** です。次の tick は、その次の行から続きます。
- それ以外の行、つまり \`drive\`、\`if\`、\`set\`、\`label\`、\`loop\` などは **時間がかかりません**。実行したら、同じ tick のまま、すぐ次の行へ進みます。

つまりプログラムは、1 tick ごとに「行動を 1 つするところまで」進みます。本物のプログラムで見てみましょう。`,
    ),
    code(TICK_BY_TICK),
    { kind: 'timeline', timeline: { stage: RANGE, program: TICK_BY_TICK, ticks: 6 }, caption: caption(
      'Which line ran on which tick, taken from a real match. A filled dot is the action that ended the tick; a hollow one took no time.',
      '本物の試合で、どの行がどの tick に実行されたか。塗った丸はその tick を終えた行動、白抜きの丸は時間のかからない行です。',
    ) },
    text(
      `Read the chart column by column:

- **Tick 1**: line 1, \`turn left\`, is an action. The tick ends there.
- **Tick 2**: line 2, \`drive forward\`, takes no time, so the program goes straight on to line 3, \`fire\`, in the same tick. Driving and shooting start together.
- **Tick 3**: line 4, \`wait\`.
- **Tick 4**: line 5, \`turn right\`. That was the last line: the program is over.
- **Tick 5 on**: no line runs any more. But the robot is still driving, because \`drive forward\` switched the driving on and nothing switched it off.`,
      `表を、左の列から順に読んでみます。

- **tick 1**: 1 行目の \`turn left\` は行動です。ここでこの tick は終わります。
- **tick 2**: 2 行目の \`drive forward\` は時間がかからないので、同じ tick のまま 3 行目の \`fire\` まで進みます。走り出すのと撃つのが同時です。
- **tick 3**: 4 行目の \`wait\`。
- **tick 4**: 5 行目の \`turn right\`。これが最後の行なので、プログラムは終わりです。
- **tick 5 から**: もうどの行も実行されません。でもロボットは走り続けています。\`drive forward\` で走りに切りかえ、だれも止めていないからです。`,
    ),
    text(
      `## What happens in one tick

In every tick, all the robots go through the same steps, in the same order:`,
      `## 1 tick の中で起きること

どの tick でも、すべてのロボットが同じ手順を、同じ順番で進みます。`,
    ),
    { kind: 'figure', figure: 'tick-steps', caption: caption(
      'One tick: every robot looks, then every program thinks, then all of them move and shoot at the same moment.',
      '1 tick の流れ。全員が見て、全員のプログラムが考えて、それから全員が同時に動き、撃ちます。',
    ) },
    text(
      `Two things follow from this:

- **What a robot sees is what was there at the start of the tick.** The sensors (the robot's eyes and ears, Chapter 4) are read before the program thinks. If your robot turns in this tick, it sees the result in the next one.
- **Nobody goes first.** All the robots move together. Your robot cannot see what the enemy will do in this tick and dodge it; it can only react in the next.`,
      `ここから、二つのことが分かります。

- **ロボットが見ているのは、その tick の始めの様子です。** センサー（ロボットの目や耳。第 4 章）は、プログラムが考える前に読まれます。この tick で回っても、その結果が見えるのは次の tick です。
- **どちらが先、はありません。** 全員が同時に動きます。敵がこの tick に何をするかを見てから避けることはできず、反応できるのは次の tick です。`,
    ),
    text(
      `## Lines that take many ticks

Some lines are actions that go on for more than one tick. \`turn left 90\` turns 6 degrees a tick (with the standard legs) until it has turned 90: that is 15 ticks, half a second, all on one line.`,
      `## 何 tick もかかる行

行動の中には、1 tick では終わらないものもあります。\`turn left 90\` は、1 tick に 6 度ずつ（標準の脚のとき）、90 度回り切るまで回ります。15 tick、つまり 0.5 秒のあいだ、ずっとこの 1 行です。`,
    ),
    code(LONG_TURN),
    { kind: 'timeline', timeline: { stage: RANGE, program: LONG_TURN, ticks: 17 }, caption: caption(
      'Line 1 is still running for 15 ticks. Only then does the program get to fire.',
      '1 行目が 15 tick のあいだ続き、そのあとでやっと fire に進みます。',
    ) },
    text(
      `\`face enemy\` is another: it turns until the robot faces the enemy. With the enemy right behind, that is half a turn — 30 ticks, a whole second.

**While a line like this runs, the program stays on it.** For that second the robot cannot shoot, cannot guard, and does not even look at whether a bullet is coming. Usually that is fine. But in a close fight, a second is long.

\`turn enemy\` turns for one tick only. Put it in a \`loop\` with other lines, and the robot can check things on every tick while it turns a little at a time. Which to use is one of the first choices that make a robot strong or weak; Chapter 5 comes back to it.`,
      `\`face enemy\` も同じ仲間で、敵の方を向くまで回り続けます。敵が真後ろなら半回転で、30 tick、まるまる 1 秒かかります。

**こういう行が続いている間、プログラムはその行から先へ進みません。** その 1 秒のあいだ、ロボットは撃つことも、身構えることもできず、弾が飛んできているかを確かめることすらしません。たいていはそれで困りません。でも近くで撃ち合っているときの 1 秒は長いのです。

\`turn enemy\` は 1 tick だけ回ります。ほかの行と一緒に \`loop\` に入れれば、少しずつ回りながら、tick ごとにいろいろ確かめられます。どちらを使うかは、ロボットの強さを分ける最初の選択の一つです。第 5 章でもう一度取り上げます。`,
    ),
    { kind: 'scene', scene: { stage: BEHIND, program: FACE_BEHIND, tick: 15 }, caption: caption(
      'Half a second into face enemy: ALPHA has turned a quarter of the way round to the target behind it, and can do nothing else until it is done.',
      'face enemy の途中（0.5 秒後）。ALPHA は後ろの的へ向かって 4 分の 1 回ったところで、回り切るまでほかのことはできません。',
    ) },
    text(
      `## A round of a loop

How long does one round of a \`loop\` take? It depends on how many actions are in it. \`loop\` itself takes no time; the actions inside take a tick each.`,
      `## loop の 1 周にかかる時間

\`loop\` の 1 周には、どれだけ時間がかかるのでしょう。中にある行動の数で決まります。\`loop\` の行そのものは時間がかからず、中の行動が 1 つにつき 1 tick かかります。`,
    ),
    code(TWO_TICK_LOOP),
    { kind: 'timeline', timeline: { stage: RANGE, program: TWO_TICK_LOOP, ticks: 6 }, caption: caption(
      'Two actions in the loop, so a round takes two ticks: turn on one, fire on the next.',
      'loop の中に行動が 2 つあるので、1 周に 2 tick。回る tick と撃つ tick が交互に来ます。',
    ) },
    text(
      `Now the other way round: a \`loop\` with **no action** in it.`,
      `では反対に、中に **行動がない** \`loop\` はどうなるでしょう。`,
    ),
    code(NO_ACTION_LOOP),
    text(
      `\`drive forward\` takes no time, so the program never gets to the end of the tick: it goes round and round the loop within one tick. To stop that, the game counts the lines: after 1000 lines with no action, the robot does nothing for that tick, and the log says "too many lines without an action". (Here the robot does still drive, since the driving was switched on.)

So remember: **every \`loop\` needs an action in it** — \`wait\` will do if there is nothing else to do.`,
      `\`drive forward\` は時間がかからないので、プログラムはいつまでも tick の終わりにたどり着けず、1 tick の中で loop を回り続けます。これを止めるため、ゲームは行を数えています。行動のないまま 1000 行進んだら、その tick はロボットは何もせず、ログに「行動のない行が多すぎる」と出ます。（この例では、走りには切りかえてあるので、走ることだけは続けます。）

ですから **\`loop\` の中には必ず行動を入れる** と覚えておきましょう。ほかにすることがなければ \`wait\` で構いません。`,
    ),
    text(
      `## A shot takes time to land

Time matters to bullets too. A bullet flies 400 a second, so a target 350 away is hit about 0.8 seconds (24 ticks) after \`fire\`. In that time a moving enemy can be somewhere else. And a gun needs time between shots (0.8 seconds with the standard gun): a \`fire\` before it is ready does not shoot, but it still uses up the tick.`,
      `## 撃ってから当たるまでにも時間がかかる

弾にも時間がかかります。弾は 1 秒に 400 進むので、350 離れた的に当たるのは、\`fire\` から約 0.8 秒（24 tick）後です。その間に、動いている敵は別の場所へ行っているかもしれません。また、銃は次の弾まで間があきます（標準の銃で 0.8 秒）。撃てるようになる前の \`fire\` は弾が出ませんが、その tick は使ってしまいます。`,
    ),
    text(
      `## Seeing ticks in the game

The DEBUG button plays a match so that you can follow it. The yellow line is the one that runs next; the pale green lines are the ones that ran in the tick being shown. The \`1▶\` button goes on one line at a time while debugging, and one tick at a time otherwise. Going through a match tick by tick with your own program is the best way to get used to all this.`,
      `## ゲームの中で tick を見る

「デバッグ」ボタンで試合をすると、プログラムの進み方を追いかけられます。黄色の行は次に実行する行、薄い緑の行は表示中の tick で実行した行です。\`1▶\` ボタンは、デバッグ中は 1 行ずつ、それ以外では 1 tick ずつ進みます。自分のプログラムで試合を 1 tick ずつ進めてみるのが、慣れる一番の方法です。`,
    ),
    { kind: 'shot', shot: 'debug', caption: caption(
      'Debugging: the match goes on as the program is followed line by line. The yellow line runs next; the green lines ran in this tick.',
      'デバッグ中の画面。プログラムを 1 行ずつ追うのに合わせて試合が進みます。黄色の行が次に実行する行、緑の行がこの tick で実行した行です。',
    ) },
    text(
      `## In short

- The match goes in ticks: 30 a second.
- In each tick, the program runs on until it does one action, and the tick is over.
- \`drive\`, \`if\`, \`set\`, \`label\` and \`loop\` take no time.
- \`drive\` is a setting: the robot keeps driving while it does other actions.
- Some lines (\`turn left 90\`, \`face enemy\`) take many ticks, and the program does nothing else meanwhile.
- Every \`loop\` needs an action in it.
- What a robot sees is what was there at the start of the tick.`,
      `## まとめ

- 試合は tick で進む。1 秒は 30 tick。
- 1 tick ごとに、プログラムは行動を 1 つするところまで進み、その tick は終わる。
- \`drive\`、\`if\`、\`set\`、\`label\`、\`loop\` は時間がかからない。
- \`drive\` は設定。ほかの行動をしている間も走り続ける。
- \`turn left 90\` や \`face enemy\` のように何 tick もかかる行があり、その間はほかのことをしない。
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
