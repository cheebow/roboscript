import { lex } from '../ai/lexer';
import type { Recording } from '../debug/recorder';
import type { Goal, Stage, Text } from './types';

/** How a step's match went for its check: done at a tick of the match, or not, and why. */
export type Outcome = { done: true; tick: number } | { done: false; why: Text };

/** A match for which the step counts once two seconds of it have played. */
const RUN_TICKS = 60;

/** Whether the match met the goal, and when. */
export function judge(goal: Goal, recording: Recording, stage: Stage | undefined): Outcome {
  const { snapshots } = recording;
  const last = snapshots.length - 1;
  switch (goal.kind) {
    case 'run':
      return { done: true, tick: Math.min(RUN_TICKS, last) };
    case 'hits': {
      let hits = 0;
      for (let tick = 1; tick <= last; tick++) {
        if (snapshots[tick].robots[1].hp < snapshots[tick - 1].robots[1].hp) hits++;
        if (hits >= goal.count) return { done: true, tick };
      }
      return { done: false, why: hits === 0 ? NO_HITS : { en: `${hits} hit(s): ${goal.count} are needed.`, ja: `当たったのは ${hits} 発です。${goal.count} 発当てましょう。` } };
    }
    case 'reach': {
      const target = stage?.goal;
      if (target === undefined) return { done: false, why: NO_GOAL };
      for (let tick = 0; tick <= last; tick++) {
        const { x, y } = snapshots[tick].robots[0];
        if (Math.hypot(x - target.x, y - target.y) <= target.radius) return { done: true, tick };
      }
      return { done: false, why: { en: 'ALPHA did not get to the goal.', ja: 'ALPHA がゴールまで行けませんでした。' } };
    }
    case 'destroy': {
      for (let tick = 0; tick <= last; tick++) if (!snapshots[tick].robots[1].alive) return { done: true, tick };
      return { done: false, why: { en: 'The target is still standing.', ja: '的がまだ残っています。' } };
    }
    case 'win': {
      const result = snapshots[last].result;
      if (result?.winnerId === 'ALPHA') return { done: true, tick: last };
      if (result?.winnerId === null) return { done: false, why: { en: 'A draw: win to clear the step.', ja: '引き分けでした。勝つとクリアです。' } };
      return { done: false, why: { en: 'BRAVO won this time.', ja: '今回は BRAVO の勝ちでした。' } };
    }
  }
}

const NO_HITS: Text = { en: 'No shot hit the target.', ja: '的に 1 発も当たりませんでした。' };
const NO_GOAL: Text = { en: 'This step has no goal.', ja: 'このステップにはゴールがありません。' };

/** The words of the program, comments left out: to tell whether it uses a word a step asks for. */
export function wordsOf(source: string): Set<string> {
  return new Set(lex(source).lines.flatMap((line) => line.tokens.filter((token) => token.type === 'word').map((token) => token.text)));
}

/** The first of the words the program does not use yet; null when it uses them all. */
export function missingWord(source: string, words: readonly string[]): string | null {
  const used = wordsOf(source);
  return words.find((word) => !used.has(word)) ?? null;
}
