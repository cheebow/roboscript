import type { MatchAnalysis } from '../arena/analysis';
import { t } from '../i18n/messages';
import type { Arena } from '../sim/types';
import { paletteOf } from '../view/sprites';
import { createElement } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The size the HP chart is drawn at; the page scales it to the room it has. */
const CHART = { width: 600, height: 140 };

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/**
 * How a match went, in numbers and pictures: each robot's shots, hits and
 * damage, its HP over the match (press the chart to go to that moment), and
 * where the hits happened on the field.
 */
export class AnalysisView {
  readonly element = createElement('div', 'analysis');
  private marker: SVGLineElement | null = null;
  private ticks = 0;

  constructor(private readonly onSeek: (tick: number) => void) {}

  show(analysis: MatchAnalysis | null, arena: Arena | null): void {
    this.marker = null;
    if (analysis === null || arena === null) {
      this.element.replaceChildren(createElement('p', 'analysis-empty', t('analysis.empty')));
      return;
    }
    this.ticks = analysis.ticks;
    const pictures = createElement('div', 'analysis-pictures');
    pictures.append(this.chart(analysis), this.hitMap(analysis, arena));
    this.element.replaceChildren(this.table(analysis), pictures);
  }

  /** Moves the line on the chart to the moment shown. */
  update(tick: number): void {
    if (this.marker === null || this.ticks === 0) return;
    const x = (Math.min(tick, this.ticks) / this.ticks) * CHART.width;
    this.marker.setAttribute('x1', `${x}`);
    this.marker.setAttribute('x2', `${x}`);
  }

  private table(analysis: MatchAnalysis): HTMLElement {
    const castles = analysis.bases !== undefined;
    const table = createElement('table', 'analysis-table');
    const head = createElement('tr', '');
    const keys = ['robot', 'accuracy', 'dealt', ...(castles ? (['castleDamage'] as const) : []), 'taken', 'guarded', 'recovered', 'distance', 'sighted'] as const;
    for (const key of keys) head.append(createElement('th', '', t(`analysis.${key}`)));
    table.append(head);
    analysis.robots.forEach((robot, index) => {
      const row = createElement('tr', '');
      const name = createElement('td', 'analysis-name', robot.name);
      name.style.color = paletteOf(index, analysis.teams).body;
      const accuracy = robot.shots === 0 ? '-' : `${Math.round((robot.hits / robot.shots) * 100)}%  (${robot.hits}/${robot.shots})`;
      const seconds = Math.round(robot.distance);
      row.append(
        name,
        createElement('td', '', accuracy),
        createElement('td', '', `${robot.damageDealt}`),
        ...(castles ? [createElement('td', '', `${robot.castleDamage}`)] : []),
        createElement('td', '', `${robot.damageTaken}`),
        createElement('td', '', `${robot.guarded}`),
        createElement('td', '', `${robot.recovered}`),
        createElement('td', '', `${seconds}`),
        createElement('td', '', `${Math.round(robot.sighted * 100)}%`),
      );
      table.append(row);
    });
    return table;
  }

  /** Each robot's HP over the match; pressing it goes to that moment. */
  private chart(analysis: MatchAnalysis): HTMLElement {
    const box = createElement('figure', 'analysis-chart');
    box.append(createElement('figcaption', '', t('analysis.hpChart')));
    const maxHp = Math.max(1, ...analysis.robots.flatMap((robot) => robot.hp));
    const picture = svg('svg', { viewBox: `0 0 ${CHART.width} ${CHART.height}`, preserveAspectRatio: 'none' });
    picture.append(svg('rect', { x: 0, y: 0, width: CHART.width, height: CHART.height, class: 'analysis-chart-back' }));
    const pointsOf = (hp: readonly number[], max: number) =>
      hp
        .map((value, at) => {
          const tick = Math.min(at * analysis.sampleEvery, analysis.ticks);
          return `${(tick / Math.max(1, analysis.ticks)) * CHART.width},${CHART.height - (value / max) * (CHART.height - 6) - 3}`;
        })
        .join(' ');
    // Each castle as a dashed line in its team's colour, on its own scale: full height is a whole castle.
    analysis.bases?.forEach((base) => {
      const teamIndex = analysis.teams?.indexOf(base.team) ?? -1;
      if (teamIndex < 0) return;
      picture.append(
        svg('polyline', {
          points: pointsOf(base.hp, Math.max(1, base.maxHp)),
          fill: 'none',
          stroke: paletteOf(teamIndex, analysis.teams).body,
          'stroke-width': 2,
          'stroke-dasharray': '6 4',
          opacity: 0.7,
          'vector-effect': 'non-scaling-stroke',
        }),
      );
    });
    analysis.robots.forEach((robot, index) => {
      const points = pointsOf(robot.hp, maxHp);
      picture.append(svg('polyline', { points, fill: 'none', stroke: paletteOf(index, analysis.teams).body, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
    });
    this.marker = svg('line', { x1: 0, y1: 0, x2: 0, y2: CHART.height, class: 'analysis-chart-now', 'vector-effect': 'non-scaling-stroke' });
    picture.append(this.marker);
    picture.addEventListener('click', (event) => {
      const box = picture.getBoundingClientRect();
      if (box.width === 0) return;
      this.onSeek(Math.round(((event.clientX - box.left) / box.width) * analysis.ticks));
    });
    picture.setAttribute('role', 'img');
    picture.setAttribute('aria-label', t('analysis.hpChart'));
    box.append(picture, createElement('div', 'analysis-hint', t('analysis.seekHint')));
    return box;
  }

  /** Where each hit landed (a dot in the colour of the robot hit) and where it came from (a faint line from the shooter). */
  private hitMap(analysis: MatchAnalysis, arena: Arena): HTMLElement {
    const box = createElement('figure', 'analysis-map');
    box.append(createElement('figcaption', '', t('analysis.hitMap')));
    const picture = svg('svg', { viewBox: `0 0 ${arena.width} ${arena.height}` });
    picture.append(svg('rect', { x: 0, y: 0, width: arena.width, height: arena.height, class: 'analysis-map-back' }));
    for (const obstacle of arena.obstacles) {
      picture.append(svg('rect', { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height, class: 'analysis-map-obstacle' }));
    }
    for (const hit of analysis.hits) {
      picture.append(svg('line', { x1: hit.from.x, y1: hit.from.y, x2: hit.at.x, y2: hit.at.y, stroke: paletteOf(hit.shooter, analysis.teams).body, class: 'analysis-map-shot' }));
    }
    for (const hit of analysis.hits) {
      const dot = svg('circle', { cx: hit.at.x, cy: hit.at.y, r: 9, fill: paletteOf(hit.target, analysis.teams).body, class: 'analysis-map-hit' });
      dot.addEventListener('click', () => this.onSeek(hit.tick));
      picture.append(dot);
    }
    box.append(picture);
    return box;
  }
}
