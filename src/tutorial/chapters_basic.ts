// Chapters 0 to 3 of the tutorial: what a program is, moving, and finding the enemy.
// Made from the text by a script: edit it here, keeping the markup (see renderMarkup).
import { ANGLE, BEHIND, CORNER, DUEL, HIDDEN, MOVING, RANGE, TRACK } from './stages';
import type { Chapter } from './types';

export const BASIC_CHAPTERS: readonly Chapter[] = [
{
  id: 'intro',
  title: { en: `Getting started`, ja: `はじめに` },
  steps: [
  {
    id: 'welcome',
    title: { en: `Welcome`, ja: `ようこそ` },
    body: { en: `RoboScript is a game where you **decide how a robot moves by writing a program**, and then send it into battle.

You write the program of the green robot, **ALPHA**. A program is a list of instructions for the computer, written in the order they should be carried out. ALPHA drives, turns and shoots exactly as your program tells it.

Its opponent is the orange robot, **BRAVO**. In this tutorial BRAVO is a target to practise on, or a sparring partner.

You do not need to have written a program before. We go one small step at a time.

- Read the explanation, then do the task under "Try it".
- When the task is done, "Cleared!" appears and **Next** can be pressed.
- If you get stuck, press **Hint**. Once you have seen every hint, you can see the **answer** too.

When you are ready, press **Next**.`, ja: `RoboScript は、**ロボットの動きをプログラムで決めて戦わせる**ゲームです。

あなたが書くのは、緑のロボット **ALPHA** のプログラムです。プログラムとは「コンピュータにしてほしいことを、順番に書いた手順書」のことです。ALPHA は、あなたの書いた手順書のとおりに走ったり、曲がったり、撃ったりします。

相手はオレンジのロボット **BRAVO** です。このチュートリアルでは、BRAVO は練習用の「的（まと）」や練習相手になります。

プログラムを書いたことがなくても大丈夫です。1 つずつ順番に進めます。

- 説明を読んで、「やってみよう」の課題に取り組みます。
- 課題ができると「クリア！」と出て、**次へ** が押せるようになります。
- 困ったら **ヒント** を押してください。ヒントを全部見ると、**答え** も見られます。

準備ができたら **次へ** を押しましょう。` },
    check: { kind: 'read' },
  },
  {
    id: 'screen',
    title: { en: `The screen`, ja: `画面の見方` },
    body: { en: `Here are the main parts of the screen (they are lit up).

- **The editor** (top middle): you write ALPHA's program here.
- **The battle view** (top right): where the robots fight, seen from above.
- **RUN** (in the top bar): starts a match with the program you wrote.
- **The log** (bottom left): what happens in the match, and any mistakes in the program, are written here.

There are also panels called "Inspector" and "Watch": we will come to them when we need them.`, ja: `画面の主な場所を紹介します（光っているところです）。

- **エディタ**（真ん中の上）: ここに ALPHA のプログラムを書きます。
- **戦闘画面**（右の上）: ロボットが戦う場所です。上から見た図になっています。
- **実行** ボタン（上のバー）: 書いたプログラムで試合を始めます。
- **ログ**（左下）: 試合で起きたことや、プログラムの間違いが書き出されます。

ほかにも「状態」や「ウォッチ」という欄がありますが、使うときにまた説明します。` },
    check: { kind: 'read' },
    highlight: ["code", "battle-frame", "run", "log-rows"],
  },
  {
    id: 'first-run',
    title: { en: `Run a program`, ja: `プログラムを実行する` },
    body: { en: `The editor already holds a short program:

\`\`\`
loop
    fire
\`\`\`

Do not worry about what it means yet. Let us just make it go. Making a program go is called **running** it.

When the match starts, ALPHA (green) shoots in the battle view. On the left is BRAVO (orange): in this step it is a target that does not move.`, ja: `エディタには、もう短いプログラムが入っています。

\`\`\`
loop
    fire
\`\`\`

意味はまだ分からなくて大丈夫です。まずは動かしてみましょう。プログラムを動かすことを「**実行する**」といいます。

試合が始まると、戦闘画面で ALPHA（緑）が弾を撃ちます。左にいるのが BRAVO（オレンジ）で、このステップでは動かない的です。` },
    task: { en: `Press **RUN** in the top bar and watch the match.`, ja: `上のバーの **実行** を押して、試合を見てみましょう。` },
    start: `loop
    fire
`,
    stage: RANGE,
    check: { kind: 'match', goal: { kind: 'run' } },
    highlight: ["run"],
  },
  ],
},
{
  id: 'first-program',
  title: { en: `Your first program`, ja: `最初のプログラム` },
  steps: [
  {
    id: 'fire',
    title: { en: `One instruction`, ja: `命令を 1 つ書く` },
    body: { en: `A program is made of **instructions** put one after another. An instruction is a set word that stands for something you want the robot to do.

The first instruction is **\`fire\`**. When ALPHA comes to \`fire\`, it shoots one bullet the way its turret (the gun on top of the robot) is pointing.

ALPHA starts out facing the target, so \`fire\` alone will hit it.

A line in the editor that starts with \`#\` is a **comment**: a note for people to read. It does nothing in the program, and you may delete it.`, ja: `プログラムは「**命令**」を並べて作ります。命令とは、ロボットにしてほしいことを表す決まった言葉です。

最初の命令は **\`fire\`**（ファイア、「撃て」）です。\`fire\` と書くと、ALPHA は砲塔（ロボットの上の銃）が向いている方へ弾を 1 発撃ちます。

ALPHA は最初から的の方を向いているので、\`fire\` だけで当たります。

エディタの \`#\` で始まる行は「**コメント**」です。人が読むためのメモで、プログラムとしては何もしません。消してもかまいません。` },
    task: { en: `Write \`fire\` in the editor, run it, and hit the target once.`, ja: `エディタに \`fire\` と書いて実行し、的に 1 発当てましょう。` },
    hints: [
      { en: `Write \`fire\` on an empty line under the comment, in small letters.`, ja: `コメントの行の下の、空いている行に \`fire\` と書きます。小文字の半角で書きます。` },
      { en: `Then press **RUN** in the top bar.`, ja: `書いたら上のバーの **実行** を押します。` },
    ],
    answer: `fire
`,
    start: `# Write your program below.
`,
    stage: RANGE,
    check: { kind: 'match', goal: { kind: 'hits', count: 1 }, uses: ['fire'] },
  },
  {
    id: 'ticks',
    title: { en: `How a program goes`, ja: `プログラムの進み方` },
    body: { en: `A program goes **from the top line down**, one line after another. When it gets past the last line, the program has ended and the robot does nothing more.

Time in a match goes in short steps called **ticks**. One tick is 1/30 of a second. A robot can do **one action a tick**. \`fire\` is an action, so running the line \`fire\` takes one tick.

One thing to watch: after one shot, the gun needs **0.8 seconds** before it can fire again. So

\`\`\`
fire
fire
fire
\`\`\`

gives only one bullet. The three lines are over in three ticks (0.1 seconds), and the gun is not ready again in that time.

If you are curious, go back a step and try it. In the next step we learn how to get round this.`, ja: `プログラムは**上の行から順番に**進みます。一番下の行まで進むとプログラムは終わり、ロボットはそれ以上何もしません。

試合の時間は「**tick**（ティック）」という短い区切りで進みます。1 tick は 1/30 秒です。ロボットは **1 tick に 1 つだけ行動** できます。\`fire\` も 1 つの行動なので、\`fire\` の行を実行すると 1 tick たちます。

ここで 1 つ注意があります。銃は、1 発撃つと次に撃てるまで **0.8 秒** かかります。だから

\`\`\`
fire
fire
fire
\`\`\`

と 3 行並べても、弾は 1 発しか出ません。3 行は 3 tick（0.1 秒）で終わってしまい、そのあいだに銃の準備ができないからです。

気になったら、前のステップに戻って試してみてください。次のステップで、これを解決する方法を学びます。` },
    check: { kind: 'read' },
  },
  {
    id: 'loop',
    title: { en: `Repeat with loop`, ja: `loop で繰り返す` },
    body: { en: `When you want something done again and again, use **\`loop\`**.

\`\`\`
loop
    fire
\`\`\`

The lines written under \`loop\` **with space at the start** are what is repeated. That space at the start of a line is called **indentation**. Indent with four spaces. If you type \`loop\` and press Enter in the editor, the next line is indented for you.

This program repeats "shoot" for ever. While the gun is not ready, \`fire\` does nothing. But it shoots the moment the gun is ready, so the robot fires once every 0.8 seconds.

The target has 200 hit points (**HP**), and each hit takes away 20. Ten hits destroy it.`, ja: `同じことを何度もしてほしいときは **\`loop\`**（ループ、「繰り返し」）を使います。

\`\`\`
loop
    fire
\`\`\`

\`loop\` の下に、**行の先頭を空けて**書いた行が、繰り返す中身です。この行の先頭の空白を「**字下げ**（インデント）」といいます。字下げは半角の空白 4 つです。エディタで \`loop\` と書いて Enter を押すと、自動で字下げされます。

このプログラムは「撃つ」をずっと繰り返します。銃の準備ができていないうちは、\`fire\` を実行しても何も起きません。それでも準備ができたとたんに撃つので、0.8 秒ごとに 1 発ずつ撃ち続けます。

的には体力（**HP**）が 200 あり、1 発で 20 減ります。10 発当てると的は壊れます。` },
    task: { en: `Use \`loop\` to keep firing, and destroy the target.`, ja: `\`loop\` を使って撃ち続け、的を壊しましょう。` },
    hints: [
      { en: `Write \`loop\` on the first line, then four spaces and \`fire\` on the second.`, ja: `1 行目に \`loop\`、2 行目に空白 4 つのあと \`fire\` と書きます。` },
    ],
    answer: `loop
    fire
`,
    stage: RANGE,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['loop', 'fire'] },
  },
  {
    id: 'indent',
    title: { en: `Fix a mistake`, ja: `間違いを直す` },
    body: { en: `When a program has a mistake, running it does not start a match. Instead

- the line with the mistake turns **red**, and
- the **log** shows \`ERROR\` and what is wrong.

The editor now holds a program with a mistake put in on purpose. The \`fire\` line is not indented, so \`loop\` has nothing to repeat.

Run it once to see what the log says. Then put it right.`, ja: `プログラムに間違いがあると、実行しても試合は始まりません。かわりに

- 間違いのある行が**赤く**なり、
- **ログ**に \`ERROR\` と、何が間違っているかが出ます。

エディタには、わざと間違えたプログラムを入れました。\`fire\` の行に字下げがないので、\`loop\` が何を繰り返せばよいか分かりません。

まず一度実行して、ログに何と出るか見てみましょう。それから直します。` },
    task: { en: `Fix the mistake, run the program, and destroy the target.`, ja: `間違いを直して実行し、的を壊しましょう。` },
    hints: [
      { en: `The log says "Expected indented block": the line under \`loop\` has to be indented.`, ja: `ログには「字下げしたブロックが必要」と出ます。\`loop\` の下の行は字下げが必要です。` },
      { en: `Put the cursor before \`fire\` and type four spaces.`, ja: `\`fire\` の前にカーソルを置いて、空白を 4 つ入れます。` },
    ],
    answer: `loop
    fire
`,
    start: `loop
fire
`,
    stage: RANGE,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['loop', 'fire'] },
    highlight: ["log-rows"],
  },
  ],
},
{
  id: 'moving',
  title: { en: `Moving`, ja: `動かす` },
  steps: [
  {
    id: 'drive',
    title: { en: `Drive forward`, ja: `前へ走る` },
    body: { en: `The instruction that makes a robot drive is **\`drive\`**.

- \`drive forward\` … drive forwards
- \`drive backward\` … drive backwards
- \`drive stop\` … stop

\`drive\` is a little different from other instructions: it is a **setting** for **how the robot drives from now on**. Setting it takes no time. Once you set \`drive forward\`, the robot keeps driving until \`drive stop\`. It keeps driving even after the program has ended.

A robot can only move the way it is facing (like a tank).

On the right of the battle view there is a ring: the **goal**. ALPHA is facing it.`, ja: `ロボットを走らせる命令は **\`drive\`**（ドライブ）です。

- \`drive forward\` … 前へ走る
- \`drive backward\` … 後ろへ走る
- \`drive stop\` … 止まる

\`drive\` は少し変わった命令で、「**これからどう走るか**」を決める**設定**です。設定するだけなので時間はかかりません。一度 \`drive forward\` にすると、\`drive stop\` にするまで走り続けます。プログラムが終わっても走り続けます。

ロボットは向いている方にしか進めません（戦車のような動き方です）。

戦闘画面の右に、輪の形の**ゴール**があります。ALPHA はゴールの方を向いています。` },
    task: { en: `Drive ALPHA to the goal.`, ja: `ALPHA をゴールまで走らせましょう。` },
    hints: [
      { en: `The one line \`drive forward\` is enough.`, ja: `\`drive forward\` の 1 行だけで行けます。` },
    ],
    answer: `drive forward
`,
    start: `# Drive to the goal (the ring on the right).
`,
    stage: TRACK,
    check: { kind: 'match', goal: { kind: 'reach' }, uses: ['drive'] },
  },
  {
    id: 'turn',
    title: { en: `Turn, then drive`, ja: `曲がってから走る` },
    body: { en: `The instruction that changes the way a robot faces is **\`turn\`**.

- \`turn left\` … turn to the left
- \`turn right\` … turn to the right

\`turn\` is an **action**, so it takes one tick, and each time it turns **6 degrees** (180 degrees a second).

This time the goal is **30 degrees to the left** of where ALPHA faces. How many \`turn left\` does it take to turn 30 degrees? Turn first, then drive with \`drive forward\`.

Writing the same line several times is perfectly fine.`, ja: `向きを変える命令は **\`turn\`**（ターン）です。

- \`turn left\` … 左に回る
- \`turn right\` … 右に回る

\`turn\` は**行動**なので 1 tick かかり、1 回で **6 度** 回ります（1 秒で 180 度）。

今度のゴールは、ALPHA の正面から **左に 30 度** の方向にあります。30 度回るには、\`turn left\` を何回すればよいでしょう？ 回ってから \`drive forward\` で走ります。

同じ行を何行も書くのは、まったく問題ありません。` },
    task: { en: `Turn 30 degrees to the left, then drive to the goal.`, ja: `左に 30 度回ってから走り、ゴールに着きましょう。` },
    hints: [
      { en: `30 ÷ 6 = 5, so \`turn left\` five times.`, ja: `30 ÷ 6 = 5 なので、\`turn left\` を 5 回です。` },
      { en: `Write \`turn left\` on five lines, and \`drive forward\` under them.`, ja: `\`turn left\` を 5 行書き、その下に \`drive forward\` を書きます。` },
    ],
    answer: `turn left
turn left
turn left
turn left
turn left
drive forward
`,
    start: `# Turn 30 degrees to the left, then drive to the goal.
`,
    stage: ANGLE,
    check: { kind: 'match', goal: { kind: 'reach' }, uses: ['turn', 'drive'] },
  },
  {
    id: 'blocked',
    title: { en: `Turn at a wall`, ja: `壁で曲がる` },
    body: { en: `A robot can find out about what is around it. The words that hold what it finds out are called **sensors**.

**\`blocked\`** is a sensor that is **true** when there is a wall or an obstacle right in front, so the robot cannot go forwards, and **false** otherwise.

To use a sensor, use **\`if\`**.

\`\`\`
if blocked
    turn right
\`\`\`

This means "**if** the way ahead is blocked, turn right". The indented lines under \`if\` run only when the condition is true.

Inside a \`loop\`, it keeps checking. But a \`loop\` must always **hold one action that takes time**. \`drive\` and \`if\` take no time, so put in **\`wait\`**, which does nothing for one tick.

This time the goal is in the top right corner. ALPHA is facing the top wall.`, ja: `ロボットは、まわりの様子を調べることができます。調べた結果が入っている言葉を「**センサー**」といいます。

**\`blocked\`**（ブロックト）は、「すぐ前に壁や障害物があって進めない」ときに**正しい**（はい）、そうでなければ**正しくない**（いいえ）になるセンサーです。

センサーを使うには **\`if\`**（イフ、「もし」）を使います。

\`\`\`
if blocked
    turn right
\`\`\`

これは「**もし** 前がふさがっていたら、右に回る」という意味です。\`if\` の下の字下げした行は、条件が正しいときだけ実行されます。

\`loop\` の中で使うと、ずっと調べ続けられます。ただし \`loop\` の中には、**必ず時間のかかる行動を 1 つ入れます**。\`drive\` も \`if\` も時間がかからないので、何もせずに 1 tick 待つ **\`wait\`**（ウェイト）を入れておきます。

今度のゴールは右上の角です。ALPHA は上の壁の方を向いています。` },
    task: { en: `Drive forward, turn right at walls, and get to the goal in the top right.`, ja: `前へ走り、壁に当たったら右に回るプログラムで、右上のゴールまで行きましょう。` },
    hints: [
      { en: `Inside a \`loop\`, write \`drive forward\`, then \`if blocked\` with \`turn right\` under it, and \`wait\` last.`, ja: `\`loop\` の中に、\`drive forward\`、\`if blocked\` とその下の \`turn right\`、最後に \`wait\` を書きます。` },
      { en: `Indent \`turn right\` four more spaces than \`if blocked\` (eight spaces in all).`, ja: `\`turn right\` は \`if blocked\` よりさらに 4 つ右に字下げします（行の先頭に空白 8 つ）。` },
    ],
    answer: `loop
    drive forward
    if blocked
        turn right
    wait
`,
    start: `# Drive forward, and turn right when a wall is in the way.
loop
    drive forward
`,
    stage: CORNER,
    check: { kind: 'match', goal: { kind: 'reach' }, uses: ['loop', 'blocked'] },
  },
  ],
},
{
  id: 'enemy',
  title: { en: `Finding the enemy`, ja: `敵を見る` },
  steps: [
  {
    id: 'turn-enemy',
    title: { en: `Turn to the enemy`, ja: `敵の方を向く` },
    body: { en: `Besides \`left\` and \`right\`, \`turn\` has **\`turn enemy\`**: it turns **towards the enemy**. You do not have to work out where the enemy is: the robot turns the right way by itself.

This time the target is **behind** ALPHA. The program in the editor only shoots straight ahead, so it misses.

With \`turn enemy\` and \`fire\` taking turns in a \`loop\`, the robot turns a little further towards the enemy each time, and shoots whenever its gun is ready.`, ja: `\`turn\` には、\`left\` と \`right\` のほかに **\`turn enemy\`** もあります。**敵の方へ向かって**回る命令です。敵の場所を自分で計算しなくても、ロボットが向きを合わせてくれます。

今度の的は ALPHA の**後ろ**にいます。エディタのプログラムは前に撃っているだけなので、当たりません。

\`loop\` の中で \`turn enemy\` と \`fire\` を交互に実行すると、少しずつ敵の方を向きながら、銃の準備ができるたびに撃ちます。` },
    task: { en: `Use \`turn enemy\` to face the target behind, and destroy it.`, ja: `\`turn enemy\` を使って後ろの的の方を向き、的を壊しましょう。` },
    hints: [
      { en: `Add a line \`turn enemy\` above \`fire\`, inside the \`loop\`.`, ja: `\`loop\` の中の \`fire\` の上に、\`turn enemy\` の行を足します。` },
    ],
    answer: `loop
    turn enemy
    fire
`,
    start: `loop
    fire
`,
    stage: BEHIND,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['enemy'] },
  },
  {
    id: 'aim',
    title: { en: `Aim the turret`, ja: `砲塔で狙う` },
    body: { en: `The gun on top of the robot, the **turret**, can turn apart from the body. The instruction that turns it is **\`aim\`**.

- \`aim enemy\` … turn the turret towards the enemy
- \`aim left\` / \`aim right\` … turn the turret left / right

The turret turns faster than the body (270 degrees a second). Turning the turret does not turn the body, so a robot can drive one way and shoot another.

This time the target **moves**. Try aiming with \`aim enemy\` instead of \`turn enemy\`.`, ja: `ロボットの上の銃（**砲塔**）は、車体とは別に回すことができます。砲塔を回す命令は **\`aim\`**（エイム、「狙う」）です。

- \`aim enemy\` … 砲塔を敵の方へ回す
- \`aim left\` / \`aim right\` … 砲塔を左 / 右へ回す

砲塔は車体より速く回ります（1 秒で 270 度）。砲塔を回しても車体の向きは変わらないので、走りながら別の方向を撃つこともできます。

今度の的は**動きます**。\`turn enemy\` のかわりに \`aim enemy\` で狙ってみましょう。` },
    task: { en: `Aim with \`aim enemy\` and hit the moving target three times.`, ja: `\`aim enemy\` で狙って、動く的に 3 発当てましょう。` },
    hints: [
      { en: `Change the line \`turn enemy\` to \`aim enemy\`.`, ja: `\`turn enemy\` の行を \`aim enemy\` に書きかえます。` },
    ],
    answer: `loop
    aim enemy
    fire
`,
    stage: MOVING,
    check: { kind: 'match', goal: { kind: 'hits', count: 3 }, uses: ['aim'] },
  },
  {
    id: 'visible',
    title: { en: `If you can see it`, ja: `見えたら撃つ` },
    body: { en: `A robot cannot see an enemy on the other side of an obstacle. **\`enemy_visible\`** is a sensor that is **true while the enemy can be seen**.

\`if\` can have an **\`else\`** ("otherwise"):

\`\`\`
if enemy_visible
    aim enemy
    fire
else
    drive forward
    wait
\`\`\`

This means "**if** the enemy can be seen, aim and shoot; **otherwise**, drive forward". Write \`else\` as far in as its \`if\`.

This time the target hides behind a big obstacle. Drive until it can be seen, then shoot. Stop with \`drive stop\` once it is in sight: a shot fired on the move scatters a lot.`, ja: `ロボットは、障害物の向こうにいる敵を見ることができません。**\`enemy_visible\`**（エネミー・ビジブル）は、**敵が見えているとき正しい**センサーです。

\`if\` には **\`else\`**（エルス、「そうでなければ」）を付けられます。

\`\`\`
if enemy_visible
    aim enemy
    fire
else
    drive forward
    wait
\`\`\`

「**もし** 敵が見えていたら狙って撃つ。**そうでなければ** 前へ走る」という意味です。\`else\` は \`if\` と同じ深さに書きます。

今度の的は、大きな障害物の陰に隠れています。見えるところまで走ってから撃ちましょう。見えたら \`drive stop\` で止まると、弾がよく当たります。走りながら撃つと、弾が大きくばらけるからです。` },
    task: { en: `Drive while the target cannot be seen; once it can, stop and shoot, and destroy it.`, ja: `見えないあいだは走り、見えたら止まって撃って、的を壊しましょう。` },
    hints: [
      { en: `Under \`if enemy_visible\`: stop, aim, fire. Under \`else\`: drive forward, wait.`, ja: `\`if enemy_visible\` の下に「止まる・狙う・撃つ」、\`else\` の下に「前へ走る・待つ」を書きます。` },
      { en: `Stopping is \`drive stop\`.`, ja: `止まるのは \`drive stop\` です。` },
    ],
    answer: `loop
    if enemy_visible
        drive stop
        aim enemy
        fire
    else
        drive forward
        wait
`,
    start: `# Drive until the target can be seen, then stop and shoot.
loop
    if enemy_visible
        aim enemy
        fire
`,
    stage: HIDDEN,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['enemy_visible', 'else'] },
  },
  {
    id: 'sparring',
    title: { en: `A first match`, ja: `はじめての試合` },
    body: { en: `At last, a match against an opponent that shoots back. BRAVO is a sparring robot: it looks for ALPHA and shoots, but slowly.

Put together what you have learnt so far.

- When the enemy can be seen: stop, aim, shoot.
- When it cannot: drive to look for it, turning when something is in the way (as in "Turn at a wall" in chapter 2).

There is an obstacle in the middle, so BRAVO cannot be seen at first.

The first to bring the other's HP to 0 wins. If you lose, try again as often as you like: change the program a little, run it, and compare the results.`, ja: `いよいよ、撃ち返してくる相手との試合です。BRAVO は練習相手のロボットです。ALPHA を探して撃ってきますが、撃つペースはゆっくりです。

ここまでに学んだことを組み合わせましょう。

- 敵が見えたら、止まって、狙って、撃つ。
- 見えなければ、走って探す。障害物にぶつかったら曲がる（2 章の「壁で曲がる」と同じです）。

真ん中に障害物があるので、最初は BRAVO が見えません。

先に相手の HP を 0 にしたほうが勝ちです。負けても何度でもやり直せます。プログラムを少し変えては実行して、結果を比べてみてください。` },
    task: { en: `Beat BRAVO, the sparring partner.`, ja: `練習相手の BRAVO に勝ちましょう。` },
    hints: [
      { en: `The program of the last step works nearly as it is.`, ja: `前のステップのプログラムが、ほとんどそのまま使えます。` },
      { en: `Under \`else\`, put what you wrote in chapter 2: drive forward, turn if blocked, wait.`, ja: `\`else\` の下に、2 章の「前へ走る・ふさがったら曲がる・待つ」を入れます。` },
    ],
    answer: `loop
    if enemy_visible
        drive stop
        aim enemy
        fire
    else
        drive forward
        if blocked
            turn left
        wait
`,
    stage: DUEL,
    check: { kind: 'match', goal: { kind: 'win' } },
  },
  ],
},
];
