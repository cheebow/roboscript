import type { Loadout } from '../data/parts';
import type { Arena, Base, Vec2 } from '../sim/types';

/** A text in both languages of the screen. Written with a little markup: see renderMarkup. */
export interface Text {
  en: string;
  ja: string;
}

/** Where a step's match is played: the field, the training robot as BRAVO, and a goal to drive to, if any. */
export interface Stage {
  arena: Arena;
  /** The program of the training robot (BRAVO). */
  bot: string;
  botLoadout?: Partial<Loadout>;
  /** A circle on the field for ALPHA to reach. */
  goal?: Vec2 & { radius: number };
  /**
   * A castle match: this many robots a side, the player's program driving
   * every machine of team 0 (ALPHA-1...) and the bot's every machine of team
   * 1. The arena must carry a spawn for each, and `bases` the two castles.
   */
  teamSize?: number;
  bases?: readonly Base[];
  /** Every match of the step is the same match, so that only the code makes a difference. */
  seed: number;
}

/** The team of each robot of a stage's match, in spawn order; undefined for the usual duel. */
export function stageTeams(stage: Stage): number[] | undefined {
  const { teamSize } = stage;
  if (teamSize === undefined) return undefined;
  return Array.from({ length: teamSize * 2 }, (_, index) => Math.floor(index / teamSize));
}

/** What has to happen in a match for a step to be done. */
export type Goal =
  | { kind: 'run' }
  | { kind: 'hits'; count: number }
  | { kind: 'reach' }
  | { kind: 'destroy' }
  | { kind: 'win' }
  /** ALPHA takes a hit while guarding. */
  | { kind: 'guard' }
  /** ALPHA gets HP back. */
  | { kind: 'recover' };

export type Check =
  /** Read and go on. */
  | { kind: 'read' }
  /** A match played, in which the goal is met; the code must use the given words, if any. */
  | { kind: 'match'; goal: Goal; uses?: readonly string[] }
  /** Something done on the screen. */
  | { kind: 'action'; action: TutorialAction };

/** What the player can do on the screen that a step may ask for. */
export type TutorialAction = 'debug' | 'stepLine' | 'mark' | 'part';

export interface Step {
  id: string;
  title: Text;
  /** The explanation. */
  body: Text;
  /** What to do, shown apart from the explanation. */
  task?: Text;
  /** Hints, shown one at a time when asked for. */
  hints?: readonly Text[];
  /** A program that does the task: offered once every hint has been seen. */
  answer?: string;
  /** For a step with parts: the parts that go with the answer. */
  answerParts?: Partial<Loadout>;
  /** The code the step starts with; without it, the code the step before ended with. */
  start?: string;
  stage?: Stage;
  check: Check;
  /** ALPHA's parts can be chosen in this step, and its matches use them; elsewhere ALPHA has standard parts. */
  parts?: boolean;
  /** Ids of elements of the screen to point at while the step is shown. */
  highlight?: readonly string[];
}

export interface Chapter {
  id: string;
  title: Text;
  steps: readonly Step[];
}
