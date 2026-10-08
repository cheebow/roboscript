// Chapter 10 of the tutorial: the castle match (the team battle).
import { CASTLE_SPLIT } from '../data/team_templates';
import { TARGET_BOT, castleStage } from './stages';
import type { Chapter } from './types';

/** The castle chapter's training teams. */
const SITTING_TEAM = TARGET_BOT;

export const CASTLE_CHAPTER: Chapter = {
  id: 'castle',
  title: { en: `The castle match`, ja: `城攻め（チームバトル）` },
  steps: [
    {
      id: 'castle-first',
      title: { en: `A castle to bring down`, ja: `城を落とす` },
      body: {
        en: `In the **team battle** (in the start menu) each side defends a **castle**. A team loses the moment its castle's HP reaches 0 — and only then: as long as the castle stands, the team is in the match, even with every robot gone. When time runs out, the healthier castle wins.

New words come with it:

- **\`enemy_base_distance\`** / **\`enemy_base_angle\`** … to the enemy castle's centre
- **\`base_hp\`** / **\`enemy_base_hp\`** … the castles' HP
- **\`face enemy_base\`** / **\`face base\`** … turn until you face a castle

Bullets stop at a castle, and only **enemy** bullets wear it down. This opponent just sits there: march on its castle, and shoot whatever stands in the way.`,
        ja: `**チームバトル**（起動メニューにあります）では、どちらの側も **城** を守ります。城の HP が 0 になった瞬間、そのチームの負けです — そして、それだけが負けです。城が立っているかぎり、ロボットが全滅してもチームは戦いの中にいます。時間切れなら、城の HP が多いほうの勝ちです。

新しい語があります。

- **\`enemy_base_distance\`** / **\`enemy_base_angle\`** … 敵の城の中心まで
- **\`base_hp\`** / **\`enemy_base_hp\`** … 城の HP
- **\`face enemy_base\`** / **\`face base\`** … 城の方を向くまで回る

弾は城で止まり、城を削れるのは **敵の** 弾だけです。今回の相手はその場に座っているだけ。城へ向かって進み、じゃまなものは撃ちましょう。`,
      },
      task: {
        en: `Use \`enemy_base_distance\` to march into range and bring the castle down. Its keeper is only in the way: beating it wins nothing.`,
        ja: `\`enemy_base_distance\` を使って射程まで進み、城を落として勝ちましょう。守りを倒しても、城が残っているうちは勝ちではありません。`,
      },
      hints: [
        {
          en: `While \`enemy_base_distance\` is more than \`weapon_range - 50\`: \`face enemy_base\`, \`drive forward\`. Once it is less: \`drive stop\`, \`face enemy_base\`, \`aim ahead\`, \`fire\`. End the marching branch with \`wait\`.`,
          ja: `\`enemy_base_distance\` が \`weapon_range - 50\` より大きい間は \`face enemy_base\` と \`drive forward\`。小さくなったら \`drive stop\`、\`face enemy_base\`、\`aim ahead\`、\`fire\` です。`,
        },
      ],
      answer: `loop
    if enemy_base_distance < weapon_range - 50
        drive stop
        face enemy_base
        aim ahead
        fire
    else
        face enemy_base
        drive forward
        wait
`,
      start: `# March on the enemy castle, and shell it from inside your range.
loop
    wait
`,
      stage: castleStage(1, SITTING_TEAM, 101),
      check: { kind: 'match', goal: { kind: 'win' }, uses: ['enemy_base_distance'] },
    },
    {
      id: 'castle-team',
      title: { en: `One program, three machines`, ja: `1 本のプログラムで 3 台` },
      body: {
        en: `A team is **one program running on every machine**. Each machine runs its own copy, with its own variables and its own sensors — so the same code can act differently on each.

**\`self_id\`** is the machine's number: 1, 2 or 3. With it, one program can split roles:

\`\`\`
if self_id == 1
    label GUARD
else
    label ATTACK
\`\`\`

Pick a machine on the **STATE** panel's tabs to watch its values; while debugging, the lines being run are the picked machine's too.`,
        ja: `チームは、**1 本のプログラムが全機体で動く** 形です。機体はそれぞれ自分のコピーを実行し、変数もセンサーも機体ごとに別です。だから同じコードでも、機体ごとに違う動きになります。

**\`self_id\`**（セルフ・アイディー）は自分の番号で、1、2、3 のどれかです。これで 1 本のプログラムに役割を分けられます。

\`\`\`
if self_id == 1
    label GUARD
else
    label ATTACK
\`\`\`

**状態** の欄のタブで機体を選ぶと、その機体の値をウォッチで見られます。デバッグ中の行の表示も、選んだ機体のものになります。`,
      },
      task: {
        en: `Make machine 1 stand guard while the others march on the enemy castle, and win. Use \`self_id\`.`,
        ja: `\`self_id\` を使って、1 番機は守りに残し、ほかの機体で敵の城へ攻め込んで勝ちましょう。`,
      },
      hints: [
        {
          en: `Start the loop with \`if self_id == 1\`: stop, aim, fire. Under \`else\`: the marching and shelling of the last step.`,
          ja: `loop の最初を \`if self_id == 1\` にして、止まって狙って撃つ。\`else\` の下に、前のステップの「進んで撃つ」を書きます。`,
        },
      ],
      answer: `loop
    if self_id == 1
        label GUARD
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
      // Light bodies and pistols: three of them fit the team's cost limit, where three standard machines would not.
      stage: castleStage(3, SITTING_TEAM, 102, { player: { body: 'light', gun: 'pistol' } }),
      check: { kind: 'match', goal: { kind: 'win' }, uses: ['self_id'] },
    },
    {
      id: 'castle-signal',
      title: { en: `The team radio`, ja: `チームの無線` },
      body: {
        en: `Teammates share one **radio**. **\`signal 1\`** puts a number on it; from the next tick, everyone reads it as **\`ally_signal\`**, until a new number is sent. What each number means is up to your program.

This opponent splits up: one keeper stays home, two machines come for your castle. March on the enemy castle together, with a rule on the radio: whoever gets an enemy in range **calls the team** — \`signal 1\` — and keeps calling while it fights. A machine that hears the call heads for its nearest teammate with **\`face ally\`**: every call is answered by every free gun. And a finished call must be **taken back** — the caller sends \`signal 0\` once no enemy is in sight — or the team would keep answering it forever. Remembering whether it was you who called takes a variable.

Watch \`ally_signal\` change in the WATCH panel while you debug: that is the protocol you designed, running.`,
        ja: `味方は 1 本の **無線** でつながっています。**\`signal 1\`** で数を載せると、次の tick から全員が **\`ally_signal\`** で読めます（新しい数を送るまで残ります）。数の意味はプログラムで決めます。

今回の相手は兵力を割いてきます: 1 台を城に残し、2 台がこちらの城へ向かってきます。こちらは全員そろって敵の城へ進軍し、無線にルールをひとつ決めましょう: 敵を射程にとらえた機体が **チームを呼ぶ** — \`signal 1\` — 戦っている間は呼び続けます。呼ばれた機体は **\`face ally\`** で一番近い味方のところへ駆けつけます。手のあいた銃は全部、呼ばれた場所に集まるわけです。そして、終わった呼び出しは **取り消す** こと — 敵が見えなくなったら呼んだ機体が \`signal 0\` を送ります。そうしないと、チームは永遠に駆けつけ続けます。「呼んだのが自分かどうか」を覚えておくのには変数を使います。

デバッグ中にウォッチの \`ally_signal\` が変わるのを見てください。自分で設計した無線のやりとりが動いています。`,
      },
      task: {
        en: `March on the enemy castle together and bring it down, calling every fight with \`signal\` and \`ally_signal\`.`,
        ja: `\`signal\` と \`ally_signal\` で戦いのたびにチームを呼び集めながら、そろって攻め込み、敵の城を落としましょう。`,
      },
      hints: [
        {
          en: `An enemy in range: \`signal 1\`, remember you called (\`set called = 1\`), stop, aim, fire. Otherwise, first take back your own call (\`signal 0\`); then, if \`ally_signal == 1\`: \`face ally\`, \`drive forward\`. No call: the marching and shelling of the first step.`,
          ja: `敵が射程にいたら \`signal 1\`、呼んだことを覚えて（\`set called = 1\`）、止まって狙って撃つ。そうでなければ、まず自分の呼び出しを取り消す（\`signal 0\`）。そのうえで \`ally_signal == 1\` なら \`face ally\` と \`drive forward\`、呼ばれていなければ最初のステップの「進んで撃つ」です。`,
        },
      ],
      answer: `set called = 0
loop
    if enemy_visible and enemy_distance < weapon_range
        signal 1
        set called = 1
        label FIGHT
        drive stop
        aim enemy
        fire
    else
        if called == 1
            signal 0
            set called = 0
        if ally_signal == 1
            label ANSWER
            face ally
            drive forward
            wait
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
      stage: castleStage(3, CASTLE_SPLIT, 103, { bot: { gun: 'pistol', body: 'light' }, player: { body: 'light', gun: 'pistol' } }),
      check: { kind: 'match', goal: { kind: 'win' }, uses: ['signal', 'ally_signal'] },
    },
    {
      id: 'castle-next',
      title: { en: `Your team awaits`, ja: `キミのチームを作ろう` },
      body: {
        en: `That is the whole idea of the castle match: one program, a castle to keep, a castle to take, and a radio between your machines.

Two more things worth knowing:

- **Parts tell machines apart.** \`sensor_range\`, \`max_speed\` and \`max_hp\` read your own machine's own parts, so roles can follow equipment: \`if sensor_range > 800\` — the far-sighted machine scouts. Fit each machine on its config (the 1 2 3 tabs), within the team's shared cost.
- **\`allies_alive\`** counts your living teammates: \`if allies_alive == 0\` is "I am the last one".

Open **TEAM BATTLE** from the start menu: write your team, pick the size (1 to 5 a side) and the map, watch saved teams fight under the commentary, and share a team with a link, like a robot.`,
        ja: `これが城攻めの全体像です。1 本のプログラム、守る城と落とす城、そして機体をつなぐ無線。

あと 2 つ、覚えておくと良いことを。

- **装備で機体を書き分けられます。** \`sensor_range\`・\`max_speed\`・\`max_hp\` は自分の機体の装備を読むので、役割を装備に合わせられます: \`if sensor_range > 800\` なら「目のいい機体が偵察」。装備は config（1 2 3 のタブ）で機体ごとに選べて、コストはチームで 1 つの枠です。
- **\`allies_alive\`** は生きている味方の数です。\`if allies_alive == 0\` は「自分が最後の 1 台」。

起動メニューから **チームバトル** を開きましょう。チームを書き、台数（片側 1〜5）とマップを選び、保存したチーム同士の試合を実況つきで観戦でき、ロボットと同じようにリンクでチームを人に渡せます。`,
      },
      check: { kind: 'read' },
    },
  ],
};
