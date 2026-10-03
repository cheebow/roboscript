import type { LeagueMatch, Standing } from '../arena/league';
import type { Entrant } from '../arena/match';
import { t } from '../i18n/messages';
import { paletteOf } from '../view/sprites';
import { createElement } from './dom';
import { createMedal } from './medal';
import { createRobotTag } from './robot_preview';

/** What the board needs to show a league: who took part, every match, and the table. */
export interface LeagueOutcome {
  entrants: readonly Entrant[];
  matches: readonly LeagueMatch[];
  standings: readonly Standing[];
}

/**
 * The result of a league as a picture: the cross table of who beat whom, a
 * dot for each match that plays it when pressed, and the table with medals
 * and a bar for the points.
 */
export function createLeagueBoard(league: LeagueOutcome, onPlay: (match: LeagueMatch) => void): HTMLElement {
  const board = createElement('div', 'league-board');
  board.append(crossTable(league, onPlay), table(league));
  return board;
}

/** A robot's picture and name, in the colour it has on the board. */
function robotTag(entrant: Entrant, index: number, small = false): HTMLElement {
  return createRobotTag(entrant.name, entrant.loadout, paletteOf(index), small);
}

function colorOf(index: number): string {
  return paletteOf(index).body;
}

function crossTable({ entrants, matches }: LeagueOutcome, onPlay: (match: LeagueMatch) => void): HTMLElement {
  const grid = createElement('div', 'cross-table');
  grid.style.gridTemplateColumns = `auto repeat(${entrants.length}, minmax(0, 1fr))`;
  grid.append(createElement('span', 'cross-corner'));
  entrants.forEach((entrant, index) => {
    const head = createElement('span', 'cross-head');
    head.append(robotTag(entrant, index, true));
    grid.append(head);
  });
  entrants.forEach((rowEntrant, row) => {
    const head = createElement('span', 'cross-row-head');
    head.append(robotTag(rowEntrant, row));
    grid.append(head);
    entrants.forEach((_, column) => {
      const cell = createElement('span', 'cross-cell');
      if (row === column) {
        cell.classList.add('self');
        grid.append(cell);
        return;
      }
      const between = matches.filter(
        (match) => (match.first === row && match.second === column) || (match.first === column && match.second === row),
      );
      let won = 0;
      let lost = 0;
      const dots = createElement('span', 'cross-dots');
      for (const match of between) {
        const outcome = match.winner === null ? 'draw' : match.winner === row ? 'won' : 'lost';
        if (outcome === 'won') won++;
        if (outcome === 'lost') lost++;
        const dot = createElement('button', `cross-dot ${outcome}`);
        dot.type = 'button';
        if (outcome === 'won') dot.style.background = colorOf(row);
        dot.title = t('league.dot.title', {
          first: entrants[match.first].name,
          second: entrants[match.second].name,
          map: match.arena.name,
          outcome: t(`league.outcome.${outcome}`),
        });
        dot.addEventListener('click', () => onPlay(match));
        dots.append(dot);
      }
      // The cell takes the colour of whoever came out ahead between the two.
      if (won > lost) {
        cell.classList.add('ahead');
        cell.style.setProperty('--cell-color', colorOf(row));
      } else if (won < lost) {
        cell.classList.add('behind');
      } else {
        cell.classList.add('level');
      }
      cell.append(dots, createElement('span', 'cross-score', `${won}-${lost}`));
      grid.append(cell);
    });
  });
  return grid;
}

function table({ entrants, standings }: LeagueOutcome): HTMLElement {
  const list = createElement('div', 'league-table');
  const most = Math.max(1, ...standings.map((line) => line.points));
  const head = createElement('div', 'league-line head');
  for (const key of ['league.place', 'league.robot', 'league.points', 'league.record'] as const) {
    head.append(createElement('span', '', t(key)));
  }
  list.append(head);
  for (const line of standings) {
    const row = createElement('div', 'league-line');
    const place = createElement('span', 'league-place');
    place.append(line.place <= 3 ? createMedal(line.place) : createElement('span', 'league-place-number', `${line.place}`));
    const bar = createElement('span', 'league-bar');
    const fill = createElement('span', 'league-bar-fill');
    fill.style.width = `${(100 * line.points) / most}%`;
    fill.style.background = colorOf(line.entrant);
    bar.append(fill, createElement('span', 'league-bar-label', `${line.points}`));
    const record = createElement('span', 'league-record', t('league.recordValue', { won: line.won, drawn: line.drawn, lost: line.lost }));
    row.append(place, robotTag(entrants[line.entrant], line.entrant), bar, record);
    list.append(row);
  }
  return list;
}
