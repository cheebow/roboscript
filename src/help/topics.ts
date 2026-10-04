// The help: how to use the app, and the guide to RoboScript. "All the words" is made from the
// language's own descriptions when shown (see wordsTopic), so it never falls behind the language.
// Made from the text by a script: edit it here, keeping the markup (see renderMarkup).
import type { Text } from '../tutorial/types';

export interface HelpTopic {
  id: string;
  title: Text;
  body: Text;
}

export interface HelpSection {
  id: 'app' | 'script';
  title: Text;
  topics: readonly HelpTopic[];
}

/** The id of the topic listing every word of the language, made when shown. */
export const WORDS_TOPIC = 'words';

export const HELP: readonly HelpSection[] = [
  {
    id: 'app',
    title: { en: 'Using RoboScript', ja: 'アプリの使い方' },
    topics: [
      { id: 'welcome', title: { en: `What RoboScript is`, ja: `RoboScript とは` }, body: { en: `RoboScript is a game where you **decide how a robot moves by writing a program**, and send it into battle. You never steer a robot during a match: everything it does comes from the program written beforehand.

- On the **PROGRAM** screen, write a robot's program, run a match, and debug it when it does not do what you meant.
- In the **ARENA**, send your robots or the built-in ones into battle and watch.
- In a **CONTEST**, gather many robots for a league or a tournament.
- In **CHALLENGE**, solve set puzzles and collect stars.
- New here? Start with the **TUTORIAL**: it teaches the language one step at a time.

The start menu comes up when the page opens; ⏻ at the left of the top bar brings it back at any time. The tabs at the top switch screens.`, ja: `RoboScript は、ロボットの動きを **プログラムで決めて** 戦わせるゲームです。試合中にロボットを操作することはありません。どう動くかは、試合の前に書いたプログラムがすべて決めます。

- **プログラム** の画面で、ロボットのプログラムを書いて試合をし、うまくいかなければデバッグして直します。
- **アリーナ** で、作ったロボットや内蔵のロボットを戦わせて見ます。
- **大会** で、たくさんのロボットを集めてリーグ戦やトーナメントをします。
- **チャレンジ** で、条件つきの課題を解いて星を集めます。
- 初めてなら **チュートリアル** から始めましょう。一歩ずつ書き方を学べます。

ページを開くと起動メニューが出ます。上部バー左端の ⏻ でいつでも戻れます。上のタブで画面を切り替えられます。` } },
      { id: 'program-screen', title: { en: `The program screen`, ja: `プログラムの画面` }, body: { en: `The screen for writing code, trying it in a match, and fixing it.

- **PROJECT** (top left): ALPHA (green) and BRAVO (orange), each with a \`main.bot\` (program) and a \`config\` (parts). Click one to open it. BRAVO's program can be changed too.
- **The editor** (middle): write the program here. **LOAD TEMPLATE** in its heading loads a built-in robot's program; **GUIDE** opens the guide to the language.
- **The battle view** (right): the match, seen from above.
- **RUN** works out the whole match, then plays it. **DEBUG** plays the same match so you can follow the program line by line. **RESET** goes back to before the match.
- Under the battle view are play / pause, one step back or on, the seek bar and the playback speed.
- Below, the **log** lists what happened in the match, and the **analysis** tab beside it shows the hits, the damage and HP over time. **Inspector** and **Watch** show the robot's numbers. Click a log row to go to that moment.
- **MAP** at the top chooses where to fight.

When the program has a mistake, the match does not start: the line turns red, and the log says why.`, ja: `コードを書き、試合で試して、直していく画面です。

- **プロジェクト**（左上）: ALPHA（緑）と BRAVO（オレンジ）。それぞれ \`main.bot\`（プログラム）と \`config\`（パーツ）を持ちます。押すと開きます。BRAVO のプログラムも書きかえられます。
- **エディタ**（真ん中）: プログラムを書きます。見出しの **テンプレート** で内蔵ロボットのプログラムを読み込めます。**解説** でスクリプトの解説が開きます。
- **戦闘画面**（右）: 試合を上から見た図です。
- **実行** を押すと、試合を最後まで計算してから再生します。**デバッグ** では、同じ試合をプログラムの 1 行ずつ追いながら再生できます。**リセット** で試合の前に戻ります。
- 戦闘画面の下には、再生 / 一時停止、1 つ戻る / 進む、シークバー、再生の速さのボタンがあります。
- 下段の **ログ** には、試合の出来事が出ます。隣の **分析** タブでは、命中やダメージ、HP の推移を見られます。**状態** と **ウォッチ** には、ロボットの値が出ます。ログの行を押すと、その時点へ移ります。
- 上の **マップ** で戦う場所を選びます。

プログラムにエラーがあると、試合は始まりません。エラーのある行が赤くなり、ログに理由が出ます。` } },
      { id: 'challenge-screen', title: { en: `Challenges`, ja: `チャレンジ` }, body: { en: `Puzzles with conditions, started from **CHALLENGE** on the start menu. There are 12, and you can try them in any order.

- Each challenge has **conditions to clear it** (beat the enemy, within so many seconds, in so many lines, without being hit…) and **two more for stars**: clearing gives ★, and each star condition met adds one more, up to ★★★.
- Some challenges **fix a part** (a Pistol, the Short sensor…); choose the other slots within the cost limit under **PARTS**.
- Every try of a challenge is the same match: only your code and parts make a difference.
- Your code and your best are kept for each challenge. Bests are compared by stars, then HP left, then time. Blank lines and lines with only a comment are not counted as lines.
- **Show an example answer** shows one way to clear it, and the parts it uses.`, ja: `起動メニューの **チャレンジ** から始める、条件つきの課題です。全部で 12 問あり、どれからでも挑戦できます。

- それぞれに **クリア条件**（敵に勝つ、何秒以内、何行以内、1 発も受けない…）と、**星の条件** が 2 つあります。クリアすると ★ が 1 つ。星の条件を 1 つ満たすごとに ★ がもう 1 つ増え、最高で ★★★ です。
- **パーツが固定** のチャレンジもあります（Pistol、Short センサーなど）。ほかのスロットは、**パーツ** を押してコストの範囲で選べます。
- 同じチャレンジは毎回同じ試合です。違いが出るのはコードとパーツだけです。
- コードと自己ベストは、チャレンジごとに保存されます。自己ベストは、星の数、残り HP、時間の順に比べます。空行とコメントだけの行は、行数に数えません。
- **解答例を見る** を押すと、クリアのしかたの一例と、そのときのパーツが出ます。` } },
      { id: 'arena-screen', title: { en: `The arena`, ja: `アリーナ` }, body: { en: `The screen for picking robots, sending them into battle and watching.

- Choose the **number of robots** (2 / 3 / 4) at the top, then a robot for each slot (those in your garage, and the 8 built-in ones).
- **FIGHT** plays one match. **SERIES** plays 20 matches over every map at once, and counts the wins (with 3 or 4 robots, how often each came in each place).
- The results line up at the bottom left; click one to watch it again. \`⇪\` gives that match's share code and file.
- Paste a match share code you were given and press **PLAY**, or open a match file with **FILE…**, to watch the same match.
- During a match, **commentary** runs along the bottom of the battle view. In the battle view's heading, "COMMENTARY" turns it on or off, and "ANALYSIS" shows how the match went.`, ja: `ロボットを選んで戦わせ、試合を見る画面です。

- 上で **台数**（2 / 3 / 4）を選び、枠ごとにロボットを選びます。選べるのは、ガレージに保存したロボットと、内蔵の 8 台です。
- **対戦** で 1 試合します。**連戦** では全マップで 20 試合をまとめて行い、勝ち数を出します（3〜4 台なら、何位を何回取ったか）。
- 結果は左下に並び、押すともう一度見られます。\`⇪\` を押すと、その試合の共有コードとファイルが出ます。
- 人からもらった試合の共有コードを貼って **再生** を押すか、**ファイル…** で試合のファイルを開くと、同じ試合を見られます。
- 試合中は、戦闘画面の下に **実況** が流れます。戦闘画面の見出しの「実況」で ON / OFF を切り替え、「分析」でその試合の分析を開けます。` } },
      { id: 'contest-screen', title: { en: `Contests`, ja: `大会` }, body: { en: `The screen for gathering 3 to 8 robots for a league or a tournament.

- **+ ADD A ROBOT** brings in built-in robots, robots from your garage, robot files, or share codes.
- Choose **LEAGUE** (everyone meets everyone twice) or **TOURNAMENT** (two wins take a robot through) at the top, and start.
- The result appears on the **board** over the battle view. Click a dot to watch that match; "◀ BOARD" at the top left brings the board back.
- From the **RESULT** menu, save the result as a file, or open someone else's.`, ja: `3〜8 台のロボットを集めて、リーグ戦かトーナメントをする画面です。

- **＋ ロボットを追加** から出場ロボットを集めます。内蔵ロボット、ガレージのロボット、ロボットのファイル、共有コードから選べます。
- 上で **リーグ戦**（全員と 2 回ずつ）か **トーナメント**（2 勝で勝ち上がり）を選んで始めます。
- 結果は戦闘画面の上の **結果ボード** に出ます。丸を押すと、その試合を見られます。左上の「◀ 結果ボード」で戻ります。
- **結果** メニューから、結果をファイルに保存したり、人の結果ファイルを開いたりできます。` } },
      { id: 'garage-help', title: { en: `The garage`, ja: `ガレージ` }, body: { en: `The shelf where you keep robots (program and parts) under a name. It is at the bottom left of the program screen.

- Type a name and press **SAVE ALPHA** / **SAVE BRAVO**. If a robot of that name is already there, the button turns into "replace?": press it again to replace that robot.
- \`A\` / \`B\` in the list loads that robot into ALPHA / BRAVO.
- \`⇪\` gives a share code: **COPY** it to give to someone, or **SAVE FILE**.
- \`×\` deletes, on the second press.
- **+ IMPORT** takes in a robot file or a share code someone gave you.`, ja: `できたロボット（プログラムとパーツ）を、名前を付けてしまっておく棚です。プログラムの画面の左下にあります。

- 名前を入れて **ALPHA を保存** / **BRAVO を保存** を押します。同じ名前のロボットがあるとボタンが「上書き?」に変わり、もう一度押すと上書きします。
- 一覧の \`A\` / \`B\` で、そのロボットを ALPHA / BRAVO に読み込みます。
- \`⇪\` で共有コードが出ます。「コピー」して人に渡すか、「ファイルに保存」します。
- \`×\` は 2 回押すと削除します。
- **＋ 取り込む** から、人にもらったロボットのファイルや共有コードを取り込めます。` } },
      { id: 'rules', title: { en: `How a match works`, ja: `試合のルール` }, body: { en: `- One second is 30 **ticks**. A robot does one action a tick. A match lasts at most 120 seconds.
- Like a tank, a robot only drives forward or backward along the way it faces. It stops against walls, obstacles and other robots.
- Sensors cannot see through obstacles. A robot remembers where it last saw a lost enemy.
- Bullets fly straight the way the turret points, and vanish at walls and obstacles. Shooting on the move scatters the shots a lot.
- Bracing with \`guard\` halves the damage of a bullet that hits at that moment (up to 4 times a match).
- Standing still where no enemy can see you brings HP back.
- To win, destroy the enemy, or have more HP left when time or ammo runs out.
- The same robots, map and seed always make the same match.`, ja: `- 1 秒は 30 **tick** です。ロボットは 1 tick に 1 つ行動します。試合は最長 120 秒です。
- ロボットは戦車のように、向いている方向に前進か後退しかできません。壁や障害物、ほかのロボットにはぶつかって止まります。
- センサーは障害物の向こうを見られません。見失った敵は、最後に見た位置を覚えています。
- 弾は砲塔の向きへまっすぐ飛び、壁や障害物で消えます。走りながら撃つと、弾が大きくばらけます。
- \`guard\` で身構えると、その瞬間に当たった弾のダメージが半分になります（1 試合に 4 回まで）。
- 敵から見えない場所で止まっていると、HP が回復します。
- 敵を撃破するか、時間切れや弾切れになったときに残り HP が多いほうが勝ちです。
- 同じロボット・マップ・seed なら、何度やっても同じ試合になります。` } },
      { id: 'parts-help', title: { en: `Choosing parts`, ja: `パーツの選び方` }, body: { en: `A robot is made of four parts: the **body** (HP), the **legs** (speed), the **gun** (damage, range, how often it fires) and the **sensor** (how far and which way it sees). Choose them in the project's \`config\`.

- Each part has a cost, and the total may be **at most 12**. To carry a strong cost-4 part, make another slot a cost-2 part: those are weaker at something, in return for their low cost.
- Put the mouse on a part's name to see what it does. Below, the robot's numbers are shown with the difference from standard.
- Choose parts to suit the program: the Cannon and Scope to shoot from afar, Rapid and Heavy to get close and fire away, Sprint or Light to fight from cover.
- Changing parts never changes the words you can use.`, ja: `ロボットは、**車体**（HP）、**脚**（速さ）、**銃**（威力・射程・撃つ間隔）、**センサー**（見える距離と向き）の 4 つのパーツでできています。パーツはプロジェクトの \`config\` で選びます。

- パーツにはそれぞれコストがあり、合計は **12 まで** です。コスト 4 の強いパーツを積むなら、どこかをコスト 2 のパーツにします。コスト 2 のパーツは、何かが苦手なかわりにコストが低いパーツです。
- パーツ名にマウスを載せると説明が出ます。下には、その組み合わせの性能が標準との差つきで出ます。
- プログラムに合うパーツを選びましょう: 遠くから撃つなら Cannon と Scope、近づいて撃ちまくるなら Rapid と Heavy、隠れながら戦うなら Sprint や Light。
- パーツを替えても、使える語は変わりません。` } },
      { id: 'sharing', title: { en: `Sharing and files`, ja: `共有とファイル` }, body: { en: `There is no server. Robots and matches are given to others as **share codes** or **files**.

- **Robots**: \`⇪\` in the garage gives a share code, or **SAVE FILE**. The other person takes it in with **+ IMPORT** in their garage.
- **Matches**: \`⇪\` on an arena result gives a share code and a file, which plays in their arena.
- **Contest results**: save to a file from the contest's **RESULT** menu; **Open a result file…** shows the same board.
- File names end in \`.roboscript.json\`. Files stay small, however long the program.
- When the rules version differs, you are told so (the match may not play out the same).`, ja: `サーバーはありません。ロボットや試合は、**共有コード** か **ファイル** で人に渡します。

- **ロボット**: ガレージの \`⇪\` で共有コード、または「ファイルに保存」。もらった人はガレージの「＋ 取り込む」で取り込みます。
- **試合**: アリーナの結果の \`⇪\` で共有コードとファイル。もらった人はアリーナで再生できます。
- **大会の結果**: 大会の「結果」メニューからファイルに保存。もらった人は「結果ファイルを開く」で、同じ結果ボードを見られます。
- ファイル名の末尾は \`.roboscript.json\` です。長いプログラムでも、ファイルは小さく収まります。
- ルールの版が違うときは、そう知らせます（同じ試合にならないことがあります）。` } },
      { id: 'keys', title: { en: `Keys`, ja: `キー操作` }, body: { en: `- **Space**: play / pause
- **← / →**: one step back / on (one line while debugging)
- **Cmd / Ctrl + Enter**: run
- **F1** (on a word in the editor): open the guide at that word
- **Esc**: close a menu or the help
- In the editor: Enter / Tab picks a suggestion, Ctrl + Space asks for suggestions, Cmd / Ctrl + / comments a line in or out, Cmd / Ctrl + Z undoes

While you type in the editor or a field, Space and the arrows are part of the text.`, ja: `- **スペース**: 再生 / 一時停止
- **← / →**: 1 つ戻る / 進む（デバッグでは 1 行）
- **Cmd / Ctrl + Enter**: 実行
- **F1**（エディタで語の上）: その語の解説を開く
- **Esc**: メニューやヘルプを閉じる
- エディタ: Enter / Tab で入力候補を確定、Ctrl + Space で候補を出す、Cmd / Ctrl + / でコメント切り替え、Cmd / Ctrl + Z で元に戻す

エディタや入力欄で打っている間は、スペースと矢印は文字入力のままです。` } },
      { id: 'faq', title: { en: `Questions`, ja: `よくある質問` }, body: { en: `**The match does not start when I press RUN**
The program has a mistake, or the parts cost more than 12. Look at the red line and the log.

**My robot does nothing / stops at once**
The program got past its last line and ended. Put what should repeat inside a \`loop\`.

**My shots miss**
The enemy is further than the gun's range (400 as standard), or you shoot on the move and the shots scatter. Drive closer using \`enemy_distance\`, then stop with \`drive stop\` and shoot. For a moving enemy, try \`aim lead\`.

**I cannot find the enemy**
It is probably behind an obstacle. Turn the other way after a while without a sighting, or head for where it was last seen (tutorial chapter 9).

**Has my code gone?**
Code is saved in the browser at every edit. Right after loading a template, Cmd / Ctrl + Z brings yours back. The code of the tutorial and of the challenges is kept apart from your own.`, ja: `**実行しても試合が始まらない**
プログラムにエラーがあるか、パーツのコストが 12 を超えています。赤い行とログを見てください。

**ロボットが何もしない / すぐ止まる**
プログラムが最後の行まで行って終わっています。繰り返したい部分を \`loop\` の中に入れましょう。

**弾が当たらない**
敵が射程（標準は 400）より遠いか、走りながら撃っていて弾がばらけています。\`enemy_distance\` で近づいてから、\`drive stop\` で止まって撃ちましょう。動く敵には \`aim lead\` が効きます。

**敵が見つからない**
障害物の陰にいるのかもしれません。しばらく見つからなければ回る向きを変える、最後に見た場所へ向かう、といった工夫をしましょう（チュートリアル 9 章）。

**自分のコードが消えた？**
コードは編集のたびにブラウザに保存されています。テンプレートを読み込んだ直後なら、Cmd / Ctrl + Z で戻せます。チュートリアルとチャレンジのコードは、いつものコードとは別に保存されています。` } },
    ],
  },
  {
    id: 'script',
    title: { en: 'The RoboScript language', ja: 'スクリプトの解説' },
    topics: [
      { id: 'basics', title: { en: `The basics`, ja: `書き方の基本` }, body: { en: `A RoboScript program is written **one instruction to a line**.

\`\`\`
# ALPHA's program
loop
    turn enemy
    fire
\`\`\`

- The program goes **from the top line down**. Past the last line it ends and does nothing more (the driving setting stays). Put what should happen again and again inside a \`loop\`.
- Match time goes in **ticks** (1/30 of a second). Running an **action** such as \`turn\` / \`aim\` / \`fire\` / \`guard\` / \`wait\` takes one tick, and the next tick goes on from the following line.
- \`if\`, \`set\`, \`drive\`, \`label\` and the like take no time. A robot does one action a tick, but driving (\`drive\`) is a setting, so it goes on alongside the actions.
- The lines inside \`if\` / \`else\` / \`loop\` / \`while\` / \`def\` are indented with **four spaces** from the next line on. Enter indents for you.
- From \`#\` to the end of the line is a **comment** (a note), which does nothing.
- Words are in small English letters; capitals count as different.`, ja: `RoboScript のプログラムは、**命令を 1 行に 1 つずつ** 並べて書きます。

\`\`\`
# ALPHA のプログラム
loop
    turn enemy
    fire
\`\`\`

- プログラムは **上の行から順に** 進みます。最後の行まで行くと終わり、それ以上何もしません（走行の設定は残ります）。何度も繰り返したいことは \`loop\` の中に書きます。
- 試合の時間は **tick**（1/30 秒）で進みます。\`turn\` / \`aim\` / \`fire\` / \`guard\` / \`wait\` のような **行動** を 1 つ実行すると 1 tick たち、次の tick は続きの行から再開します。
- \`if\`、\`set\`、\`drive\`、\`label\` などは時間がかかりません。1 tick にできる行動は 1 つですが、走行（\`drive\`）は設定なので、行動と同時に続きます。
- \`if\` / \`else\` / \`loop\` / \`while\` / \`def\` の中身は、次の行から **半角の空白 4 つ** で字下げして書きます。Enter を押すと自動で字下げされます。
- \`#\` から行末までは **コメント**（メモ）で、何もしません。
- 語は小文字の英語です。大文字と小文字は区別されます。` } },
      { id: 'moving', title: { en: `Moving and shooting`, ja: `動く・撃つ` }, body: { en: `- **Turn the body**: \`turn left\` / \`right\` turn 6 degrees at a time. \`turn enemy\` (towards the enemy), \`turn cover\` (along the way to cover) and \`turn hit\` (towards where you were shot from) turn that way as far as they can in a tick.
- **Turn until facing**: \`face enemy\` / \`cover\` / \`hit\` keep turning, however many ticks it takes, until facing that way.
- **Drive**: \`drive forward\` / \`backward\` / \`stop\`. It is a setting: the robot keeps driving until \`drive stop\`.
- **Turn the turret**: \`aim left\` / \`right\` / \`enemy\` / \`lead\` / \`ahead\`. The turret turns apart from the body, and faster (270 degrees a second). \`aim lead\` aims where a bullet will meet the enemy if it keeps moving as it does.
- **Shoot**: \`fire\` shoots the way the turret points. Nothing happens while the gun is getting the next shot ready (one shot every 0.8 seconds as standard) or out of ammo. A shot fired on the move scatters five times as much as one fired standing still.
- **Brace**: \`guard\` halves the damage of a bullet that hits on that tick (up to 4 times a match; each one puts off your next shot a little).
- **Wait**: \`wait\` does nothing for one tick.`, ja: `- **車体を回す**: \`turn left\` / \`right\` で 6 度ずつ回ります。\`turn enemy\`（敵の方へ）、\`turn cover\`（隠れ場所への道の方へ）、\`turn hit\`（撃たれた方へ）は、その方向へ回せるだけ回ります。
- **向くまで回る**: \`face enemy\` / \`cover\` / \`hit\` は、その方向を向くまで何 tick でも回り続けます。
- **走る**: \`drive forward\` / \`backward\` / \`stop\`。設定なので、\`drive stop\` まで走り続けます。
- **砲塔を回す**: \`aim left\` / \`right\` / \`enemy\` / \`lead\` / \`ahead\`。砲塔は車体とは別に、車体より速く（1 秒に 270 度）回ります。\`aim lead\` は、敵がこのまま動いたときに弾が届く位置を狙います。
- **撃つ**: \`fire\` は砲塔の向きへ撃ちます。次の弾の準備中（標準では 0.8 秒に 1 発）や弾切れのときは、何も起きません。走りながら撃つと、止まって撃つときの 5 倍ばらけます。
- **身構える**: \`guard\` は、その tick に当たった弾のダメージを半分にします（1 試合に 4 回まで。使うたびに、次に撃てるまでが少し延びます）。
- **待つ**: \`wait\` は何もせずに 1 tick 過ごします。` } },
      { id: WORDS_TOPIC, title: { en: 'All the words', ja: '語の一覧' }, body: { en: '', ja: '' } },
      { id: 'values', title: { en: `Numbers and variables`, ja: `数と変数` }, body: { en: `- Every value is a **number**. Calculate with \`+ - * /\` and brackets. Dividing by 0 gives 0.
- **Sensors** are words holding what the robot found out: a number, or true / false (\`enemy_distance\`, \`hp\` and so on). They are listed in "All the words".
- A **variable** is a box for a number. Put a number in with \`set\`:

\`\`\`
set shots = 0
loop
    fire
    set shots = shots + 1
\`\`\`

- A name is letters, digits and \`_\`, starting with a letter. The names of words and sensors cannot be used.
- Reading a name that is never \`set\` anywhere in the program is a mistake. Read before it is set, it is 0.
- While debugging, the variables show at the top of Watch.`, ja: `- 値はすべて **数** です。\`+ - * /\` と括弧で計算できます。0 で割ると 0 になります。
- **センサー** は、ロボットが調べた結果が入った語です。中身は数か、正しい / 正しくないのどちらかです（\`enemy_distance\`、\`hp\` など）。一覧は「語の一覧」にあります。
- **変数** は数を入れておく箱です。\`set\` で入れます。

\`\`\`
set shots = 0
loop
    fire
    set shots = shots + 1
\`\`\`

- 名前は英字で始まる半角の英数字と \`_\` です。語やセンサーの名前は使えません。
- プログラムのどこにも \`set\` のない名前を読むとエラーになります。\`set\` する前に読むと 0 です。
- 変数の中身は、デバッグ中にウォッチの上の欄で見られます。` } },
      { id: 'conditions', title: { en: `Conditions and repeating`, ja: `条件と繰り返し` }, body: { en: `\`\`\`
loop
    if enemy_distance < 200
        drive backward
    else if enemy_distance < 400
        drive stop
        fire
    else
        drive forward
        wait
\`\`\`

- The lines in \`if condition\` run only when the condition holds. \`else if condition\` adds another condition, and \`else\` is for when none held.
- **Compare**: \`<\` \`>\` \`<=\` \`>=\` \`==\` (equal) \`!=\` (not equal).
- **Combine**: \`and\` (both), \`or\` (either), \`not\`, and brackets.
- True / false sensors (\`enemy_visible\` and so on), function calls and variables can stand as a condition on their own (true when not 0). \`true\` / \`false\` are 1 / 0.
- \`loop\` repeats for ever, \`while condition\` while the condition holds. \`break\` leaves the innermost repeat at once.
- Always put an action that takes time in a \`loop\`. Running 1000 lines in a tick without one, the robot does nothing that tick.`, ja: `\`\`\`
loop
    if enemy_distance < 200
        drive backward
    else if enemy_distance < 400
        drive stop
        fire
    else
        drive forward
        wait
\`\`\`

- \`if 条件\` の中身は、条件が正しいときだけ実行されます。\`else if 条件\` で別の条件を続けられ、\`else\` はどれも正しくなかったときです。
- **比べる**: \`<\` \`>\` \`<=\` \`>=\` \`==\`（等しい）\`!=\`（等しくない）。
- **組み合わせる**: \`and\`（両方）、\`or\`（どちらか）、\`not\`（正しくない）、括弧。
- 正しい / 正しくないのセンサー（\`enemy_visible\` など）や、関数の呼び出し、変数は、そのまま条件に書けます（0 でなければ正しい）。\`true\` / \`false\` は 1 / 0 です。
- \`loop\` はずっと、\`while 条件\` は条件が正しいあいだ繰り返します。\`break\` で、いちばん内側の繰り返しをすぐ抜けます。
- \`loop\` の中には、時間のかかる行動を必ず入れましょう。行動のないまま 1 tick に 1000 行を実行すると、その tick は何もせずに終わります。` } },
      { id: 'functions-help', title: { en: `Functions`, ja: `関数` }, body: { en: `\`\`\`
def in_range()
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
\`\`\`

- \`def name(parameter, …)\` gives a group of lines a name. Write it at the outermost level, not indented. Write \`()\` even with no parameters.
- Call it with \`name(value, …)\`, on a line of its own or inside a condition or a calculation.
- With \`return value\`, the call becomes that value (0 without one).
- A function called inside a condition or a calculation cannot hold actions that take time, nor \`loop\` / \`while\`.
- Only the parameters belong to the function; variables made with \`set\` are shared by the whole program.
- A function cannot call itself (no recursion).`, ja: `\`\`\`
def in_range()
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
\`\`\`

- \`def 名前(引数, …)\` で、ひとまとまりの行に名前を付けます。字下げなしの、いちばん外側に書きます。引数がなくても \`()\` を書きます。
- 呼ぶときは \`名前(値, …)\`。1 行に単独で書くか、条件や式の中に書きます。
- \`return 値\` で、呼び出しがその値になります（書かなければ 0）。
- 条件や式の中で呼ぶ関数には、時間のかかる行動と \`loop\` / \`while\` は書けません。
- 関数の中だけで使えるのは引数だけです。\`set\` した変数は、プログラム全体で共有されます。
- 関数が自分自身を呼ぶこと（再帰）はできません。` } },
      { id: 'debugging-help', title: { en: `Debugging`, ja: `デバッグのしかた` }, body: { en: `- Run with **DEBUG**, and the line that runs next (yellow) and the lines run so far in this tick (pale green) are shown.
- \`1▶\` goes on one line, \`◀1\` back one. \`1▷\` (step over) runs through any function the line calls.
- **Click a line number** to mark the line ◆ and jump to the next moment it runs. The seek bar shows every moment it ran; \`◆▶\` / \`◀◆\` go to the next / previous.
- **Watch** shows the variables and sensors, **Inspector** the robot's position, HP and so on. While paused, a sensor shows the value the program reads on that line.
- Click a **log** row to jump to the line that caused it.
- The battle view shows the line of sight to the enemy and aiming marks.

When the robot does not do what you meant, look in Watch for the line where a value is not what you expected.`, ja: `- **デバッグ** で実行すると、次に実行する行（黄色）と、今の tick で通った行（薄い緑）が出ます。
- \`1▶\` で 1 行進み、\`◀1\` で 1 行戻ります。\`1▷\`（ステップオーバー）は、その行が呼ぶ関数の中を一気に進めます。
- **行番号を押す** と、その行に ◆ が付き、その行が次に実行される瞬間へ飛びます。シークバーに、実行されたすべての時点が出ます。\`◆▶\` / \`◀◆\` で次 / 前へ。
- **ウォッチ** に変数とセンサーの値、**状態** にロボットの位置や HP が出ます。一時停止中のセンサーの値は、プログラムがその行で読む値です。
- **ログ** の行を押すと、その出来事を起こした行へ飛びます。
- 戦闘画面には、敵への視線や狙いの印が出ます。

思ったとおりに動かないときは、「どの行で、どの値が、思っていたのと違うか」をウォッチで探しましょう。` } },
      { id: 'errors', title: { en: `Common mistakes`, ja: `よくあるエラー` }, body: { en: `| Message | Usual cause and fix |
|---|---|
| Expected indented block | Indent the line after \`loop\` or \`if\` with four spaces |
| Indent does not match any outer block | Make the number of spaces match an outer block |
| Tabs / full-width spaces are not allowed for indentation | Indent with ordinary spaces |
| Unknown command / Unknown variable | Check the spelling. A variable has to be \`set\` somewhere |
| Expected direction after "turn" | Give a direction, as in \`turn left\` |
| "move" is now "drive" | Use \`drive forward\` (it drives until stopped) |
| "f" cannot be used as a value: it takes time | Take the actions (\`fire\` and so on) out of a function called in a condition or a calculation |
| "f" calls itself | Make sure functions do not call each other round in a circle |
| "break" can only be used inside a loop or a while | Move \`break\` into a repeat |
| The cost is over the limit | Change to lower-cost parts in \`config\`, so the total is 12 or less |

A faulty line turns red, and the editor underlines it. Put the cursor on it to see what is wrong.`, ja: `| ログの文 | よくある原因と直し方 |
|---|---|
| 字下げしたブロックが必要 | \`loop\` や \`if\` の次の行を、空白 4 つで字下げする |
| 字下げが、外側のどのブロックとも合っていない | 字下げの空白の数を、外のブロックとそろえる |
| 字下げにタブ / 全角スペースは使えない | 半角の空白で字下げし直す |
| 知らない命令 / 知らない変数 | つづりを確かめる。変数は、どこかで \`set\` しておく |
| "turn" のあとに方向が必要 | \`turn left\` のように方向を書く |
| "move" は "drive" になった | \`drive forward\` を使う（止めるまで走る） |
| "f" は値として使えない: 時間がかかる | 条件や式の中で呼ぶ関数から、行動（\`fire\` など）を外す |
| "f" が自分自身を呼んでいる | 関数どうしが呼び合わないようにする |
| break は loop か while の中でしか使えない | \`break\` を繰り返しの中に移す |
| コストが上限を超えている | \`config\` でコストの低いパーツに替え、合計を 12 以下にする |

エラーのある行は赤くなり、エディタではその行に波線が出ます。カーソルを載せると内容が出ます。` } },
      { id: 'examples', title: { en: `Examples`, ja: `例` }, body: { en: `**Drive up and shoot**

\`\`\`
loop
    if enemy_visible and enemy_distance < weapon_range - 50
        drive stop
        aim enemy
        fire
    else
        turn enemy
        drive forward
\`\`\`

**Drive sideways, aiming where the enemy will be**

\`\`\`
drive forward
loop
    if blocked
        turn left
    else if lead_angle > 2 or lead_angle < -2
        aim lead
    else
        fire
\`\`\`

**Hide and rest when hurt**

\`\`\`
loop
    if hp < 120 and not hidden
        face cover
        drive forward
        wait
    else if hidden
        drive stop
        wait
    else
        aim enemy
        fire
\`\`\`

To learn more, read the built-in robots' programs with **LOAD TEMPLATE** in the editor.`, ja: `**近づいて撃つ**

\`\`\`
loop
    if enemy_visible and enemy_distance < weapon_range - 50
        drive stop
        aim enemy
        fire
    else
        turn enemy
        drive forward
\`\`\`

**横に走りながら、動く先を狙う**

\`\`\`
drive forward
loop
    if blocked
        turn left
    else if lead_angle > 2 or lead_angle < -2
        aim lead
    else
        fire
\`\`\`

**HP が減ったら隠れて休む**

\`\`\`
loop
    if hp < 120 and not hidden
        face cover
        drive forward
        wait
    else if hidden
        drive stop
        wait
    else
        aim enemy
        fire
\`\`\`

もっと知りたいときは、エディタの **テンプレート** で内蔵ロボットのプログラムを読んでみましょう。` } },
    ],
  },
];
