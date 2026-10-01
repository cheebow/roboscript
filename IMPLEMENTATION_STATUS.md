# IMPLEMENTATION STATUS

上位仕様は `SPEC.md`（Codex向け実装指示書 v0.1）。
技術構成だけ指示書から変更し、Godot / GDScript ではなく **Web（TypeScript + Vite + Canvas 2D + CodeMirror 6）** で実装している。

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | 戦闘エンジン | 完了（2026-10-01） |
| 2 | RoboScript | 完了（2026-10-01） |
| 3 | IDE UI | 完了（2026-10-01） |
| 4 | DEBUG機能 | 完了（2026-10-01） |
| 5 | Polish | 未着手 |

## 実行方法

```sh
npm install
npm run dev        # 表示された URL をブラウザで開く
```

- 中央上の CODE EDITOR にプレイヤー（ALPHA）のAIコードが入っている。**RUN** で敵（BRAVO、`dumb_bot`）との試合が始まる。
- **DEBUG** で同じ試合を DEBUG モードで再生する（実行行のハイライト、全種類のログ、ブレークポイントでの停止）。
- **PAUSE / PLAY** で停止 / 再開、**RESET** で初期配置に戻る。
- BATTLE VIEW の下の操作列: PLAY / PAUSE、`◀1`（1tick戻る）、`1▶`（1tick進む = STEP）、シークバー、再生速度（0.25x〜4x）。
- DEBUG LOG の行をクリックすると、その時点に戻り、該当するコード行へ移動する。
- CODE EDITOR の行番号（またはその左の余白）をクリックすると、ブレークポイント（●）を設定 / 解除できる。DEBUG の再生は、その行が実行される直前で止まる（行が黄色になる）。PLAY で続行、`1▶` でその行を実行する。
- 構文エラーがあると、該当行が赤くなり、DEBUG LOG に ERROR が出て、試合は始まらない。
- コードは編集のたびにブラウザの localStorage へ自動保存され、再読み込みしても残る。サンプルAIに戻すには、ブラウザの開発者ツールで `robograming/projects/alpha/main.bot` のキーを削除する。
- `?seed=数値` を URL に付けると seed を変えられる（例: `http://localhost:5173/?seed=7`）。

## テスト方法

```sh
npm test           # Vitest（127件）
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
│  ├─ match_defaults.ts    tickレート、試合時間、既定seed
│  ├─ default_arena.ts     フィールド、障害物、初期位置
│  ├─ sample_ai.ts         プレイヤーの初期コード（31章）
│  └─ enemies/
│     └─ dumb_bot.ts       敵AI（RoboScriptソース）
├─ sim/                    DOM非依存。Node上で単体実行できる
│  ├─ types.ts             Vec2 / Rect / Arena
│  ├─ math.ts              角度、衝突判定
│  ├─ rng.ts               MatchRng（seed付き乱数）
│  ├─ ai_context.ts        AIContext / AIAction / RobotBrain / RobotState
│  ├─ sensor.ts            Sensor インターフェース + ConeSensor
│  ├─ weapon.ts            Weapon インターフェース + Gun
│  ├─ bullet.ts            Bullet と1tick分の移動・衝突
│  ├─ robot.ts             RobotController
│  ├─ simulation.ts        Simulation（step() で1tick）と勝敗判定
│  └─ event_reporter.ts    試合中の出来事をデバッグイベントにする
├─ ai/                     RoboScript
│  ├─ lexer.ts             行 → インデント幅とトークン列
│  ├─ ast.ts               IfNode / ConditionNode / ActionNode / StateNode
│  ├─ parser.ts            parse(source) → { program, errors }
│  ├─ script_variables.ts  変数名・方向・state名の定義
│  ├─ script_error.ts      ScriptError と "Line N: ..." の整形
│  ├─ runtime.ts           ScriptBrain（AST を毎tick評価する RobotBrain）
│  └─ roboscript.ts        compileScript(source) → Brain またはエラー一覧
├─ debug/
│  ├─ debug_event.ts       DebugEvent（tick / timestamp / robotId / type / message / sourceLine）
│  ├─ debug_logger.ts      DebugLogger（1試合分のイベントをメモリに保持）
│  ├─ snapshot.ts          Snapshot（1tick分の表示用の状態）と captureSnapshot
│  ├─ recorder.ts          recordMatch(config) → Recording（全スナップショット + イベント）
│  └─ replay_manager.ts    ReplayManager（表示する tick、再生、速度、step、seek、ブレークポイント）
├─ project/
│  └─ project_store.ts     main.bot と project.json の保存・読み込み
├─ ui/                     画面。記録された Snapshot を表示する
│  ├─ app.ts               全体の配線（試合の記録、RUN / DEBUG / RESET、描画ループ、保存）
│  ├─ toolbar.ts           上部バー
│  ├─ transport.ts         再生操作（1tick移動、シークバー、速度、時刻）
│  ├─ project_panel.ts     PROJECT ツリー
│  ├─ code_editor.ts       CodeMirror のラッパー
│  ├─ roboscript_highlight.ts  シンタックスハイライト
│  ├─ config_view.ts       config（ロボット基本値の一覧）
│  ├─ inspector.ts         INSPECTOR
│  ├─ watch_panel.ts       WATCH
│  ├─ debug_log.ts         DEBUG LOG
│  └─ field_list.ts / format.ts / dom.ts  共通部品
├─ view/
│  └─ battle_view.ts       Canvas描画（Snapshot を描く）
├─ main.ts
└─ style.css
tests/                     lexer / parser / runtime / scripts / sensor / weapon / movement /
                           battle / determinism / debug_logger / project_store / replay
```

指示書34章の `BattleController` の責務は、`Simulation`（tick・ロボット更新・勝敗）、`recordMatch`（試合開始から終了まで）、`ReplayManager`（pause・速度・reset 後の再生）に分けている。

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

- 5領域のレイアウト（上部バー / PROJECT・CODE EDITOR / BATTLE VIEW・INSPECTOR / DEBUG LOG・WATCH）。指示書5章の図から、INSPECTOR だけ CODE EDITOR の右から BATTLE VIEW の右へ移している
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
| 初期の向き | 背中合わせ（開始直後に索敵の分岐が実行されるようにするため） |
| 弾数の初期値 | 50 |
| 弾の散らばり | ±2° |
| ロボット半径 / 弾半径 | 16 / 3 |
| 障害物とセンサー | 障害物はセンサーを遮らない（弾と移動だけを遮る） |
| 見失った後の `enemy_distance` / `enemy_angle` | 最後に見た位置までの距離・角度。一度も見ていなければ 0 |
| 見失った後の `turn enemy` | 最後に見た位置へ向く。一度も見ていなければ何もしない |
| 同じtickで両者が破壊された場合 | DRAW |
| `wait` の意味 | そのtickの行動を取り消して評価を終了 |
| `set` | 予約語として未対応エラー |
| エラーがある状態で RUN | 新しい試合を始めず、進行中の試合は破棄して初期配置に戻す |
| INSPECTOR の位置 | BATTLE VIEW の右（指示書の図では CODE EDITOR の右）。試合中の状態なので戦闘画面の隣に置き、WATCH と同じ列に揃えた |
| PAUSE | 指示書では Phase 4 だが Phase 3 で実装 |
| 試合の計算 | RUN 時に最後まで計算してから再生する（指示書は逐次実行を前提にした書き方だが、決定論的なので結果は同じ） |
| ブレークポイントの停止条件 | その行が実行され始める tick の直前で止まる（指示書は「実行された場合」。毎tick先頭から実行される言語なので全tickで止めると先へ進めず、実行後に止めるとデバッガとして違和感があるため） |
| 1tick戻る、シークバー | 指示書にない操作を追加 |
| DEBUG 時のセンサー範囲などの描画 | Phase 5 で実装（25章は DEBUG の表示に挙げているが、Phase 5 の完成条件に含まれている） |
| RUN モードのログ | SYSTEM / HIT / WARNING / ERROR（25章の「最低限のログ」の中身をこう決めた） |
| エラー行の赤表示 | 次の RUN まで残る（編集しても行に追従する） |

## 残課題

1. **seed を変えても勝敗は変わらない。** ±2° の散らばりは、正面から近づいてくる相手や止まっている相手には外れないため。弾の軌道は seed ごとに変わっている。
2. **障害物がほとんど戦闘に関わらない。** センサーは障害物を透過し、両者は中央の通路をまっすぐ近づくので、障害物に触れずに決着する。
3. **センサーが全域に届くので、一度見つけると見失いにくい。** 見失うのは相手が視野角90°の外に出たときだけ。
4. ロボットは壁に正面から当たると止まったままになる。壁を検知する手段が `AIContext` にないため、AI側で回避できない。
5. **BATTLE VIEW が小さい。** 大きさは中段の高さで決まっていて、1440x900 で 515x309、1100x700 では 327x196 になる（Phase 4 で操作列を入れたぶん、さらに小さくなった）。横長の画面では左右に余白が残る。
6. 保存したコードをサンプルAIに戻す操作が画面にない（開発者ツールで localStorage のキーを消す必要がある）。
7. 画面の部品（`src/ui`）には自動テストがない。ブラウザでの画面キャプチャで確認している。
8. ブレークポイントは保存されない（再読み込みで消える）。対象は ALPHA のコードだけ。
9. リプレイはメモリ上にだけあり、ファイルへの保存はできない（指示書23章で後回し可とされている）。

## 次のPhase（Phase 5: Polish）に必要な作業

- ドット絵風のロボット・弾のスプライト（7章: 少ない色数、見やすさ優先）
- DEBUG 時のオーバーレイ（25・26章）: センサー範囲と視野角の扇形、敵を検知したときのターゲット枠、最終観測位置。`Snapshot` に必要な値（向き、`enemyVisible`、`lastSeen`）は入っている
- エフェクト（発射、命中、破壊）。短く控えめに
- 敵AI 3種（30章: DumbBot / AggressiveBot / CowardBot）と選択UI。現在は `dumb_bot` 固定
- 32章のゲーム性の確認: 接近型 / 遠距離維持型 / 回転索敵型 / 回避型で勝敗に差が出るか。残課題1〜4（seed、障害物、センサー、壁）はここで効いてくる
- 38章の MVP 完成条件15項目の最終確認
