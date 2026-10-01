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

**MVP 完成条件（指示書38章）の15項目はすべて満たしている。** 確認内容は「MVP 完成条件の確認」を参照。

MVP 完成後に、画面の配置、移動の仕組み（タンク式）、センサー、マップ（3種から選択）、**RoboScript の実行モデル（1命令 = 1tick、ループと変数）とデバッガ（行単位）**、エディタの入力支援、**身を守るためのセンサーと行動（弾の検知、`guard`、隠れ場所、壁までの距離）**、サンプルAIと敵AIのコードを変更・追加した。**現在の仕様は「MVP 完成後の変更」が正**で、Phase 1〜5 の節にある時刻・行番号・画面サイズ・対戦結果・言語仕様は各Phase 完了時点の記録。

## 実行方法

```sh
npm install
npm run dev        # 表示された URL をブラウザで開く
```

- 中央上の CODE EDITOR にプレイヤー（ALPHA、緑、右側から開始）のAIコードが入っている。**RUN** で敵（BRAVO、オレンジ）との試合が始まる。
- PROJECT には ALPHA と BRAVO があり、それぞれ `main.bot`（コード）と `config`（ロボット情報）を持つ。**敵（BRAVO）のコードも編集できる。**
- `main.bot` を開いているとき、見出し右の **LOAD TEMPLATE** で、そのエディタにテンプレート（Sample / DumbBot / AggressiveBot / CowardBot / GuardBot / CoverBot）をロードできる（Cmd / Ctrl + Z で取り消せる）。初期状態は ALPHA が Sample、BRAVO が DumbBot。
- 上部の **MAP** でマップ（Center Block / Open Field / Long Wall）を選ぶ。次の RUN / DEBUG から反映される。
- **DEBUG** で同じ試合を DEBUG モードで再生する（次に実行する行のハイライト、全種類のログ、ブレークポイントでの停止、戦闘画面に視線・ターゲット枠・最後に見た位置・state）。視線などは INSPECTOR で選んでいるロボットのもの。
- **PAUSE / PLAY** で停止 / 再開、**RESET** で初期配置に戻る。
- BATTLE VIEW の下の操作列: PLAY / PAUSE、`▶▶`（DEBUG でブレークポイントに止まらずに再生）、`◀1` と `1▶`（DEBUG では**1行**、RUN では 1tick ずつ戻る / 進む）、シークバー、再生速度（0.25x〜4x）。
- DEBUG LOG の行をクリックすると、その時点に戻り、該当するコード行へ移動する。
- CODE EDITOR の行番号（またはその左の余白）をクリックすると、ブレークポイント（●）を設定 / 解除できる。DEBUG の再生は、その行を実行する直前で、通るたびに止まる（行が黄色になる）。PLAY で次のブレークポイントまで、`▶▶` で止まらずに最後まで再生、`1▶` でその行を実行する。
- WATCH には、プログラムが `set` した変数と、センサーの値が出る。
- CODE EDITOR は入力を助ける: 入力候補（Enter / Tab で確定、`Ctrl+Space` で呼び出し）、語にカーソルを載せると説明、自動インデント、エラーの赤い波線、`Cmd / Ctrl + /` でコメント切り替え。
- 構文エラーがあると、該当行が赤くなり、DEBUG LOG に ERROR が出て、試合は始まらない。
- 両方のコードは編集のたびにブラウザの localStorage へ自動保存され、再読み込みしても残る。
- `?seed=数値` を URL に付けると seed を変えられる（例: `http://localhost:5173/?seed=7`）。

## テスト方法

```sh
npm test           # Vitest（331件）
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
│  ├─ arenas/              マップ（index.ts が一覧。center_block / open_field / long_wall、common.ts は共通部分）
│  └─ templates/           テンプレート（RoboScriptソース）。index.ts が一覧と、ロード先に合わせた旋回の向きの入れ替え
│     ├─ index.ts          テンプレートの一覧（id / 表示名 / ソース）
│     ├─ sample.ts
│     ├─ dumb_bot.ts
│     ├─ aggressive_bot.ts
│     ├─ coward_bot.ts
│     ├─ guard_bot.ts
│     └─ cover_bot.ts
├─ sim/                    DOM非依存。Node上で単体実行できる
│  ├─ types.ts             Vec2 / Rect / Arena
│  ├─ math.ts              角度、衝突判定
│  ├─ rng.ts               MatchRng（seed付き乱数）
│  ├─ ai_context.ts        AIContext / AIAction / RobotBrain / RobotState
│  ├─ sensor.ts            Sensor インターフェース + ConeSensor
│  ├─ surroundings.ts      Surroundings（ロボットが周りについて分かること: 壁、飛んでくる弾、隠れ場所）
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
│  ├─ script_variables.ts  変数名・方向・state名の定義
│  ├─ script_error.ts      ScriptError と "Line N: ..." の整形
│  ├─ runtime.ts           ScriptBrain（途中で止まって続きから再開できるインタプリタ）
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
│  └─ replay_manager.ts    ReplayManager（表示位置 = tick + 行、再生、速度、行単位の step、seek、ブレークポイント）
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
                           effects / templates / arenas / surroundings / defence / math（strategies.ts は対戦確認用のプレイヤーAI）
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
| マップ | 3種から選択: Center Block（既定）/ Open Field / Long Wall。上部の MAP で選び、`project.json` に保存される |
| PROJECT ツリー | ALPHA と BRAVO に分け、それぞれに `main.bot` と `config` を持たせた |
| 敵のコード | **BRAVO の `main.bot` も編集できる。** 上部の VS（敵の選択）は廃止した |
| テンプレート | `LOAD TEMPLATE` で、Sample / DumbBot / AggressiveBot / CowardBot / GuardBot / CoverBot をどちらのエディタにもロードできる（下記） |
| **RoboScript 2** | **プログラムが上から下へ1回流れ、行動の文を1つ実行するたびに 1tick 進む**方式に作り替えた。`loop` / `while` / `set`（変数）/ 算術式 / 括弧 / コメントを追加（下記） |
| **行単位のデバッガ** | 「現在の行」は次に実行する1行。`1▶` / `◀1` は1行ずつ。ブレークポイントはその行の直前で毎回止まる。WATCH にプログラムの変数が出る（下記） |
| DEBUG 時の表示 | 視野の扇形をやめ、敵が見えている間の視線（直線）を描く。ターゲット枠・最後に見た位置・state は変更なし |
| **エディタの入力支援** | 入力候補、ホバーでの説明、自動インデント、入力中のエラー表示（下記） |
| **身を守るセンサーと行動** | 飛んでくる弾（`bullet_*`）、隠れ場所（`cover_*` と `turn cover`）、壁までの距離（`wall_*`）が読め、`guard` でダメージを半分にできる（下記） |
| ログの ACTION | 「行動が変わったら記録」から「その行の行動が直近1秒間に実行されていなかったら記録」に変えた（旋回と前進が毎tick 入れ替わるため） |

途中で一度 `clear_shot`（射線が通っているか）という変数を追加したが、センサーが障害物に遮られるようになって `enemy_visible` と同じ意味になったので、コミット前に廃止した。

### 現在の RoboScript（RoboScript 2）

Phase 2 の言語（毎tick プログラム全体を先頭から評価し直す）では、DEBUG で1行ずつ進められず、「現在の行」が1行に決まらず、ループも変数も書けなかった。通常のプログラムと同じ流れ方に作り替えた。

| 種類 | 文 | かかる時間 |
|---|---|---|
| 行動 | `move forward` / `move backward` / `turn left` / `turn right` / `turn enemy` / `turn cover` / `fire` / `guard` / `wait` | **1tick** |
| 制御 | `if 条件` / `else` / `loop`（ずっと繰り返す）/ `while 条件`（条件が真の間繰り返す） | なし |
| 変数 | `set 名前 = 式` | なし |
| 表示 | `state IDLE` / `SEARCH` / `TRACK` / `ATTACK` / `EVADE` | なし |
| コメント | `#` から行末まで | — |

- **実行**: 先頭から1行ずつ進む。行動の文を実行すると、その行動を 1tick ぶん行い、次の tick は続きの行から再開する。
- **1tick に行動は1つ。** 旋回しながら前進、前進しながら射撃はできない。
- **最後の行まで行くと、ロボットは何もしなくなる。** 繰り返したい処理は `loop` に入れる。ログに `program finished: the robot stops (use loop to keep it going)` が出る。
- **変数**は数値のみ。式には `+ - * /`、括弧、数値、変数、センサーの数値が使える。プログラムのどこにも `set` のない名前を使うと `Unknown variable "x"`。`set` より前に読むと 0。0 で割ると 0。予約語とセンサーの名前は変数名にできない。
- **条件式**: 比較（`< > <= >= == !=`、両辺は式）と `and` / `or` / `not`、括弧。センサーの値は、その行を実行している tick のもの。
- **暴走の防止**: 行動を実行しないまま 1tick に 1000行（`MATCH_DEFAULTS.lineBudget`）を実行したら、その tick は何もせず、次の tick に続きから再開する。ログに `too many lines without an action: …` が1回出る（例: 行動のない `loop`）。
- `move left` / `move right` は `Line N: Robots cannot move sideways: use "turn left" and "move forward"` というエラーになる。
- インデントは空白（タブはエラー）。ブロックは `if` / `else` / `loop` / `while` の次の行を字下げして書く。

センサーの値:

| 名前 | 意味 |
|---|---|
| `enemy_visible` | 敵がセンサー範囲内にいて、障害物に隠れていない。向きは関係ない。判定には車体の幅ぶんの余裕を取っているので、**見えていれば、まっすぐ走って行けるし、撃てば届く** |
| `blocked` | 障害物か壁が正面にあり、前へ進めない。相手ロボットは数えない（ぶつかった敵に向いたまま撃てるようにするため） |
| `blocked_behind` | 障害物か壁が真後ろにあり、後退できない。相手ロボットは数えない |
| `enemy_distance` / `enemy_angle` | 見えていれば敵まで、見えていなければ最後に見た位置までの距離と相対角度。一度も見ていなければ 0 |
| `hp` / `ammo` | 自分の HP と残弾 |
| `bullet_incoming` / `bullet_distance` / `bullet_angle` | 当たるコースの弾があるか、その弾までの距離と方向（下記） |
| `cover_visible` / `cover_distance` / `cover_angle` | 敵から隠れられる場所へ行けるか、そこまでの道のりと、次に向かう方向（下記） |
| `wall_ahead` / `wall_behind` / `wall_left` / `wall_right` | その方向の壁・障害物までの距離（下記） |

実装: `ScriptBrain`（`src/ai/runtime.ts`）は JavaScript のジェネレータで書いたインタプリタで、行動の文で `yield` して tick を終え、次の `decide()` で続きから再開する。実行位置と変数はロボットごとに持つ。エンジン側（`RobotBrain` / `AIContext` / `AIAction`、`Simulation`）の形は変えていない。同じ seed・同じコードなら同じ結果になる。

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

- `guard` は 1tick の行動。**その tick に当たった弾のダメージが半分（20 → 10）になる。** 構えている tick は動けず、撃てない。割合は `ROBOT_DEFAULTS.guardDamageFactor`（0.5）。
- **構えた 1tick ごとに、自分が次に撃てるまでの時間が 0.3 秒（9tick）延びる**（`ROBOT_DEFAULTS.guardRecovery`）。射撃の間隔は 0.8 秒なので、1発の弾に 1tick だけ構えるなら撃てる回数は約 6割、2tick 構えると約 3割になる。撃つつもりのない間（近づいている途中、弾切れ）に構えるぶんには損がない。
- 弾が当たる tick に構えている必要がある。早すぎる `guard` は効かず、次の射撃が遅れるだけになる。
- **なるべく遅く、短く構える。** 弾は 1tick に約13 進み、車体の半径ぶん（19）手前で当たるので、`bullet_distance < 36` なら次の tick までに当たる。敵が見えている間のプログラムは「向く」「撃つ / 進む」で1周 2tick かかるため、周の頭で1回確かめるだけだと 1tick 早く構えることになる。行動の前ごとに確かめれば、当たる tick だけ構えられる（GuardBot を参照）。
- 戦闘画面では構えているロボットを輪で囲む。ログは `ACTION guard` と `HIT … (guarded)`。INSPECTOR の COOLDOWN に、延びた時間が出る。

「構えたあと一定時間撃てない」という決め方も試したが、射撃の間隔（0.8 秒）より短いと何も変わらず、同じかそれより長いと、弾が来るたびに構えるロボットが二度と撃てなくなった。構えた時間に応じて延びる方式にして、構え方のうまさで差がつくようにした。

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
- エディタの入力候補・ホバー説明・ハイライトにも新しい語が出る。

### 行単位のデバッガ

試合は今までどおり RUN / DEBUG を押したときに最後まで計算して記録する。記録には tick ごとに「実行した行の順番」と「変数への代入」を入れてあり、表示位置を「tick」から「**tick + その中で何行進んだか**」に細かくした。インタプリタの状態を巻き戻す必要はない。

| 項目 | 動き |
|---|---|
| 現在の行（黄色） | **次に実行する1行。** ロボットごとに1行 |
| 実行済みの行（薄い緑） | 今の tick の中で、すでに通った行 |
| `1▶` | **1行**進む。`if` や `set` の行では時間は進まず、行動の行を実行するとロボットが 1tick 動く |
| `◀1` | 1行戻る |
| ブレークポイント | **その行を実行する直前で止まる。通るたびに毎回止まる。** PLAY で次のブレークポイントまで、`1▶` でその行を実行 |
| `▶▶` | **ブレークポイントに止まらずに再生を続ける。** `loop` の中のブレークポイントは毎周止まるので、そこから先を通して見たいときに使う。PAUSE・STEP・シーク・試合の終わりで解除され、次の PLAY からはまた止まる。RUN モードでは押せない |
| WATCH | 上にプログラムの変数（`set` したもの）、下にセンサーの値。行を進めると変数も変わる |
| ログクリック | そのイベントを起こした行を「現在の行」にした位置（実行の直前）へ移動する。行のないイベント（HIT など）はその tick へ |
| PLAY / シークバー / 速度 | tick 単位（今までどおり） |

- 行単位で進むのは、**開いているファイルのロボット**。もう一方のロボットは、同じ tick の先頭の行が「現在の行」になる。ブレークポイントで止まると、そのロボットのファイルが開いて対象が切り替わる。
- 止まっている間の WATCH / INSPECTOR のセンサー値（`enemy_visible`、`enemy_distance` など）は、これから実行する tick のもの（プログラムがその行で読む値）。位置や HP は表示中の tick のもの。
- プログラムが終了したロボットには「現在の行」がなく、`1▶` は 1tick ずつ進む。
- RUN モードではコードの表示はなく、`◀1` / `1▶` は 1tick ずつ動く。
- 上部の表示: `BREAKPOINT   ALPHA line 12. PLAY: to the next breakpoint, ▶▶: play on, 1▶: step.`

### エディタの入力支援

| 機能 | 動き |
|---|---|
| 入力候補 | 入力中に、その位置に合う語だけを出す。行の先頭は文（`if` `loop` `move` …）、`move ` の後は `forward` / `backward`、`turn ` の後は `left` / `right` / `enemy`、`state ` の後は state 名、`if ` / `while ` の後はセンサーと自分の変数、比較や `=` の後は数値のセンサーと自分の変数、値の後は `and` / `or`。各候補の右に短い説明、横に詳しい説明が出る |
| 確定 | Enter または Tab。続きが必要な語（`move` `if` `set` など）は空白を入れて、すぐ次の候補を出す（`mo` → Enter → `move ` → `forward` / `backward`） |
| 候補を出さないとき | コメントの中、語を打ち終わったとき（`fire` の後の Enter はそのまま改行になる）、空行（`Ctrl+Space` で呼び出せる） |
| ホバー | 命令・センサー・方向・state 名・自分の変数にカーソルを載せると説明が出る。変数は最初に `set` した行を示す |
| 自動インデント | `if` / `else` / `loop` / `while` の次の行は1段深くなる。`else` と打つと、対応する `if`（まだ `else` のない、いちばん近いもの）の深さに戻る。手で戻した位置より深い `if` には合わせない |
| エラーの波線 | 入力が 0.5秒止まると、RUN と同じ解析をして、エラーのある行のコードに赤い波線を引く。カーソルを載せると内容が出る。**直したエラーの波線はすぐ消える。** 候補の一覧が出ている間は新しい波線を出さない |
| 赤い背景 | RUN / DEBUG でエラーになった行に付く（今までどおり）。その行のエラーが直ると消える |
| その他 | `Cmd / Ctrl + /` でコメント切り替え、`(` で `)` を補う、対応する括弧の強調 |

「何を候補にするか」「何と説明するか」「どこまで字下げするか」は `src/ai/`（`completion.ts` / `reference.ts` / `indentation.ts`）の純粋な関数で決め、テストしている。`src/ui/roboscript_assist.ts` はそれを CodeMirror（`@codemirror/autocomplete`、`hoverTooltip`、`indentService`）につなぐだけ。エラーの波線は `@codemirror/lint` の `setDiagnostics` で出している。説明文は、ログやメッセージに合わせて英語。

### 現在のサンプルAI（`src/data/templates/sample.ts`）

```text
# Each move, turn or fire takes one tick.
loop
    if blocked
        state SEARCH
        turn left
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 250
                state ATTACK
                fire
            else
                state TRACK
                move forward
        else
            state SEARCH
            move forward
```

- 正面がふさがっていたら左へ旋回する。
- 敵が見えていれば敵の方を向き（1tick）、次の tick に、近ければ撃ち、遠ければ前進する。**向く tick と進む tick が交互になる**ので、敵へ近づく速さは探索中の半分になる。
- 敵が見えなければ、そのまま前進して探す。
- **ALPHA は左へ、BRAVO は右へ旋回する。** 向かい合っているので、両者が障害物の同じ側へ回り込んで出会う。
- すでに保存されているコード（ブラウザの localStorage）は書き換わらない。`loop` のない古いコードは、最初の行動を1回実行して終わる。LOAD TEMPLATE の Sample で新しいサンプルにできる。

### テンプレートと、2体のコード（`src/data/templates/`）

| テンプレート | 内容 |
|---|---|
| Sample | 敵の方を向いてから、距離250未満なら撃ち、遠ければ前進する |
| DumbBot | Sample と同じで、距離300未満で撃つ |
| AggressiveBot | 前進 → 敵の方を向く → 射程（400）内なら撃つ、を繰り返す。止まらない |
| CowardBot | 距離300未満なら撃ってから後退する。後ろがふさがったら（`blocked_behind`）その場で撃ち続ける。距離400未満なら撃ち、それより遠ければ近づく |
| GuardBot | DumbBot に防御を足したもの。行動の前ごとに弾を確かめ、当たる tick（`bullet_incoming and bullet_distance < 36`）だけ `guard` する |
| CoverBot | 距離350未満で撃つ。HP が 60 を切ると、1回だけ物陰へ逃げ込み（`turn cover` と `move forward`）、敵が見えるまで最大5秒待つ。そのあとは障害物を逆回りして敵を探す |

- **ロード先に合わせて、障害物を避ける旋回の向きを入れ替える。** ALPHA にロードすると `turn left`、BRAVO にロードすると `turn right` になる。2体が同じ向きに旋回すると障害物の反対側に分かれて出会えないため。テンプレート同士の全組み合わせ（6 × 6）は、3つのマップすべてで時間切れにならず決着する（テストで固定）。CoverBot だけは、隠れたあと逆回りに探すため、両方の向きの旋回を持つ。
- **保存先**: ALPHA は `robograming/projects/alpha/main.bot`、BRAVO は `robograming/projects/alpha/bravo.bot`。
- **RUN / DEBUG は両方のコードを解析する。** どちらかにエラーがあれば試合を始めず、ログにロボット名付きで出し、該当するエディタの行を赤くして、そのファイルを開く。
- **編集後の扱いはロボットごと。** 編集したほうのエディタだけ、次の RUN / DEBUG まで行の表示とブレークポイントを止める。
- **ログクリック**は、その行のロボットのコードを開いて該当行へ移動する。

### 修正した不具合

**障害物の角のそばにいるロボットが、敵を「見えない」と誤判定していた。** 視線の判定で、障害物を上下左右に車体の半径ぶん広げた四角形を使っていたため、角の斜め外側（実際には半径以上離れている場所）にいても隠れている扱いになっていた。CowardBot が四隅寄りのブロックの角まで後退すると、1tickごとに「見える → 後退」「見えない → 前進」を繰り返して、その場で前後に揺れ続けていた。線分と四角形の実際の距離で判定するように直した。

### マップ（`src/data/arenas/`）

初期位置（右に ALPHA、左に BRAVO、向かい合わせ）と四隅寄りの 80x80 のブロック4つは共通で、中央だけが違う。どれも点対称。

| マップ | 中央 | 特徴 |
|---|---|---|
| Center Block（既定） | 横長のブロック 400x90 | 互いが見えない状態で始まり、ブロックを回り込んでから戦う |
| Open Field | なし | 最初から互いが見えていて、正面から撃ち合う |
| Long Wall | 縦長の壁 40x300 | 壁の端まで走って回り込み、出会った瞬間に近距離戦になる |

### 既定の対戦の流れ（Center Block、サンプルAI 対 DumbBot、seed 1）

| 時刻 | 出来事 | ALPHA が実行する行 |
|---|---|---|
| 0.033 | 敵は見えない。前進を始める（`SEARCH`） | 2, 3, 6, 7, 16, 17, **18** |
| 1.667 | 中央のブロックに当たる（`blocked`）。ALPHA は左へ、BRAVO は右へ、約90°旋回する | 2, 3, 4, **5** |
| 約2.2 | ブロックに沿って前進する（どちらも画面の下側へ） | 2, 3, 6, 7, 16, 17, **18** |
| 2.800 | ブロックの角を抜けて互いが見える。敵の方を向く | 2, 3, 6, 7, **8** |
| 2.833 | 前進する（`TRACK`）。以後、向く tick と進む tick が交互になる | 10, 13, 14, **15** |
| 4.500 | BRAVO が距離300未満で撃ち始める | |
| 5.500 | ALPHA が距離250未満で撃ち始める（`ATTACK`）。4発撃つ | 10, 11, **12** |
| 8.200 | ALPHA が破壊され、BRAVO の勝ち（BRAVO HP 40） | |

太字はその tick の行動の行。

### 対戦結果（seed 1〜5）

プレイヤー側の戦い方（`tests/strategies.ts`）と、サンプルAIの射撃距離だけを変えたものを、敵5種と対戦させた。数字は5回のうちの回数で、「分」は同時に破壊されての引き分け。

- 遠距離維持型: 射程ぎりぎりで撃ち、近づかれたら下がる
- 回転索敵型: 動かず、敵の方を向いて射程内なら撃つ
- 突撃型: 止まらずに近づきながら撃つ
- 回避型: 最初の弾が来たら、敵が弾を撃ち尽くすまで（約43秒）横へ避け続け、そのあと攻める
- 防御型: サンプルAI（射撃距離 350）に、弾が当たる tick だけの `guard` を足したもの
- 早すぎる防御型: 同じだが、周の頭で1回確かめるだけなので 1〜2tick 早く構える

**Center Block**

| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot |
|---|---|---|---|---|---|
| サンプルAIのまま | 負け | 負け | 負け | 負け | 負け |
| 射撃距離を 250 → 350 | 勝ち | 勝ち | 負け | 負け | 勝ち |
| 射撃距離を 250 → 400 | 勝ち | 勝ち | 分 | 負け | 勝ち |
| 遠距離維持型 | 勝ち | 分 | 分 | 負け | 勝ち |
| 回転索敵型 | 勝ち | 勝ち | 勝ち4 分1 | 勝ち | 勝ち |
| 突撃型 | 勝ち | 分 | 負け | 負け | 勝ち3 分1 負け1 |
| 回避型 | 勝ち | 負け | 勝ち | 勝ち | 勝ち4 負け1 |
| 防御型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち |
| 早すぎる防御型 | 勝ち | 負け | 負け | 勝ち | 勝ち |

**Open Field**

| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot |
|---|---|---|---|---|---|
| サンプルAIのまま | 負け | 負け | 負け | 負け | 負け |
| 射撃距離を 250 → 350 | 勝ち | 負け | 負け | 負け | 勝ち |
| 射撃距離を 250 → 400 | 勝ち | 勝ち | 分 | 勝ち | 勝ち |
| 遠距離維持型 | 勝ち | 勝ち | 分 | 勝ち | 勝ち |
| 回転索敵型 | 勝ち | 勝ち | 勝ち | 勝ち | 勝ち |
| 突撃型 | 勝ち | 分 | 負け | 負け | 勝ち |
| 回避型 | 勝ち3 負け2 | 負け | 勝ち | 勝ち3 負け2 | 負け |
| 防御型 | 勝ち | 勝ち4 負け1 | 勝ち | 勝ち | 勝ち |
| 早すぎる防御型 | 勝ち | 負け | 負け | 勝ち | 勝ち |

**Long Wall**

| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot |
|---|---|---|---|---|---|
| サンプルAIのまま | 分 | 勝ち | 勝ち | 負け | 勝ち |
| 射撃距離を 250 → 350 / 400 | 分 | 勝ち | 勝ち | 負け | 勝ち |
| 遠距離維持型 | 負け | 勝ち | 分4 勝ち1 | 負け | 勝ち |
| 回転索敵型 | 勝ち3 分2 | 勝ち | 勝ち | 勝ち4 負け1 | 勝ち3 分1 負け1 |
| 突撃型 | 負け | 分 | 負け | 負け | 負け |
| 回避型 | 負け | 勝ち | 負け | 負け | 負け |
| 防御型 | 勝ち | 勝ち | 勝ち | 勝ち2 分3 | 勝ち |
| 早すぎる防御型 | 負け | 勝ち | 負け | 勝ち2 負け3 | 勝ち |

- **既存の4テンプレート同士と、サンプルAI・射撃距離を変えたものの結果は、今回の追加の前と変わらない。** 最初の学び（射撃距離を 250 → 350 にすると DumbBot と AggressiveBot に勝つ）はそのまま成り立つ。
- **`guard` は構え方で差がつく。** 当たる tick だけ構える防御型は、3つのマップで敵5種にほぼ負けなし。1〜2tick 早く構えるだけの「早すぎる防御型」は、`guard` なしなら勝てる AggressiveBot に負ける（構えるたびに自分の射撃が遅れるため）。
- **GuardBot は強い敵になった。** Center Block で Sample・DumbBot・AggressiveBot・CowardBot に勝つ。射程（400）の外から近づく間に撃たれるので、動かずに撃つ回転索敵型には負ける。
- **避けるだけでも勝てる。** 回避型は、敵が離れて撃ち続ける Center Block で DumbBot・CowardBot・GuardBot に勝つ（敵の弾 50発を避け切ってから攻める。試合は約52秒かかる）。近づいてくる AggressiveBot や、出会った時点で近い Long Wall では避ける時間がなく負ける。
- **隠れるだけでは勝てない。** CoverBot は逃げ込む間に背中を撃たれ、出てきたあとも不利なままなので、隠れた試合はほぼ負ける（Sample と DumbBot には、隠れる前に勝つ）。隠れ場所の使い道（待ち伏せ、HP で勝っているときの時間稼ぎなど）はプレイヤーが考える余地として残している。
- テンプレート同士の全組み合わせに時間切れはない。プレイヤー側の戦い方では、Open Field の回避型 対 Sample が5回のうち1回、時間切れになる。

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
| マップ | 3種から選択（指示書8章は固定の1種）。既定は中央に横長のブロックがある Center Block |
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
| 弾の検知・防御・隠れ場所・壁までの距離 | 指示書17章の変数にない `bullet_*` / `cover_*` / `wall_*` と、16章にない行動 `guard` / `turn cover` を追加 |
| プログラムの実行 | **先頭から1回流れ、行動の文を1つ実行するたびに 1tick 進む**（指示書18章は「毎tick先頭から評価」）。DEBUG を通常のプログラミングと同じ感覚にするため。18章の狙い（実行時間の予測・決定論・安全性）は、1tick に実行できる行数の上限（1000行）で保っている |
| ループと変数 | `loop` / `while` / `set` を追加（指示書18章は `while` / `for` を禁止、15章の文法にも変数はない） |
| 1tick の行動 | 1つだけ。旋回しながら前進、前進しながら射撃はできない |
| `wait` の意味 | 何もせずに 1tick 過ごす |
| コメント | `#` から行末まで |
| エラーがある状態で RUN | 新しい試合を始めず、進行中の試合は破棄して初期配置に戻す |
| 画面の配置 | 上段に PROJECT・CODE EDITOR・BATTLE VIEW を左右に並べ、下段に DEBUG LOG・INSPECTOR・WATCH を置く。指示書5章の図（BATTLE VIEW を中段に全幅）では戦闘画面が高さで制限されて小さくなるため、横幅を使える配置に変えた。INSPECTOR と WATCH は試合中の状態なので BATTLE VIEW の真下に並べている |
| PAUSE | 指示書では Phase 4 だが Phase 3 で実装 |
| 試合の計算 | RUN 時に最後まで計算してから再生する（指示書は逐次実行を前提にした書き方だが、決定論的なので結果は同じ） |
| ブレークポイントの停止条件 | その行を実行する直前で、通るたびに毎回止まる（指示書は「実行された場合」）。途中の版にあった「実行され始めた tick の手前で1回だけ止まる」という規則は、実行モデルの変更に合わせて廃止した |
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

1. **うまく構える防御型と、動かずに撃つ回転索敵型が強い。** どちらも確認した範囲でほぼ負けなし。`guard` は「構えた 1tick ごとに次の射撃が 0.3 秒遅れる」ようにして、早すぎる構えは損になるようにしたが、当たる tick だけ構えれば今も有利（`guardDamageFactor` と `guardRecovery` は `ROBOT_DEFAULTS` にある）。自分の銃があとどれだけで撃てるかを読むセンサーはない。
2. **隠れても得にならない。** HP は回復せず、隠れている間に有利になる要素がない。隠れ場所へ向かう間は敵に背を向ける。
3. **動かずに撃つ戦い方が強いまま。** その場で向きを合わせて射程（400）から撃つだけの AI は、動く AI が「向く」「進む」「撃つ」で時間を分け合うぶん有利になる。
4. **旋回の向きが敵と同じだと出会えない。** `turn right` で避ける AI は、Center Block と Long Wall で敵（右へ旋回）と障害物の反対側に分かれ、120秒の引き分けになる。
5. **動いている相手への遠距離射撃は外れやすい。** 現在位置を狙うだけで、移動先を狙う手段がない。横へ動き続ける相手には当たらない。
6. **障害物の角をはさんで隣り合うと、互いが見えない。** 視線の判定に車体の幅ぶんの余裕を取っているため、角のすぐ向こうにいる敵は、接していても `enemy_visible` が false になる。物陰で待つ CoverBot に敵がぶつかったまま、どちらも撃たない場面がある。
7. 敵が見えないときのサンプルAIは「まっすぐ進み、ふさがったら左へ旋回」するだけなので、障害物の配置によっては壁沿いを回り続ける。
8. seed の影響は小さい。結果が変わる組み合わせは一部だけ。

### 言語とデバッガ

9. **保存済みの古いコード（`loop` のないもの）は、最初の行動を1回実行して終わる。** ログに `program finished` の警告が出る。`LOAD TEMPLATE` で入れ直すか、全体を `loop` の中に入れる必要がある。
10. 行動のない `loop` を1行ずつ STEP すると、1tick 進むまでに1000行ぶん押すことになる（PLAY やシークバーでは普通に進む）。
11. 行単位で進められるのは、開いているファイルのロボットだけ。もう一方は tick の先頭の行を表示する。
12. 変数は数値のみ。真偽値や文字列、関数、`else if`、`break` はない。
13. ブレークポイントは保存されない（再読み込みで消える）。
14. リプレイはメモリ上にだけあり、ファイルへの保存はできない（指示書23章で後回し可とされている）。

### 画面と開発

15. BATTLE VIEW の大きさは 1440x900 で 866x520、1100x700 で 584x350。ロボットのスプライトは画面上で 19〜28 ピクセル四方ほど。
16. 画面の部品（`src/ui`、`src/view`）には自動テストがない。ブラウザでの画面キャプチャで確認している。
17. デスクトップアプリ化（指示書3章の macOS / Windows 対応）はしていない。ブラウザで動く。

## MVP 後の候補

指示書39章で後回しとされたもの以外で、残課題から出てくる候補。

- 隠れることに意味を持たせる仕組み（残課題2。例: 隠れている間は少しずつ回復する、弾を補給できる）
- 銃の状態を読むセンサー（あと何秒で撃てるか）
- 動く戦い方が報われるようにする調整（残課題3）。例: 砲塔を車体と別に回せるようにする、移動と射撃を同時にできるようにする
- RoboScript の拡張: `else if`、`break`、関数、行をまたいで進む「ステップオーバー」
- 旋回の向きが同じでも出会えるようにする工夫（残課題4）
- 偏差射撃の手段（残課題5）
- マップの追加
- デスクトップアプリ化（Tauri / Electron）
