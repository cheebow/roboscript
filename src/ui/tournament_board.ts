import type { Entrant } from '../arena/match';
import type { Bracket, Tie, TieMatch } from '../arena/tournament';
import { t } from '../i18n/messages';
import { paletteOf } from '../view/sprites';
import { createElement } from './dom';
import { createMedal } from './medal';
import { createRobotPreview, drawRobotPreview } from './robot_preview';

// Sizes of the drawing, in CSS pixels.
const TIE_WIDTH = 190;
const ROW_HEIGHT = 30;
const TIE_HEIGHT = ROW_HEIGHT * 2 + 14;
const ROUND_GAP = 46;
/** The height a first-round tie takes, with room around it. */
const SLOT = TIE_HEIGHT + 18;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The result of a tournament as a bracket: a box for every tie with the two
 * robots, their wins and a dot for each match (pressed, it plays the match),
 * joined round to round by lines in the colour of the robot that went
 * through; the champion at the end, with medals for the first three places.
 */
export function createTournamentBoard(
  entrants: readonly Entrant[],
  bracket: Bracket,
  onPlay: (match: TieMatch) => void,
): HTMLElement {
  const { rounds } = bracket;
  const firstTies = rounds[0].length;
  const height = firstTies * SLOT;
  const width = (rounds.length + 1) * (TIE_WIDTH + ROUND_GAP);
  const board = createElement('div', 'tournament-board');
  board.style.width = `${width}px`;
  board.style.height = `${height + 24}px`;

  const lines = document.createElementNS(SVG_NS, 'svg');
  lines.setAttribute('class', 'bracket-lines');
  lines.setAttribute('width', `${width}`);
  lines.setAttribute('height', `${height + 24}`);
  board.append(lines);

  const centre = (round: number, index: number) => 24 + (index + 0.5) * SLOT * 2 ** round;
  const left = (round: number) => round * (TIE_WIDTH + ROUND_GAP);

  rounds.forEach((round, roundIndex) => {
    const heading = createElement('div', 'bracket-round', roundName(roundIndex, rounds.length));
    heading.style.left = `${left(roundIndex)}px`;
    heading.style.width = `${TIE_WIDTH}px`;
    board.append(heading);
    round.forEach((tie, index) => {
      const box = tieBox(entrants, tie, bracket, onPlay);
      box.style.left = `${left(roundIndex)}px`;
      box.style.top = `${centre(roundIndex, index) - TIE_HEIGHT / 2}px`;
      board.append(box);
      // From this tie to the next round, or to the champion, in the colour of the one that went through.
      const fromX = left(roundIndex) + TIE_WIDTH;
      const fromY = centre(roundIndex, index);
      const toX = left(roundIndex + 1);
      const toY = roundIndex + 1 < rounds.length ? centre(roundIndex + 1, Math.floor(index / 2)) : fromY;
      const midX = fromX + ROUND_GAP / 2;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`);
      path.setAttribute('class', 'bracket-path');
      path.setAttribute('stroke', paletteOf(tie.winner).body);
      lines.append(path);
    });
  });

  // The champion.
  const champion = createElement('div', 'bracket-champion');
  champion.style.left = `${left(rounds.length)}px`;
  champion.style.top = `${centre(rounds.length - 1, 0) - 34}px`;
  champion.append(createMedal(1), robotTag(entrants[bracket.champion], bracket.champion), createElement('span', 'bracket-champion-label', t('tournament.champion')));
  board.append(champion);
  return board;
}

function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - 1 - round;
  if (fromEnd === 0) return t('tournament.final');
  if (fromEnd === 1) return t('tournament.semiFinal');
  return t('tournament.round', { number: round + 1 });
}

function robotTag(entrant: Entrant, index: number): HTMLElement {
  const tag = createElement('span', 'robot-tag');
  const picture = createRobotPreview();
  drawRobotPreview(picture, entrant.loadout, paletteOf(index));
  tag.append(picture, createElement('span', 'robot-tag-name', entrant.name));
  return tag;
}

function tieBox(entrants: readonly Entrant[], tie: Tie, bracket: Bracket, onPlay: (match: TieMatch) => void): HTMLElement {
  const box = createElement('div', 'bracket-tie');
  box.style.width = `${TIE_WIDTH}px`;
  box.style.height = `${TIE_HEIGHT}px`;
  const sides: [number | null, number][] = [
    [tie.a, tie.score[0]],
    [tie.b, tie.score[1]],
  ];
  for (const [entrant, wins] of sides) {
    const row = createElement('div', 'bracket-row');
    if (entrant === null) {
      row.classList.add('bye');
      row.append(createElement('span', 'robot-tag-name', t('tournament.bye')));
    } else {
      if (entrant !== tie.winner) row.classList.add('beaten');
      const place = bracket.places[entrant];
      // Medals for the places a robot ends on, where it was knocked out (or won).
      const knockedOutHere = entrant !== tie.winner || entrant === bracket.champion;
      if (place !== null && place > 1 && knockedOutHere) row.append(createMedal(place));
      row.append(robotTag(entrants[entrant], entrant));
      row.append(createElement('span', 'bracket-wins', tie.b === null ? '' : `${wins}`));
    }
    box.append(row);
  }
  const dots = createElement('div', 'bracket-dots');
  tie.matches.forEach((match, index) => {
    const dot = createElement('button', 'cross-dot');
    dot.type = 'button';
    if (match.winner === null) dot.classList.add('draw');
    else {
      dot.classList.add('won');
      dot.style.background = paletteOf(match.winner).body;
    }
    dot.title = t('tournament.dot.title', {
      number: index + 1,
      first: entrants[match.first].name,
      second: entrants[match.second].name,
      map: match.arena.name,
      winner: match.winner === null ? t('league.outcome.draw') : entrants[match.winner].name,
    });
    dot.addEventListener('click', () => onPlay(match));
    dots.append(dot);
  });
  box.append(dots);
  return box;
}
