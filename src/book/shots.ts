import debugGif from '../../docs/images/debug.gif';
import programPng from '../../docs/images/program.png';
import type { ShotId } from './types';

// The pictures of the game's screens the book shows. They are taken by hand,
// so they go out of date when the screens change: the book keeps to a few.

export const SHOTS: Record<ShotId, string> = {
  program: programPng,
  debug: debugGif,
};
