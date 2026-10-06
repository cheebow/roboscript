// Chapters 4 to 9 of the tutorial: numbers, functions, debugging, defending, parts, and what next.
// Made from the text by a script: edit it here, keeping the markup (see renderMarkup).
import { FAR, FAR_HIDDEN, QUARTER, SHELTER, SHOT_AT, SNIPE } from './stages';
import type { Chapter } from './types';

export const ADVANCED_CHAPTERS: readonly Chapter[] = [
{
  id: 'numbers',
  title: { en: `Numbers and comparing`, ja: `数と比べる` },
  steps: [
  {
    id: 'distance',
    title: { en: `How far is the enemy?`, ja: `敵までの距離` },
    body: { en: `Some sensors hold a **number** rather than true or false.

**\`enemy_distance\`** is **how far away the enemy is**. The field is 1000 wide and 600 high, and a robot's radius is 16.

Numbers can be **compared**:

- \`enemy_distance < 350\` … less than 350 (close)
- \`enemy_distance > 350\` … more than 350 (far)
- \`<=\` at most, \`>=\` at least, \`==\` equal, \`!=\` not equal

This time the target is **far off** (700 away). A bullet only reaches **400**, so with the program in the editor the bullets vanish on the way. Drive closer, then shoot.`, ja: `センサーには、正しい・正しくないだけでなく、**数** が入っているものもあります。

**\`enemy_distance\`**（エネミー・ディスタンス）は、**敵までの距離** です。フィールドは横 1000、縦 600 の広さで、ロボットの半径は 16 です。

数は **比べる** ことができます。

- \`enemy_distance < 350\` … 350 より小さい（近い）
- \`enemy_distance > 350\` … 350 より大きい（遠い）
- \`<=\` 以下、\`>=\` 以上、\`==\` 等しい、\`!=\` 等しくない

今度の的は **遠く**（700 先）にいます。銃の弾が届くのは **400 まで** なので、エディタのプログラムでは弾が途中で消えてしまいます。近づいてから撃ちましょう。` },
    task: { en: `Drive forward until the enemy is closer than 350, then stop and shoot, and destroy the target.`, ja: `敵までの距離が 350 より近くなるまで前へ走り、近づいたら止まって撃って、的を壊しましょう。` },
    hints: [
      { en: `Under \`if enemy_distance < 350\`: stop and fire. Under \`else\`: drive forward and wait.`, ja: `\`if enemy_distance < 350\` の下に「止まる・撃つ」、\`else\` の下に「前へ走る・待つ」です。` },
    ],
    answer: `loop
    if enemy_distance < 350
        drive stop
        fire
    else
        drive forward
        wait
`,
    start: `# The target is 700 away, but a bullet only reaches 400.
loop
    fire
`,
    stage: FAR,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['enemy_distance'] },
  },
  {
    id: 'range',
    title: { en: `Calculating`, ja: `計算する` },
    body: { en: `How far a bullet reaches (the **range**) depends on the parts. **\`weapon_range\`** is a sensor that holds the range of your own gun (400 for now).

A program can also **calculate**:

- \`+\` add, \`-\` subtract, \`*\` multiply, \`/\` divide
- \`( )\` to work something out first

For example, \`weapon_range - 50\` is "50 short of the range". From the very edge of the range, a shot may fall short of a moving enemy, so it is safer to shoot from a little closer.

Using this instead of the number 350 makes a program that still works if you change your gun later.`, ja: `銃の弾が届く距離（**射程**）は、パーツによって変わります。**\`weapon_range\`**（ウェポン・レンジ）は、自分の銃の射程が入ったセンサーです（今は 400）。

プログラムでは **計算** もできます。

- \`+\` たす、\`-\` ひく、\`*\` かける、\`/\` わる
- \`( )\` で先に計算するところをまとめる

たとえば \`weapon_range - 50\` は「射程より 50 手前」です。射程ぎりぎりから撃つと、動く敵には届かないことがあります。少し手前から撃つほうが確実です。

数字の 350 のかわりにこれを使えば、あとで銃を替えても、そのまま使えるプログラムになります。` },
    task: { en: `Use \`weapon_range - 50\` instead of 350, and destroy the target.`, ja: `350 のかわりに \`weapon_range - 50\` を使って、的を壊しましょう。` },
    hints: [
      { en: `Change it to \`if enemy_distance < weapon_range - 50\`.`, ja: `\`if enemy_distance < weapon_range - 50\` と書きかえます。` },
    ],
    answer: `loop
    if enemy_distance < weapon_range - 50
        drive stop
        fire
    else
        drive forward
        wait
`,
    stage: FAR,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['weapon_range'] },
  },
  {
    id: 'variables',
    title: { en: `Variables: boxes for numbers`, ja: `変数: 数を入れる箱` },
    body: { en: `A **variable** is a **named box to keep a number in**. Put a number in with **\`set\`**:

\`\`\`
set n = 0
set n = n + 1
\`\`\`

The first line puts 0 in the box \`n\`; the second puts back into \`n\` "what is in \`n\`, plus 1". So \`n\` goes up by 1. You choose the name (letters, digits and \`_\`, starting with a letter).

One more word: **\`while\`**. \`loop\` repeats for ever; \`while\` repeats **only as long as its condition is true**.

\`\`\`
set n = 0
while n < 15
    turn left
    set n = n + 1
\`\`\`

This means "while \`n\` is less than 15, turn left and add 1 to \`n\`", so it does \`turn left\` **exactly 15 times**: 15 × 6 = 90 degrees.

This time the goal is **90 degrees to the left** of ALPHA (straight up). Instead of writing \`turn left\` on 15 lines as in chapter 2, count the turns with \`while\`.

(In fact \`turn left 90\` turns this far in one line. Here, for practice with variables, count the turns.)`, ja: `**変数** は、数を入れておく **名前の付いた箱** です。**\`set\`**（セット）で数を入れます。

\`\`\`
set n = 0
set n = n + 1
\`\`\`

1 行目で箱 \`n\` に 0 を入れ、2 行目で「\`n\` の中身に 1 をたした数」を \`n\` に入れ直します。つまり \`n\` が 1 増えます。名前は自分で決められます（英字で始まる半角の英数字と \`_\`）。

もう 1 つ、**\`while\`**（ワイル、「〜のあいだ」）を覚えましょう。\`loop\` は永遠に繰り返しますが、\`while\` は **条件が正しいあいだだけ** 繰り返します。

\`\`\`
set n = 0
while n < 15
    turn left
    set n = n + 1
\`\`\`

これは「\`n\` が 15 より小さいあいだ、左に回って \`n\` を 1 増やす」なので、\`turn left\` を **ちょうど 15 回** します。15 × 6 = 90 度です。

今度のゴールは、ALPHA から見て **左に 90 度**（真上）です。2 章のように \`turn left\` を 15 行書くかわりに、\`while\` で数えて回りましょう。

（実は \`turn left 90\` の 1 行でも、ここまで回れます。ここでは変数の練習なので、数えて回りましょう。）` },
    task: { en: `Turn 90 degrees to the left with \`set\` and \`while\`, then drive to the goal.`, ja: `\`set\` と \`while\` で左に 90 度回ってから走り、ゴールに着きましょう。` },
    hints: [
      { en: `Under the program of the explanation, write \`drive forward\` outside the \`while\` (not indented).`, ja: `説明のプログラムの下に、\`while\` の外（字下げなし）で \`drive forward\` を書きます。` },
    ],
    answer: `set n = 0
while n < 15
    turn left
    set n = n + 1
drive forward
`,
    start: `# Turn a quarter turn to the left, counting with a variable, then drive to the goal.
`,
    stage: QUARTER,
    check: { kind: 'match', goal: { kind: 'reach' }, uses: ['set', 'while'] },
  },
  {
    id: 'and',
    title: { en: `and, or, not`, ja: `and・or・not` },
    body: { en: `Conditions can be put together:

- \`A and B\` … true when **both** A and B are true
- \`A or B\` … true when **either** A or B is true
- \`not A\` … true when A is not true

This time the target hides behind an obstacle and is far off. With chapter 3's "stop and shoot once you see it", ALPHA stops the moment it sees the target, and its bullets do not reach.

Stop and shoot only when the target **can be seen and** is in range.`, ja: `条件は組み合わせられます。

- \`A and B\` … A と B の **両方** が正しいとき正しい
- \`A or B\` … A と B の **どちらか** が正しいとき正しい
- \`not A\` … A が正しくないとき正しい

今度の的は障害物の陰にいて、しかも遠くにいます。3 章の「見えたら止まって撃つ」では、見えた瞬間に止まってしまい、弾が届きません。

「**見えていて、しかも** 射程に入っている」ときだけ止まって撃つようにしましょう。` },
    task: { en: `Use \`and\` to stop and shoot only when the target can be seen and is in range, and destroy it.`, ja: `\`and\` を使って、見えていて射程内のときだけ止まって撃ち、的を壊しましょう。` },
    hints: [
      { en: `It is \`if enemy_visible and enemy_distance < weapon_range - 50\`.`, ja: `\`if enemy_visible and enemy_distance < weapon_range - 50\` です。` },
    ],
    answer: `loop
    if enemy_visible and enemy_distance < weapon_range - 50
        drive stop
        aim enemy
        fire
    else
        drive forward
        wait
`,
    start: `loop
    if enemy_visible
        drive stop
        aim enemy
        fire
    else
        drive forward
        wait
`,
    stage: FAR_HIDDEN,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['and'] },
  },
  ],
},
{
  id: 'functions',
  title: { en: `Functions`, ja: `関数` },
  steps: [
  {
    id: 'def',
    title: { en: `Give a few lines a name`, ja: `まとまりに名前を付ける` },
    body: { en: `As a program grows, it gets hard to see what is done where. So give a group of lines **a name** of its own. This is called a **function**.

\`\`\`
def shoot()
    drive stop
    aim enemy
    fire
\`\`\`

After **\`def\`** (define) comes the name and \`()\`, and the lines it holds are indented below. On its own this does nothing. To use it, write **its name and \`()\`**: this is called **calling** the function.

\`\`\`
loop
    if enemy_distance < weapon_range - 50
        shoot()
    else
        drive forward
        wait
\`\`\`

When the program comes to \`shoot()\`, it runs what is in \`def shoot()\`, and then comes back to the next line.

Write a function **above** the lines that use it.`, ja: `プログラムが長くなると、どこで何をしているのか分かりにくくなります。そこで、ひとまとまりの行に **名前を付けて** まとめます。これを **関数** といいます。

\`\`\`
def shoot()
    drive stop
    aim enemy
    fire
\`\`\`

**\`def\`**（デフ、define = 定義する）のあとに名前と \`()\` を書き、その下に字下げして中身を書きます。これだけでは何も起きません。使うときは **名前と \`()\`** を書きます。これを関数を **呼ぶ** といいます。

\`\`\`
loop
    if enemy_distance < weapon_range - 50
        shoot()
    else
        drive forward
        wait
\`\`\`

プログラムが \`shoot()\` の行に来ると、\`def shoot()\` の中身を実行し、終わったら次の行に戻ります。

関数は、それを使う行より **上** に書きます。` },
    task: { en: `Put "stop, aim, fire" into a function \`shoot\`, call it, and destroy the target.`, ja: `「止まる・狙う・撃つ」を関数 \`shoot\` にまとめて呼び、的を壊しましょう。` },
    hints: [
      { en: `The two programs of the explanation, one after the other, work as they are.`, ja: `説明の 2 つのプログラムを、上から順にそのまま並べれば動きます。` },
    ],
    answer: `def shoot()
    drive stop
    aim enemy
    fire

loop
    if enemy_distance < weapon_range - 50
        shoot()
    else
        drive forward
        wait
`,
    start: `# Put "stop, aim, fire" into a function called shoot, and call it.
loop
    if enemy_distance < weapon_range - 50
        drive stop
        aim enemy
        fire
    else
        drive forward
        wait
`,
    stage: FAR,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['def', 'shoot'] },
  },
  {
    id: 'return',
    title: { en: `A function that answers`, ja: `答えを返す関数` },
    body: { en: `A function can also **give back an answer (a value)**. After **\`return\`** comes a value: the function ends there, and the call becomes that value.

\`\`\`
def in_range()
    if enemy_distance < weapon_range - 50
        return true
    return false
\`\`\`

\`true\` means true and \`false\` means false. This function gives back "true when in range, otherwise false", so it can go straight into an \`if\`:

\`\`\`
if in_range()
    shoot()
\`\`\`

The condition now has a name, and the program reads just as it means: "if in range, shoot".

A function called inside an \`if\` or a calculation cannot hold **actions that take time**, like \`fire\` or \`turn\`, nor \`loop\` / \`while\`: time must not pass while a value is being worked out.`, ja: `関数は、**答え（値）を返す** こともできます。**\`return\`**（リターン、「返す」）のあとに値を書くと、そこで関数が終わり、呼んだところがその値になります。

\`\`\`
def in_range()
    if enemy_distance < weapon_range - 50
        return true
    return false
\`\`\`

\`true\` は「正しい」、\`false\` は「正しくない」です。この関数は「射程内なら正しい、そうでなければ正しくない」を返すので、\`if\` にそのまま書けます。

\`\`\`
if in_range()
    shoot()
\`\`\`

条件に名前が付いて、「射程内なら撃つ」とそのまま読めるプログラムになりました。

ただし、\`if\` や計算の中で呼ぶ関数には、\`fire\` や \`turn\` のような **時間のかかる行動** と、\`loop\` / \`while\` は書けません。値を出すあいだに時間が進んではいけないからです。` },
    task: { en: `Make a function \`in_range\`, write \`if in_range()\`, and destroy the target.`, ja: `関数 \`in_range\` を作って \`if in_range()\` と書き、的を壊しましょう。` },
    hints: [
      { en: `Write \`def in_range()\` above or below \`def shoot()\` (above the \`loop\`).`, ja: `\`def in_range()\` を \`def shoot()\` の上か下（\`loop\` より上）に書きます。` },
      { en: `In the \`loop\`, change \`if enemy_distance < weapon_range - 50\` to \`if in_range()\`.`, ja: `\`loop\` の中の \`if enemy_distance < weapon_range - 50\` を \`if in_range()\` にします。` },
    ],
    answer: `def in_range()
    if enemy_distance < weapon_range - 50
        return true
    return false

def shoot()
    drive stop
    aim enemy
    fire

loop
    if in_range()
        shoot()
    else
        drive forward
        wait
`,
    stage: FAR,
    check: { kind: 'match', goal: { kind: 'destroy' }, uses: ['return', 'in_range'] },
  },
  ],
},
{
  id: 'debugging',
  title: { en: `Debugging`, ja: `デバッグ` },
  steps: [
  {
    id: 'debug-run',
    title: { en: `Run it to debug`, ja: `デバッグで実行する` },
    body: { en: `When a program does not do what you meant, it has a **bug**. Finding and fixing it is called **debugging**.

Run with **DEBUG** in the top bar, and you can follow the match **one line at a time**:

- the editor shows **the line that runs next** in colour;
- the battle view shows the line of sight to the enemy, and aiming marks;
- the log shows everything that happens.`, ja: `プログラムが思ったとおりに動かないとき、その原因になっている間違いを「**バグ**（虫）」といいます。バグを見つけて直すことが「**デバッグ**」です。

上のバーの **デバッグ** で実行すると、試合を **1 行ずつ** 見られるようになります。

- エディタに、**次に実行する行** が色付きで出ます。
- 戦闘画面に、敵への視線や狙いの印が出ます。
- ログに、すべての出来事が出ます。` },
    task: { en: `Press **DEBUG** in the top bar.`, ja: `上のバーの **デバッグ** を押しましょう。` },
    stage: FAR,
    check: { kind: 'action', action: 'debug' },
    highlight: ["debug"],
  },
  {
    id: 'step-line',
    title: { en: `One line at a time`, ja: `1 行ずつ進める` },
    body: { en: `Press **\`1▶\`** under the battle view and the program goes on **by one line**. **\`◀1\`** goes back a line.

Pause, press \`1▶\` a few times, and watch how the coloured line moves. When an \`if\` condition is false, the lines inside it are skipped.

**Watch**, at the bottom right, shows the sensors at that moment and what is in the program's variables. See \`enemy_distance\` get smaller as ALPHA drives on.`, ja: `戦闘画面の下の **\`1▶\`** を押すと、プログラムが **1 行だけ** 進みます。**\`◀1\`** で 1 行戻ります。

一時停止して \`1▶\` を何度か押し、色付きの行がどう動くか見てみましょう。\`if\` の条件が正しくないと、その中の行は飛ばされるのが分かります。

右下の **ウォッチ** には、その瞬間のセンサーの値と、プログラムの変数の中身が出ます。**敵までの距離**（\`enemy_distance\`）が、走るにつれて小さくなっていくのを確かめてください。` },
    task: { en: `Run with DEBUG, and press **\`1▶\`**.`, ja: `デバッグで実行して、**\`1▶\`** を押しましょう。` },
    stage: FAR,
    check: { kind: 'action', action: 'stepLine' },
    highlight: ["step", "watch-fields"],
  },
  {
    id: 'mark',
    title: { en: `When does this line run?`, ja: `この行はいつ動く？` },
    body: { en: `While debugging, click a **line number** in the editor: the line gets a mark (◆), and you jump to **the moment that line next runs**. The seek bar gets a tick at every moment the line ran.

\`◆▶\` and \`◀◆\` move to the next / previous time it runs. Click the line number again to take the mark off.

It is a handy way to find out "how many times did \`fire\` run?" or "when did it go into this \`if\`?".`, ja: `デバッグ中に、エディタの **行番号** をクリックすると、その行に印（◆）が付き、**その行が次に実行される瞬間** へ飛びます。シークバーには、その行が実行されたすべての時点に目印が付きます。

\`◆▶\` と \`◀◆\` で、次の / 前の実行時点へ移れます。もう一度行番号をクリックすると印が外れます。

「\`fire\` は何回実行された？」「この \`if\` の中に入ったのはいつ？」を調べるのに便利です。` },
    task: { en: `Run with DEBUG, and click the line number of the \`fire\` line.`, ja: `デバッグで実行して、\`fire\` の行の行番号をクリックしましょう。` },
    stage: FAR,
    check: { kind: 'action', action: 'mark' },
  },
  {
    id: 'find-bug',
    title: { en: `Find the bug`, ja: `バグを探す` },
    body: { en: `The program in the editor has a **bug** put in on purpose. When it runs, ALPHA does not drive up to the target: it keeps shooting from where it is.

Run it with DEBUG, step through it line by line, look at \`enemy_distance\` in Watch, and find which line is wrong.

When you have found it, fix it, and destroy the target.`, ja: `エディタのプログラムには、わざと **バグ** を 1 つ入れてあります。実行すると、ALPHA は的に近づかず、その場で撃ち続けてしまいます。

デバッグで実行し、1 行ずつ進めたり、ウォッチで \`enemy_distance\` を見たりして、どの行がおかしいか探してください。

見つけたら直して、的を壊しましょう。` },
    task: { en: `Find the bug, fix it, and destroy the target.`, ja: `バグを見つけて直し、的を壊しましょう。` },
    hints: [
      { en: `Look at the \`if\` condition. When the distance is 700, is \`enemy_distance > 350\` true or false?`, ja: `\`if\` の条件を見てください。距離が 700 のとき、\`enemy_distance > 350\` は正しい？ 正しくない？` },
      { en: `\`>\` should be \`<\`: make it \`enemy_distance < 350\`.`, ja: `\`>\` と \`<\` が逆です。\`enemy_distance < 350\` にします。` },
    ],
    answer: `loop
    if enemy_distance < 350
        drive stop
        fire
    else
        drive forward
        wait
`,
    start: `loop
    if enemy_distance > 350
        drive stop
        fire
    else
        drive forward
        wait
`,
    stage: FAR,
    check: { kind: 'match', goal: { kind: 'destroy' } },
    highlight: ["debug"],
  },
  ],
},
{
  id: 'defence',
  title: { en: `Defending`, ja: `身を守る` },
  steps: [
  {
    id: 'guard',
    title: { en: `Brace with guard`, ja: `guard で身構える` },
    body: { en: `This BRAVO aims at you and shoots back.

**\`guard\`** is an action: the robot **braces** for one tick, and a bullet that hits during that tick does **half** its damage. But

- it can be used only **4 times** a match (\`guards\` tells how many are left);
- each use puts off your own next shot a little (0.3 seconds).

So the trick is to use it **only at the moment a bullet hits**. There are sensors for bullets:

- **\`bullet_incoming\`** … true when a bullet is on course to hit you
- **\`bullet_distance\`** … how far away that bullet is

A bullet covers about 13 a tick, so with \`bullet_distance < 36\` it will hit about on the next tick.`, ja: `今度の BRAVO は、こちらを狙って撃ち返してきます。

**\`guard\`**（ガード）は、1 tick のあいだ **身構える** 行動です。その tick に当たった弾のダメージは **半分** になります。ただし

- 1 試合に **4 回** までしか使えません（残りは \`guards\` で分かります）。
- 使うたびに、自分の次の弾が少し（0.3 秒）遅れます。

だから、**弾が当たるその瞬間だけ** 使うのがコツです。弾を調べるセンサーがあります。

- **\`bullet_incoming\`** … 自分に当たるコースの弾が飛んできているとき正しい
- **\`bullet_distance\`** … その弾までの距離

弾は 1 tick に約 13 進むので、\`bullet_distance < 36\` なら、だいたい次の tick に当たります。` },
    task: { en: `Use \`guard\` just before a bullet hits, and take half the damage.`, ja: `当たる直前に \`guard\` して、弾のダメージを半分にしましょう。` },
    hints: [
      { en: `At the top of the \`loop\`, put \`if bullet_incoming and bullet_distance < 36\` with \`guard\` in it, and aim and fire under \`else\`.`, ja: `\`loop\` の最初に \`if bullet_incoming and bullet_distance < 36\` を置き、その中で \`guard\`、\`else\` で狙って撃ちます。` },
    ],
    answer: `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else
        aim enemy
        fire
`,
    start: `# BRAVO shoots back: brace with guard just before a bullet hits.
loop
    aim enemy
    fire
`,
    stage: SHOT_AT,
    check: { kind: 'match', goal: { kind: 'guard' }, uses: ['guard'] },
  },
  {
    id: 'cover',
    title: { en: `Hide and recover`, ja: `隠れて回復する` },
    body: { en: `Keep getting shot and you lose. Then the best thing is to **hide behind an obstacle**.

- **\`hidden\`** … true while the enemy cannot see you
- **\`face cover\`** … turns until facing a place hidden from the enemy (a **hiding place**), taking as many ticks as it needs
- **\`cover_distance\`** … how far it is to drive to the hiding place

What is more, a robot that **stays still for 0.5 seconds** where no enemy can see it **gets back 20 HP a second**.

With a program that says "while seen, drive to the hiding place; once hidden, stop and rest", get some HP back. The battle view shows the way to the hiding place as a dotted line.`, ja: `撃たれ続けると負けてしまいます。そんなときは **障害物の陰に隠れる** のが一番です。

- **\`hidden\`** … 敵から見えていないとき正しい
- **\`face cover\`** … 敵から隠れられる場所（**隠れ場所**）の方を向くまで回る（向くまで何 tick でもかかる）
- **\`cover_distance\`** … 隠れ場所までの道のり

さらに、敵から見えない場所で **0.5 秒止まっている** と、HP が **1 秒に 20 ずつ回復** します。

「見えていたら隠れ場所へ走る。隠れたら止まって休む」というプログラムで、HP を回復させましょう。戦闘画面には、隠れ場所への道が点線で出ます。` },
    task: { en: `When shot, run to the hiding place, stop, and get some HP back.`, ja: `撃たれたら隠れ場所へ逃げ込み、止まって HP を回復させましょう。` },
    hints: [
      { en: `Under \`if hidden\`: stop and wait. Under \`else\`: \`face cover\`, \`drive forward\`, \`wait\`.`, ja: `\`if hidden\` の下に「止まる・待つ」、\`else\` の下に \`face cover\`・\`drive forward\`・\`wait\` です。` },
    ],
    answer: `loop
    if hidden
        drive stop
        wait
    else
        face cover
        drive forward
        wait
`,
    start: `# When shot, run to cover, then stop and rest there.
loop
    aim enemy
    fire
`,
    stage: SHELTER,
    check: { kind: 'match', goal: { kind: 'recover' }, uses: ['hidden', 'cover'] },
  },
  ],
},
{
  id: 'parts',
  title: { en: `Parts`, ja: `パーツ` },
  steps: [
  {
    id: 'parts-intro',
    title: { en: `Choose the parts`, ja: `パーツを選ぶ` },
    body: { en: `A robot is made of four **parts**:

- **BODY** … how much HP. Heavier means more HP, and slower
- **LEGS** … how fast it drives and turns
- **GUN** … how hard its bullets hit, how fast they fly, its range, how often it can fire, and how many shots it has
- **SENSOR** … how far it sees, and which way

Press **PARTS** above to choose parts (**CODE** takes you back to the editor). Put the mouse on a part's name to see what it does. Below, the robot's numbers with those parts are shown, with the difference from standard.

The parts you choose here are used in the matches of the steps about parts. Your own ALPHA's parts do not change.`, ja: `ロボットは 4 つの **パーツ** でできています。

- **車体**（BODY）… HP の多さ。重いほど HP が多く、遅い
- **脚**（LEGS）… 走る速さと回る速さ
- **銃**（GUN）… 弾の威力・速さ・射程・撃つ間隔・弾数
- **センサー**（SENSOR）… 見える距離と向き

上の **パーツ** を押すと、パーツを選ぶ画面になります（**コード** でエディタに戻ります）。パーツの名前にマウスを載せると説明が出ます。下には、そのパーツでのロボットの性能が、標準との違いつきで出ます。

ここで選んだパーツは、パーツを使うステップの試合で使われます。いつもの ALPHA のパーツは変わりません。` },
    task: { en: `Open **PARTS** and change any one part.`, ja: `**パーツ** を開いて、どれか 1 つパーツを替えてみましょう。` },
    parts: true,
    stage: SNIPE,
    check: { kind: 'action', action: 'part' },
  },
  {
    id: 'cost',
    title: { en: `Within the cost`, ja: `コストの中でやりくりする` },
    body: { en: `Each part has a **cost**, and the four together may cost **at most 12**. All Standard (cost 3 each) is exactly 12.

A part that is strong at something costs 4, and a part that costs 2 is weak at something. Making one thing stronger means giving up something else: that is what choosing parts is about.

This BRAVO stands **480** away and shoots back. A Standard gun reaches only 400, so your bullets fall short (and so do BRAVO's).

The **Cannon** reaches 520, but costs 4: with the other parts as they are, the total would be 13, one over the limit. Swap one of the other parts for one that costs 2. The **Scope** sensor (cost 2) sees only ahead, but far. BRAVO is straight ahead, so that does not matter.`, ja: `パーツにはそれぞれ **コスト** があり、4 つの合計は **12 まで** です。全部 Standard（コスト 3）で、ちょうど 12 です。

強いパーツはコストが 4 です。コスト 2 のパーツには、そのかわり苦手なことがあります。何かを強くしたら、ほかの何かをあきらめる。それがパーツ選びです。

今度の BRAVO は **480** 先にいて、撃ち返してきます。Standard の銃は射程が 400 なので、こちらの弾は届きません（BRAVO の弾も届きません）。

銃の **Cannon**（キャノン）は 520 まで届きますが、コストが 4 です。ほかがそのままだと合計 13 で、上限を 1 超えてしまいます。ほかのどれか 1 つを、コスト 2 のパーツにしましょう。センサーの **Scope**（スコープ、コスト 2）は、前しか見えないかわりに遠くまで見えます。BRAVO は正面にいるので、前しか見えなくても困りません。` },
    task: { en: `Choose parts within a cost of 12 that can reach BRAVO 480 away, and destroy it.`, ja: `コスト 12 以内で、480 先の BRAVO を壊せるパーツを選び、壊しましょう。` },
    hints: [
      { en: `With the Cannon as GUN, the cost is 13.`, ja: `銃を Cannon にすると、コストは 13 になります。` },
      { en: `With the Scope as SENSOR it comes to 12. As a program, \`aim enemy\` and \`fire\` in a \`loop\` are enough.`, ja: `センサーを Scope にすると 12 に収まります。プログラムは \`loop\` の中で \`aim enemy\` と \`fire\` で十分です。` },
    ],
    answer: `loop
    aim enemy
    fire
`,
    answerParts: { gun: 'cannon', sensor: 'scope' },
    parts: true,
    start: `loop
    aim enemy
    fire
`,
    stage: SNIPE,
    check: { kind: 'match', goal: { kind: 'destroy' } },
  },
  {
    id: 'builds',
    title: { en: `Builds and programs`, ja: `パーツとプログラムの組み合わせ` },
    body: { en: `There is no one right way to choose parts. What matters is choosing **parts that suit the program**.

- A program that shoots from afar … the long-reaching **Cannon**, the far-seeing **Scope**
- One that gets close and fires away … the quick-firing **Rapid**, the **Heavy** body with more HP
- One that fights from cover … the fast **Sprint** legs, or the **Light** body
- One that circles round its enemy … the quick-turning **Pivot** legs
- One that shoots without stopping … the sure-footed **Walker** legs
- One that races between hiding places … the **Hover** legs, which slide and cannot stop at once

And when you change parts, look at the program again. If it uses \`weapon_range\` (chapter 4), for example, the distance it starts shooting from fits a new gun by itself.`, ja: `パーツの選び方に正解はありません。**プログラムに合うパーツ** を選ぶのが大事です。

- 遠くから撃つプログラムなら … 射程の長い **Cannon**、遠くまで見える **Scope**
- 近づいて撃ちまくるなら … 撃つ間隔の短い **Rapid**、HP の多い **Heavy**
- 隠れながら戦うなら … 速く走れる脚の **Sprint**、軽い車体の **Light**
- 敵のまわりを回るなら … 素早く向きを変えられる脚の **Pivot**

また、パーツを替えたらプログラムも見直しましょう。たとえば 4 章で \`weapon_range\` を使っておくと、銃を替えても撃ち始める距離が自動で合います。` },
    check: { kind: 'read' },
  },
  ],
},
{
  id: 'next',
  title: { en: `What next`, ja: `その先へ` },
  steps: [
  {
    id: 'templates',
    title: { en: `Read other programs`, ja: `ほかのプログラムを読む` },
    body: { en: `The quickest way to get better is to **read other people's programs**.

On the program screen, press **LOAD TEMPLATE** to the right of the editor's heading to load the program of any of the eight built-in robots (Cmd / Ctrl + Z takes it back).

- **Sample** … drives up and shoots: the basic shape
- **AggressiveBot** … charges without stopping
- **CowardBot** … backs away as it shoots
- **GuardBot** … defends itself with \`guard\`
- **CoverBot** … hides behind obstacles to recover
- **StrafeBot** … drives sideways, aiming where the enemy will be (\`aim lead\`)
- **SentryBot** … stops, and aims carefully where the enemy will be

Each is explained with comments (\`#\`). Put the cursor on a word this tutorial did not cover to see what it means.`, ja: `上達の近道は、**ほかの人のプログラムを読む** ことです。

プログラムの画面で、エディタの見出しの右にある **テンプレート** を押すと、内蔵ロボット 8 台のプログラムをエディタに読み込めます（Cmd / Ctrl + Z で元に戻せます）。

- **Sample** … 近づいて撃つ、基本の形
- **AggressiveBot** … 止まらずに突っ込む
- **CowardBot** … 下がりながら撃つ
- **GuardBot** … \`guard\` で身を守る
- **CoverBot** … 物陰に隠れて回復する
- **StrafeBot** … 横に走りながら、敵の動く先を狙う（\`aim lead\`）
- **SentryBot** … 止まって、動く先を正確に狙う

どれもコメント（\`#\`）で説明が書いてあります。このチュートリアルで習っていない語は、カーソルを載せると説明が出ます。` },
    check: { kind: 'read' },
  },
  {
    id: 'search',
    title: { en: `Finding a hidden enemy`, ja: `見えない敵を探す工夫` },
    body: { en: `On a map with many obstacles, the enemy can be hard to find. In particular, **two robots that search by turning the same way** can chase each other round an obstacle and never meet.

How to search is up to your program. For example:

- **If the enemy is not found for a while, turn the other way.** Count the time without a sighting in a variable, and swap \`turn left\` for \`turn right\` (DumbBot and GuardBot do this).
- **Head for where it was last seen.** While the enemy cannot be seen, \`turn enemy\` and \`enemy_distance\` point to **where it was last seen**. Lost it? Go there.
- **Face where the shots come from.** When \`hit\` is true, an enemy you cannot see has shot you. \`face hit\` turns you towards it, and you may find it.
- **Follow a wall.** Watch \`wall_left\` or \`wall_right\`, and drive so as not to stray from the wall: it takes you deep into maze-like maps.

The rules never tell you where the enemy is. How to look for it is a chance for your program, and for you, to show what you can do.`, ja: `障害物の多いマップでは、敵がなかなか見つからないことがあります。とくに、**同じ向きに回って探す 2 台** は、障害物のまわりを追いかけっこして、いつまでも出会えないことがあります。

探し方は、プログラムの工夫しだいです。たとえば

- **しばらく見つからなければ、回る向きを変える。** 変数で見つからない時間を数えて、\`turn left\` と \`turn right\` を入れかえます（DumbBot や GuardBot がこうしています）。
- **最後に見た場所へ向かう。** \`turn enemy\` と \`enemy_distance\` は、見えていない間は **最後に見た位置** を指します。見失ったら、そこへ向かってみましょう。
- **撃たれた方を向く。** \`hit\` が正しければ、見えない敵に撃たれています。\`face hit\` でそちらを向けば、見つかることがあります。
- **壁に沿って走る。** \`wall_left\` や \`wall_right\` で壁までの距離を見て、壁から離れすぎないように走ると、迷路のようなマップでも奥まで行けます。

敵の居場所は、ルールでは教えてくれません。どう探すかも、プログラムを書くあなたの腕の見せどころです。` },
    check: { kind: 'read' },
  },
  {
    id: 'garage',
    title: { en: `Keep your robot`, ja: `ロボットを保存する` },
    body: { en: `On the program screen, **PROJECT** holds ALPHA and BRAVO, each with a \`main.bot\` (program) and a \`config\` (parts). **BRAVO's program can be changed too**, so you can set two robots of your own against each other.

Keep a robot you are happy with in the **GARAGE** below, under a name: type the name and press "SAVE ALPHA". A robot in the garage can be loaded into ALPHA or BRAVO at any time with \`A\` / \`B\`.`, ja: `プログラムの画面の **プロジェクト** には ALPHA と BRAVO がいて、それぞれ \`main.bot\`（プログラム）と \`config\`（パーツ）を持っています。**BRAVO のプログラムも書きかえられる** ので、自分のロボットどうしを戦わせることもできます。

できたロボットは、下の **ガレージ** に名前を付けて保存しましょう。名前を入れて「ALPHA を保存」を押します。保存したロボットは、\`A\` / \`B\` でいつでも ALPHA / BRAVO に読み込めます。` },
    check: { kind: 'read' },
  },
  {
    id: 'arena',
    title: { en: `Arena, contests and sharing`, ja: `アリーナ・大会・共有` },
    body: { en: `Once you have a robot, try it on the other screens (from the start menu):

- **ARENA** … pick robots from your garage or the built-in ones, send them into battle and watch. There are battle royales of 3 or 4 robots, and series of 20 matches over every map.
- **CONTEST** … gather 3 to 8 robots for a league or a tournament, with a table or a bracket of the results.
- **Sharing** … with **SHARE** in the garage, post a robot on X, or turn it into a **share link**, a **share code** or a **file** to give to a friend. Take in your friends' robots, and set them against yours in a contest.`, ja: `ロボットができたら、ほかの画面で試してみましょう（起動メニューから行けます）。

- **アリーナ** … ガレージのロボットや内蔵ロボットを選んで戦わせ、試合を見ます。3〜4 台のバトルロイヤルや、全マップで 20 試合の連戦もできます。
- **大会** … 3〜8 台を集めて、リーグ戦やトーナメントをします。結果は表やトーナメント表で見られます。
- **共有** … ガレージの「共有」で、ロボットを X に投稿したり、**共有リンク**・**共有コード**・**ファイル** にしたりして、友だちに渡せます。友だちのロボットを取り込んで、大会で戦わせることもできます。` },
    check: { kind: 'read' },
  },
  {
    id: 'end',
    title: { en: `Well done!`, ja: `おつかれさまでした` },
    body: { en: `That is the end of the tutorial. Having come this far, you can now

- put instructions in order and repeat them with \`loop\`,
- change what the robot does with \`if\` and sensors,
- tidy a program with variables and functions,
- find and fix mistakes by debugging,
- and choose parts to build a robot of your own.

These are the basics of programming itself, and they work in other programming languages too.

From here on, build robots freely and send them into battle. If you are ever unsure, come back to this tutorial at any time ("Chapters" takes you to any step).

Press **THE END** to go back to the start menu.`, ja: `これでチュートリアルはおしまいです。ここまで来たあなたは、もう

- 命令を順番に並べ、\`loop\` で繰り返し、
- \`if\` とセンサーで状況に合わせて動きを変え、
- 変数と関数でプログラムを整理し、
- デバッグで間違いを見つけて直し、
- パーツを選んで、自分だけのロボットを作る

ことができます。これは、ほかのプログラミング言語でも使える、プログラミングの基本そのものです。

あとは、自由にロボットを作って戦わせてください。迷ったら、いつでもこのチュートリアルに戻ってこられます（「章の一覧」から好きなステップへ）。

**おしまい** を押すと、起動メニューに戻ります。` },
    check: { kind: 'read' },
  },
  ],
},
];
