import { MATCH_DEFAULTS } from '../data/match_defaults';
import { ROBOT_DEFAULTS } from '../data/robot_defaults';

/** The Japanese for the words of RoboScript: a hint of a few words and a sentence or two. The English is in src/ai/reference.ts. */
export interface WordText {
  hint: string;
  summary: string;
}

const NO_TIME = '時間はかからない。';
const NOT_THE_ENEMY = '敵は数えない。';
const ANGLE = '度。0 が正面、右が正';
const BULLET_STEP = Math.round(ROBOT_DEFAULTS.shotSpeed / MATCH_DEFAULTS.tickRate);
const GUARDED_SHARE = `${Math.round(ROBOT_DEFAULTS.guardDamageFactor * 100)}%`;

export const WORDS_JA: Record<string, WordText> = {
  if: { hint: '条件が成り立つときに実行', summary: `条件が成り立つとき、下の字下げした行を実行する。${NO_TIME}` },
  else: { hint: 'そうでなければ', summary: '上の if の条件が成り立たないとき、下の字下げした行を実行する。1 行で else if 条件 と書くと、別の条件を調べられる（何回でも続けられる）。' },
  loop: { hint: 'ずっと繰り返す', summary: '下の字下げした行をずっと繰り返す。loop がないとプログラムは 1 回で終わり、そのあとは何もしない: 車体は最後に決めた drive のまま走り続ける（drive stop で止まる）。' },
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
  drive: { hint: '車体の走り方を決める', summary: `車体の走り方をこれ以降 forward、backward、stop のどれかにする。旋回・照準・発射をしている間も走り続ける。${NO_TIME}` },
  turn: { hint: '車体を回す、1 tick', summary: '車体を 1 tick ぶん回す: left、right、enemy（敵の方へ）、cover（隠れ場所の方へ）、hit（撃たれた方へ）。砲塔も一緒に回る。' },
  face: { hint: '向くまで車体を回す', summary: '敵、隠れ場所、最後に撃たれた方向を向くまで、車体を 1 tick ずつ回す。face hit は turn hit を繰り返すのと同じ。向いていれば、または向く先がなければ、時間はかからない。' },
  aim: { hint: '砲塔を回す、1 tick', summary: '砲塔を 1 tick ぶん回す: left、right、enemy（敵の方へ）、lead（敵の動く先へ）、ahead（車体の正面へ）。' },
  fire: { hint: '撃つ、1 tick', summary: '砲塔の向きに撃つ。1 tick かかる。次の弾が撃てるまでの間と弾切れのときは何も出ない。車体が走っている tick に撃つと弾が 5 倍ばらける。' },
  guard: { hint: '被弾に備える、1 tick', summary: `1 tick のあいだ身構える: その tick に当たった弾のダメージは ${GUARDED_SHARE} になる。1 試合に ${ROBOT_DEFAULTS.maxGuards} tick ぶんしか使えず、使うたびに次の弾が撃てるのが ${ROBOT_DEFAULTS.guardRecovery} 秒遅れる。弾が当たる tick に使う。` },
  wait: { hint: '何もしない、1 tick', summary: '1 tick のあいだ何もしない。' },
  forward: { hint: '車体の向く方へ', summary: '車体が向いている方へ。' },
  backward: { hint: '車体の向きと逆へ', summary: '車体が向いている方と逆へ。' },
  stop: { hint: '止まる', summary: '走るのをやめる。' },
  left: { hint: '反時計回り', summary: '画面で見て反時計回り。' },
  right: { hint: '時計回り', summary: '画面で見て時計回り。' },
  enemy: { hint: '敵の方へ', summary: '敵の方へ。見えていなければ、最後に見た位置の方へ。' },
  lead: { hint: '敵の動く先', summary: '今撃った弾が届くころに敵がいる場所（今の動きを続けた場合）。そこを狙った弾は、動きを変える敵には外れる。' },
  ahead: { hint: '車体の正面', summary: '車体の正面。' },
  cover: { hint: '隠れ場所の方へ', summary: '敵から隠れられる場所への一番短い道の、次の地点の方へ。障害物の角を回る道も選ぶ（cover_visible を参照）。' },
  enemy_visible: { hint: '敵が見えている', summary: '敵がセンサーの範囲内にいて、障害物の陰に隠れていないとき真。見えている敵には、まっすぐ走って行けるし、まっすぐ撃てる。敵が複数いるとき（バトルロイヤル）は、enemy_ の語と向き enemy はすべて「見えている敵のうち一番近い 1 台」（誰も見えなければ最後に見た敵）のこと。' },
  blocked: { hint: 'すぐ前に壁か障害物', summary: `すぐ前に壁か障害物があって前進できないとき真。${NOT_THE_ENEMY}` },
  blocked_behind: { hint: 'すぐ後ろに壁か障害物', summary: `すぐ後ろに壁か障害物があって後退できないとき真。${NOT_THE_ENEMY}` },
  bullet_incoming: { hint: '弾が当たりそう', summary: '今いる場所にいると当たるコースの敵の弾があるとき真。コースから出れば避けられる。当たる tick に guard すればダメージが半分になる。' },
  cover_visible: { hint: '隠れ場所に行ける', summary: '敵（見えなければ最後に見た位置）から隠れられる場所へ行けるとき真。敵を一度も見ていないうちは偽。' },
  enemy_distance: { hint: '敵までの距離', summary: '敵までの距離。見えなければ最後に見た位置まで。一度も見ていなければ 0。' },
  enemy_angle: { hint: '敵への角度、-180〜180', summary: `車体の向きから敵への角度（${ANGLE}）。` },
  hp: { hint: '自分の HP', summary: 'このロボットの残り HP。' },
  ammo: { hint: '残りの弾', summary: 'このロボットの残りの弾数。' },
  guards: { hint: '残りの guard', summary: `このロボットがあと何 tick 身構えられるか（1 試合に ${ROBOT_DEFAULTS.maxGuards}）。0 のときの guard は何も起きない。` },
  bullet_distance: { hint: '当たりそうな弾までの距離', summary: `当たるコースの弾のうち最も近いものまでの距離。なければ 0。標準の銃の弾は 1 tick に約 ${BULLET_STEP} 進む。` },
  bullet_angle: { hint: '当たりそうな弾への角度', summary: `車体の向きから、最も近い当たりそうな弾への角度（${ANGLE}）。なければ 0。` },
  cover_distance: { hint: '隠れ場所までの道のり', summary: '最寄りの隠れ場所までの道のり。すでに隠れているか、隠れ場所がなければ 0。' },
  cover_angle: { hint: '隠れ場所への角度', summary: `車体の向きから、隠れ場所へ向かう道の次の地点への角度（${ANGLE}）。なければ 0。` },
  wall_ahead: { hint: '前の空き', summary: `車体の縁から、正面の最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  wall_behind: { hint: '後ろの空き', summary: `車体の縁から、真後ろの最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  wall_left: { hint: '左の空き', summary: `車体の縁から、真左の最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  wall_right: { hint: '右の空き', summary: `車体の縁から、真右の最も近い壁か障害物までの距離。${NOT_THE_ENEMY}` },
  aim_angle: { hint: '砲塔から敵へ、0 で照準が合う', summary: `砲塔の向きから敵（見えなければ最後に見た位置）への角度（${ANGLE}）。0 なら aim enemy で照準が合っている。` },
  lead_angle: { hint: '砲塔から敵の先へ、0 で照準が合う', summary: `砲塔の向きから、弾が届くころに敵がいる場所への角度（${ANGLE}）。0 なら aim lead で照準が合っている。` },
  gun_angle: { hint: '車体上の砲塔の向き', summary: `車体に対する砲塔の角度（${ANGLE}）。` },
  weapon_range: { hint: '銃の射程', summary: `このロボットの銃の射程。標準の銃で ${ROBOT_DEFAULTS.weaponRange}。これより遠い敵を撃っても弾は届かない。` },
  hit: { hint: '弾が当たった', summary: '敵の弾が当たってから、プログラムが読むまで真。読む行に着くまで何 tick かかっても、そこでは真のまま。次の tick から偽に戻る。どこから来たかは hit_angle。turn hit でその方向へ回る。' },
  hit_angle: { hint: '最後に当たった弾の方向', summary: `最後に当たった弾が来た方向（${ANGLE}）。次に当たるまで残り、車体が回れば一緒に変わる。一度も当たっていなければ 0。` },
  touching_enemy: { hint: '敵と接している', summary: 'ロボットと敵が接していて、どちらもそれ以上近づけないとき真（どちらがぶつかったかは問わない）。敵の方向は enemy_angle。' },
  hidden: { hint: '敵から見えていない', summary: `敵のセンサーに映っていないとき真: 遠すぎる、センサーの角度の外、障害物の陰。隠れたまま ${ROBOT_DEFAULTS.recoveryDelay} 秒止まっていると、以後 1 秒に ${ROBOT_DEFAULTS.recoveryRate} ずつ HP が回復する（走るか見つかるまで）。` },
};

/** The Japanese for `hit` as the direction of a turn. */
export const DIRECTION_HIT_JA: WordText = { hint: '最後に撃たれた方へ', summary: '最後に当たった弾が来た方向へ（hit_angle を参照）。一度も当たっていなければ何もしない。' };
