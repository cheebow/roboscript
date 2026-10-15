import { ROBOT_DEFAULTS } from '../data/robot_defaults';
import { inLanguage } from '../pages/page';
import type { Text } from '../tutorial/types';
import type { FigureId } from './types';

// The book's diagrams, drawn as SVG. Their colours come from the page's
// palette through classes (pages.css), so they read as the rest of the page.

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function canvas(width: number, height: number): SVGSVGElement {
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'book-figure-svg' });
  root.style.maxWidth = `${width}px`;
  return root;
}

/** A box with a word or two in it, and a smaller line under them. */
function box(x: number, y: number, width: number, height: number, title: Text, note: Text, accent = false): SVGGElement {
  const group = svg('g', {});
  group.append(
    svg('rect', { x, y, width, height, class: accent ? 'book-fig-box accent' : 'book-fig-box' }),
    svg('text', { x: x + width / 2, y: y + height / 2 - 4, class: 'book-fig-title', 'text-anchor': 'middle' }, inLanguage(title)),
    svg('text', { x: x + width / 2, y: y + height / 2 + 13, class: 'book-fig-note', 'text-anchor': 'middle' }, inLanguage(note)),
  );
  return group;
}

function arrow(x1: number, y1: number, x2: number, y2: number): SVGPathElement {
  return svg('path', { d: `M${x1},${y1} L${x2},${y2} M${x2 - 6},${y2 - 4} L${x2},${y2} L${x2 - 6},${y2 + 4}`, class: 'book-fig-line' });
}

/** What every robot goes through in one tick, in order, and round again. */
function tickSteps(): SVGSVGElement {
  const steps: [Text, Text][] = [
    [{ en: 'Look', ja: '見る' }, { en: 'sensors', ja: 'センサー' }],
    [{ en: 'Think', ja: '考える' }, { en: 'the program', ja: 'プログラム' }],
    [{ en: 'Move', ja: '動く' }, { en: 'turn, drive', ja: '回る・走る' }],
    [{ en: 'Shoot', ja: '撃つ' }, { en: 'aim, fire', ja: '砲塔・発射' }],
    [{ en: 'Bullets fly', ja: '弾が飛ぶ' }, { en: 'hits', ja: '当たり判定' }],
  ];
  const width = 640;
  const boxWidth = 104;
  const gap = (width - 20 - boxWidth * steps.length) / (steps.length - 1);
  const root = canvas(width, 150);
  steps.forEach(([title, note], index) => {
    const x = 10 + index * (boxWidth + gap);
    root.append(box(x, 20, boxWidth, 56, title, note, index === 1));
    if (index > 0) root.append(arrow(x - gap + 3, 48, x - 3, 48));
  });
  // Round again: under the boxes, from the last back to the first.
  const last = 10 + (steps.length - 1) * (boxWidth + gap) + boxWidth / 2;
  const first = 10 + boxWidth / 2;
  root.append(
    svg('path', { d: `M${last},78 L${last},112 L${first},112 L${first},84 M${first - 4},90 L${first},84 L${first + 4},90`, class: 'book-fig-line' }),
    svg('text', { x: width / 2, y: 132, class: 'book-fig-note', 'text-anchor': 'middle' }, inLanguage({ en: 'then the next tick: 30 times a second', ja: 'そして次の tick へ（1 秒に 30 回）' })),
  );
  return root;
}

/** An ordinary program runs to its end at once; a robot's runs a little each tick. */
function programVsTick(): SVGSVGElement {
  const root = canvas(640, 190);
  const left = 150;
  const tickWidth = 112;
  // The same five lines, run two ways.
  const runs: { label: Text; groups: number[][] }[] = [
    { label: { en: 'Ordinary program', ja: 'ふつうのプログラム' }, groups: [[1, 2, 3, 4, 5]] },
    { label: { en: 'RoboScript', ja: 'RoboScript' }, groups: [[1], [2, 3], [4], [5]] },
  ];
  runs.forEach(({ label, groups }, row) => {
    const y = 40 + row * 70;
    root.append(svg('text', { x: 10, y: y + 5, class: 'book-fig-title' }, inLanguage(label)));
    groups.forEach((lines, at) => {
      const x = left + at * tickWidth;
      root.append(svg('rect', { x, y: y - 14, width: tickWidth - 8, height: 28, class: row === 0 ? 'book-fig-box' : 'book-fig-box accent' }));
      root.append(svg('text', { x: x + (tickWidth - 8) / 2, y: y + 5, class: 'book-fig-code', 'text-anchor': 'middle' }, lines.map((line) => `${line}`).join(' ')));
    });
  });
  // The clock under them: the ordinary program takes no time worth telling.
  const axis = 175;
  root.append(arrow(left, axis - 20, left + tickWidth * 4 + 20, axis - 20));
  for (let tick = 0; tick < 4; tick++) {
    root.append(svg('text', { x: left + tick * tickWidth + (tickWidth - 8) / 2, y: axis, class: 'book-fig-note', 'text-anchor': 'middle' }, `tick ${tick + 1}`));
  }
  root.append(svg('text', { x: 10, y: axis, class: 'book-fig-note' }, inLanguage({ en: 'match time →', ja: '試合の時間 →' })));
  return root;
}

/** How enemy_angle is measured: from where the body faces, plus to the right, minus to the left. */
function angles(): SVGSVGElement {
  const root = canvas(420, 340);
  const [cx, cy, r] = [210, 165, 105];
  root.append(svg('circle', { cx, cy, r, class: 'book-fig-line' }));
  // The body, facing up, with its front marked.
  root.append(
    svg('rect', { x: cx - 13, y: cy - 13, width: 26, height: 26, class: 'book-fig-box accent' }),
    svg('path', { d: `M${cx},${cy - 13} L${cx},${cy - r}`, class: 'book-fig-line' }),
  );
  const marks: [number, string, Text][] = [
    [0, '0', { en: 'ahead', ja: '正面' }],
    [90, '90', { en: 'right', ja: '右' }],
    [-90, '-90', { en: 'left', ja: '左' }],
    [180, '180 / -180', { en: 'behind', ja: '後ろ' }],
  ];
  for (const [angle, value, name] of marks) {
    const rad = (angle * Math.PI) / 180;
    const [x, y] = [cx + Math.sin(rad) * (r + 22), cy - Math.cos(rad) * (r + 22)];
    const anchor = angle === 90 ? 'start' : angle === -90 ? 'end' : 'middle';
    const dx = angle === 90 ? -14 : angle === -90 ? 14 : 0;
    root.append(
      svg('text', { x: x + dx, y: y + (angle === 0 ? -4 : angle === 180 ? 10 : 0), class: 'book-fig-code', 'text-anchor': anchor }, value),
      svg('text', { x: x + dx, y: y + (angle === 0 ? -20 : angle === 180 ? 26 : 16), class: 'book-fig-note', 'text-anchor': anchor }, inLanguage(name)),
    );
  }
  // An enemy ahead and to the right, at +45.
  const rad = (45 * Math.PI) / 180;
  const [ex, ey] = [cx + Math.sin(rad) * r, cy - Math.cos(rad) * r];
  root.append(
    svg('path', { d: `M${cx},${cy - 40} A40,40 0 0 1 ${cx + Math.sin(rad) * 40},${cy - Math.cos(rad) * 40}`, class: 'book-fig-line' }),
    svg('circle', { cx: ex, cy: ey, r: 8, class: 'book-fig-dot action' }),
    svg('text', { x: ex + 14, y: ey - 6, class: 'book-fig-code' }, 'enemy_angle = 45'),
  );
  return root;
}

/** Four built-in robots that each beat the next, round in a ring: no robot beats them all. */
function rivals(): SVGSVGElement {
  const root = canvas(460, 300);
  const names = ['GuardBot', 'CoverBot', 'SentryBot', 'StrafeBot'];
  const places = [
    [60, 40],
    [300, 40],
    [300, 220],
    [60, 220],
  ];
  const [width, height] = [120, 40];
  names.forEach((name, index) => {
    const [x, y] = places[index];
    root.append(
      svg('rect', { x, y, width, height, class: 'book-fig-box accent' }),
      svg('text', { x: x + width / 2, y: y + 25, class: 'book-fig-title', 'text-anchor': 'middle' }, name),
    );
  });
  const beats = inLanguage({ en: 'beats', ja: 'に勝ち越す' });
  // Winner to loser, round the ring.
  const arrows: [number, number, number, number, number, number][] = [
    [180, 60, 300, 60, 240, 50],
    [360, 80, 360, 220, 368, 154],
    [300, 240, 180, 240, 240, 266],
    [120, 220, 120, 80, 112, 154],
  ];
  arrows.forEach(([x1, y1, x2, y2, tx, ty], index) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = (turn: number) => `${x2 - 8 * Math.cos(angle + turn)},${y2 - 8 * Math.sin(angle + turn)}`;
    root.append(
      svg('path', { d: `M${x1},${y1} L${x2},${y2} M${head(0.5)} L${x2},${y2} L${head(-0.5)}`, class: 'book-fig-line' }),
      svg('text', { x: tx, y: ty, class: 'book-fig-note', 'text-anchor': index === 1 ? 'start' : index === 3 ? 'end' : 'middle' }, beats),
    );
  });
  return root;
}

/** Three team templates that each beat the next, round in a ring, 3 a side. */
function teamRivals(): SVGSVGElement {
  const root = canvas(460, 290);
  const [width, height] = [130, 40];
  // Top, bottom right, bottom left: each beats the next.
  const places: [string, number, number][] = [
    ['BaseRunner', 165, 20],
    ['BaseTurtle', 300, 220],
    ['BaseSplit', 30, 220],
  ];
  for (const [name, x, y] of places) {
    root.append(
      svg('rect', { x, y, width, height, class: 'book-fig-box accent' }),
      svg('text', { x: x + width / 2, y: y + 25, class: 'book-fig-title', 'text-anchor': 'middle' }, name),
    );
  }
  const beats = inLanguage({ en: 'beats', ja: 'に勝ち越す' });
  const arrows: [number, number, number, number, number, number, string][] = [
    [270, 60, 345, 220, 322, 132, 'start'],
    [300, 240, 160, 240, 230, 266, 'middle'],
    [115, 220, 190, 60, 138, 132, 'end'],
  ];
  for (const [x1, y1, x2, y2, tx, ty, anchor] of arrows) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = (turn: number) => `${x2 - 8 * Math.cos(angle + turn)},${y2 - 8 * Math.sin(angle + turn)}`;
    root.append(
      svg('path', { d: `M${x1},${y1} L${x2},${y2} M${head(0.5)} L${x2},${y2} L${head(-0.5)}`, class: 'book-fig-line' }),
      svg('text', { x: tx, y: ty, class: 'book-fig-note', 'text-anchor': anchor }, beats),
    );
  }
  return root;
}

/**
 * How far a shot can stray, to scale: a target the width of a robot, 350
 * away, and the widest a shot goes either side, standing and on the move.
 */
function spread(): SVGSVGElement {
  const distance = 350;
  const target = ROBOT_DEFAULTS.radius;
  const scale = 1.4;
  const root = canvas(700, 300);
  const [x0, y0] = [40, 150];
  const x1 = x0 + distance * scale;
  // The labels go right of the target, clear of it.
  const labelX = x1 + target * scale + 10;
  const cone = (degrees: number, accent: boolean, label: Text, labelY: number) => {
    const side = Math.tan((degrees * Math.PI) / 180) * distance * scale;
    root.append(
      svg('path', { d: `M${x0},${y0} L${x1},${y0 - side} L${x1},${y0 + side} Z`, class: accent ? 'book-fig-cone accent' : 'book-fig-cone' }),
      svg('text', { x: labelX, y: labelY, class: 'book-fig-note' }, `${inLanguage(label)} ±${degrees}°`),
    );
  };
  cone(ROBOT_DEFAULTS.movingShotSpread, false, { en: 'on the move', ja: '走りながら' }, y0 - Math.tan((ROBOT_DEFAULTS.movingShotSpread * Math.PI) / 180) * distance * scale + 4);
  cone(ROBOT_DEFAULTS.shotSpread, true, { en: 'standing', ja: '止まって' }, y0 + 4);
  root.append(
    svg('circle', { cx: x1, cy: y0, r: target * scale, class: 'book-fig-target' }),
    svg('rect', { x: x0 - 26, y: y0 - 10, width: 20, height: 20, class: 'book-fig-box accent' }),
    svg('path', { d: `M${x0},${y0 + 110} L${x1},${y0 + 110}`, class: 'book-fig-line' }),
    svg('text', { x: (x0 + x1) / 2, y: y0 + 128, class: 'book-fig-note', 'text-anchor': 'middle' }, `${distance}`),
  );
  return root;
}

export function createFigure(id: FigureId): SVGSVGElement {
  return id === 'tick-steps' ? tickSteps() : id === 'angles' ? angles() : id === 'rivals' ? rivals() : id === 'team-rivals' ? teamRivals() : id === 'spread' ? spread() : programVsTick();
}

/**
 * A chart of which line of a program ran on which tick: a row for each line,
 * a column for each tick. The last line a tick ran is the action it ended
 * with, drawn solid; the lines before it took no time, drawn hollow.
 */
export function createTimeline(program: string, rows: readonly (readonly number[])[]): SVGSVGElement {
  const lines = program.replace(/\n$/, '').split('\n');
  const rowHeight = 24;
  const tickWidth = 28;
  const codeWidth = Math.max(...lines.map((line) => line.length)) * 7.4 + 44;
  const top = 30;
  const width = codeWidth + rows.length * tickWidth + 8;
  const root = canvas(width, top + lines.length * rowHeight + 8);
  root.append(svg('text', { x: codeWidth - 10, y: 18, class: 'book-fig-note', 'text-anchor': 'end' }, 'tick'));
  rows.forEach((_, at) => {
    root.append(svg('text', { x: codeWidth + at * tickWidth + tickWidth / 2, y: 18, class: 'book-fig-note', 'text-anchor': 'middle' }, `${at + 1}`));
  });
  lines.forEach((line, at) => {
    const y = top + at * rowHeight;
    if (at % 2 === 0) root.append(svg('rect', { x: 0, y, width, height: rowHeight, class: 'book-fig-band' }));
    root.append(
      svg('text', { x: 6, y: y + 16, class: 'book-fig-note' }, `${at + 1}`),
      svg('text', { x: 28, y: y + 16, class: 'book-fig-code', 'xml:space': 'preserve' }, line),
    );
  });
  rows.forEach((executed, tick) => {
    const x = codeWidth + tick * tickWidth + tickWidth / 2;
    // A line may run more than once in a tick (round a loop): one mark is enough.
    new Set(executed).forEach((line) => {
      const action = line === executed[executed.length - 1];
      root.append(svg('circle', { cx: x, cy: top + (line - 1) * rowHeight + rowHeight / 2, r: 6, class: action ? 'book-fig-dot action' : 'book-fig-dot' }));
    });
  });
  return root;
}
