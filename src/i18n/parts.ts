import type { Part } from '../data/parts';
import { currentLanguage } from './language';

/** What each part is for, in Japanese; the English is on the part itself. */
export const PART_SUMMARIES_JA: Record<string, string> = {
  'body:light': '速く走り、速く曲がる。打たれ弱い。',
  'body:standard': 'バランス型。',
  'body:heavy': '打たれ強い。走るのも曲がるのも遅い。',
  'legs:sprint': '直進が速い。旋回が遅い。',
  'legs:standard': 'バランス型。',
  'legs:pivot': '旋回が速い。直進が遅い。',
  'gun:pistol': '安い。射程が短く、弾がばらけ、弾数も少ない。',
  'gun:rapid': '連射が効き、弾も多い。1 発が弱く、ばらける。',
  'gun:standard': 'バランス型。',
  'gun:cannon': '一撃が重く、遠くまで届く。装填と砲塔が遅く、弾も遅くて少ない。',
  'sensor:short': '安い。全方向が見えるが、遠くは見えない。',
  'sensor:standard': '遠くまで、全方向が見える。',
  'sensor:scope': '安い。遠くまで見えるが、前だけ。',
};

/** The part's summary in the current language. */
export function partSummary(part: Part): string {
  return (currentLanguage() === 'ja' ? PART_SUMMARIES_JA[`${part.slot}:${part.id}`] : undefined) ?? part.summary;
}
