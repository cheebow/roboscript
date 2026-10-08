import { MATCH_DEFAULTS } from '../data/match_defaults';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';

/** The Japanese for the words of RoboScript: a hint of a few words and a sentence or two. The English is in src/ai/reference.ts. */
export interface WordText {
  hint: string;
  summary: string;
}

const NO_TIME = '時間はかからない。';
const NOT_THE_ENEMY = 'ロボットは数えない（敵にふさがれているときは、かわりに touching_enemy が真になる）。';
const ANGLE = '度。0 が正面、右が正';
const BULLET_STEP = Math.round(ROBOT_DEFAULTS.shotSpeed / MATCH_DEFAULTS.tickRate);
const GUARDED_SHARE = `${Math.round(ROBOT_DEFAULTS.guardDamageFactor * 100)}%`;

export const WORDS_JA: Record<string, WordText> = {
  if: { hint: '条件が成り立つときに実行', summary: `条件が成り立つとき、下の字下げした行を実行する。${NO_TIME}` },
  else: { hint: 'そうでなければ', summary: '上の if の条件が成り立たないとき、下の字下げした行を実行する。1 行で else if 条件 と書くと、別の条件を調べられる（何回でも続けられる）。' },
  loop: { hint: 'ずっと繰り返す', summary: '下の字下げした行をずっと繰り返す。loop がないと、プログラムは 1 回実行して終わる。そのあとも、車体は最後に決めた drive のまま走り続ける（drive stop で止まる）。' },
  while: { hint: '条件が成り立つ間、繰り返す', summary: '条件が成り立っている間、下の字下げした行を繰り返す。' },
  break: { hint: '繰り返しを抜ける', summary: `いちばん内側の loop / while をすぐに抜けて、その次の行へ進む。${NO_TIME}` },
  def: { hint: '関数を定義する', summary: 'def approach(limit) のように関数を定義する。中身は下に字下げして書く。approach(350) と呼んだときに実行される。' },
  return: { hint: '関数を抜ける', summary: '関数を終える。return limit + 1 や return true のように値を付けると、呼び出しがその値になる。付けなければ 0。' },
  true: { hint: 'はい: 数の 1', summary: '数の 1 を「はい」として書いたもの。問いに答える関数で return true のように使う。0 でない関数の結果や変数は、if about_to_be_hit() のように条件として成り立つ。' },
  false: { hint: 'いいえ: 数の 0', summary: '数の 0 を「いいえ」として書いたもの: return false。条件としては成り立たない。' },
  and: { hint: '両方の条件', summary: '両側の条件がどちらも成り立つときに成り立つ。' },
  or: { hint: 'どちらかの条件', summary: '両側の条件の少なくとも一方が成り立つときに成り立つ。' },
  not: { hint: '逆', summary: 'あとに続く条件が成り立たないときに成り立つ。' },
  set: { hint: '変数に値を入れる', summary: `set name = value のように、変数に数を入れる。set する前の変数は 0 として読める。${NO_TIME}` },
  label: { hint: '今していることに名前を付ける', summary: `label HIDING のように、今していることに好きな名前を付ける。名前はロボットの下に出て、変わったときにログに出る。動きは変わらない。${NO_TIME}` },
  signal: { hint: 'チームに数を送る', summary: `signal 3 のように、チームの無線に数を載せる。次の tick から、チーム全員が ally_signal で読める（新しい数を送るまで変わらない）。数の意味はプログラムで決める。1 台のときは自分あてのメモになる。${NO_TIME}` },
  drive: { hint: '車体の走り方を決める', summary: `車体の走り方をこれ以降 forward、backward、stop のどれかにする。旋回・照準・発射をしている間も走り続ける。${NO_TIME}` },
  turn: { hint: '車体を回す、1 tick', summary: '車体を 1 tick ぶん回す: left、right、enemy（敵の方へ）、cover（隠れ場所の方へ）、hit（撃たれた方へ）、ally（味方の方へ）、base / enemy_base（基地の方へ）。砲塔も一緒に回る。turn left 90 のように left / right の後ろに角度を書くと、その角度だけ回り切るまで 1 tick ずつ回る。敵の方を向き切るまで回るなら face。' },
  face: { hint: '向くまで車体を回す', summary: '敵、隠れ場所、最後に撃たれた方向、今の真後ろ（back）、味方（ally）、基地（base / enemy_base）のどれかを向くまで、車体を 1 tick ずつ回す。face hit は turn hit を繰り返すのと同じ。向いていれば、または向く先がなければ、時間はかからない。回っている間、プログラムはほかのことをしない。毎 tick 弾や壁も確かめたいときは、loop の中で turn を使う。' },
  aim: { hint: '砲塔を回す、1 tick', summary: '砲塔を 1 tick ぶん回す: left、right、enemy（敵の方へ）、lead（敵の動く先へ）、ahead（車体の正面へ）。aim right 30 のように left / right の後ろに角度を書くと、その角度だけ回り切るまで 1 tick ずつ回る。' },
  fire: { hint: '撃つ、1 tick', summary: '砲塔の向いている方へ撃つ。1 tick かかる。次の弾が撃てるようになるまでの間と、弾切れのときは、弾は出ない。車体が走っている tick に撃つと、弾のばらつきが 5 倍になる。' },
  guard: { hint: '被弾に備える、1 tick', summary: `1 tick のあいだ身構える: その tick に当たった弾のダメージは ${GUARDED_SHARE} になる。1 試合に ${ROBOT_DEFAULTS.maxGuards} tick ぶんしか使えず、使うたびに、次に撃てるようになるのが ${ROBOT_DEFAULTS.guardRecovery} 秒遅れる。弾が当たる tick に合わせて使う。` },
  wait: { hint: '何もしない、1 tick', summary: '1 tick のあいだ何もしない。' },
  forward: { hint: '車体の向く方へ', summary: '車体が向いている方へ。' },
  backward: { hint: '車体の向きと逆へ', summary: '車体が向いている方と逆へ。' },
  stop: { hint: '止まる', summary: '走るのをやめる。' },
  left: { hint: '反時計回り', summary: '画面で見て反時計回り。後ろに数を書くと、その角度だけ回る: turn left 90。' },
  right: { hint: '時計回り', summary: '画面で見て時計回り。後ろに数を書くと、その角度だけ回る: aim right 30。' },
  enemy: { hint: '敵の方へ', summary: '敵の方へ。見えていなければ、最後に見た位置の方へ。' },
  lead: { hint: '敵の動く先', summary: '今撃った弾が届くころに敵がいる場所（今の動きを続けた場合）。そこを狙った弾は、動きを変える敵には外れる。' },
  ahead: { hint: '車体の正面', summary: '車体の正面。' },
  back: { hint: '真後ろ（face 用）', summary: 'face でだけ使う。face を始めたときの向きの真後ろ。face back で車体がくるりと反対を向く（標準の脚で約 1 秒）。turn は 1 tick しか回らないので、turn back とは書けない。' },
  cover: { hint: '隠れ場所の方へ', summary: '敵から隠れられる場所への一番短い道の、次の地点の方へ。障害物の角を回る道も選ぶ（cover_visible を参照）。' },
  ally: { hint: '一番近い味方の方へ', summary: '一番近い生きている味方の方へ（ally_distance を参照）。味方がいなければ何もしない。' },
  base: { hint: '自分の基地の方へ', summary: '自分のチームの基地の中心の方へ。基地のない試合では何もしない。' },
  enemy_base: { hint: '敵の基地の方へ', summary: '敵の基地の中心の方へ。基地のない試合では何もしない。' },
  enemy_visible: { hint: '敵が見えている', summary: '敵がセンサーの範囲内にいて、障害物の陰に隠れていないとき真。見えている敵へは、まっすぐ走って行くことも、まっすぐ撃つこともできる。敵が複数いるとき（バトルロイヤル）は、enemy_ のワードと向き enemy はすべて「見えている敵のうち一番近い 1 台」（誰も見えなければ最後に見た敵）のこと。' },
  blocked: { hint: 'すぐ前に壁か障害物', summary: `すぐ前に壁か障害物があって前進できないとき真。${NOT_THE_ENEMY}` },
  blocked_behind: { hint: 'すぐ後ろに壁か障害物', summary: `すぐ後ろに壁か障害物があって後退できないとき真。${NOT_THE_ENEMY}` },
  bullet_incoming: { hint: '弾が当たりそう', summary: 'このまま今の場所にいると当たる、敵の弾があるとき真。弾の通り道から出れば避けられる。当たる tick に guard すれば、ダメージが半分になる。' },
  cover_visible: { hint: '隠れ場所に行ける', summary: '敵（見えなければ最後に見た位置）から隠れられる場所へ行けるとき真。敵を一度も見ていないうちは偽。' },
  enemy_distance: { hint: '敵までの距離', summary: '敵までの距離。見えなければ最後に見た位置まで。一度も見ていなければ 0。' },
  enemy_angle: { hint: '敵への角度、-180〜180', summary: `車体の向きから敵への角度（${ANGLE}）。` },
  hp: { hint: '自分の HP', summary: 'このロボットの残り HP。' },
  ammo: { hint: '残りの弾', summary: 'このロボットの残りの弾数。' },
  guards: { hint: '残りの guard', summary: `このロボットがあと何 tick 身構えられるか（1 試合に ${ROBOT_DEFAULTS.maxGuards}）。0 のときに guard しても何も起きない。` },
  bullet_distance: { hint: '当たりそうな弾までの距離', summary: `当たりそうな弾のうち、最も近いものまでの距離。なければ 0。標準の銃の弾は 1 tick に約 ${BULLET_STEP} 進む。` },
  bullet_angle: { hint: '当たりそうな弾への角度', summary: `車体の向きから、最も近い当たりそうな弾への角度（${ANGLE}）。なければ 0。` },
  cover_distance: { hint: '隠れ場所までの道のり', summary: '最寄りの隠れ場所までの道のり。すでに隠れているか、隠れ場所がなければ 0。' },
  abs: { hint: 'abs(x): 符号を取った値', summary: '値からマイナスを取ったもの: abs(-30) は 30。abs(aim_angle) > 2 は、狙いが左右どちらかに 2 度より大きくずれていること。' },
  min: { hint: 'min(a, b): 小さい方', summary: '2 つの値の小さい方: min(hp, 100) は 100 より大きくならない。' },
  max: { hint: 'max(a, b): 大きい方', summary: '2 つの値の大きい方: max(enemy_distance - 200, 0) は 0 より小さくならない。' },
  sqrt: { hint: 'sqrt(x): 平方根', summary: '平方根: sqrt(x * x + y * y) は、横に x、縦に y 進んだ線の長さ。マイナスの数の平方根は 0。' },
  random: { hint: 'random(a, b): でたらめな整数', summary: 'a から b までの整数（両端を含む）のどれかを、でたらめに選ぶ: random(1, 6) はサイコロ。数は試合の seed から作るので、同じ試合なら同じ数が出る。' },
  cover_angle: { hint: '隠れ場所への角度', summary: `車体の向きから、隠れ場所へ向かう道の次の地点への角度（${ANGLE}）。なければ 0。` },
  wall_ahead: { hint: '前の空き', summary: `車体の縁から、正面の最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  wall_behind: { hint: '後ろの空き', summary: `車体の縁から、真後ろの最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  wall_left: { hint: '左の空き', summary: `車体の縁から、真左の最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  wall_right: { hint: '右の空き', summary: `車体の縁から、真右の最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  aim_angle: { hint: '砲塔から敵へ、0 で照準が合う', summary: `砲塔の向きから敵（見えなければ最後に見た位置）への角度（${ANGLE}）。0 なら aim enemy で照準が合っている。` },
  lead_angle: { hint: '砲塔から敵の先へ、0 で照準が合う', summary: `砲塔の向きから、弾が届くころに敵がいる場所への角度（${ANGLE}）。0 なら aim lead で照準が合っている。` },
  gun_angle: { hint: '車体上の砲塔の向き', summary: `車体に対する砲塔の角度（${ANGLE}）。` },
  weapon_range: { hint: '銃の射程', summary: `このロボットの銃の射程。標準の銃で ${ROBOT_DEFAULTS.weaponRange}。これより遠い敵を撃っても弾は届かない。` },
  sensor_range: { hint: 'センサーの届く距離', summary: `このロボットのセンサーが届く距離。標準のセンサーで ${ROBOT_DEFAULTS.sensorRange}。装備の違う機体に、1 本のプログラムで別の役割を持たせられる: if sensor_range > 800。` },
  max_speed: { hint: '脚の速さ', summary: `このロボットの脚の速さ（1 秒あたり）。標準の脚で ${ROBOT_DEFAULTS.moveSpeed}。` },
  max_hp: { hint: '始まりの HP', summary: `このロボットが試合を始めたときの HP。標準の車体で ${ROBOT_DEFAULTS.maxHp}。hp < max_hp / 2 は半分より削られたこと。` },
  enemy_speed: { hint: '敵の速さ', summary: `見えている敵が動いている速さ（1 秒あたり。標準の脚で走ると ${ROBOT_DEFAULTS.moveSpeed}）。敵が見えていなければ 0。` },
  enemy_heading: { hint: '敵の進む向き', summary: `車体の向きから、見えている敵が進んでいる向きへの角度（${ANGLE}）。敵が見えていないか止まっていれば 0。enemy_speed と合わせて、狙う先を自分で計算できる。` },
  reload: { hint: '次に撃てるまでの秒数', summary: '銃が次に撃てるようになるまでの秒数。撃てるときは 0。それまでに fire しても弾は出ない。' },
  hit: { hint: '弾が当たった', summary: '敵の弾が当たってから、プログラムが読むまで真。読む行に着くまで何 tick かかっても、そこでは真のまま。次の tick から偽に戻る。どこから来たかは hit_angle。turn hit でその方向へ回る。' },
  hit_angle: { hint: '最後に当たった弾の方向', summary: `最後に当たった弾が来た方向（${ANGLE}）。次に当たるまで残り、車体が回れば一緒に変わる。一度も当たっていなければ 0。` },
  touching_enemy: { hint: '敵と接している', summary: 'ロボットと敵が接していて、どちらもそれ以上近づけないとき真（どちらがぶつかったかは問わない）。敵の方向は enemy_angle。' },
  hidden: { hint: '敵から見えていない', summary: `敵のセンサーに映っていないとき真: 遠すぎる、センサーの角度の外、障害物の陰。隠れたまま ${ROBOT_DEFAULTS.recoveryDelay} 秒止まっていると、以後 1 秒に ${ROBOT_DEFAULTS.recoveryRate} ずつ HP が回復する（走るか見つかるまで）。` },
  self_id: { hint: 'チームの何号機か', summary: 'チームの中での自分の番号: 1、2、3。チーム全員が実行する 1 本のプログラムを、if self_id == 2 のように番号で書き分けられる。チーム戦でなければ 1。' },
  allies_alive: { hint: '生きている味方の数', summary: '自分を数えずに、まだ試合にいる味方の数。自分だけになったときと、チーム戦でない試合では 0。' },
  ally_signal: { hint: 'チームの無線', summary: 'チームのだれかが signal で最後に送った数（tick の始めの値。この tick に送られた数は次の tick から読める）。まだ何も送られていなければ 0。' },
  ally_distance: { hint: '一番近い味方までの距離', summary: '一番近い生きている味方までの距離。味方どうしは無線でつながっているという決まりなので、障害物の陰でも分かる。味方がいなければ 0。' },
  ally_angle: { hint: '一番近い味方の方向', summary: `一番近い生きている味方への角度（${ANGLE}）。turn ally / face ally でそちらを向ける。味方がいなければ 0。` },
  ally_hp: { hint: '一番近い味方の HP', summary: '一番近い生きている味方の HP。ally_hp < 60 を「助けが要る」の合図にできる。味方がいなければ 0。' },
  base_hp: { hint: '自分の基地の HP', summary: '自分のチームの基地に残っている HP。0 になった瞬間にチームの負け。基地のない試合では 0。' },
  base_distance: { hint: '自分の基地までの距離', summary: '自分のチームの基地の中心までの距離。基地のない試合では 0。' },
  base_angle: { hint: '自分の基地の方向', summary: `自分のチームの基地の中心への角度（${ANGLE}）。face base でそちらを向ける。基地のない試合では 0。` },
  enemy_base_hp: { hint: '敵の基地の HP', summary: '敵の基地に残っている HP。0 にすれば勝ち。基地のない試合では 0。' },
  enemy_base_distance: { hint: '敵の基地までの距離', summary: '敵の基地の中心までの距離。基地のない試合では 0。' },
  enemy_base_angle: { hint: '敵の基地の方向', summary: `敵の基地の中心への角度（${ANGLE}）。face enemy_base でそちらを向ける。基地のない試合では 0。` },
};

/** The Japanese for `hit` as the direction of a turn. */
export const DIRECTION_HIT_JA: WordText = { hint: '最後に撃たれた方へ', summary: '最後に当たった弾が来た方向へ（hit_angle を参照）。一度も当たっていなければ何もしない。' };
