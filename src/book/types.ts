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
export type FigureId = 'tick-steps' | 'program-vs-tick' | 'angles' | 'rivals' | 'spread' | 'team-rivals';

/** A robot of the book's own, by a name to show it by. */
export interface BookRobot {
  name: Text;
  source: string;
}

/** A robot or a team against others, played when the reader asks: see matchups.ts. */
export interface Matchup {
  /** A template id (a team template's, in a base battle), or a robot of the book's own. */
  robot: string | BookRobot;
  /** Template ids (team templates', in a base battle). */
  opponents: readonly string[];
  /** Arena ids: ARENAS, or CASTLE_ARENAS in a base battle. */
  arenas: readonly string[];
  seeds: readonly number[];
  /** Machines a side, for a base battle with the default parts; one on one without it. */
  teamSize?: number;
}

/** A picture of the game's screens: see shots.ts. */
export type ShotId = 'program' | 'debug' | 'debugger';

/**
 * A match as the program screen plays it: ALPHA's program against a built-in
 * robot as BRAVO, on a map, with a seed. The reader can play the same match
 * in the game (the seed goes in the address, as ?seed=1).
 */
export interface Replay {
  /** ALPHA's program. */
  program: string;
  /** BRAVO: a template id. */
  bravo: string;
  /** An arena id of ARENAS. */
  arena: string;
  seed: number;
}

/** What a replay shows beside the picture of its moment: the game's own analysis, or its log up to a tick. */
export type ReplayPanel = { kind: 'analysis' } | { kind: 'log'; until: number };

export type BookBlock =
  | { kind: 'text'; text: Text }
  /** A program; a Text when its comments are written in the language of the page. */
  | { kind: 'code'; code: string | Text }
  | { kind: 'scene'; scene: Scene; caption: Text }
  | { kind: 'timeline'; timeline: Timeline; caption: Text }
  | { kind: 'readings'; readings: Readings; caption: Text }
  /** A program with a mistake in it, and what the game says about it, in the language of the page. */
  | { kind: 'error'; program: string; caption: Text }
  | { kind: 'figure'; figure: FigureId; caption: Text }
  | { kind: 'shot'; shot: ShotId; caption: Text }
  /**
   * A real match with the game's analysis or log beside a picture of one
   * moment of it: pressing the chart, a hit or a row of the log shows that
   * moment, as in the game.
   */
  | { kind: 'replay'; replay: Replay; tick: number; panel?: ReplayPanel; caption: Text }
  /** A built-in robot's program, as the game has it now, folded away until opened. */
  | { kind: 'template'; template: string }
  | { kind: 'matchup'; matchup: Matchup }
  /** The parts of a slot, from the game's own list. */
  | { kind: 'parts'; slot: 'body' | 'legs' | 'gun' | 'sensor' }
  /**
   * A challenge of the game, as the game has it (its title, what to do, its
   * conditions), with hints that tell more and more: the first shown, the
   * others folded away until opened.
   */
  | { kind: 'challenge'; challenge: string; hints: readonly Text[] }
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
