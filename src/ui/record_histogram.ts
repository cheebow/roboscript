import { t } from '../i18n/messages';
import { createElement } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The size the bars are drawn at; the page scales it to the room it has. */
const SIZE = { width: 280, height: 56 };
const BINS = 16;
/** Fewer reference records than this say nothing, so no picture is shown. */
export const RECORDS_SHOWN_FROM = 8;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/** Whether reference records are worth a picture: enough of them, and not all alike. */
export function showableRecords(seconds: readonly number[] | undefined): seconds is readonly number[] {
  return seconds !== undefined && seconds.length >= RECORDS_SHOWN_FROM && seconds[seconds.length - 1] > seconds[0];
}

/**
 * The reference records of a challenge as bars over seconds (quick on the
 * left), with a line where this clear landed. `seconds` is sorted, as the
 * bundled records are.
 */
export function renderRecordHistogram(seconds: readonly number[], mine: number): HTMLElement {
  const lowest = Math.min(seconds[0], mine);
  const highest = Math.max(seconds[seconds.length - 1], mine);
  const span = highest - lowest;

  const counts: number[] = new Array(BINS).fill(0);
  for (const record of seconds) counts[Math.min(BINS - 1, Math.floor(((record - lowest) / span) * BINS))] += 1;
  const fullest = Math.max(...counts);

  const picture = svg('svg', { class: 'record-histogram', viewBox: `0 0 ${SIZE.width} ${SIZE.height}`, preserveAspectRatio: 'none' });
  const binWidth = SIZE.width / BINS;
  counts.forEach((count, at) => {
    if (count === 0) return;
    const height = (count / fullest) * (SIZE.height - 4);
    picture.append(svg('rect', { class: 'record-histogram-bar', x: at * binWidth + 1, width: binWidth - 2, y: SIZE.height - height, height }));
  });
  const x = Math.min(SIZE.width - 1, Math.max(1, ((mine - lowest) / span) * SIZE.width));
  picture.append(svg('line', { class: 'record-histogram-me', x1: x, x2: x, y1: 0, y2: SIZE.height, 'vector-effect': 'non-scaling-stroke' }));

  const box = createElement('figure', 'record-histogram-box');
  const scale = createElement('figcaption', 'record-histogram-scale');
  scale.append(
    createElement('span', '', t('challenge.seconds', { seconds: lowest.toFixed(1) })),
    createElement('span', '', t('challenge.records', { count: seconds.length })),
    createElement('span', '', t('challenge.seconds', { seconds: highest.toFixed(1) })),
  );
  box.append(picture, scale);
  return box;
}
