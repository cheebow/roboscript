import type { Stage, Text } from '../tutorial/types';

// The book (book.html): a read-through introduction and strategy guide, in
// parts and chapters. A chapter is a run of blocks: text in the little markup
// of the help, programs, and pictures. The pictures of matches are drawn from
// real matches, played when the page is read, so they never go out of date.

/** A moment of a real match, drawn as the battle screen draws it. */
export interface Scene {
  /** Where the match is played and who the other robot is: a stage of the tutorial. */
  stage: Stage;
  /** ALPHA's program. */
  program: string;
  /** The tick to show: 0 is the start, 30 is one second in. */
  tick: number;
}

/** Which lines of a program ran on each of its first ticks, as a chart. */
export interface Timeline {
  stage: Stage;
  program: string;
  /** How many ticks from the start to chart. */
  ticks: number;
}

/** The sensors a table of readings can show: see readingsRows. */
export type ReadingSensor = 'enemy_visible' | 'enemy_distance' | 'enemy_angle' | 'hp';

/** What a robot's sensors read on some ticks of a real match, as a table. */
export interface Readings {
  stage: Stage;
  program: string;
  ticks: readonly number[];
  sensors: readonly ReadingSensor[];
}

/** A diagram drawn by the book itself: see figures.ts. */
export type FigureId = 'tick-steps' | 'program-vs-tick' | 'angles' | 'rivals' | 'spread';

/** A built-in robot against others, played when the reader asks: see matchups.ts. */
export interface Matchup {
  /** Template ids. */
  robot: string;
  opponents: readonly string[];
  /** Arena ids (ARENAS). */
  arenas: readonly string[];
  seeds: readonly number[];
}

/** A picture of the game's screens: see shots.ts. */
export type ShotId = 'program' | 'debug';

export type BookBlock =
  | { kind: 'text'; text: Text }
  | { kind: 'code'; code: string }
  | { kind: 'scene'; scene: Scene; caption: Text }
  | { kind: 'timeline'; timeline: Timeline; caption: Text }
  | { kind: 'readings'; readings: Readings; caption: Text }
  /** A program with a mistake in it, and what the game says about it, in the language of the page. */
  | { kind: 'error'; program: string; caption: Text }
  | { kind: 'figure'; figure: FigureId; caption: Text }
  | { kind: 'shot'; shot: ShotId; caption: Text }
  /** A built-in robot's program, as the game has it now, folded away until opened. */
  | { kind: 'template'; template: string }
  | { kind: 'matchup'; matchup: Matchup }
  /** The parts of a slot, from the game's own list. */
  | { kind: 'parts'; slot: 'body' | 'legs' | 'gun' | 'sensor' }
  /** Where the help says more: the ids of its topics. */
  | { kind: 'see'; topics: readonly string[] };

export interface BookChapter {
  id: string;
  title: Text;
  blocks: readonly BookBlock[];
}

export interface BookPart {
  id: string;
  title: Text;
  chapters: readonly BookChapter[];
}
