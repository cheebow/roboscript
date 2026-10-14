// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { BOOK, CHAPTERS } from '../src/book/chapters';
import {
  DRIVE_ON,
  FACE_BEHIND,
  KEEP_FIRING,
  LONG_TURN,
  NO_ACTION_LOOP,
  ONE_SHOT,
  TICK_BY_TICK,
  TURN_THEN_DRIVE,
  TWO_TICK_LOOP,
} from '../src/book/examples';
import { recordFor, timelineRows } from '../src/book/scenes';
import type { BookBlock } from '../src/book/types';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { HELP } from '../src/help/topics';
import { type Language, useLanguage } from '../src/i18n/language';
import { renderBookPage } from '../src/pages/book_page';
import { BEHIND, QUARTER, RANGE, TRACK } from '../src/tutorial/stages';

// The book (book.html): that it renders whole, that its programs work, and
// that what its text says about them is what the game does.

function inLanguage(language: Language, render: () => HTMLElement): HTMLElement {
  useLanguage(language);
  try {
    return render();
  } finally {
    useLanguage('en');
  }
}

const BLOCKS: readonly BookBlock[] = CHAPTERS.flatMap((chapter) => chapter.blocks);

/** Every text of the book, in both languages. */
function allText(): string[] {
  return [
    ...BOOK.flatMap((part) => [part.title.en, part.title.ja]),
    ...CHAPTERS.flatMap((chapter) => [chapter.title.en, chapter.title.ja]),
    ...BLOCKS.flatMap((block) => ('text' in block ? [block.text.en, block.text.ja] : 'caption' in block ? [block.caption.en, block.caption.ja] : [])),
  ];
}

describe('the book page', () => {
  it.each(['en', 'ja'] as const)('carries every chapter under its own anchor, linked from the contents, in %s', (language) => {
    const page = inLanguage(language, renderBookPage);
    for (const chapter of CHAPTERS) {
      expect(page.querySelector(`section[id="${chapter.id}"]`), chapter.id).not.toBeNull();
      expect(page.querySelector(`nav a[href="#${chapter.id}"]`), chapter.id).not.toBeNull();
    }
    // Every picture is there, with its caption.
    const pictures = BLOCKS.filter((block) => 'caption' in block).length;
    expect(page.querySelectorAll('figure.book-figure figcaption')).toHaveLength(pictures);
    expect(page.querySelectorAll('.book-scene')).toHaveLength(BLOCKS.filter((block) => block.kind === 'scene').length);
    expect(page.querySelectorAll('.book-figure-svg')).toHaveLength(
      BLOCKS.filter((block) => block.kind === 'timeline' || block.kind === 'figure').length,
    );
    for (const image of page.querySelectorAll('img.book-shot')) expect(image.getAttribute('alt')).not.toBe('');
  });

  it('ends each chapter but the last with the way on to the next', () => {
    const page = inLanguage('ja', renderBookPage);
    const onward = [...page.querySelectorAll('a.book-next')].map((link) => link.getAttribute('href'));
    expect(onward).toEqual(CHAPTERS.slice(1).map((chapter) => `#${chapter.id}`));
    expect(page.querySelector(`#${CHAPTERS[2].id} h2`)?.textContent).toBe('第 3 章 時間は tick で進む');
  });

  it('points only to topics the help has', () => {
    const topics = new Set(HELP.flatMap((section) => section.topics).map((topic) => topic.id));
    for (const block of BLOCKS) if (block.kind === 'see') for (const id of block.topics) expect(topics.has(id), id).toBe(true);
    const page = inLanguage('ja', renderBookPage);
    expect(page.querySelector('.book-see a')?.getAttribute('href')).toMatch(/^\.\/help\.html#/);
  });

  it('writes its programs as programs, not in the text, and every one of them compiles', () => {
    const programs = BLOCKS.flatMap((block) =>
      block.kind === 'code' ? [block.code] : block.kind === 'scene' ? [block.scene.program] : block.kind === 'timeline' ? [block.timeline.program] : [],
    );
    expect(programs.length).toBeGreaterThan(5);
    for (const program of programs) expect(compileScript(program).ok, program).toBe(true);
    for (const text of allText()) expect(text).not.toContain('```');
  });

  it('shows each moment of a match before the match is over', () => {
    for (const block of BLOCKS) {
      if (block.kind !== 'scene') continue;
      const { recording } = recordFor(block.scene.stage, block.scene.program, block.scene.tick);
      expect(recording.snapshots.length, block.scene.program).toBeGreaterThan(block.scene.tick);
    }
  });

  it('never calls a part cheap or dear', () => {
    for (const text of allText()) expect(text).not.toMatch(/安い|安価|お得|cheap|expensive|bargain/i);
  });
});

describe('what the chapter on ticks says', () => {
  const ticks = (program: string, stage = RANGE, count = 6) => timelineRows({ stage, program, ticks: count });

  it('a tick runs on to its one action: drive takes no time, so it and fire share tick 2; after the last line nothing runs', () => {
    expect(ticks(TICK_BY_TICK)).toEqual([[1], [2, 3], [4], [5], [], []]);
  });

  it('drive is a setting: the robot keeps driving after the program is over', () => {
    const { recording } = recordFor(RANGE, TICK_BY_TICK, 6);
    const [, , , , , five, six] = recording.snapshots.map((snapshot) => snapshot.robots[0]);
    expect(six.x).not.toBe(five.x);
  });

  it('turn left 90 takes 15 ticks, half a second, at 6 degrees a tick', () => {
    expect(ROBOT_DEFAULTS.rotateSpeed / MATCH_DEFAULTS.tickRate).toBe(6);
    const rows = ticks(LONG_TURN, RANGE, 17);
    expect(rows.slice(0, 15)).toEqual(Array.from({ length: 15 }, () => [1]));
    expect(rows[15]).toEqual([1, 2]);
  });

  it('face enemy with the enemy right behind takes 30 ticks, a whole second, and is a quarter round at tick 15', () => {
    const rows = ticks(FACE_BEHIND, BEHIND, 31);
    expect(rows.slice(0, 30)).toEqual(Array.from({ length: 30 }, () => [1]));
    expect(rows[30]).toContain(2);
    const { recording } = recordFor(BEHIND, FACE_BEHIND, 15);
    const start = recording.snapshots[0].robots[0].rotation;
    expect(Math.abs(recording.snapshots[15].robots[0].rotation - start)).toBe(90);
  });

  it('a loop with two actions takes two ticks a round', () => {
    expect(ticks(TWO_TICK_LOOP)).toEqual([[1, 2], [3], [1, 2], [3], [1, 2], [3]]);
  });

  it('a loop without an action is stopped after 1000 lines, with a warning; the driving goes on', () => {
    const { recording } = recordFor(RANGE, NO_ACTION_LOOP, 2);
    expect(recording.snapshots[1].robots[0].executedLines.length).toBeGreaterThanOrEqual(1000);
    expect(recording.events.some((event) => event.tick === 1 && event.type === 'warning' && /without an action/.test(event.message))).toBe(true);
    expect(recording.snapshots[2].robots[0].x).not.toBe(recording.snapshots[0].robots[0].x);
  });

  it('a bullet flies 400 a second: the target 350 away is hit 24 ticks after fire; a gun needs 0.8 seconds between shots', () => {
    expect(ROBOT_DEFAULTS.shotSpeed).toBe(400);
    expect(ROBOT_DEFAULTS.shotCooldown).toBe(0.8);
    const { recording } = recordFor(RANGE, ONE_SHOT, 30);
    const [alpha, target] = recording.snapshots[0].robots;
    expect(Math.abs(target.x - alpha.x)).toBe(350);
    const hitAt = recording.snapshots.findIndex((snapshot) => snapshot.robots[1].hp < target.hp);
    expect(hitAt).toBe(24);
  });
});

describe('what the chapter on moving says', () => {
  it('one fire is one shot, then the program is over', () => {
    const { recording } = recordFor(RANGE, ONE_SHOT, 12);
    expect(recording.snapshots[12].bullets).toHaveLength(1);
    expect(recording.events.some((event) => event.type === 'warning' && /program finished/.test(event.message))).toBe(true);
  });

  it('with loop it keeps shooting: by tick 40 one shot has hit and the next is flying', () => {
    const { recording } = recordFor(RANGE, KEEP_FIRING, 40);
    expect(recording.snapshots[40].robots[1].hp).toBeLessThan(ROBOT_DEFAULTS.maxHp);
    expect(recording.snapshots[40].bullets.length).toBeGreaterThan(0);
  });

  it('drive forward alone drives on: three seconds in, the robot has gone 300 and is still going', () => {
    const { recording } = recordFor(TRACK, DRIVE_ON, 91);
    const at = (tick: number) => recording.snapshots[tick].robots[0].x;
    expect(Math.round(at(90) - at(0))).toBe(300);
    expect(at(91)).toBeGreaterThan(at(90));
  });

  it('turn left 90 then drive forward: facing right at the start, it drives up', () => {
    const { recording } = recordFor(QUARTER, TURN_THEN_DRIVE, 75);
    const [start, then] = [recording.snapshots[0].robots[0], recording.snapshots[75].robots[0]];
    expect(start.rotation).toBe(0);
    expect(then.y).toBeLessThan(start.y - 100);
    expect(Math.abs(then.x - start.x)).toBeLessThan(1);
  });
});
