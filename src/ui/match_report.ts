import { analyze } from '../arena/analysis';
import { type Loadout, partIn, SLOTS } from '../data/parts';
import type { DebugEvent } from '../debug/debug_event';
import type { Recording } from '../debug/recorder';
import { type MessageKey, t } from '../i18n/messages';
import { winnersOf } from '../sim/winners';
import { formatTimestamp } from './format';

/** A program of the match, under the name it is shown by. */
export interface ReportedProgram {
  name: string;
  source: string;
}

export interface MatchReport {
  /** The match played; null when the programs did not get as far as a match (their errors are in the log). */
  recording: Recording | null;
  arenaName: string | null;
  /** Each robot's parts, in the recording's order. */
  loadouts: readonly Loadout[];
  programs: readonly ReportedProgram[];
  /** The log, the rows the screen leaves out included. */
  events: readonly DebugEvent[];
}

/**
 * The match as plain text, to be pasted somewhere else, an AI chat for one:
 * where it was fought, how it ended, the numbers of the analysis, the
 * programs, and the log, every row of it however far the replay has got.
 */
export function formatMatchReport(report: MatchReport): string {
  const { recording, arenaName, loadouts, programs, events } = report;
  const lines = [`# ${t('report.title')}`];
  if (recording !== null) {
    const ids = recording.snapshots[0].robots.map((robot) => robot.id);
    const last = recording.snapshots[recording.snapshots.length - 1];
    const seconds = t('report.seconds', { seconds: ((recording.snapshots.length - 1) / recording.tickRate).toFixed(1) });
    lines.push(`${t('report.arena')}: ${arenaName ?? '-'} / seed ${recording.seed}`);
    if (last.result !== null) {
      const winners = winnersOf(last.result);
      const outcome = winners === null ? t('report.draw') : t('report.winner', { names: winners.join(' & ') });
      lines.push(`${t('report.result')}: ${outcome} (${last.result.reason}, ${seconds})`);
    }
    lines.push(t('report.time', { rate: recording.tickRate }), '');

    const analysis = analyze(recording, ids);
    const castles = analysis.bases !== undefined;
    const head = [
      t('analysis.robot'),
      ...SLOTS.map((slot) => t(`slot.${slot}` as MessageKey)),
      t('analysis.accuracy'),
      t('analysis.dealt'),
      ...(castles ? [t('analysis.castleDamage')] : []),
      t('analysis.taken'),
      t('analysis.guarded'),
      t('analysis.recovered'),
      t('analysis.distance'),
      t('analysis.sighted'),
    ];
    lines.push(`## ${t('report.robots')}`, tableRow(head), tableRow(head.map(() => '---')));
    analysis.robots.forEach((robot, index) => {
      const loadout = loadouts[index];
      lines.push(
        tableRow([
          robot.name,
          ...SLOTS.map((slot) => (loadout === undefined ? '-' : partIn(loadout, slot).name)),
          `${robot.hits}/${robot.shots}`,
          `${robot.damageDealt}`,
          ...(castles ? [`${robot.castleDamage}`] : []),
          `${robot.damageTaken}`,
          `${robot.guarded}`,
          `${robot.recovered}`,
          `${Math.round(robot.distance)}`,
          `${Math.round(robot.sighted * 100)}%`,
        ]),
      );
    });
    lines.push('');
  }

  for (const program of programs) {
    lines.push(`## ${t('report.program', { name: program.name })}`, '```', program.source.trimEnd(), '```', '');
  }

  lines.push(`## ${t('report.log')}`);
  for (const event of events) {
    const where = event.sourceLine === null ? '' : ` (${t('report.line', { line: event.sourceLine })})`;
    lines.push(`[${formatTimestamp(event.timestamp)}] ${event.robotId ?? '-'} ${t(`log.type.${event.type}` as MessageKey)}${where} ${event.message}`);
  }
  return `${lines.join('\n')}\n`;
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}
