import type { Refusal, SteppedPlay } from '../arena/match';

/** A long run being driven; cancelling throws the steps played so far away. */
export interface DrivenRun {
  cancel(): void;
}

/**
 * Drives a SteppedPlay one step a task, so the screen keeps painting and can
 * say how far it is. `progress` is told before each step, `done` once with
 * the result, or with the refusal of the step that could not be played.
 */
export function driveSteps<Result>(
  play: SteppedPlay<Result>,
  progress: (done: number, count: number) => void,
  done: (outcome: ({ ok: true } & Result) | Refusal) => void,
): DrivenRun {
  let cancelled = false;
  let index = 0;
  const next = () => {
    if (cancelled) return;
    if (index >= play.count) {
      done({ ok: true, ...play.result() });
      return;
    }
    progress(index + 1, play.count);
    const stepped = play.step(index);
    if (!stepped.ok) {
      done(stepped);
      return;
    }
    index++;
    setTimeout(next, 0);
  };
  setTimeout(next, 0);
  return {
    cancel() {
      cancelled = true;
    },
  };
}
