import { afterEach, describe, expect, it } from 'vitest';
import { GUARD_FIXED } from '../src/book/chapters';
import { GUARD_ON_TOP } from '../src/book/examples';
import { playReplay } from '../src/book/replays';
import { STANDARD_LOADOUT } from '../src/data/parts';
import type { DebugEvent } from '../src/debug/debug_event';
import { useLanguage } from '../src/i18n/language';
import { formatMatchReport } from '../src/ui/match_report';

describe('the match copied as text', () => {
  afterEach(() => useLanguage('en'));
  const { recording } = playReplay(GUARD_FIXED);
  const report = (events: readonly DebugEvent[] = recording.events) =>
    formatMatchReport({
      recording,
      arenaName: 'Open Field',
      loadouts: [STANDARD_LOADOUT, STANDARD_LOADOUT],
      programs: [
        { name: 'ALPHA', source: GUARD_ON_TOP },
        { name: 'BRAVO', source: 'loop\n    fire\n' },
      ],
      events,
    });

  it('says where the match was fought and how it ended', () => {
    useLanguage('en');
    const text = report();
    expect(text).toContain('Map: Open Field / seed 1');
    expect(text).toContain('Result: won by ALPHA (destroyed, 10.1 s)');
    expect(text).toContain('One second is 30 ticks');
  });

  it('gives the numbers of the analysis, with each robot\'s parts', () => {
    useLanguage('en');
    const text = report();
    expect(text).toContain('| robot | BODY | LEGS | GUN | SENSOR | hits | dealt | taken | guarded |');
    expect(text).toContain('| ALPHA | Standard | Standard | Standard | Standard | 10/10 | 200 | 190 | 1 |');
  });

  it('gives both programs whole', () => {
    useLanguage('en');
    const text = report();
    expect(text).toContain(`## Program of ALPHA\n\`\`\`\n${GUARD_ON_TOP.trimEnd()}\n\`\`\``);
    expect(text).toContain('## Program of BRAVO\n```\nloop\n    fire\n```');
  });

  it('gives every row of the log, with the line that caused it', () => {
    useLanguage('en');
    const rows = report().split('## Log\n')[1].trimEnd().split('\n');
    expect(rows).toHaveLength(recording.events.length);
    expect(rows[0]).toBe('[00.000] - SYSTEM match started seed=1');
    expect(rows).toContain('[02.633] ALPHA ACTION (line 3) guard');
    expect(rows.at(-1)).toBe('[10.133] - SYSTEM winner: ALPHA (destroyed)');
  });

  it('is in the language of the page', () => {
    useLanguage('ja');
    const text = report();
    expect(text).toContain('# RoboScript の試合');
    expect(text).toContain('結果: ALPHA の勝ち (destroyed, 10.1 秒)');
    expect(text).toContain('## ALPHA のプログラム');
    expect(text).toContain('[02.633] ALPHA 行動 (3 行目) guard');
  });

  it('gives the programs and their errors when there was no match', () => {
    useLanguage('en');
    const error: DebugEvent = { tick: 0, timestamp: 0, robotId: 'ALPHA', type: 'error', message: 'Unknown command "fier"', sourceLine: 2 };
    const text = formatMatchReport({ recording: null, arenaName: null, loadouts: [], programs: [{ name: 'ALPHA', source: 'loop\n    fier\n' }], events: [error] });
    expect(text).not.toContain('Result:');
    expect(text).toContain('## Program of ALPHA');
    expect(text).toContain('[00.000] ALPHA ERROR (line 2) Unknown command "fier"');
  });
});
