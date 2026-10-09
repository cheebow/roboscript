// What changed, told to the player: the start-up screen shows the entries
// newer than their last visit, and the help lists them all ("更新履歴").
// Add a line here, newest first, for every change a player would notice.

export interface Change {
  /** The day the change went out, as YYYY-MM-DD. */
  date: string;
  en: string;
  ja: string;
}

export const CHANGES: readonly Change[] = [
  {
    date: '2026-10-09',
    en: 'The start menu is in groups now — LEARN, SOLO, TEAM BATTLE, HELP & SETTINGS — and the team battle has two lines of its own: PROGRAM to write your team, WATCH to go straight to watching teams fight.',
    ja: '起動メニューを「まなぶ」「個人戦」「チーム戦」「ヘルプと設定」の見出しで分けました。チーム戦には「プログラム」と「観戦」の 2 つがあり、観戦の画面へも直接入れます。',
  },
  {
    date: '2026-10-09',
    en: 'New word for the team battle: enemies_alive, how many enemies are left. Every enemy falls to your team\'s bullets and the shooter tells the rest by radio, so it is right even for enemies nobody sees. When it reads 0, only the base is left to take — the team template BaseRally now goes back out instead of waiting out the clock at home.',
    ja: 'チームバトルに新しいワード enemies_alive（敵の生存数）が入りました。敵を倒すのは必ず自分のチームの弾なので、撃った機体が無線で知らせ、見えていない敵の分まで正しく数えられます。0 になったら、あとは基地を落とすだけ。チームのテンプレート BaseRally も、敵が全滅したら守りから攻めに戻るようになりました（基地にこもったまま時間切れにならない）。',
  },
  {
    date: '2026-10-08',
    en: "The castle is now the base, as base_hp and face base always said, and the rule is the base battle: a team stays in the match while its base stands, even with every robot gone, and a base has one robot's worth of HP (200) at every size. The commentary reads each side's plan, calls a base on the brink, and says why a judgement went the way it did. New team template: BaseDecoy. Saved teams, links and files keep working.",
    ja: '「城」は「基地」に、城攻めは「基地戦」になりました（base_hp や face base と同じ言葉です）。全滅しても基地が立っているかぎり試合は続き、基地の HP は台数によらずロボット 1 台ぶん（200）。実況は布陣を読み、落ちかけた基地を呼び、判定の理由まで伝えます。チームのテンプレートに BaseDecoy が加わりました。保存したチームやリンク、ファイルはそのまま使えます。',
  },
  {
    date: '2026-10-08',
    en: 'The radio learned addresses: signal 3 to 2 sends a number to machine 2 alone, and ally_signal_from says who sent what arrived. The team template BaseCaptain calls one helper home by name, and the challenge Call by name shows why that beats calling everyone. On the field a little envelope flies from the sender to each robot it is for; a base being worn down throws hot sparks, and a recovering robot gives off rising plus signs.',
    ja: '無線に宛先が付きました。signal 3 to 2 で 2 号機だけに数が届き、ally_signal_from で「だれが送ったか」が読めます。チームのテンプレート BaseCaptain は助けを 1 台だけ名指しで呼び戻し、チャレンジ「名指しで呼べ」では全員を呼ぶより強い理由が分かります。戦闘画面では小さな封筒が送信機から相手まで飛び、削られる基地からは火花が散り、回復中のロボットからは + マークが立ちのぼります。',
  },
  {
    date: '2026-10-08',
    en: 'Smoother and clearer: the arena can field ALPHA and BRAVO as you are editing them, without saving; a series and a contest count up instead of freezing the page; loading from the garage asks for a second press; an error stays until you click it away; the watch folds its long lists; each team in the watching shows every machine; and play/pause sits by the seek bar alone. Esc closes the start menu, switching the language keeps your screen, the help calls the language\u2019s words "words", and the top bar names its modes, SOLO and TEAM BATTLE.',
    ja: '使いやすく、分かりやすくしました。アリーナに編集中の ALPHA・BRAVO を保存せずに出せ、連戦や大会は画面を固めずに進み具合を数え、ガレージからの読み込みは 2 度押しで確定、エラーのお知らせはクリックするまで残り、ウォッチの長い一覧はたためて、観戦のチーム欄には全機体が並び、再生/一時停止はシークバー横の 1 つになりました。起動メニューは Esc で閉じられ、言語を切り替えても元の画面に戻り、ヘルプの「語」は「ワード」に統一、上部バーには「個人戦」「チームバトル」の見出しが付きました。',
  },
  {
    date: '2026-10-08',
    en: 'Tutorial chapter 10 no longer jams: its teams fit the shared cost pool, and a cost problem says so instead of pointing at the code. The challenge The unbroken base was rebuilt to be winnable, with light bodies and pistols fixed so that the team fits its cost — meet the rushers away from your base.',
    ja: 'チュートリアル 10 章が途中で詰まらなくなりました。チームの装備がコストの枠に収まり、コスト超過のときはコストの案内が出ます。チャレンジ「鉄壁の基地」もクリアできる形に作り直し、コストに収まるよう車体 Light と銃 Pistol を固定にしました。基地から離れて迎え撃つのがコツです。',
  },
  {
    date: '2026-10-07',
    en: 'Robots move like they mean it: tracks roll, wheels turn, walker legs step and hover skirts shimmer while a robot drives.',
    ja: 'ロボットの絵が走るようになりました。走行中はキャタピラが回り、車輪が回転し、Walker の脚は踏み替え、Hover のスカートは揺らぎます。',
  },
  {
    date: '2026-10-07',
    en: 'The team battle now goes up to 5 a side, futsal-style — enough for a keeper, defenders and attackers. The new CastleFormation template shows such a line-up, and each side of the palette gained two shades.',
    ja: 'チームバトルが片側 5 台まで選べるようになりました。キーパー・ディフェンダー・アタッカーの布陣が組める規模です。その見本のテンプレート CastleFormation が入り、チームの配色も各系統 5 階調になりました。',
  },
  {
    date: '2026-10-07',
    en: 'Learning the castle match: tutorial chapter 10 teaches it step by step (one program, self_id, the signal radio), three castle challenges joined the list, and three new team templates — CastleTurtle walls in, CastleRally falls back when a teammate is lost, and CastleRunner goes for nothing but the castle.',
    ja: '城攻めが学べるようになりました。チュートリアル第 10 章が 1 本のプログラム・self_id・signal の無線を順に教え、城のチャレンジが 3 問増え、チームのテンプレートに CastleTurtle（籠城）、CastleRally（味方が落ちたら戻る）、CastleRunner（ロボットを無視して城だけを狙う）が加わりました。',
  },
  {
    date: '2026-10-07',
    en: 'The team battle can be watched: pick two saved teams, hear the commentary call the castles, and share the match with a #castle= link. The analysis knows teams and castles too.',
    ja: 'チームバトルに「観戦」が付きました。保存した 2 チームを選んで戦わせ、城を呼ぶ実況付きで見られます。試合は #castle= リンクで人に渡せ、分析もチームと城が分かるようになりました。',
  },
  {
    date: '2026-10-07',
    en: 'Teams can be kept and shared: the team battle has a garage of teams, and a team travels as a share code, a link (#team=) or a .roboscript.json file, like a robot does.',
    ja: 'チームを保存して渡せるようになりました。チームバトルにチームのガレージが付き、ロボットと同じように、共有コード・リンク（#team=）・ファイル（.roboscript.json）で人に渡せます。',
  },
  {
    date: '2026-10-07',
    en: 'TEAM BATTLE, new in the start menu: one program drives a whole team of 1 to 3 robots, defending its own castle and bringing the enemy one down. New words came with it: signal and ally_signal (the team radio), self_id, allies_alive, ally_distance, base_hp, enemy_base_distance and more — and sensor_range, max_speed and max_hp, which tell differently equipped machines apart in any match.',
    ja: '起動メニューに「チームバトル」が入りました。1 本のプログラムで 1〜3 台のチームを動かし、自分の城を守りながら敵の城を落とします。新しい語も入りました: signal と ally_signal（チームの無線）、self_id、allies_alive、ally_distance、base_hp、enemy_base_distance など。sensor_range / max_speed / max_hp は、どの試合でも装備の違う機体を書き分けるのに使えます。',
  },
  {
    date: '2026-10-07',
    en: 'Two pages outside the game: an introduction (about.html) and the whole help on one page (help.html), to read before you play or to link to.',
    ja: 'ゲームの外に 2 ページできました。紹介ページ（about.html）と、ヘルプを 1 ページで読めるページ（help.html）です。遊ぶ前に読んだり、リンクで人に渡せたりします。',
  },
  {
    date: '2026-10-07',
    en: 'Recipes for the new legs joined the help: "March in, firing all the way" (Walker) and "Never stop" (Hover).',
    ja: '新しい脚で遊ぶレシピがレシピ集に入りました: 「撃ちながら歩いて詰める」（Walker）と「止まらずに走り撃ちする」（Hover）。',
  },
  {
    date: '2026-10-07',
    en: 'New legs: the Walker is slow but shoots well on the move; the Hover is fast but slides, and cannot stop at once.',
    ja: '新しい脚: Walker は遅いかわりに走りながらでも当てられ、Hover は速いかわりにすぐ止まれず滑ります。',
  },
  {
    date: '2026-10-07',
    en: 'abs, min, max, sqrt and random can now be used in values and conditions: if abs(aim_angle) > 2, turn left random(30, 150).',
    ja: '式で abs・min・max・sqrt・random が使えるようになりました: if abs(aim_angle) > 2、turn left random(30, 150) など。',
  },
  {
    date: '2026-10-05',
    en: 'The help\'s examples grew into "Recipes": 16 short programs, one for each thing you may want a robot to do.',
    ja: 'ヘルプの「例」が「レシピ集」になりました。やりたいことごとの短いプログラムが 16 個あります。',
  },
  {
    date: '2026-10-05',
    en: 'turn left 90: write an angle after turn or aim left / right, and the robot turns just that far.',
    ja: 'turn left 90 のように、turn や aim の left / right の後ろに角度を書くと、その角度だけ回れるようになりました。',
  },
];

/** The changes newer than the day last seen, newest first; every one of them when nothing was seen yet (null). */
export function changesSince(seen: string | null): Change[] {
  return CHANGES.filter((change) => seen === null || change.date > seen);
}

/** The day of the newest change; null only while the list is empty. */
export function latestChangeDate(): string | null {
  return CHANGES[0]?.date ?? null;
}
