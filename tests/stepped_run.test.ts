import { describe, expect, it } from 'vitest';
import type { SteppedPlay } from '../src/arena/match';
import { driveSteps } from '../src/ui/stepped_run';

function counting(count: number, failAt: number | null = null): SteppedPlay<{ played: number }> & { played: number } {
  const play = {
    played: 0,
    count,
    step(index: number) {
      if (index === failAt) return { ok: false as const, problems: ['stuck'] };
      play.played++;
      return { ok: true as const };
    },
    result() {
      return { played: play.played };
    },
  };
  return play;
}

const settled = <T>(run: (done: (outcome: T) => void) => void) => new Promise<T>((resolve) => run(resolve));

describe('driving a stepped play', () => {
  it('plays every step, telling of each, and hands over the result', async () => {
    const play = counting(3);
    const seen: number[] = [];
    const outcome = await settled<{ ok: boolean }>((done) => driveSteps(play, (at) => seen.push(at), done));
    expect(outcome).toEqual({ ok: true, played: 3 });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('hands over the refusal of a step that cannot be played', async () => {
    const play = counting(3, 1);
    const outcome = await settled<{ ok: boolean }>((done) => driveSteps(play, () => {}, done));
    expect(outcome).toEqual({ ok: false, problems: ['stuck'] });
    expect(play.played).toBe(1);
  });

  it('plays nothing more once cancelled', async () => {
    const play = counting(5);
    let finished = false;
    const run = driveSteps(
      play,
      () => {
        if (play.played === 1) run.cancel();
      },
      () => {
        finished = true;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(play.played).toBeLessThanOrEqual(2);
    expect(finished).toBe(false);
  });
});
