import type { Part } from '../data/parts';
import { currentLanguage } from './language';

/** What each part is for, in Japanese; the English is on the part itself. */
export const PART_SUMMARIES_JA: Record<string, string> = {
  'body:light': '速く走り、すばやく曲がる。HP が少ない。',
  'body:standard': 'バランス型。',
  'body:heavy': 'HP が多く、打たれ強い。走るのも曲がるのも遅い。',
  'legs:sprint': '直進が速い。そのかわり旋回が遅い。',
  'legs:standard': 'バランス型。',
  'legs:pivot': '旋回が速い。そのかわり直進が遅い。',
  'gun:pistol': '射程が短く、弾がばらけやすく、弾数も少ない。そのぶんコストが低い。',
  'gun:rapid': '撃つ間隔が短く、弾数も多い。1 発の威力は弱く、弾がばらけやすい。',
  'gun:standard': 'バランス型。',
  'gun:cannon': '1 発の威力が大きく、射程も長い。装填と砲塔の旋回が遅く、弾速も遅い。弾数も少ない。',
  'sensor:short': '全方向が見えるが、遠くは見えない。そのぶんコストが低い。',
  'sensor:standard': '全方向の遠くまで見える。',
  'sensor:scope': '遠くまで見えるが、前方だけ。そのぶんコストが低い。',
};

/** The part's summary in the current language. */
export function partSummary(part: Part): string {
  return (currentLanguage() === 'ja' ? PART_SUMMARIES_JA[`${part.slot}:${part.id}`] : undefined) ?? part.summary;
}
