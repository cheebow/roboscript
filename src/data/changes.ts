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
