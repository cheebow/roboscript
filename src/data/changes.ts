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
