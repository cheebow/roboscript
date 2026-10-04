import type { Loadout, Slot } from '../data/parts';
import type { Recording } from '../debug/recorder';
import type { ReplayManager } from '../debug/replay_manager';
import type { TutorialMatch } from '../tutorial/match';
import type { ScriptError } from '../ai/script_error';
import type { Stage, TutorialAction } from '../tutorial/types';

/**
 * What leads the player through set matches beside their own editor: the
 * tutorial, or the challenges. The program screen plays its matches and
 * tells it what the player did.
 */
export interface Coach {
  /** The field and the training robot the match is played on; undefined when there is none to show. */
  readonly stage: Stage | undefined;
  /** ALPHA's parts, as the match is played with them. */
  readonly loadout: Loadout;
  /** The slots whose parts the player cannot change. */
  readonly fixedSlots: ReadonlySet<Slot>;
  /** The match of the source, ready to record; the errors of the program when it has any. */
  match(source: string, loadout: Loadout): { ok: true; match: TutorialMatch } | { ok: false; errors: ScriptError[] };
  /** Judges the recorded match, and gives back what of it the screen is to show. */
  played(recording: Recording): Recording;
  /** The match is being shown: the result comes out as the replay gets to it. */
  watch(replay: ReplayManager): void;
  /** The program had errors, or the parts cost too much: no match. */
  matchRefused(): void;
  /** Something the player did on the screen. */
  acted(action: TutorialAction): void;
  /** The parts the player picked. */
  setLoadout(loadout: Loadout): void;
  /** The player's code changed: to be kept. */
  codeEdited(code: string): void;
  /** Called every frame. */
  update(): void;
  /** The screen is opened / left. */
  open(): void;
  close(): void;
}
