import debuggerEn from '../../docs/images/book-debugger-en.png';
import debuggerJa from '../../docs/images/book-debugger-ja.png';
import debugGif from '../../docs/images/debug.gif';
import programPng from '../../docs/images/program.png';
import type { Text } from '../tutorial/types';
import type { ShotId } from './types';

// The pictures of the game's screens the book shows. They are taken by hand,
// so they go out of date when the screens change: the book keeps to a few.
// The debugger's, in both languages, are taken by scripts/book_shots.mjs.

/** A number put over a picture, at a place given in percent of its width and height. */
export interface ShotMark {
  n: number;
  x: number;
  y: number;
}

export interface Shot {
  /** One picture, or one for each language. */
  image: string | Text;
  /** Numbers over the picture that the text goes through. */
  marks?: readonly ShotMark[];
}

export const SHOTS: Record<ShotId, Shot> = {
  program: { image: programPng },
  debug: { image: debugGif },
  debugger: {
    image: { en: debuggerEn, ja: debuggerJa },
    marks: [
      { n: 1, x: 84.8, y: 6.6 },
      { n: 2, x: 50, y: 6.6 },
      { n: 3, x: 12.3, y: 54.2 },
      { n: 4, x: 35, y: 41.6 },
      { n: 5, x: 35, y: 36.9 },
      { n: 6, x: 58.7, y: 22 },
      { n: 7, x: 50, y: 65.5 },
      { n: 8, x: 66, y: 65.5 },
      { n: 9, x: 12, y: 73.3 },
      { n: 10, x: 30, y: 86.9 },
      { n: 11, x: 60, y: 73.3 },
      { n: 12, x: 85, y: 73.3 },
    ],
  },
};
