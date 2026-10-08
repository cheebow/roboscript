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
    date: '2026-10-08',
    en: 'The castle is now the base, as the words base_hp and face base always said: the mode is TEAM BATTLE, its rule the base battle, and the team templates are BaseRush, BaseSplit and friends. Saved teams, links and files all keep working.',
    ja: '「城」は「基地」になりました。base_hp や face base が最初からそう言っていた通りです。モード名はチームバトル、ルール名は基地戦、チームのテンプレートは BaseRush・BaseSplit などに。保存したチームやリンク、ファイルはそのまま使えます。',
  },
  {
    date: '2026-10-08',
    en: 'Words tidied up: the help calls the language’s words "words" throughout, the log’s kind column, GOAL and GUARD read in Japanese on the Japanese screen, the common-mistakes table quotes the real messages, and the top bar got a SOLO heading beside TEAM BATTLE, whose first tab is now PROGRAM.',
    ja: '言葉まわりを見直しました。ヘルプの「語」は「ワード」に統一、日本語の画面ではログの種別や GOAL・ガードも日本語に、「よくあるエラー」の表は実際のメッセージを引用するように。上部バーには「個人戦」の見出しが付き、チームバトル側のタブは「プログラム」になりました。',
  },
  {
    date: '2026-10-08',
    en: 'Tutorial chapter 10 no longer jams: its teams now fit the shared cost pool, a cost problem says so instead of pointing at the code, and The unbroken base was rebuilt to be winnable — meet the rushers away from your base.',
    ja: 'チュートリアル 10 章が途中で詰まらなくなりました。チームの装備がコストの枠に収まるようになり、コスト超過のときはコードではなくコストの案内が出ます。チャレンジ「鉄壁の基地」もクリアできる形に作り直しました。基地から離れて迎え撃つのがコツです。',
  },
  {
    date: '2026-10-08',
    en: "A new team template: CastleDecoy walks its leader into the enemy's fire, and the moment it is hit, the rest run for the castle.",
    ja: 'チームのテンプレートに CastleDecoy が加わりました。1 番機が先頭を歩いて敵の弾を引き受け、被弾した瞬間、残りの機体が城へ走り出します。',
  },
  {
    date: '2026-10-08',
    en: "The commentary earned its press badge: it reads each side's plan from the opening moves, calls a wiped-out team, a castle on the brink and the last robot standing, sums the match up in a lull, and says why a judgement went the way it did.",
    ja: '実況が賢くなりました。開始直後の動きから布陣を読み、全滅・残り 1 台・落城寸前を呼び、膠着したら戦況をまとめ、判定決着では理由（城の差か、残り HP か）まで伝えます。',
  },
  {
    date: '2026-10-08',
    en: "The castle is the goal: a team now stays in the match while its castle stands, even with every robot gone, and a castle has one robot's worth of HP (200) at every team size — storming it is usually faster than grinding the team down.",
    ja: '城攻めのルールが「城がすべて」になりました。全滅しても城が立っているかぎり試合は続き、城の HP は台数によらずロボット 1 台ぶん（200）。敵を倒すより、城を攻める方が早い——そういう調整です。',
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
