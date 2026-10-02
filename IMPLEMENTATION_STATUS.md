# IMPLEMENTATION STATUS

上位仕様は `SPEC.md`（Codex向け実装指示書 v0.1）。
技術構成だけ指示書から変更し、Godot / GDScript ではなく **Web（TypeScript + Vite + Canvas 2D + CodeMirror 6）** で実装している。

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | 戦闘エンジン | 完了（2026-10-01） |
| 2 | RoboScript | 完了（2026-10-01） |
| 3 | IDE UI | 完了（2026-10-01） |
| 4 | DEBUG機能 | 完了（2026-10-01） |
| 5 | Polish | 完了（2026-10-01） |

**MVP 完成条件（指示書38章）の15項目は、Phase 5 の時点ですべて満たした**（確認内容は「MVP 完成条件の確認」）。その後、15番目の「ブレークポイントで停止できる」は意図して外し、行の実行時点へ移動する機能に置き換えている。

MVP 完成後に、画面の配置、移動の仕組み（タンク式）、センサー、マップ（3種から選択）、**RoboScript の実行モデル（1命令 = 1tick、ループと変数）とデバッガ（行単位）**、エディタの入力支援、身を守るためのセンサーと行動（弾の検知、`guard`、隠れ場所、壁までの距離）、**走りながら撃つ仕組み（走行の持続 `drive`、車体と別に回る砲塔 `aim`、移動先を狙う `aim lead`）**、サンプルAIと敵AIのコードを変更・追加した。**現在の仕様は「MVP 完成後の変更」が正**で、Phase 1〜5 の節にある時刻・行番号・画面サイズ・対戦結果・言語仕様は各Phase 完了時点の記録。

## 実行方法

```sh
npm install
npm run dev        # 表示された URL をブラウザで開く
```

- 中央上の CODE EDITOR にプレイヤー（ALPHA、緑、右側から開始）のAIコードが入っている。**RUN** で敵（BRAVO、オレンジ）との試合が始まる。
- PROJECT には ALPHA と BRAVO があり、それぞれ `main.bot`（コード）と `config`（ロボット情報）を持つ。**敵（BRAVO）のコードも編集できる。**
- `main.bot` を開いているとき、見出し右の **LOAD TEMPLATE** で、そのエディタにテンプレート（Sample / DumbBot / AggressiveBot / CowardBot / GuardBot / CoverBot / StrafeBot）をロードできる（Cmd / Ctrl + Z で取り消せる）。初期状態は ALPHA が Sample、BRAVO が DumbBot。
- 上部の **MAP** でマップ（9種: Center Block / Open Field / Long Wall / Bare Ground / Pillars / Corridor / Bunkers / Cross / Zigzag）を選ぶ。次の RUN / DEBUG から反映される。
- **DEBUG** で同じ試合を DEBUG モードで再生する（次に実行する行のハイライト、全種類のログ、行の実行時点への移動、戦闘画面に視線・ターゲット枠・最後に見た位置・ラベル）。視線などは INSPECTOR で選んでいるロボットのもの。
- **PAUSE / PLAY** で停止 / 再開、**RESET** で初期配置に戻る。
- BATTLE VIEW の下の操作列: PLAY / PAUSE、`◀1` と `1▶`（DEBUG では**1行**、RUN では 1tick ずつ戻る / 進む）、シークバー、再生速度（0.25x〜4x）。
- DEBUG LOG の行をクリックすると、その時点に戻り、該当するコード行へ移動する。
- DEBUG 中に CODE EDITOR の行番号（またはその左の余白）をクリックすると、**その行が次に実行される直前へ移動する**。もう一度クリックでその次へ、Shift+クリックで1つ前へ。その行が実行された時点は、シークバーに目印で出る。
- WATCH には、プログラムが `set` した変数と、センサーの値が出る。
- CODE EDITOR は入力を助ける: 入力候補（Enter / Tab で確定、`Ctrl+Space` で呼び出し）、語にカーソルを載せると説明、自動インデント、エラーの赤い波線、`Cmd / Ctrl + /` でコメント切り替え。
- 構文エラーがあると、該当行が赤くなり、DEBUG LOG に ERROR が出て、試合は始まらない。
- 両方のコードは編集のたびにブラウザの localStorage へ自動保存され、再読み込みしても残る。
- `?seed=数値` を URL に付けると seed を変えられる（例: `http://localhost:5173/?seed=7`）。

## テスト方法

```sh
npm test           # Vitest（424件）
npm run typecheck
npm run build
```

## プロジェクト構成

```text
SPEC.md                    上位仕様
IMPLEMENTATION_STATUS.md   このファイル
index.html                 5領域のレイアウト
src/
├─ data/
│  ├─ robot_defaults.ts    ロボット基本値（数値はここに集約）
│  ├─ match_defaults.ts    tickレート、試合時間、既定seed、1tick の行数上限
│  ├─ arenas/              マップ9種（index.ts が一覧。1マップ1ファイル、common.ts は共通部分）
│  └─ templates/           テンプレート（RoboScriptソース）。index.ts が一覧と、ロード先に合わせた旋回の向きの入れ替え
│     ├─ index.ts          テンプレートの一覧（id / 表示名 / ソース）
│     ├─ sample.ts
│     ├─ dumb_bot.ts
│     ├─ aggressive_bot.ts
│     ├─ coward_bot.ts
│     ├─ guard_bot.ts
│     ├─ cover_bot.ts
│     ├─ strafe_bot.ts
│     └─ side.ts           障害物を回り込む側（ALPHA は左、BRAVO は右）
├─ sim/                    DOM非依存。Node上で単体実行できる
│  ├─ types.ts             Vec2 / Rect / Arena
│  ├─ math.ts              角度、衝突判定
│  ├─ rng.ts               MatchRng（seed付き乱数）
│  ├─ ai_context.ts        AIContext / AIAction / RobotBrain / RobotState
│  ├─ sensor.ts            Sensor インターフェース + ConeSensor
│  ├─ surroundings.ts      Surroundings（ロボットが周りについて分かること: 壁、飛んでくる弾、隠れ場所）
│  ├─ aiming.ts            leadPoint（動く敵に弾が届く点）
│  ├─ threats.ts           findIncomingBullet（当たるコースの弾）
│  ├─ range_finder.ts      wallDistance（壁・障害物までの距離）
│  ├─ cover.ts             findCover（敵から隠れられる場所と、そこまでの経路）
│  ├─ weapon.ts            Weapon インターフェース + Gun
│  ├─ bullet.ts            Bullet と1tick分の移動・衝突
│  ├─ robot.ts             RobotController
│  ├─ simulation.ts        Simulation（step() で1tick）と勝敗判定
│  └─ event_reporter.ts    試合中の出来事をデバッグイベントにする
├─ ai/                     RoboScript
│  ├─ lexer.ts             行 → インデント幅とトークン列
│  ├─ ast.ts               IfNode / LoopNode / WhileNode / SetNode / ActionNode / StateNode、式と条件
│  ├─ parser.ts            parse(source) → { program, errors }
│  ├─ script_variables.ts  予約語・センサー名・方向の定義
│  ├─ script_error.ts      ScriptError と "Line N: ..." の整形
│  ├─ runtime.ts           ScriptBrain（途中で止まって続きから再開できるインタプリタ）
│  ├─ features.ts          featuresOf（プログラムが隠れ場所・弾の検知・偏差射撃を使うか）
│  ├─ reference.ts         語ごとの説明（入力候補とホバーで使う）、プログラムの変数の一覧
│  ├─ completion.ts        completionsAt(source, position) → その位置に合う入力候補
│  ├─ indentation.ts       indentFor(lines, lineIndex, unit) → その行の字下げ幅
│  └─ roboscript.ts        compileScript(source) → Brain またはエラー一覧
├─ debug/
│  ├─ debug_event.ts       DebugEvent（tick / timestamp / robotId / type / message / sourceLine）
│  ├─ debug_logger.ts      DebugLogger（1試合分のイベントをメモリに保持）
│  ├─ snapshot.ts          Snapshot（1tick分の表示用の状態）と captureSnapshot
│  ├─ effects.ts           EffectTracker（発射・着弾・破壊を数tick続くエフェクトにする）
│  ├─ recorder.ts          recordMatch(config) → Recording（全スナップショット + イベント）
│  └─ replay_manager.ts    ReplayManager（表示位置 = tick + 行、再生、速度、行単位の step、seek、行の実行時点への移動）
├─ project/
│  └─ project_store.ts     main.bot と project.json の保存・読み込み
├─ ui/                     画面。記録された Snapshot を表示する
│  ├─ app.ts               全体の配線（試合の記録、RUN / DEBUG / RESET、描画ループ、保存）
│  ├─ toolbar.ts           上部バー
│  ├─ transport.ts         再生操作（1行 / 1tick 移動、シークバー、速度、時刻）
│  ├─ project_panel.ts     PROJECT ツリー
│  ├─ code_editor.ts       CodeMirror のラッパー
│  ├─ roboscript_highlight.ts  シンタックスハイライト
│  ├─ roboscript_assist.ts 入力候補・ホバー説明・自動インデントをエディタにつなぐ
│  ├─ config_view.ts       config（ロボット基本値の一覧）
│  ├─ inspector.ts         INSPECTOR
│  ├─ watch_panel.ts       WATCH
│  ├─ debug_log.ts         DEBUG LOG
│  └─ field_list.ts / format.ts / dom.ts  共通部品
├─ view/
│  ├─ battle_view.ts       Canvas描画（Snapshot を描く）
│  ├─ sprites.ts           ドットパターンとスプライト生成
│  ├─ effects_layer.ts     エフェクトの描画
│  └─ debug_overlay.ts     視線、ターゲット枠、最後に見た位置
├─ main.ts
└─ style.css
tests/                     lexer / parser / runtime / reference / completion / indentation / scripts / sensor / weapon / movement /
                           battle / determinism / debug_logger / project_store / replay /
                           effects / templates / arenas / surroundings / defence / turret / math（strategies.ts は対戦確認用のプレイヤーAI）
```

指示書34章の `BattleController` の責務は、`Simulation`（tick・ロボット更新・勝敗）、`recordMatch`（試合開始から終了まで）、`ReplayManager`（pause・速度・reset 後の再生）に分けている。

---

## MVP 完成後の変更

| 変更 | 内容 |
|---|---|
| 画面の配置 | 上段に PROJECT・CODE EDITOR・BATTLE VIEW を左右に並べ、下段に DEBUG LOG・INSPECTOR・WATCH を置いた。BATTLE VIEW は 1440x900 で 515x309 → 866x520、1100x700 で 327x196 → 584x350 |
| 開始時の向き | 背中合わせ → 向かい合わせ |
| 移動 | **タンク式**。向きの方向にだけ前進・後退する。横移動（`move left` / `move right`）は廃止し、斜めに障害物へ当たっても滑らず止まる |
| センサー | **全方位（360°）で、障害物に遮られる**。車体がどちらを向いていても敵を追えるが、障害物の陰の敵は見えない |
| マップ | 9種から選択（下記）。既定は Center Block。上部の MAP で選び、`project.json` に保存される |
| PROJECT ツリー | ALPHA と BRAVO に分け、それぞれに `main.bot` と `config` を持たせた |
| 敵のコード | **BRAVO の `main.bot` も編集できる。** 上部の VS（敵の選択）は廃止した |
| テンプレート | `LOAD TEMPLATE` で、Sample / DumbBot / AggressiveBot / CowardBot / GuardBot / CoverBot / StrafeBot をどちらのエディタにもロードできる（下記） |
| **RoboScript 2** | **プログラムが上から下へ1回流れ、行動の文を1つ実行するたびに 1tick 進む**方式に作り替えた。`loop` / `while` / `set`（変数）/ 算術式 / 括弧 / コメントを追加（下記） |
| **行単位のデバッガ** | 「現在の行」は次に実行する1行。`1▶` / `◀1` は1行ずつ。行番号のクリックで、その行が実行される時点へ移動する。WATCH にプログラムの変数が出る（下記） |
| DEBUG 時の表示 | 視野の扇形をやめ、敵が見えている間の視線（直線）を描く。ターゲット枠・最後に見た位置・ラベルは変更なし |
| **エディタの入力支援** | 入力候補、ホバーでの説明、自動インデント、入力中のエラー表示（下記） |
| **身を守るセンサーと行動** | 飛んでくる弾（`bullet_*`）、隠れ場所（`cover_*` と `turn cover`）、壁までの距離（`wall_*`）が読め、`guard` でダメージを半分にできる（下記） |
| **走りながら撃つ** | 走行は `drive` で設定して続ける。砲塔は車体と別に `aim` で回す。`aim lead` は敵の移動先を狙う（下記） |
| ログの ACTION | 「行動が変わったら記録」から「その行の行動が直近1秒間に実行されていなかったら記録」に変えた（旋回と前進が毎tick 入れ替わるため） |

途中で一度 `clear_shot`（射線が通っているか）という変数を追加したが、センサーが障害物に遮られるようになって `enemy_visible` と同じ意味になったので、コミット前に廃止した。

### 現在の RoboScript（RoboScript 2）

Phase 2 の言語（毎tick プログラム全体を先頭から評価し直す）では、DEBUG で1行ずつ進められず、「現在の行」が1行に決まらず、ループも変数も書けなかった。通常のプログラムと同じ流れ方に作り替えた。

| 種類 | 文 | かかる時間 |
|---|---|---|
| 行動 | 車体の旋回 `turn left` / `right` / `enemy` / `cover`、砲塔の旋回 `aim left` / `right` / `enemy` / `lead` / `ahead`、`fire` / `guard` / `wait` | **1tick** |
| 走行 | `drive forward` / `drive backward` / `drive stop`（止めるまで走り続ける） | なし |
| 制御 | `if 条件` / `else` / `loop`（ずっと繰り返す）/ `while 条件`（条件が真の間繰り返す） | なし |
| 変数 | `set 名前 = 式` | なし |
| 表示 | `label 名前`（ロボットが今していることに付ける札。名前は自由） | なし |
| コメント | `#` から行末まで | — |

- **実行**: 先頭から1行ずつ進む。行動の文を実行すると、その行動を 1tick ぶん行い、次の tick は続きの行から再開する。
- **1tick に行動は1つ。走行はそれと並行して続く。** 走りながら撃てるし、走りながら旋回もできるが、車体の旋回と砲塔の旋回、旋回と射撃は同じ tick にはできない。
- **最後の行まで行くと、ロボットは何もしなくなる。** 繰り返したい処理は `loop` に入れる。ログに `program finished: the robot stops (use loop to keep it going)` が出る。
- **`label 名前`** は、ロボットが今していることに札を付ける。**表示のためだけのもので、動きは変わらない。** 札はロボットの下（DEBUG 中）・INSPECTOR・WATCH に出続け、変わったときだけログに `label SEARCH -> TRACK` と出る。名前は自由（英数字とアンダースコアの1語。`label HIDING`、`label wait_for_ammo` など）。何も付けていない間は `IDLE`。
  - 以前は `state` という名前で、`IDLE` / `SEARCH` / `TRACK` / `ATTACK` / `EVADE` の5つしか書けなかった。`state` と書くとロボットの動きが切り替わるように見えるのに、実際は表示だけだったので、名前を変えて自由に書けるようにした。古い `state ...` はエラーになり、`label` を案内する。
  - `print` や `log` にしなかったのは、プログラムがループで毎 tick 実行されるため。「実行するたびに1行出る」ものにすると、1秒に30行ずつログが流れる。
- **変数**は数値のみ。式には `+ - * /`、括弧、数値、変数、センサーの数値が使える。プログラムのどこにも `set` のない名前を使うと `Unknown variable "x"`。`set` より前に読むと 0。0 で割ると 0。予約語とセンサーの名前は変数名にできない。
- **条件式**: 比較（`< > <= >= == !=`、両辺は式）と `and` / `or` / `not`、括弧。センサーの値は、その行を実行している tick のもの。
- **暴走の防止**: 行動を実行しないまま 1tick に 1000行（`MATCH_DEFAULTS.lineBudget`）を実行したら、その tick は何もせず、次の tick に続きから再開する。ログに `too many lines without an action: …` が1回出る（例: 行動のない `loop`）。
- `move` は廃止した。書くと `Line N: "move" is now "drive": use "drive forward" (the robot keeps driving until "drive stop")` というエラーになる。`drive left` / `drive right` も `Robots cannot drive sideways: …` というエラー。
- **`drive` だけのループは「行動のないループ」になる。** 何もしない場面には `wait` を書く。
- インデントは空白（タブはエラー）。ブロックは `if` / `else` / `loop` / `while` の次の行を字下げして書く。

センサーの値:

| 名前 | 意味 |
|---|---|
| `enemy_visible` | 敵がセンサー範囲内にいて、障害物に隠れていない。向きは関係ない。判定には車体の幅ぶんの余裕を取っているので、**見えていれば、まっすぐ走って行けるし、撃てば届く** |
| `blocked` | 障害物か壁が正面にあり、前へ進めない。相手ロボットは数えない（ぶつかった敵に向いたまま撃てるようにするため） |
| `blocked_behind` | 障害物か壁が真後ろにあり、後退できない。相手ロボットは数えない |
| `enemy_distance` / `enemy_angle` | 見えていれば敵まで、見えていなければ最後に見た位置までの距離と相対角度。一度も見ていなければ 0 |
| `hp` / `ammo` / `guards` | 自分の HP、残弾、`guard` の残り回数 |
| `bullet_incoming` / `bullet_distance` / `bullet_angle` | 当たるコースの弾があるか、その弾までの距離と方向（下記） |
| `cover_visible` / `cover_distance` / `cover_angle` | 敵から隠れられる場所へ行けるか、そこまでの道のりと、次に向かう方向（下記） |
| `wall_ahead` / `wall_behind` / `wall_left` / `wall_right` | その方向の壁・障害物までの距離（下記） |
| `aim_angle` / `lead_angle` / `gun_angle` | 砲塔から敵まで、砲塔から敵の移動先までの角度と、車体の上での砲塔の向き（下記） |

実装: `ScriptBrain`（`src/ai/runtime.ts`）は JavaScript のジェネレータで書いたインタプリタで、行動の文で `yield` して tick を終え、次の `decide()` で続きから再開する。実行位置と変数はロボットごとに持つ。エンジン側（`RobotBrain` / `AIContext` / `AIAction`、`Simulation`）の形は変えていない。同じ seed・同じコードなら同じ結果になる。

### 走りながら撃つ: 走行、砲塔、偏差射撃

「動かずに射程ぎりぎりから撃つ」戦い方がほぼ負けなしだったので、動く側が有利になるように作り替えた。それまでは、1tick に行動が1つなので動く側は撃つ回数が減り、砲が車体に固定なので撃つには敵へまっすぐ向くしかなかった。

**走行（`drive`）**

- `drive forward` / `drive backward` / `drive stop` は**時間のかからない設定文**（`set` や `label` と同じ）。ロボットは `drive stop` か別の `drive` まで走り続け、その間に旋回・照準・射撃・`guard` ができる。
- 壁や障害物に向かって走ると、その場で止まったまま（滑らない）。向きを変えて進めるようになれば、また走り出す。
- プログラムが終わっても、走行の設定は残る。

**砲塔（`aim`）**

| 文 | 動き |
|---|---|
| `aim left` / `aim right` | 砲塔を左 / 右へ回す |
| `aim enemy` | 砲塔を敵の今の位置（見えなければ最後に見た位置）へ向ける |
| `aim lead` | 砲塔を、敵が今の動きを続けた場合に弾が届く頃の位置へ向ける |
| `aim ahead` | 砲塔を車体の正面へ戻す |

- 砲塔は車体の上で回る（`ROBOT_DEFAULTS.turretSpeed` = 270°/秒、1tick に 9°。車体は 180°/秒）。車体を旋回すると砲塔も一緒に回る。
- **`fire` は砲塔の向きへ撃つ。** `aim` を一度も使わなければ砲塔は正面のままなので、`turn enemy` と `fire` だけのプログラムは今までどおり動く。
- センサー: `aim_angle`（砲塔から敵までの角度。0 なら `aim enemy` で狙えている）、`lead_angle`（砲塔から敵の移動先までの角度。0 なら `aim lead` で狙えている）、`gun_angle`（車体の正面から見た砲塔の向き）。`enemy_angle` / `bullet_angle` / `cover_angle` は今までどおり車体の正面が基準。

**偏差射撃（`aim lead`）**

- 弾は 400 離れた相手に届くまで約1秒かかり、その間に横へ走る相手は 100 進む。今の位置を狙う `aim enemy` / `turn enemy` の弾は、横に走る相手の後ろを通る（テストで固定: 距離 300 を横切る相手に 4秒間 1発も当たらない）。
- `aim lead` は、敵の直前 1tick の動きを速度とみなし、弾と敵が出会う点を求めて、そこへ砲塔を向ける（`src/sim/aiming.ts`）。まっすぐ走る相手には当たり、弾が届く前に折り返す相手には外れる。止まっている相手には `aim enemy` と同じ。
- 敵が見えない間は、最後に見た位置を狙う。

**1tick の順序**: 観測 → 判断 → 走行の設定 → 車体の旋回 → 走行 → 砲塔の旋回 → 射撃 → 弾の移動。

**画面**: 車体と砲塔を別のスプライトで描き、砲塔が回るのが見える。INSPECTOR に GUN（砲塔の向き）と DRIVE（走行の設定）、WATCH に `aim_angle` / `lead_angle` / `gun_angle` を追加した（INSPECTOR も2列表示）。DEBUG では、`aim lead` か `lead_angle` を使うプログラムのロボットを選んでいると、敵の移動先に「＋」の印が出る。

書き方の例（走りながら、移動先を狙って撃つ）:

```text
drive forward
loop
    if enemy_visible
        if lead_angle > 2 or lead_angle < -2
            aim lead
        else
            fire
    else
        wait
```

### 身を守るためのセンサーと行動

**飛んでくる弾**

| 名前 | 意味 |
|---|---|
| `bullet_incoming` | 敵の弾が、今いる場所にこのまま当たるコースで飛んできている |
| `bullet_distance` | その弾までの距離（複数あれば最も近いもの）。なければ 0 |
| `bullet_angle` | その弾がいる方向（-180〜180、右が正）。なければ 0 |

- 「当たるコース」= 弾の残りの飛距離の中で、壁や障害物に当たる前に、自分の車体（半径 + 弾の半径）を通る。外れる弾、遮られる弾、届かない弾、自分の弾は数えない（`src/sim/threats.ts`。当たり判定は弾の移動と同じ関数を使う）。
- 弾は 1tick に約13 進む（速度 400 / 30tick）。400 離れて撃たれた弾は当たるまで約1秒。
- **避け方**: 弾に対して横を向き、前か後ろへ進んで弾のコースから出る。射程ぎりぎり（380）から撃ち続ける相手なら1発も当たらなくなる。近いほど時間がなく、横を向き終えるまでの1〜3発は当たる（テストで固定）。

**防御（`guard`）**

- `guard` は 1tick の行動。**その tick に当たった弾のダメージが半分（20 → 10）になる。** 構えている tick は旋回も照準も射撃もできない（走行は続く）。割合は `ROBOT_DEFAULTS.guardDamageFactor`（0.5）。
- **構えられるのは 1試合に 4tick ぶんだけ**（`ROBOT_DEFAULTS.maxGuards`）。残りは `guards` で読める。使い切ったあとの `guard` は何も起きず、その tick を無駄にする（ログに `out of guards` の警告が1回出る）。
- **構えた 1tick ごとに、自分が次に撃てるまでの時間が 0.3 秒（9tick）延びる**（`ROBOT_DEFAULTS.guardRecovery`）。使い切ったあとの空振りでは延びない。
- 弾が当たる tick に構えている必要がある。早すぎる `guard` は効かず、回数と射撃の時間を無駄にする。
- **なるべく遅く、短く構える。** 弾は 1tick に約13 進み、車体の半径ぶん（19）手前で当たるので、`bullet_distance < 36` なら次の tick までに当たる。行動の前ごとに確かめれば、当たる tick だけ構えられる（GuardBot を参照）。
- **表示**: 構えたロボットを輪で囲み、上に `GUARD` と出す。構えは 1tick（1/30 秒）だけなので、輪と文字は 0.5秒（15tick）かけて薄くなっていく（構えている tick は輪が太い）。構えて受けた弾は、ロボットの周りに広がる点の輪で示す。RUN でも DEBUG でも出る。
- ログは `ACTION guard` と `HIT … (guarded)`。INSPECTOR に残り回数（GUARDS）と、延びた射撃までの時間（COOLDOWN）が出る。

決め方の経緯（DumbBot に `guard` を足した GuardBot を、9マップで他の6テンプレートと対戦させた勝率）:

| ルール | 勝ち |
|---|---|
| `guard` なし（= DumbBot） | 35% |
| 回数無制限、射撃の遅れなし | 最初の版。ほぼ全勝 |
| 回数無制限、遅れ 0.3 秒 | 72% |
| 4回まで、遅れなし | 82% |
| 1回まで、遅れなし | 64% |
| **4回まで、遅れ 0.3 秒（採用）** | **57%** |
| 4回まで、遅れ 0.4 秒 | 32% |

- 回数だけを絞っても足りなかった（1回でも 64%）。10 のダメージを減らすだけで、互角の撃ち合いの勝敗がひっくり返るため。
- 「構えたあと一定時間撃てない」という決め方は、射撃の間隔（0.8 秒）より短いと何も変わらず、同じかそれより長いと、弾が来るたびに構えるロボットが二度と撃てなくなった。構えた時間に応じて延びる方式にしている。
- 遅れを 0.4 秒にすると、構えるほうが損になる。

**隠れ場所（`cover_*` と `turn cover`）**

| 名前 | 意味 |
|---|---|
| `cover_visible` | 敵から隠れられる場所へ行ける |
| `cover_distance` | そこまでの道のり。すでに隠れていれば 0。行ける場所がなければ 0 |
| `cover_angle` | そこへ行く経路で、次に向かう地点の方向（-180〜180、右が正）。なければ 0 |
| `turn cover` | その方向へ旋回する（1tick。`turn enemy` と同じ動き方） |

- 「隠れ場所」= 障害物のすぐそばで車体が収まり、敵（見えていれば今の位置、見えなければ最後に見た位置）との間に障害物が入る地点。その中で**道のりが最も短いもの**を選ぶ。敵を一度も見ていない間は `cover_visible` は false。
- **経路は障害物の角を回り込む。** 隠れ場所は障害物の敵と反対側にあるので、直進だけでは行けないことが多い。障害物の四隅の少し外側を経由点にして、最短の経路を求める（`src/sim/cover.ts`。経由点同士・経由点と隠れ場所の間を直進できるかは、マップごとに1回だけ計算する）。計画では「まっすぐ走って行ける場所」としていたが、それではほとんど見つからなかったので変えた。
- 使い方: `cover_angle` が 0 に近くなるまで `turn cover`、そのあと `move forward`、を `cover_distance` が 0 になるまで繰り返す（CoverBot を参照）。
- 隠れ場所を探す計算は重いので、プログラムが `cover_*` を読んだとき（と、画面に表示するとき）にだけ行う。結果はその tick の最初の状態に対するもので、いつ読んでも同じ。

**壁までの距離（`wall_*`）**

`wall_ahead` / `wall_behind` / `wall_left` / `wall_right` は、車体の中心からその方向へまっすぐ伸ばした線が、最初に壁か障害物に当たるまでの距離（車体の端から測る）。相手ロボットは数えない。`blocked` / `blocked_behind` は今までどおり。

**画面**

- WATCH に新しい値の行を追加した（センサーの値は2列で表示）。
- DEBUG の戦闘画面（INSPECTOR で選んだロボット）: 隠れ場所にひし形の印と、そこまでの経路（破線）。当たるコースの弾を輪で囲む。
- **これらの印は、そのロボットのプログラムが関係する語を使っているときだけ描く。** 使っていないプログラムでは意味のない線になるため。値は WATCH にいつでも出る。

  | 印 | 描く条件（プログラムに書かれている語） |
  |---|---|
  | 隠れ場所の印と経路 | `cover_visible` / `cover_distance` / `cover_angle` / `turn cover` |
  | 当たるコースの弾の輪 | `bullet_incoming` / `bullet_distance` / `bullet_angle` |
  | 敵の移動先の「＋」 | `aim lead` / `lead_angle` |

  判定は構文解析の結果から行うので、コメントやラベルの中の文字には反応しない（`src/ai/features.ts`）。視線・ターゲット枠・最後に見た位置は、どのプログラムでも出る。
- エディタの入力候補・ホバー説明・ハイライトにも新しい語が出る。

### 行単位のデバッガ

試合は今までどおり RUN / DEBUG を押したときに最後まで計算して記録する。記録には tick ごとに「実行した行の順番」と「変数への代入」を入れてあり、表示位置を「tick」から「**tick + その中で何行進んだか**」に細かくした。インタプリタの状態を巻き戻す必要はない。

| 項目 | 動き |
|---|---|
| 現在の行（黄色） | **次に実行する1行。** ロボットごとに1行 |
| 実行済みの行（薄い緑） | 今の tick の中で、すでに通った行 |
| `1▶` | **1行**進む。`if` や `set` の行では時間は進まず、行動の行を実行するとロボットが 1tick 動く |
| `◀1` | 1行戻る |
| 行番号をクリック | **その行が次に実行される直前へ移動する**（一時停止）。もう一度クリックでその次へ、最後まで行くと最初に戻る。Shift+クリックで1つ前へ。クリックした行には ◆ が付く |
| シークバーの目印 | ◆ の行が実行された時点すべてに、細い線が出る。「いつ撃ったか」「この分岐に何回入ったか」が一目で分かる |
| WATCH | 上にプログラムの変数（`set` したもの）、下にセンサーの値。行を進めると変数も変わる |
| ログクリック | そのイベントを起こした行を「現在の行」にした位置（実行の直前）へ移動する。行のないイベント（HIT など）はその tick へ |
| PLAY / シークバー / 速度 | tick 単位（今までどおり） |

- 行単位で進むのは、**開いているファイルのロボット**。もう一方のロボットは、同じ tick の先頭の行が「現在の行」になる。
- 止まっている間の WATCH / INSPECTOR のセンサー値（`enemy_visible`、`enemy_distance` など）は、これから実行する tick のもの（プログラムがその行で読む値）。位置や HP は表示中の tick のもの。
- プログラムが終了したロボットには「現在の行」がなく、`1▶` は 1tick ずつ進む。
- RUN モードではコードの表示はなく、`◀1` / `1▶` は 1tick ずつ動く。
- 上部の表示: `DEBUG   PAUSED   ALPHA line 13: run 2 of 49`（◆ の行の何回目の実行にいるか）。その行の上にいないときは `runs 49 times`、一度も実行されない行は `never runs in this match`。
- ◆ の行は、次の DEBUG でも同じ行のまま目印を出し直す（コードを直した前後で比べられる）。コードを編集すると、次の DEBUG まで消える。RUN 中と試合のないときは、クリックしても何も起きない。
- `fire` の行のように「実行しても何も起きないことがある」行は、実行された回数（撃とうとした回数）で数える。実際に撃った時点はログの `ACTION fire` で分かる。

**ブレークポイントは廃止した。** 試合は最初から最後まで記録済みで、いつでも戻れるので、「止めないと流れてしまう」ことがない。また `loop` の中の行は毎周通るので、ブレークポイントからの PLAY が実質ステップ実行になり、止まらずに再生する `▶▶` ボタンを足す必要まであった。「その行が実行される時点へ飛ぶ」ほうが、同じ目的に直接届く。

### エディタの入力支援

| 機能 | 動き |
|---|---|
| 入力候補 | 入力中に、その位置に合う語だけを出す。行の先頭は文（`if` `loop` `move` …）、`move ` の後は `forward` / `backward`、`turn ` の後は `left` / `right` / `enemy`、`label ` の後はプログラムで使っているラベル、`if ` / `while ` の後はセンサーと自分の変数、比較や `=` の後は数値のセンサーと自分の変数、値の後は `and` / `or`。各候補の右に短い説明、横に詳しい説明が出る |
| 確定 | Enter または Tab。続きが必要な語（`move` `if` `set` など）は空白を入れて、すぐ次の候補を出す（`mo` → Enter → `move ` → `forward` / `backward`） |
| 候補を出さないとき | コメントの中、語を打ち終わったとき（`fire` の後の Enter はそのまま改行になる）、空行（`Ctrl+Space` で呼び出せる） |
| ホバー | 命令・センサー・方向・自分の変数にカーソルを載せると説明が出る。変数は最初に `set` した行を示す |
| 自動インデント | `if` / `else` / `loop` / `while` の次の行は1段深くなる。`else` と打つと、対応する `if`（まだ `else` のない、いちばん近いもの）の深さに戻る。手で戻した位置より深い `if` には合わせない |
| エラーの波線 | 入力が 0.5秒止まると、RUN と同じ解析をして、エラーのある行のコードに赤い波線を引く。カーソルを載せると内容が出る。**直したエラーの波線はすぐ消える。** 候補の一覧が出ている間は新しい波線を出さない |
| 赤い背景 | RUN / DEBUG でエラーになった行に付く（今までどおり）。その行のエラーが直ると消える |
| その他 | `Cmd / Ctrl + /` でコメント切り替え、`(` で `)` を補う、対応する括弧の強調 |

「何を候補にするか」「何と説明するか」「どこまで字下げするか」は `src/ai/`（`completion.ts` / `reference.ts` / `indentation.ts`）の純粋な関数で決め、テストしている。`src/ui/roboscript_assist.ts` はそれを CodeMirror（`@codemirror/autocomplete`、`hoverTooltip`、`indentService`）につなぐだけ。エラーの波線は `@codemirror/lint` の `setDiagnostics` で出している。説明文は、ログやメッセージに合わせて英語。

### 現在のサンプルAI（`src/data/templates/sample.ts`）

```text
# "drive" keeps the hull going. Each turn, aim or fire takes one tick.
loop
    if blocked
        label SEARCH
        turn left
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 250
                label ATTACK
                drive stop
                fire
            else
                label TRACK
                drive forward
        else
            label SEARCH
            drive forward
            wait
```

- 正面がふさがっていたら左へ旋回する（走行は前進のままなので、向きが空けば走り出す）。
- 敵が見えていれば車体を敵へ向け、遠ければ走って近づき、距離 250 未満なら止まって撃つ。
- **砲塔は使わない**（正面のまま、車体ごと敵へ向く）。プレイヤーが `aim` を使い始める余地を残している。
- 敵が見えなければ、前進して探す。
- **ALPHA は左へ、BRAVO は右へ回り込む。** 向かい合っているので、両者が障害物の同じ側へ回り込んで出会う。
- すでに保存されているコード（ブラウザの localStorage）は書き換わらない。`move` を使った古いコードはエラーになり、`drive` を案内する。LOAD TEMPLATE の Sample で新しいサンプルにできる。

### テンプレートと、2体のコード（`src/data/templates/`）

| テンプレート | 内容 |
|---|---|
| Sample | 車体を敵へ向けて近づき、距離250未満なら止まって撃つ |
| DumbBot | Sample と同じで、距離300未満で撃つ |
| AggressiveBot | 止まらずに敵へ走り、射程（400）内なら撃つ |
| CowardBot | 距離300未満なら後退しながら撃つ。後ろがふさがったら（`blocked_behind`）止まって撃つ。距離400未満なら止まって撃ち、それより遠ければ近づく |
| GuardBot | DumbBot に防御を足したもの。行動の前ごとに弾を確かめ、当たる tick（`bullet_incoming and bullet_distance < 36 and guards > 0`）だけ `guard` する |
| CoverBot | 距離350未満で撃つ。HP が 60 を切ると、1回だけ物陰へ逃げ込み（`turn cover` と `drive forward`）、敵が見えるまで最大5秒待つ。そのあとは障害物を逆回りして敵を探す |
| StrafeBot | 距離 340 まで近づいたら、車体を敵に対して横向きにし、壁の間を往復しながら `aim lead` で撃つ。障害物で敵が見えなくなったら引き返す |

- **ロード先に合わせて、障害物を回り込む側を変える。** 各テンプレートは「回り込む側」を受け取ってソースを作る（`build('left' | 'right')`）。ALPHA にロードすると `turn left`、BRAVO にロードすると `turn right` になる。2体が同じ側へ回ると障害物の反対側に分かれて出会えないため。StrafeBot が敵に横を向けるための旋回のように、敵の位置で決まる旋回は入れ替えない。
- テンプレート同士の全組み合わせ（7 × 7）は、3つのマップすべてで時間切れにならず決着する（テストで固定）。
- **保存先**: ALPHA は `robograming/projects/alpha/main.bot`、BRAVO は `robograming/projects/alpha/bravo.bot`。
- **RUN / DEBUG は両方のコードを解析する。** どちらかにエラーがあれば試合を始めず、ログにロボット名付きで出し、該当するエディタの行を赤くして、そのファイルを開く。
- **編集後の扱いはロボットごと。** 編集したほうのエディタだけ、次の RUN / DEBUG まで行の表示と、行の実行時点への移動を止める。
- **ログクリック**は、その行のロボットのコードを開いて該当行へ移動する。

### 修正した不具合

**障害物の角のそばにいるロボットが、敵を「見えない」と誤判定していた。** 視線の判定で、障害物を上下左右に車体の半径ぶん広げた四角形を使っていたため、角の斜め外側（実際には半径以上離れている場所）にいても隠れている扱いになっていた。CowardBot が四隅寄りのブロックの角まで後退すると、1tickごとに「見える → 後退」「見えない → 前進」を繰り返して、その場で前後に揺れ続けていた。線分と四角形の実際の距離で判定するように直した。

### マップ（`src/data/arenas/`）

9種から選べる。初期位置（右に ALPHA、左に BRAVO、向かい合わせ）は共通で、どれも点対称（どちらの側も同じ条件）。

| マップ | 障害物 | 特徴 |
|---|---|---|
| Center Block（既定） | 中央に横長のブロック 400x90、四隅寄りに 80x80 のブロック4つ | 互いが見えない状態で始まり、ブロックを回り込んでから戦う |
| Open Field | 四隅寄りのブロック4つだけ | 最初から互いが見えていて、正面から撃ち合う |
| Long Wall | 中央に縦長の壁 40x300、四隅寄りのブロック4つ | 壁の端まで走って回り込み、出会った瞬間に近距離戦になる |
| Bare Ground | なし | 隠れる場所がまったくない。走る余地はいちばん広い |
| Pillars | 50x50 の柱が7本 | どこにでも物陰があり、長い射線が通らない |
| Corridor | 横長の壁 500x30 が上下に2枚 | 3本の通路。中央の通路で向かい合って始まり、狭くて弾を避けにくい。外側の通路で回り込める |
| Bunkers | 縦の壁 30x200 が各ロボットの前に1枚ずつ | それぞれ壁の陰から始まり、壁の間は開けている |
| Cross | 中央に十字（300x40 と 40x300）、四隅寄りのブロック4つ | 十字で4つの区画に分かれる。横に走る余地が少ない |
| Zigzag | 上から伸びる壁と下から伸びる壁（各 40x380） | 相手側へ行く道が2回曲がる。出会うまでが長い（試合は平均30秒ほど） |

新しい6種での主な組み合わせ（seed 1〜5、プレイヤーが ALPHA）:

| マップ | サンプル 対 DumbBot | 射撃距離 350 対 DumbBot | 横走り型 対 動かず撃つ型 |
|---|---|---|---|
| Bare Ground | 負け | 勝ち | 勝ち |
| Pillars | 負け | 勝ち | 勝ち |
| Corridor | 負け | 勝ち | 勝ち |
| Bunkers | 負け | 勝ち | 勝ち |
| Cross | 勝ち | 負け | 負け |
| Zigzag | 勝ち | 勝ち | 勝ち |

- **最初の学び（250 → 350 で DumbBot に勝つ）は、9種のうち6種で成り立つ**（Center Block、Open Field、Bare Ground、Pillars、Corridor、Bunkers）。Long Wall は相打ち、Cross は逆になり、Zigzag はどちらでも勝つ。
- 横走り型は Cross 以外の8種で動かず撃つ型に勝つ（テストで固定）。
- **テンプレート同士の全組み合わせ（7 × 7）は、9種すべてで時間切れにならない**（テストで固定）。Pillars の StrafeBot 同士だけは、互いの弾を避け切って弾切れで引き分けになる。

マップを足したときに見つかって直した点:

- **障害物の角をはさんで接した2体が、互いを見られず動けなくなっていた。** 視線の判定には車体の幅ぶんの余裕が要るので、角のすぐ向こうの敵は見えず、互いに相手へ走り続けて止まっていた。**近い距離（車体の半径の3倍以内）では、弾が通る幅があれば見える**ようにした（`simulation.ts` の `hasLineOfSight`）。
- **弾切れ同士の試合が、時間切れまで続いていた。** 全員の弾がなくなり、飛んでいる弾もなくなったら、その時点で残り HP で決着する（結果の理由は `out of ammo`）。
- **CoverBot が、隠れたあと敵と同じ向きに回り続けることがあった。** 敵を 10秒見つけられなければ、回り込む側を入れ替えるようにした。

### 既定の対戦の流れ（Center Block、サンプルAI 対 DumbBot、seed 1）

| 時刻 | 出来事 | ALPHA が実行する行 |
|---|---|---|
| 0.033 | 敵は見えない。前進を始める（`SEARCH`、`drive forward`） | 2, 3, 6, 7, 17, 18, 19, **20** |
| 1.667 | 中央のブロックに当たる（`blocked`）。ALPHA は左へ、BRAVO は右へ、約90°旋回する | 2, 3, 4, **5** |
| 約2.2 | 向きが空いて、ブロックに沿って走り出す（どちらも画面の下側へ） | 2, 3, 6, 7, 17, 18, 19, **20** |
| 2.733 | ブロックの角を抜けて互いが見える。車体を敵へ向ける | 2, 3, 6, 7, **8** |
| 2.767 | 走って近づく（`TRACK`）。毎tick、車体を敵へ向け直す | 10, 14, 15, 16, 2, 3, 6, 7, **8** |
| 3.567 | BRAVO が距離300未満で止まり、撃ち始める | |
| 4.067 | ALPHA が距離250未満で止まり、撃ち始める（`ATTACK`）。5発撃つ | 10, 11, 12, **13** |
| 7.267 | ALPHA が破壊され、BRAVO の勝ち（BRAVO HP 20） | |

太字はその tick の行動の行。`drive` の行（12、16、19）は時間を使わない。

### 対戦結果（seed 1〜5）

プレイヤー側（ALPHA）の戦い方と、敵テンプレート（BRAVO）を対戦させた。数字は5回のうちの回数で、「分」は同時に破壊されての引き分け。

- 遠距離維持型: 射程ぎりぎりで撃ち、近づかれたら後退する
- 動かず撃つ型: 動かず、砲塔を敵へ向けて射程内なら撃つ（`aim enemy`）
- 動かず先読み型: 同じだが `aim lead` で撃つ
- 突撃型: 止まらずに敵へ走りながら撃つ
- 横走り型: StrafeBot と同じ
- 回避型: 最初の弾が来たら、敵が弾を撃ち尽くすまで（約43秒）横へ避け続け、そのあと攻める
- 防御型: サンプルAI（射撃距離 350）に、弾が当たる tick だけの `guard` を足したもの
- 早すぎる防御型: 同じだが、周の頭で1回確かめるだけなので 1〜2tick 早く構える

**Center Block**

| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot | 対 StrafeBot |
|---|---|---|---|---|---|---|
| サンプルAIのまま | 負け | 勝ち | 負け | 負け | 勝ち | 負け |
| 射撃距離を 250 → 350 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち | 負け |
| 遠距離維持型 | 勝ち | 分 | 分 | 勝ち | 勝ち | 負け |
| 動かず撃つ型 | 勝ち | 分 | 勝ち1 分4 | 勝ち | 勝ち | 勝ち3 負け2 |
| 動かず先読み型 | 勝ち | 分 | 勝ち1 分1 負け3 | 勝ち | 勝ち | 負け |
| 突撃型 | 負け | 分 | 分 | 負け | 勝ち | 負け |
| 横走り型 | 負け | 勝ち | 勝ち | 負け | 勝ち | 分2 負け3 |
| 回避型 | 勝ち2 負け3 | 負け | 勝ち | 勝ち2 負け3 | 勝ち4 負け1 | 勝ち |
| 防御型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち | 負け |
| 早すぎる防御型 | 勝ち | 勝ち | 負け | 勝ち | 勝ち | 負け |

**Open Field**

| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot | 対 StrafeBot |
|---|---|---|---|---|---|---|
| サンプルAIのまま | 負け | 負け | 負け | 負け | 勝ち | 負け |
| 射撃距離を 250 → 350 | 勝ち | 負け | 負け | 勝ち | 勝ち | 負け |
| 遠距離維持型 | 勝ち | 勝ち | 分 | 勝ち | 勝ち | 勝ち |
| 動かず撃つ型 | 勝ち | 分 | 勝ち1 分4 | 勝ち | 勝ち4 負け1 | 負け |
| 動かず先読み型 | 勝ち | 分 | 勝ち1 分4 | 勝ち | 勝ち | 勝ち |
| 突撃型 | 勝ち | 分 | 負け | 勝ち | 勝ち | 負け |
| 横走り型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち1 分1 負け3 |
| 回避型 | 負け | 負け | 勝ち | 負け | 負け | 勝ち2 負け3 |
| 防御型 | 勝ち | 勝ち | 負け | 勝ち | 勝ち | 負け |
| 早すぎる防御型 | 勝ち | 負け | 負け | 勝ち | 勝ち | 負け |

**Long Wall**

| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot | 対 StrafeBot |
|---|---|---|---|---|---|---|
| サンプルAIのまま | 分 | 勝ち | 負け | 負け | 勝ち | 負け |
| 射撃距離を 250 → 350 | 分 | 勝ち | 負け | 負け | 勝ち | 負け |
| 遠距離維持型 | 勝ち | 勝ち | 分 | 勝ち | 勝ち | 負け |
| 動かず撃つ型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち | 負け |
| 動かず先読み型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち | 負け |
| 突撃型 | 負け | 分 | 負け | 負け | 負け | 負け |
| 横走り型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち | 分 |
| 回避型 | 負け | 勝ち | 勝ち1 負け4 | 負け | 負け | 負け |
| 防御型 | 勝ち | 勝ち | 負け | 勝ち1 分2 負け2 | 勝ち | 負け |
| 早すぎる防御型 | 負け | 勝ち | 負け | 勝ち2 負け3 | 勝ち | 負け |

戦い方同士でも対戦させた（プレイヤー用のプログラムを、回り込む側だけ入れ替えて BRAVO にした）。

- **「動かずに撃つ」は負けなしでなくなった。** 横走り型は Cross 以外の8マップで、動かず撃つ型に5回とも勝つ（テストで固定）。今の位置を狙う弾は、横に走る相手の後ろを通るため。
- **横走りには「先読み」が効く。** Open Field では、`aim lead` で撃つ動かず先読み型が横走り型に勝つ。遠距離維持型も勝つ。障害物の多い Center Block では、横走り型は DumbBot と GuardBot に負ける（往復できる幅が狭く、折り返しのたびに当てられる）。
- **どの戦い方にも負ける相手がいる。** 横走り型がいちばん勝ちが多いが、上のとおり負ける相手がある。防御型は横走り型に負け、動かず撃つ型は横走り型と GuardBot に負ける。
- **最初の学びはそのまま成り立つ。** 既定のマップで、サンプルAIは DumbBot に負け、射撃距離を 250 → 350 にすると勝つ。
- **`guard` は「入れれば得だが、それだけでは勝てない」強さになった。** 当たる tick だけ構える防御型は、Center Block で StrafeBot 以外の敵5種に勝つが、Open Field と Long Wall では CowardBot に負ける。1〜2tick 早く構える「早すぎる防御型」は回数を無駄にし、Center Block でも CowardBot に負ける。GuardBot は、射撃距離を 350 にしただけのサンプルにも Center Block と Open Field で負ける。
- **隠れるだけでは勝てない。** CoverBot は Center Block でどの相手にも勝てない。逃げ込む間に撃たれ、出てきたあとも不利なまま。
- テンプレート同士の全組み合わせに時間切れはない。プレイヤー側の戦い方では、動かない者同士（互いに近づかない）と、Open Field の遠距離維持型 対 CoverBot などが時間切れの引き分けになる。

### 既知の制約

**プレイヤーが敵と同じ向き（`turn right`）に旋回して避けると、Center Block と Long Wall では2体が障害物の反対側に分かれたまま出会えず、120秒の引き分けになる。** 動きが点対称になるため。DEBUG で再生すると反対側にいることが分かる。Open Field では起きない。

---

## Phase 5: Polish

### 実装した内容

- **敵AI 3種**（30章）: すべて RoboScript。上部バーの VS で選び、選択は `project.json` に保存される

  | 敵 | 動き |
  |---|---|
  | DumbBot | 見えなければ回転。見えたら接近し、距離300未満で射撃 |
  | AggressiveBot | 見えたら常に前進し続け、距離400（射程）未満で撃ち続ける |
  | CowardBot | 距離300未満なら後退しながら射撃。それ以外は距離400まで近づいて射撃 |

- **`enemy.bot`**: PROJECT ツリーから、選択中の敵のソースをハイライト付き・読み取り専用で表示
- **ドット絵風スプライト**（7章）: 16x16 のドットパターン（1ドット = フィールドの2単位）からロボットを描く。車体・履帯・砲身、1体あたり7色。破壊後はグレーの残骸。弾は明るいドットと暗い尾。画像ファイルは使っていない
- **DEBUG 時の表示**（25・26章）: INSPECTOR で選んでいるロボットについて、視野の扇形、敵が見えている間のターゲット枠、見失っている間の最後に見た位置（×印）。両ロボットの名前の下に state。RUN では描かない
- **エフェクト**: 発射（2tick）、着弾（4tick）、破壊（15tick）。記録に含めているので、シークしても同じコマが出る。試合は破壊の tick で終わるので、再生は末尾から15tickぶん続いて破壊のエフェクトを最後まで見せる（時刻表示は試合終了の時刻のまま）

### ゲーム性の確認（32章）

プレイヤー側に4種類の戦い方のAI（`tests/strategies.ts`）を用意し、敵3種と seed 1〜5 で対戦させて、戦い方によって勝敗が変わることを確認した。Phase 5 完了時点のマップと移動（横移動あり）での結果は、MVP 完成後の変更で前提が変わったため削除した。現在の結果は「MVP 完成後の変更」の「対戦結果」を参照。

- 敵AIの数値は最初の案のままで、調整はしていない。この結果は `tests/templates.test.ts`（当時は `enemies.test.ts`）で固定している。

### Phase 4 から変更した点

| 項目 | 変更 |
|---|---|
| `Simulation` | `tickEvents`（その tick の発射・着弾・破壊と位置）を追加 |
| `Snapshot` | 弾の向きと `effects` を追加 |
| `recordMatch` | エフェクトの長さを引数で受け取る |
| `ReplayManager` | 末尾を過ぎて再生を続ける `tailTicks` と `overrun` を追加 |
| `CodeEditor` | 読み取り専用モードと `setSource` を追加 |
| `ProjectInfo` | `enemy`（選んだ敵の id）を追加 |
| PROJECT ツリー | `enemy.bot` を追加 |

### 動作確認の結果

- `npm test` 147件すべて成功、`npm run typecheck` と `npm run build` も成功
- ブラウザ（ヘッドレスChrome、1440x900、高解像度表示）で以下を確認。実行時エラーとコンソールの警告はなし
  - スプライト: 2体がドット絵で描かれ、向きに合わせて回転する。破壊後はグレーの残骸になる
  - DEBUG: ALPHA の視野の扇形、BRAVO を囲むターゲット枠、名前の下の state が出る。INSPECTOR を BRAVO に切り替えると、BRAVO の扇形と ALPHA を囲む枠に変わる。RUN では出ない
  - エフェクト: 着弾の火花、破壊時の広がる粒を拡大キャプチャで確認。末尾では再生が15tickぶん続いてから止まる
  - 敵の選択: セレクトに3体が並ぶ。CowardBot に切り替えて RUN すると 6.333秒で BRAVO の勝ち（BRAVO HP 100）。`enemy.bot` に CowardBot のソースが出て、編集できない
  - 再読み込み後も CowardBot が選ばれたままで、`project.json` に `"enemy":"coward_bot"` が入っている
  - Phase 4 の確認項目（再生操作、ログクリック、ブレークポイント、編集後の表示）を再実行し、すべて同じ結果

### MVP 完成条件の確認（38章）

時刻と行番号は、現在の既定のマップ（Center Block）とサンプルAIで、DumbBot と対戦したときのもの（seed 1）。

| # | 条件 | 確認 |
|---|---|---|
| 1 | アプリが起動する | ブラウザで起動し、5領域が表示される |
| 2 | 最初からサンプルAIが表示されている | 起動直後の CODE EDITOR に31章のサンプルAIが入っている |
| 3 | RUNを押せる | RUN で試合が始まる |
| 4 | ロボットがAIに従って移動する | サンプルAIが前進し、中央のブロックで左へ旋回して回り込み、敵の方へ向き直って、距離250未満で止まる。ログに `move forward` → `turn left` → `move forward` → `turn enemy` → `move stop` |
| 5 | 敵を発見する | ブロックの角を抜けた 2.800秒に `enemy detected: BRAVO` |
| 6 | 射撃する | 4.133秒から `fire`。弾と発射エフェクトが出る |
| 7 | 敵または自分が破壊される | 7.333秒で ALPHA の HP が 0 になり、残骸になる |
| 8 | 勝敗が表示される | 戦闘画面と上部に `WINNER: BRAVO` |
| 9 | AIコードを書き換えられる | CODE EDITOR で編集でき、自動保存される |
| 10 | 書き換えた挙動が戦闘に反映される | 射撃距離を 250 → 350 にすると約7.2秒で `WINNER: ALPHA` |
| 11 | DEBUGログが表示される | DEBUG LOG に SYSTEM / SENSOR / AI / ACTION / HIT が出る |
| 12 | ログクリックでその時点へ移動できる | ALPHA の `state TRACK -> ATTACK` をクリックすると 4.133秒へ戻り、エディタが9行目（`state ATTACK`）へ移動する |
| 13 | 現在のAI状態をWatchで確認できる | WATCH に `enemy_visible` / `blocked` / `blocked_behind` などと `state` が表示され、tick ごとに変わる |
| 14 | 現在実行行がコード上で確認できる | DEBUG で、表示中の tick に実行した行が緑で示される |
| 15 | ブレークポイントで停止できる | 10行目（`fire`）に置くと 4.100秒（実行の直前）で止まる |

---

## Phase 4: DEBUG機能

### 方式

RUN / DEBUG を押した時点で **試合を最後まで一気に計算し、画面はその記録を再生する**。

```text
RUN / DEBUG → recordMatch() が全tickを計算 → Recording（スナップショット列 + イベント）
            → ReplayManager が表示する tick を決める → 各パネルがその tick の Snapshot を表示
```

試合は決定論的なので、先に計算しても結果は変わらない。PAUSE / STEP / シーク / ログクリック / ブレークポイントは、どれも「表示する tick を動かす」操作になっている。
`snapshots[n]` は n tick 実行後の状態で、`DebugEvent.tick` と同じ数え方なので、ログの行からそのままジャンプできる。

### 実装した内容

- **記録**（23章）: tick ごとに時刻、各ロボットの位置・向き・HP・state・弾数・クールダウン・センサー値・実行した行、弾の位置、勝敗を保存（メモリのみ）
- **再生操作**（24章）: PLAY / PAUSE（上部バーと操作列の両方にある）、STEP（`1▶`）、速度 0.25x / 0.5x / 1x / 2x / 4x。最後まで再生した後の PLAY は先頭から再生し直す
- **追加した操作**（指示書にはない）: `◀1`（1tick戻る）、シークバー
- **RUN と DEBUG**（25章）:

  | | RUN | DEBUG |
  |---|---|---|
  | 実行行のハイライト | なし | 表示中の tick で ALPHA が実行した行を強調 |
  | ブレークポイント | 無視 | 止まる |
  | DEBUG LOG | SYSTEM / HIT / WARNING / ERROR のみ | 全種類 |
  | 再生操作・ログクリック・INSPECTOR・WATCH | 使える | 使える |

- **実行行の表示**（27章）: DEBUG モードで、表示中の tick に ALPHA が実行した行の背景を薄く色付けする
- **ログクリック**（28章）: 再生を止めてそのイベントの tick へ移動し、ソース行があれば CODE EDITOR をその行へ移動して選択する。`config` 表示中なら `main.bot` に切り替わる
- **ブレークポイント**（29章）: 行番号またはその左の余白をクリックして設定 / 解除。DEBUG の再生は、ブレークポイントの行が**実行される直前**で止まる
  - 止まる位置: ALPHA が「次の tick で実行し、いまの tick では実行していない」行にブレークポイントがある tick。その行の効果（弾の発射など）はまだ画面に出ていない
  - 表示: その行を黄色、直前の tick で実行した行を緑で示し、上部に `BREAKPOINT   line 9 runs on the next tick. PLAY to continue, 1▶ to step.` と出す
  - `1▶` で 1tick 進めるとその行が実行される。PLAY で続行する。1tick目から実行される行に置くと、開始前（00.000）で止まる
  - STEP やシークでは止まらない
- **DEBUG LOG の表示範囲**: これまでに到達した最も先の tick までのイベントを表示する。シークで戻ったときは、現在位置より先の行を薄く表示する
- **RUN 後にコードを編集した場合**: 行番号がずれるので、次の RUN / DEBUG まで実行行ハイライト・ブレークポイントでの停止・ログクリック時の行移動を止め、上部に `[code edited since this run]` と表示する
- INSPECTOR / WATCH のセンサー値は、その tick の開始時にセンサーが読んだ値（AI が判断に使った値）を表示する

### Phase 3 から変更した点

| 項目 | 変更 |
|---|---|
| 試合の進め方 | 実時間で `Simulation` を進める方式から、先に全tickを計算して再生する方式へ |
| `MatchController` | 削除（役割は `ReplayManager` に移った） |
| BATTLE VIEW / INSPECTOR / WATCH | `Simulation` ではなく `Snapshot` を表示する |
| 上部バー | DEBUG を有効化。PAUSE のラベルは停止中 `PLAY` になる。経過時間は BATTLE VIEW 下の時刻表示に移動 |
| `RobotController` | 直近に実行した行を保持する `executedLines` を追加 |

### 動作確認の結果

- `npm test` 124件すべて成功、`npm run typecheck` と `npm run build` も成功
- ブラウザ（ヘッドレスChrome、1440x900）で以下を確認。実行時エラーとコンソールの警告はなし
  - RUN: 再生されて 6.833秒で `WINNER: BRAVO`。ログは SYSTEM と HIT のみ（11行）。実行行ハイライトなし
  - DEBUG: 実行行がハイライトされ、ログに SYSTEM / SENSOR / AI / ACTION / HIT が出る（35行）
  - PAUSE で停止、`1▶` で 1tick 進み、`◀1` で 1tick 戻る
  - 速度: 0.25x で2秒再生すると 0.467秒ぶん、4x で1秒再生すると 4.000秒ぶん進む
  - シークバー: 先頭や末尾へ移動できる
  - ログの `ALPHA AI state SEARCH -> ATTACK` をクリック: 00.800 へ戻り、INSPECTOR / WATCH がその時点の値になり、エディタの4行目（`state ATTACK`）が選択され、それより後のログ行が薄くなる
  - 9行目（`fire`）にブレークポイントを置いて DEBUG: 03.600（撃つ直前。弾数50のまま）で停止し、9行目が黄色になる。`1▶` で 03.633 へ進むと9行目が緑になり弾数が49になる。PLAY（上部でも操作列でも）で最後まで再生される。RUN では止まらない
  - 1行目にブレークポイントを置いて DEBUG: 00.000 で停止する
  - コードを1文字編集: 実行行ハイライトが消え、`[code edited since this run]` が表示される

---

## Phase 3: IDE UI

### 実装した内容

- 5領域のレイアウト（上部バー / PROJECT・CODE EDITOR / BATTLE VIEW・INSPECTOR / DEBUG LOG・WATCH）。Phase 3 の時点では、指示書5章の図から INSPECTOR だけを BATTLE VIEW の右へ移していた（MVP 完成後に配置を変更した。現在の配置は「指示書から変えた点」の「画面の配置」を参照）
- **上部バー**: プロジェクト名、メッセージ欄（起動時は `Edit the code and press RUN.`、試合中は経過時間と状態、決着後は勝敗）、RUN / PAUSE / RESET / DEBUG（無効）
- **PROJECT**: `ALPHA > main.bot / config`。`config` を選ぶと中央にロボット基本値の一覧が出る
- **CODE EDITOR**（CodeMirror 6）: 行番号、Undo / Redo、RoboScript のシンタックスハイライト、エラー行の赤表示、ブレークポイント用の余白（まだ空欄）、Tab でスペース4つ分のインデント
- **INSPECTOR**: ID / HP / X / Y / ROTATION / STATE / TARGET / TARGET_DISTANCE / AMMO / COOLDOWN。見出しの ALPHA / BRAVO で対象を切り替える
- **WATCH**: ALPHA の `enemy_visible` / `enemy_distance` / `enemy_angle` / `hp` / `ammo` / `state` / `last_seen_x` / `last_seen_y`
- **DEBUG LOG**: イベントを `[06.833] BRAVO HIT  ALPHA damage=20 hp=0` の形式で表示。末尾を見ている間は新しい行に追従する
- **BATTLE VIEW**: 枠に合わせて 5:3 のまま拡大縮小。画面の解像度に合わせて描画するので、高解像度の画面でも文字と線がぼやけない
- **保存**: localStorage に `robograming/projects/alpha/project.json` と `.../main.bot` として自動保存

### ログに記録するイベント

| type | 記録するとき | 例 |
|---|---|---|
| SYSTEM | 試合開始、決着 | `match started seed=1` / `winner: BRAVO (destroyed)` |
| SENSOR | 敵が見えた、見失った | `enemy detected: BRAVO` |
| AI | state が変わった | `state SEARCH -> ATTACK` |
| ACTION | 移動・旋回の指示が前のtickから変わった、弾を撃った | `move forward` / `move stop` / `turn enemy` / `fire` |
| HIT | 弾が当たった（行のロボット名は撃った側） | `ALPHA damage=20 hp=80` |
| WARNING | 弾切れで撃てなかった（最初の1回） | `out of ammo` |
| ERROR | RUN 時の構文エラー | `Line 3: Unknown command "shoot"` |

- 各イベントは `tick / timestamp / robotId / type / message / sourceLine` を持つ（28章）。AI / ACTION には、その指示を出したソース行が入っている。
- `tick` は「そのイベントが起きた tick が終わった時点の tick 数」。開始前のイベントは 0。Phase 4 でスナップショット N（N tick 実行後の状態）へジャンプするときにそのまま使える。
- 指示書の `TARGET` は、敵が1体のMVPでは SENSOR と同じ内容になるので出していない（型だけ定義）。
- ロガーを渡さずに `Simulation` を作れば、イベント処理は一切走らない。渡しても試合結果は変わらない（テストで確認済み）。

### Phase 2 から変更した点

| 項目 | 変更 |
|---|---|
| `AIAction` | `sourceLines`（move / turn / fire / state を決めた行）を追加 |
| `Simulation.tick` | step の最後ではなく最初に増やすようにした（結果は同じ。イベントの tick を揃えるため） |
| `MatchController` | `paused` と `running` を追加 |
| BATTLE VIEW | 固定 1000x600 の Canvas を CSS で拡大縮小する方式から、表示サイズと画面解像度に合わせて描画する方式に変更 |
| 暫定画面 | 削除（`src/main.ts` は `ui/app.ts` を起動するだけ） |

### 動作確認の結果

- `npm test` 102件すべて成功、`npm run typecheck` と `npm run build` も成功
- ブラウザ（ヘッドレスChrome、1440x900 と 1100x700）で以下を確認。実行時エラーとコンソールの警告はなし
  - 起動直後: 5領域が表示され、サンプルAIがハイライト付きで入っている。PAUSE は無効、ログは空
  - RUN: 試合が進み、INSPECTOR / WATCH / DEBUG LOG が更新され、6.83秒で `WINNER: BRAVO (destroyed)`
  - PAUSE: 経過時間が止まり、ボタンが RESUME になる。もう一度押すと再開する
  - RESET: 初期配置に戻り、ログが空になる
  - エラーのあるコードで RUN: 3行目と5行目が赤くなり、ログに ERROR が2件出て、試合は始まらない
  - `config` をクリック: ロボット基本値が表示される
  - コードを書き換えて再読み込み: 編集内容が残っている。そのまま RUN すると 6.73秒で `WINNER: ALPHA`

---

## Phase 2: RoboScript

### 実装した内容

- `source → lexer → parser → AST → runtime` の処理系。解析は RUN 時に1回だけ行い、毎tickは AST を評価する
- 文: `if` / `else` / `move` / `turn` / `fire` / `wait` / `state`
- インデントによるブロック（スペース。幅は揃っていれば任意）
- 条件式: `enemy_visible`、`enemy_distance` / `enemy_angle` / `hp` / `ammo` と比較演算子 `< > <= >= == !=`、`and` / `or` / `not`
- 行番号付きのエラー（`Line N: メッセージ`）。誤りのある行をすべて報告する
- 実行した行の記録（`AIAction.executedLines`）
- `ScriptBrain` は `RobotBrain` を実装し、`AIContext` だけを読む。内部状態を持たない

### 言語のルール

| 項目 | ルール |
|---|---|
| 評価 | 毎tick、先頭から順に実行 |
| `move` / `turn` / `state` が複数回実行された | 最後に実行されたものが有効 |
| `fire` | 一度実行されればそのtickは射撃を要求 |
| `wait` | それまでの `move` / `turn` / `fire` を取り消し、そのtickの評価を終了（`state` は残る） |
| 実行行 | 実行した文（`if` 行、分岐に入った `else` 行、各コマンド行）の行番号を順に記録 |
| 論理演算の優先順位 | `not` > `and` > `or` |
| 比較 | 数値同士のみ（数値変数または数値リテラル、負数・小数可） |
| `state` の名前 | `IDLE` / `SEARCH` / `TRACK` / `ATTACK` / `EVADE` のみ |
| インデント | スペースのみ。タブはエラー |

エラーメッセージ:

```text
Unknown command "shoot"
Expected condition
Unexpected else
Expected indented block
Unexpected indent
Indent does not match any outer block
Tabs are not allowed for indentation
Unexpected character ";"
Unknown variable "foo" / Unknown direction "up" / Unknown state "FOO"
Expected direction after "move" / Expected state name after "state"
Expected comparison after "hp" / Expected value after "<"
enemy_visible is not a number
Unexpected "now" after "fire"
"set" is not supported yet
```

1行につき報告するエラーは1件。字句エラー（タブ、使えない文字）がある場合は、それだけを報告する。

実装していないもの（指示書にないため）: コメント、括弧、`else if`、`true` / `false`、算術式、ユーザー定義の state 名、`set`（予約語としてエラーにしている）。

### 対戦結果（seed 1〜10 で同じ）

| プレイヤーの射撃距離 | 結果 |
|---|---|
| 250（サンプルAI） | 6.83秒で BRAVO の勝ち（BRAVO HP 20） |
| 350 | 6.73秒で ALPHA の勝ち（ALPHA HP 20） |
| 300（`dumb_bot` と同じ） | 同時破壊で DRAW |

---

## Phase 1: 戦闘エンジン

### 実装した内容

- 1000x600 のフィールドと矩形の障害物6個（点対称配置）
- ロボット2体（ALPHA / BRAVO、同一性能）
- 移動（前後左右、壁・障害物・相手ロボットで止まり、斜めに当たると滑る）
- 旋回（左 / 右 / 敵方向）
- センサー（視野角90°の扇形。見失った後は最後に見た位置を保持）
- 射撃（物理弾。クールダウン0.8秒、射程400、弾数あり）
- 弾の衝突（壁・障害物・ロボット。1tick分の軌跡を線分で判定するのですり抜けない）
- HP と勝敗（破壊 / 120秒タイムアウト時はHPの多い側 / 同HPまたは同時破壊は DRAW）
- 固定tick 30Hz のシミュレーション（描画FPSと分離）
- seed 付きの試合専用乱数（`Math.random` は不使用）
- AI判断の分離（Brain は `AIContext` を受け取り `AIAction` を返すだけ）

### 1tickの処理順

1. 両ロボットがセンサーで観測（同じ時点の状態を使う）
2. 両ロボットの Brain が `AIAction` を決定
3. 旋回 → 移動
4. 武器のクールダウンを進め、`fire` があれば弾を生成
5. 弾の移動と衝突
6. 勝敗判定

### 座標と角度

- x は右、y は下が正
- 角度は度。0° が右向き、時計回りが正（`turn right` = 時計回り）
- `enemy_angle` は自機の向きから見た相対角度（-180〜180、右が正）

---

## 指示書から変えた点、指示書に記述がなくこちらで決めた点

| 項目 | 採用した内容 |
|---|---|
| センサー範囲 | 300 → 1200（初期距離760より短く、その場で回転するAI同士が互いを見つけられなかったため。視野角90°は変更なし） |
| 初期位置 | 自機 ALPHA が右、敵 BRAVO が左（指示書8章の図は A が左、B が右）。フィールドは点対称なので有利不利はない |
| 初期の向き | 向かい合わせ。開始直後から互いが見えるので、索敵の処理は相手を見失ったときだけ動く |
| サンプルAI | 指示書31章のサンプルを、中央に障害物のあるマップ向けに書き直した（「MVP 完成後の変更」を参照） |
| マップ | 9種から選択（指示書8章は固定の1種で、障害物は4〜6個）。既定は中央に横長のブロックがある Center Block。障害物のないマップや、7個あるマップもある |
| 条件式の変数 | 指示書17章の5つに `blocked` と `blocked_behind` を追加 |
| 移動 | タンク式。指示書16章の `move left` / `move right` を廃止し、障害物に沿って滑る動きもなくした |
| センサーの視野角 | 90° → 360°。代わりに障害物が視線を遮る（指示書11章は「範囲内かつ視野角内」だけが条件） |
| 弾数の初期値 | 50 |
| 弾の散らばり | ±2° |
| ロボット半径 / 弾半径 | 16 / 3 |
| 障害物とセンサー | 障害物はセンサーも遮る（当初は遮らなかった。タンク式の移動に合わせて変更） |
| 見失った後の `enemy_distance` / `enemy_angle` | 最後に見た位置までの距離・角度。一度も見ていなければ 0 |
| 見失った後の `turn enemy` | 最後に見た位置へ向く。一度も見ていなければ何もしない |
| 同じtickで両者が破壊された場合 | DRAW |
| 全員が弾切れになった場合 | 飛んでいる弾がなくなった時点で、残り HP で決着（指示書の終了条件は破壊と時間切れだけ） |
| 弾の検知・防御・隠れ場所・壁までの距離 | 指示書17章の変数にない `bullet_*` / `cover_*` / `wall_*` と、16章にない行動 `guard` / `turn cover` を追加 |
| プログラムの実行 | **先頭から1回流れ、行動の文を1つ実行するたびに 1tick 進む**（指示書18章は「毎tick先頭から評価」）。DEBUG を通常のプログラミングと同じ感覚にするため。18章の狙い（実行時間の予測・決定論・安全性）は、1tick に実行できる行数の上限（1000行）で保っている |
| ループと変数 | `loop` / `while` / `set` を追加（指示書18章は `while` / `for` を禁止、15章の文法にも変数はない） |
| 1tick の行動 | 時間のかかる行動（車体の旋回・砲塔の旋回・`fire`・`guard`・`wait`）は1つだけ。走行（`drive`）は設定で、行動と並行して続く |
| 砲塔 | 車体と別に回る（指示書9章のロボットには砲塔の区別がない）。`aim enemy` / `aim lead` などで向け、`fire` は砲塔の向きへ撃つ |
| 移動の命令 | 指示書16章の `move forward` / `move backward`（1tick ぶん進む）を、走り続ける設定 `drive forward` / `backward` / `stop` に置き換えた |
| `wait` の意味 | 何もせずに 1tick 過ごす |
| コメント | `#` から行末まで |
| ロボットの状態表示 | 指示書の `state`（5種類の決まった名前）を、自由な名前を付けられる `label` に置き換えた。表示とログのためだけのもので、動きには影響しない |
| エラーがある状態で RUN | 新しい試合を始めず、進行中の試合は破棄して初期配置に戻す |
| 画面の配置 | 上段に PROJECT・CODE EDITOR・BATTLE VIEW を左右に並べ、下段に DEBUG LOG・INSPECTOR・WATCH を置く。指示書5章の図（BATTLE VIEW を中段に全幅）では戦闘画面が高さで制限されて小さくなるため、横幅を使える配置に変えた。INSPECTOR と WATCH は試合中の状態なので BATTLE VIEW の真下に並べている |
| PAUSE | 指示書では Phase 4 だが Phase 3 で実装 |
| 試合の計算 | RUN 時に最後まで計算してから再生する（指示書は逐次実行を前提にした書き方だが、決定論的なので結果は同じ） |
| ブレークポイント | **廃止した**（指示書29章と38章の MVP 完成条件15にある）。代わりに、行番号をクリックするとその行が実行される時点へ移動し、実行された時点がシークバーに出る。試合が記録済みでいつでも戻れるため、止める仕組みより飛ぶ仕組みのほうが役に立つと判断した |
| 1tick戻る、シークバー | 指示書にない操作を追加 |
| RUN モードのログ | SYSTEM / HIT / WARNING / ERROR（25章の「最低限のログ」の中身をこう決めた） |
| センサー表示の対象 | INSPECTOR で選んでいるロボット（指示書は対象を指定していない）。全方位センサーなので、26章の扇形ではなく敵への視線を描く |
| 敵AI | 一覧から選ぶ方式（指示書30章「選択可能にする」）ではなく、テンプレートとして BRAVO のエディタにロードして編集できる方式にした |
| スプライト | 画像ファイルではなく、コード内のドットパターンから生成 |
| 破壊エフェクトの再生 | 試合終了後も15tickぶん再生を続ける（試合は破壊の tick で終わるため） |
| エラー行の赤表示 | その行のエラーが直るまで残る（編集しても行に追従する） |

## 残課題

MVP の範囲では未対応のもの、遊んでみて調整が要りそうなものを挙げる。

### ゲームバランス

1. **横走り型（StrafeBot）の勝ちが多い。** 負ける相手はある（先読みして撃つ相手、Center Block の DumbBot と GuardBot）が、3つのマップを通していちばん勝つ。Long Wall では負けなし。折り返す間隔を変える、車体の向きを変えながら走るなど、先読みを外す動きを書けばさらに強くなる余地がある。
2. **隠れても得にならない。** HP は回復せず、隠れている間に有利になる要素がない。隠れ場所へ向かう間は敵に背を向ける。CoverBot は Center Block で全敗する。
3. **結果が、どちら側（ALPHA / BRAVO）で始めるかに左右される組み合わせがある。** マップは点対称だが、ロボットの更新順と乱数の使われ方が同じではないため。例: Center Block の StrafeBot 対 DumbBot は、StrafeBot が ALPHA なら負け、BRAVO なら勝つ。
4. **旋回の向きが敵と同じだと出会えない。** `turn right` で避ける AI は、Center Block と Long Wall で敵（右へ旋回）と障害物の反対側に分かれ、120秒の引き分けになる。
5. **`aim lead` は直線の動きしか読まない。** 弾が届く前に折り返す相手や、曲がりながら走る相手には外れる。敵の速さや向きを数値で読むセンサーはないので、自分で補正する手段はない。
6. **マップによって、敵を探す時間が長い。** 探し方は「前へ走り、ふさがったら曲がる」だけなので、Zigzag のように道が曲がるマップでは出会うまでに 20〜30秒かかる。
7. 敵が見えないときのサンプルAIは「まっすぐ進み、ふさがったら左へ旋回」するだけなので、障害物の配置によっては壁沿いを回り続ける。
8. seed の影響は小さい。結果が変わる組み合わせは一部だけ。

### 言語とデバッガ

9. **保存済みの古いコード（`loop` のないもの）は、最初の行動を1回実行して終わる。** ログに `program finished` の警告が出る。`LOAD TEMPLATE` で入れ直すか、全体を `loop` の中に入れる必要がある。
10. 行動のない `loop` を1行ずつ STEP すると、1tick 進むまでに1000行ぶん押すことになる（PLAY やシークバーでは普通に進む）。
11. 行単位で進められるのは、開いているファイルのロボットだけ。もう一方は tick の先頭の行を表示する。
12. 変数は数値のみ。真偽値や文字列、関数、`else if`、`break` はない。
13. 行番号クリックで選んだ行（◆）は保存されない（再読み込みで消える）。選べるのは1行だけ。
14. リプレイはメモリ上にだけあり、ファイルへの保存はできない（指示書23章で後回し可とされている）。

### 画面と開発

15. BATTLE VIEW の大きさは 1440x900 で 866x520、1100x700 で 584x350。ロボットのスプライトは画面上で 19〜28 ピクセル四方ほど。
16. 画面の部品（`src/ui`、`src/view`）には自動テストがない。ブラウザでの画面キャプチャで確認している。
17. デスクトップアプリ化（指示書3章の macOS / Windows 対応）はしていない。ブラウザで動く。

## MVP 後の候補

指示書39章で後回しとされたもの以外で、残課題から出てくる候補。

- 隠れることに意味を持たせる仕組み（残課題2。例: 隠れている間は少しずつ回復する、弾を補給できる）
- 銃の状態を読むセンサー（あと何秒で撃てるか）
- RoboScript の拡張: `else if`、`break`、関数、行をまたいで進む「ステップオーバー」
- 旋回の向きが同じでも出会えるようにする工夫（残課題4）
- 敵の速さと向きを読むセンサー（残課題5。自分で狙いを補正できるようにする）
- 車体の旋回と砲塔の操作を同じ tick にできるようにする（今は 1tick にどちらか1つ）
- マップの追加
- デスクトップアプリ化（Tauri / Electron）
