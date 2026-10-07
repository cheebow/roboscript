import { analyze } from '../arena/analysis';
import type { Recording } from '../debug/recorder';
import { judge } from '../tutorial/checks';
import type { Goal, Text } from '../tutorial/types';
import type { Challenge, Condition } from './types';

/** What a try of a challenge came to: how it was played, and whether (and how well) it was cleared. */
export interface ChallengeResult {
  cleared: boolean;
  /** The tick it was cleared at, or the end of the match. */
  tick: number;
  /** 0 when not cleared; else 1, and one more for each star condition met. */
  stars: number;
  /** Which of the two star conditions were met. */
  starsMet: [boolean, boolean];
  /** Why it was not cleared, when it was not. */
  why: Text | null;
  record: { lines: number; seconds: number; hp: number };
}

/** Lines of a program that do something: not blank, not only a comment. */
export function linesOf(source: string): number {
  return source.split(/\r?\n/).filter((line) => line.replace(/#.*$/, '').trim() !== '').length;
}

/** How a try went: the goal, the conditions it must meet, and the stars. */
export function judgeChallenge(challenge: Challenge, source: string, recording: Recording): ChallengeResult {
  const outcome = judge(challenge.goal, recording, challenge.stage);
  const last = recording.snapshots.length - 1;
  const tick = outcome.done ? outcome.tick : last;
  const ids = recording.snapshots[0].robots.map((robot) => robot.id);
  const analysis = analyze(recording, ids);
  // In a castle challenge, "ALPHA" is the player's whole team: its numbers are the team's together.
  const mineAt = (index: number) => (recording.teams === undefined ? index === 0 : recording.teams[index] === 0);
  const mine = analysis.robots.filter((_, index) => mineAt(index));
  const alpha = {
    damageTaken: mine.reduce((sum, robot) => sum + robot.damageTaken, 0),
    recovered: mine.reduce((sum, robot) => sum + robot.recovered, 0),
    guarded: mine.reduce((sum, robot) => sum + robot.guarded, 0),
    shots: mine.reduce((sum, robot) => sum + robot.shots, 0),
  };
  const baseHpAt = (team: number, at: number) => {
    const index = recording.bases?.findIndex((base) => base.team === team) ?? -1;
    return index < 0 ? null : (recording.snapshots[at].bases[index] ?? null);
  };
  const record = {
    lines: linesOf(source),
    seconds: tick / recording.tickRate,
    hp: recording.snapshots[tick].robots.reduce((sum, robot, index) => sum + (mineAt(index) ? robot.hp : 0), 0),
  };
  const holds = (condition: Condition): boolean => {
    switch (condition.kind) {
      case 'lines':
        return record.lines <= condition.max;
      case 'seconds':
        return record.seconds <= condition.max;
      case 'hp':
        return record.hp >= condition.min;
      case 'noHit':
        return alpha.damageTaken === 0;
      case 'recovered':
        return alpha.recovered >= condition.min;
      case 'guarded':
        return alpha.guarded >= condition.min;
      case 'shots':
        return alpha.shots <= condition.max;
      case 'castleHp':
        return (baseHpAt(0, last) ?? 0) >= condition.min;
      case 'castleDestroyed':
        return (baseHpAt(1, last) ?? 1) <= 0;
    }
  };
  if (!outcome.done) return { cleared: false, tick, stars: 0, starsMet: [false, false], why: outcome.why, record };
  const unmet = (challenge.require ?? []).find((condition) => !holds(condition));
  if (unmet !== undefined) {
    return { cleared: false, tick, stars: 0, starsMet: [false, false], record, ...unmetWhy(unmet) };
  }
  const starsMet: [boolean, boolean] = [holds(challenge.stars[0]), holds(challenge.stars[1])];
  return { cleared: true, tick, stars: 1 + starsMet.filter(Boolean).length, starsMet, why: null, record };
}

/** Why a condition that must hold did not, in both languages. */
function unmetWhy(condition: Condition): { why: Text } {
  const { en, ja } = describeCondition(condition);
  return { why: { en: `Not cleared: the condition "${en}" was not met.`, ja: `条件「${ja}」を満たしていないので、クリアになりません。` } };
}

/** A condition in words, in both languages. */
export function describeCondition(condition: Condition): Text {
  switch (condition.kind) {
    case 'lines':
      return { en: `in ${condition.max} lines or fewer`, ja: `${condition.max} 行以内` };
    case 'seconds':
      return { en: `within ${condition.max} seconds`, ja: `${condition.max} 秒以内` };
    case 'hp':
      return { en: `with ${condition.min} HP or more left`, ja: `HP を ${condition.min} 以上残す` };
    case 'noHit':
      return { en: 'without being hit', ja: '1 発も当たらない' };
    case 'recovered':
      return { en: `getting back ${condition.min} HP or more`, ja: `HP を合計 ${condition.min} 以上回復` };
    case 'guarded':
      return { en: `guarding against ${condition.min} hits or more`, ja: `${condition.min} 回以上ガードで受ける` };
    case 'shots':
      return { en: `in ${condition.max} shots or fewer`, ja: `${condition.max} 発以内` };
    case 'castleHp':
      return { en: `with your castle at ${condition.min} HP or more`, ja: `自分の城の HP を ${condition.min} 以上残す` };
    case 'castleDestroyed':
      return { en: 'bringing the enemy castle down', ja: '敵の城を落とす' };
  }
}

/** What a challenge's match has to end in, in both languages. */
export function describeGoal(goal: Goal): Text {
  switch (goal.kind) {
    case 'win':
      return { en: 'Win the match', ja: '試合に勝つ' };
    case 'destroy':
      return { en: 'Destroy BRAVO', ja: 'BRAVO を壊す' };
    case 'reach':
      return { en: 'Get to the goal', ja: 'ゴールに着く' };
    case 'recover':
      return { en: 'Get HP back', ja: 'HP を回復する' };
    case 'guard':
      return { en: 'Guard against a hit', ja: 'ガードで弾を受ける' };
    case 'hits':
      return { en: `Hit BRAVO ${goal.count} times`, ja: `BRAVO に ${goal.count} 発当てる` };
    case 'run':
      return { en: 'Run the program', ja: 'プログラムを動かす' };
  }
}
