import { createElement } from './dom';

/** A medal for a place: gold, silver and bronze for the first three, plain after that (styled in src/style.css). */
export function createMedal(place: number, title = ''): HTMLElement {
  const medal = createElement('span', 'place-badge');
  medal.dataset.place = `${Math.min(place, 4)}`;
  medal.title = title;
  medal.append(createElement('span', 'place-number', `${place}`));
  return medal;
}
