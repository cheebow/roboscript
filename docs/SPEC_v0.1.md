# プログラミングロボット対戦ゲーム
# Codex向け実装指示書 v0.1

## 0. この文書の目的

本書は、プログラミングによって自律行動するロボット同士を対戦させるゲームの、最初のプレイ可能版を実装するための指示書である。

Codex等のコーディングエージェントは、本書を上位仕様として扱うこと。

不明点があった場合は、過剰に機能を追加せず、

**「シンプルなルールから深い挙動が生まれる」**

という設計原則を優先すること。

---

# 1. プロジェクト概要

プレイヤーがロボットのAIプログラムを書き、そのAIによって自律行動するロボットを戦わせる2D対戦シミュレーションゲーム。

プレイヤー自身は戦闘中にロボットを直接操作しない。

基本ゲームループは以下。

1. AIコードを書く
2. RUNする
3. ロボット同士が自動戦闘する
4. ログを見る
5. DEBUGする
6. AIを修正する
7. 再度RUNする

本ゲームの中心的な面白さは、

**「自分のロボットがなぜその行動をしたのかを理解し、改良すること」**

にある。

---

# 2. MVPの目標

最初のバージョンでは、以下が一通り遊べればよい。

- プレイヤー用ロボット1体
- 敵ロボット1体
- 2Dフィールド
- 移動
- 回転
- 索敵
- 射撃
- HP
- 勝敗判定
- AIコード編集
- RUN
- PAUSE
- DEBUGログ
- Watch表示
- リプレイ
- ログクリックによる時点ジャンプ

機体カスタマイズ、複数機戦、通信、ECM、CPU制約等はMVPには入れない。

ただし、後から追加しやすい構造にはしておく。

---

# 3. 推奨技術構成

## ゲームエンジン

Godot 4.x

## 言語

GDScript

## 対応プラットフォーム

まず以下。

- macOS
- Windows

Linux対応可能な構造にはしておく。

---

# 4. アプリ全体の方向性

一般的なゲームUIではなく、

**架空のロボットAI統合開発環境**

として見せる。

見た目の参考概念：

- IDE
- VS Code
- JetBrains IDE
- ターミナル
- デバッガ
- シミュレータ

ただし特定製品をコピーしない。

---

# 5. 画面構成

メイン画面は1ウインドウ。

以下の5領域で構成する。

```text
┌──────────────────────────────────────────────────────────┐
│ PROJECT NAME                  RUN PAUSE RESET DEBUG      │
├────────────┬──────────────────────────────┬──────────────┤
│ PROJECT    │ CODE EDITOR                  │ INSPECTOR    │
│            │                              │              │
│ main.bot   │                              │ STATE        │
│ config     │                              │ TARGET       │
│            │                              │ HP           │
│            │                              │ DISTANCE     │
├────────────┴──────────────────────────────┴──────────────┤
│                     BATTLE VIEW                         │
│                                                        │
│                  2D DOT-STYLE ARENA                    │
│                                                        │
├────────────────────────────────┬────────────────────────┤
│ DEBUG LOG                      │ WATCH                  │
│                                │                        │
└────────────────────────────────┴────────────────────────┘
```

---

# 6. UIレイアウト

## 左

PROJECT PANEL

MVPでは以下だけでよい。

```text
PROJECT
└─ ALPHA
   ├─ main.bot
   └─ config
```

main.botクリックでコード表示。

configクリックでロボット情報表示。

---

## 中央上

CODE EDITOR

MVPでは以下を実装。

- 行番号
- テキスト編集
- Undo
- Redo
- シンタックスハイライト
- エラー行表示
- 現在実行行表示
- ブレークポイント用余白

高度なIDE機能は不要。

---

## 右

INSPECTOR

現在選択しているロボットについて以下を表示。

```text
ID
HP
X
Y
ROTATION
STATE
TARGET
TARGET_DISTANCE
AMMO
COOLDOWN
```

DEBUG時はリアルタイム更新。

---

## 中央下

BATTLE VIEW

ここが戦闘画面。

2Dトップビュー。

ドット絵風。

完全なピクセルアートに固定する必要はない。

低解像度風のスプライトを使用する。

---

## 下部左

DEBUG LOG

例：

```text
[02.130] SENSOR   enemy detected: BRAVO
[02.131] TARGET   selected: BRAVO
[02.132] AI       line 12 matched
[02.133] ACTION   move_forward
[02.644] ACTION   fire
[02.812] HIT      BRAVO damage=20
```

---

## 下部右

WATCH

以下の変数を常時表示。

```text
enemy_visible
enemy_distance
enemy_angle
hp
ammo
state
last_seen_x
last_seen_y
```

将来的にはユーザー定義変数を追加可能にする。

---

# 7. ビジュアル方針

UI：

- ダークテーマ
- モノスペース系フォント
- 細い罫線
- 控えめな色
- 不要なグラデーション禁止
- 大げさなSF装飾禁止

ゲーム部分：

- ドット絵風
- トップビュー
- 少ない色数
- 見やすさ優先
- エフェクトは短く控えめ

---

# 8. バトルフィールド

MVPフィールドは固定。

内部座標：

```text
width  = 1000
height = 600
```

画面表示時には適切にスケールする。

障害物はMVPでは4～6個。

矩形のみでよい。

例：

```text
┌─────────────────────────┐
│        ███              │
│                         │
│  A                B     │
│               ████      │
│                         │
└─────────────────────────┘
```

---

# 9. ロボット

MVPでは両者同一性能。

## 基本値

```text
HP                100
MOVE_SPEED        100 units/sec
ROTATE_SPEED      180 deg/sec
SENSOR_RANGE      300
SENSOR_ANGLE      90 deg
WEAPON_RANGE      400
SHOT_DAMAGE       20
SHOT_SPEED        400
SHOT_COOLDOWN     0.8 sec
```

数値は定数ファイルへまとめる。

コードへのハードコード禁止。

---

# 10. ロボット状態

最低限以下。

```text
IDLE
SEARCH
TRACK
ATTACK
EVADE
```

ただしSTATEはエンジン側が勝手に決めるのではなく、

AIコードから設定できるようにする。

STATEは主としてデバッグ表示用。

---

# 11. センサー

ロボットは敵の正確な位置を常時知っていてはいけない。

敵がセンサー範囲内かつ視野角内にいる場合だけ、

```text
enemy_visible = true
```

とする。

取得可能情報：

```text
enemy_visible
enemy_distance
enemy_angle
enemy_x
enemy_y
```

enemy_visible=falseの場合、

enemy_x/enemy_yは現在位置ではなく、

最後に観測した位置を保持する。

---

# 12. 射撃

射撃は物理弾。

即着弾ではない。

弾丸には、

```text
position
direction
speed
owner
damage
```

を持つ。

壁またはロボットに接触すると消える。

味方撃ちはMVPでは考慮不要。

---

# 13. 勝敗

HP <= 0で破壊。

どちらかが破壊されたら戦闘終了。

最大試合時間：

```text
120 sec
```

時間切れの場合、

HPが多い側を勝者とする。

同HPならDRAW。

---

# 14. AIプログラム方式

MVPでは独自の軽量DSLを使用する。

名称仮：

**RoboScript**

Python互換を目指さない。

実装しやすく、安全で、決定論的であることを優先する。

---

# 15. RoboScript文法

初期実装では以下だけサポートする。

```text
if
else
set
move
turn
fire
wait
state
```

例：

```text
state SEARCH

if enemy_visible
    state ATTACK

    if enemy_distance < 200
        fire
    else
        move forward
else
    turn right
```

---

# 16. RoboScriptコマンド

## move

```text
move forward
move backward
move left
move right
```

意味：

一定時間ではなく、

**そのtickに希望する移動方向**

を設定する。

---

## turn

```text
turn left
turn right
turn enemy
```

turn enemyは敵の方向へ旋回。

---

## fire

```text
fire
```

発射可能なら射撃。

クールダウン中なら何もしない。

---

## state

```text
state ATTACK
```

DEBUG表示用。

---

## wait

```text
wait
```

そのtickは何もしない。

---

# 17. 条件式

最初は以下のみ。

```text
enemy_visible
enemy_distance
enemy_angle
hp
ammo
```

比較演算子：

```text
<
>
<=
>=
==
!=
```

論理演算：

```text
and
or
not
```

---

# 18. RoboScript実行方式

毎ゲームtick、AIを先頭から評価する。

ただし無限ループ構造は言語仕様に含めない。

while / forは禁止。

これにより、

- 実行時間の予測
- 決定論
- 安全性

を確保する。

---

# 19. 内部表現

RoboScriptは一度ASTへ変換する。

例：

```text
IfNode
ConditionNode
ActionNode
StateNode
```

テキストを毎tick再解析しない。

RUN時に、

```text
source
↓
lexer
↓
parser
↓
AST
↓
runtime
```

とする。

---

# 20. エラー表示

RUN時に構文解析。

エラー例：

```text
Line 14: Unknown command "shoot"
Line 22: Expected condition
Line 31: Unexpected else
```

CODE EDITORの該当行も強調表示する。

エラーがある場合、戦闘を開始しない。

---

# 21. ゲームtick

シミュレーションは固定tick。

推奨：

```text
30 tick/sec
```

描画FPSとは分離する。

AI判断もゲームtick単位。

これによりリプレイの再現性を確保する。

---

# 22. 決定論

非常に重要。

同じ、

- 初期位置
- AI
- random seed

なら同じ戦闘結果になること。

乱数を使用する場合、ゲームエンジンのグローバル乱数を直接使わない。

Match専用RandomNumberGeneratorを使う。

---

# 23. リプレイ

戦闘中、各tickの状態を保存する。

最低限：

```text
time
robotA.position
robotA.rotation
robotA.hp
robotA.state

robotB.position
robotB.rotation
robotB.hp
robotB.state

bullets

AI executed lines

debug events
```

MVPではメモリ保存だけでよい。

ファイル保存は後回し可。

---

# 24. リプレイ操作

以下を実装。

```text
PLAY
PAUSE
STEP
0.25x
0.5x
1x
2x
4x
```

STEPは1tick進行。

---

# 25. DEBUGモード

RUNとDEBUGを分ける。

## RUN

表示：

- ロボット
- 弾
- HP
- 最低限のログ

## DEBUG

追加表示：

- センサー範囲
- 視野角
- ターゲット
- AI STATE
- 最終観測位置
- 現在実行行
- 詳細ログ
- Watch

---

# 26. センサーオーバーレイ

DEBUG時のみ表示。

視野を扇形で表示する。

敵を検知した場合は、ターゲット枠を表示。

---

# 27. コードと戦闘の同期

AIが実行された行を記録する。

例：

```text
line 4
line 6
line 7
```

DEBUG再生中は、現在実行中のコード行をCODE EDITORで強調表示する。

---

# 28. ログクリック

DEBUG LOGの各イベントには、

```text
tick
timestamp
robot_id
type
message
source_line
```

を持たせる。

ログ行をクリックすると、

そのtickへリプレイをジャンプする。

該当source_lineがあればCODE EDITORもその行へ移動する。

これはMVP必須機能。

---

# 29. ブレークポイント

CODE EDITOR左余白をクリックすると、

その行にブレークポイントを設定。

DEBUG中、その行が実行された場合、

自動的にPAUSEする。

MVPでは、

- 追加
- 削除
- 停止

だけでよい。

条件付きブレークポイントは不要。

---

# 30. 敵AI

MVPでは固定の3種類を用意。

## DumbBot

```text
敵が見えなければ回転
敵が見えたら接近
近ければ射撃
```

## AggressiveBot

```text
常に接近
射撃可能なら射撃
```

## CowardBot

```text
敵が近ければ離れる
距離を保ちながら射撃
```

選択可能にする。

---

# 31. 初期プレイヤーAI

初回起動時にはサンプルAIを表示。

```text
state SEARCH

if enemy_visible
    state ATTACK

    turn enemy

    if enemy_distance < 250
        fire
    else
        move forward
else
    turn right
```

RUNを押せばすぐ戦える状態にする。

---

# 32. 最低限のゲーム性

単にコードが動くだけではなく、

少なくとも、

- 接近型
- 遠距離維持型
- 回転索敵型
- 回避型

の戦略差が感じられる状態にする。

AIを書き換えることで勝敗が明確に変化すること。

---

# 33. ファイル構成案

```text
res://
├─ scenes/
│  ├─ main/
│  │  └─ main.tscn
│  ├─ battle/
│  │  ├─ battle_view.tscn
│  │  ├─ robot.tscn
│  │  └─ bullet.tscn
│  └─ ui/
│     ├─ code_editor.tscn
│     ├─ debug_log.tscn
│     ├─ inspector.tscn
│     └─ watch_panel.tscn
│
├─ scripts/
│  ├─ battle/
│  │  ├─ battle_controller.gd
│  │  ├─ robot_controller.gd
│  │  ├─ sensor.gd
│  │  ├─ weapon.gd
│  │  └─ bullet.gd
│  │
│  ├─ ai/
│  │  ├─ lexer.gd
│  │  ├─ parser.gd
│  │  ├─ ast.gd
│  │  ├─ runtime.gd
│  │  └─ ai_context.gd
│  │
│  ├─ debug/
│  │  ├─ debug_event.gd
│  │  ├─ debug_logger.gd
│  │  └─ replay_manager.gd
│  │
│  └─ ui/
│
├─ assets/
│  ├─ sprites/
│  ├─ icons/
│  └─ fonts/
│
├─ data/
│  ├─ robot_defaults.gd
│  └─ enemies/
│
└─ tests/
```

---

# 34. 主要クラス

## BattleController

責務：

- 試合開始
- tick管理
- ロボット更新
- 勝敗管理
- pause
- reset
- simulation speed

---

## RobotController

責務：

- position
- rotation
- HP
- movement
- AI Runtime呼び出し
- sensor
- weapon

---

## Sensor

責務：

- 視野判定
- 距離
- 角度
- 最終観測位置

---

## Weapon

責務：

- cooldown
- fire
- ammo
- bullet生成

---

## AIRuntime

責務：

- AST実行
- AIContext参照
- Action生成
- executed line記録

---

## ReplayManager

責務：

- tick snapshot保存
- seek
- replay
- step

---

## DebugLogger

責務：

イベント記録。

```text
sensor
target
ai
action
hit
warning
system
```

---

# 35. AIContext

AIRuntimeから直接RobotControllerを触らせない。

AIRuntimeはAIContext経由で情報取得。

例：

```text
enemy_visible
enemy_distance
enemy_angle
hp
ammo
```

出力はAIAction。

例：

```text
move_direction
turn_direction
fire
state
```

この分離は必須。

将来的なCPU制約や通信追加に備える。

---

# 36. テスト

最低限以下について自動テストを書く。

## Parser

- 正常なif
- if/else
- ネスト
- 不正コマンド
- 不正インデント
- 条件式

## Sensor

- 範囲内
- 範囲外
- 視野内
- 視野外

## Weapon

- cooldown
- damage
- bullet collision

## Battle

- HP 0で終了
- timeout
- draw

## Replay

- tick seek
- state復元

---

# 37. 開発フェーズ

## Phase 1

戦闘エンジンのみ。

完成条件：

- 2体がフィールドに存在
- 移動可能
- 射撃可能
- HP減少
- 勝敗判定

AIはハードコードでよい。

---

## Phase 2

RoboScript。

完成条件：

- ソース入力
- Parser
- AST
- Runtime
- AIによってロボットが動く

---

## Phase 3

IDE UI。

完成条件：

- Code Editor
- Project Panel
- Battle View
- Inspector
- Log
- Watch

---

## Phase 4

DEBUG機能。

完成条件：

- Replay
- Pause
- Step
- speed
- executed line
- log seek
- breakpoint

---

## Phase 5

Polish。

完成条件：

- ドット絵風スプライト
- センサー表示
- ターゲット表示
- エフェクト
- 初期AI
- 敵AI3種

---

# 38. MVP完成条件

以下がすべて満たされた時点をMVP完成とする。

1. アプリが起動する
2. 最初からサンプルAIが表示されている
3. RUNを押せる
4. ロボットがAIに従って移動する
5. 敵を発見する
6. 射撃する
7. 敵または自分が破壊される
8. 勝敗が表示される
9. AIコードを書き換えられる
10. 書き換えた挙動が戦闘に反映される
11. DEBUGログが表示される
12. ログクリックでその時点へ移動できる
13. 現在のAI状態をWatchで確認できる
14. 現在実行行がコード上で確認できる
15. ブレークポイントで停止できる

---

# 39. MVPで実装しないもの

以下は意図的に後回しにする。

- オンライン対戦
- ランキング
- ユーザーアカウント
- Steam連携
- 複数機チーム
- ロボット間通信
- 機体パーツ
- 武器選択
- CPU負荷
- ECM
- AI学習
- 機械学習
- Python対応
- Lua対応
- Mod
- Workshop
- ストーリーモード
- キャンペーン
- スキン販売

Codexはこれらを自主的に追加しないこと。

---

# 40. 将来拡張を考慮する箇所

以下はインターフェースで分離しておく。

## Sensor

将来：

- Radar
- Camera
- Thermal

へ拡張。

## Weapon

将来：

- Gun
- Missile
- Railgun

へ拡張。

## AIContext

将来：

- memory
- communication
- CPU budget

を追加。

## BattleMode

将来：

- Deathmatch
- Capture
- Escort

へ拡張。

---

# 41. コード品質ルール

- 1クラス1責務を意識する
- 巨大なBattleControllerを作らない
- UIとシミュレーションを密結合させない
- AI RuntimeからGodotノードを直接操作しない
- 設定値を散在させない
- magic number禁止
- ログ出力をprint()だけに依存しない
- エラーを握り潰さない

---

# 42. シミュレーションとUIの分離

重要。

理想構造：

```text
UI
 ↓
MatchController
 ↓
Simulation
 ↓
Robot
 ↓
AI Runtime
```

Simulationは、可能な限り画面描画なしでも実行できるようにする。

将来、

```text
1000試合一括シミュレーション
```

などを行えるようにするため。

---

# 43. セーブ

MVPでは最低限、

```text
main.bot
```

の内容をローカルへ保存する。

自動保存でもよい。

できればプロジェクト形式。

```text
projects/
└─ alpha/
   ├─ project.json
   └─ main.bot
```

project.json例：

```json
{
  "name": "ALPHA",
  "version": 1
}
```

---

# 44. 初回体験

初回起動後、

説明画面を何枚も表示しない。

直接IDE画面を表示する。

最初からサンプルコードがある。

画面上部に、

```text
Edit the code and press RUN.
```

程度だけ表示する。

まず戦わせる。

説明は後から行う。

---

# 45. 理想的な最初の5分

ユーザー：

1. 起動
2. RUN
3. ロボットが戦う
4. 負ける
5. コードを見る
6. 距離条件を変更する
7. RUN
8. 挙動が変わる
9. 勝つ

ここまでを5分以内に体験できること。

---

# 46. ゲーム設計上の最重要原則

本作は、

**「プログラムを書くゲーム」**

というだけでは不十分。

重要なのは、

**プログラムを書いた結果を観察し、理由を理解して改善するゲーム**

である。

したがって、

コードエディタと同じくらい、

- ログ
- リプレイ
- Watch
- ブレークポイント
- 可視化

を重要視すること。

---

# 47. UI上の最重要原則

このゲームは、

**IDEの中でロボットが戦っている**

ように見えること。

Battle Viewだけ別ゲームに見えてはいけない。

戦闘も開発環境の一部として存在すること。

---

# 48. Codexへの作業指示

実装を開始する際は、一度に全機能を実装しないこと。

必ずPhase単位で進める。

各Phase終了時に、

1. 実装内容
2. 変更ファイル
3. 動作確認方法
4. 残課題
5. 次Phase

をREADMEまたは進捗ファイルへ記録すること。

推奨ファイル：

```text
IMPLEMENTATION_STATUS.md
```

---

# 49. 最初にCodexへ与える具体的指示

以下から開始すること。

---

Godot 4.xを使用して、この仕様書に記載されたプログラミングロボット対戦ゲームのMVPを実装してください。

最初はPhase 1のみ実装してください。

Phase 1の目的は、AIやIDE画面を作ることではなく、再現性のある2Dロボット戦闘シミュレーションの基盤を完成させることです。

実装するもの：

- 1000x600の2Dフィールド
- ロボット2体
- 移動
- 回転
- センサー
- 弾丸
- 射撃
- HP
- 障害物
- 勝敗
- 120秒タイムアウト
- 固定tick 30Hz
- deterministic random seed

このPhaseではAIはハードコードで構いません。

ただし後のRoboScript実装に備えて、RobotControllerとAI判断ロジックを分離してください。

Simulationと描画も可能な範囲で分離してください。

完成後はIMPLEMENTATION_STATUS.mdを作成し、

- 実装した内容
- プロジェクト構成
- 実行方法
- テスト方法
- 次のPhaseに必要な作業

を記載してください。

仕様にない機能は追加しないでください。

---

# 50. 完成イメージ

プレイヤーが画面に向かう。

コードを書く。

RUNを押す。

ドット絵のロボットが動き始める。

ログが流れる。

敵を見つける。

AIの条件分岐が実行される。

ロボットが旋回する。

撃つ。

外れる。

敵に撃たれる。

負ける。

ログの該当行をクリックする。

その瞬間まで時間が戻る。

センサー範囲を見る。

変数を見る。

コードを見る。

原因に気づく。

一行直す。

RUNを押す。

今度は避ける。

撃つ。

当たる。

勝つ。

この

**「コードを書く → 見る → 気づく → 直す」**

の繰り返しを、本ゲームの完成形の中心とする。
