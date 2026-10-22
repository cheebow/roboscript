// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { BOOK, CHAPTERS, GUARD_CASE, GUARD_CASE_SHOWN, GUARD_FIXED, LOST_MATCH, TRACK_CASE, TRACK_CASE_SHOWN, MATCHUP_ARENAS, MATCHUP_SEEDS, RIVALS, TEAMS, TEAM_ARENAS, TEAM_SIZE, WON_MATCH, againstDumbBot, growMatchupOf, matchupOf, teamMatchupOf } from '../src/book/chapters';
import { analyzeReplay, playReplay } from '../src/book/replays';
import { SHOTS } from '../src/book/shots';
import { matchCount, matchupRecords } from '../src/book/matchups';
import { BROADSIDE } from '../src/book/stages';
import { CHALLENGES, type ChallengeResult, linesOf, playChallenge } from '../src/challenge';
import { ARENAS, CASTLE_ARENAS } from '../src/data/arenas';
import { TEAM_TEMPLATES, findTeamTemplate } from '../src/data/team_templates';
import { TEAM_DEFAULT_LOADOUT, castleHpFor, teamCostLimitFor } from '../src/data/castle';
import { prepareCastleFight } from '../src/arena/castle_match';
import { Simulation } from '../src/sim/simulation';
import { COST_LIMIT, PARTS, SLOTS, STANDARD_LOADOUT, type Slot, costOf, statsOf } from '../src/data/parts';
import { TEMPLATES, findTemplate } from '../src/data/templates';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { type MessageKey, t } from '../src/i18n/messages';
import type { Stage } from '../src/tutorial/types';
import {
  AIM_AHEAD,
  AIM_AT_ENEMY,
  COUNT_HITS,
  DRIVE_ON,
  FACE_BEHIND,
  FIRE_FIRST,
  GROW_1,
  GROW_2,
  GROW_3,
  GROW_4,
  GROW_HIDE,
  GUARD_AT_HIT,
  GUARD_FIRST,
  GUARD_ON_SIGHT,
  GUARD_ON_TOP,
  GUARD_UNDER,
  HIDE_AND_REST,
  JUST_LOOK,
  KEEP_FIRING,
  LONG_TURN,
  NO_ACTION_LOOP,
  NO_GUARD,
  ONE_SHOT,
  SAMPLE_SAME,
  SAMPLE_SOONER,
  SEARCH_AND_SHOOT,
  SEARCH_AND_SHOOT_IN_FUNCTIONS,
  SHOOT_ON_THE_MOVE,
  STUCK,
  TICK_BY_TICK,
  TIMED_DRIVE,
  TRACK_NO_ACTION,
  TURN_AND_CHECK,
  TURN_FIRST,
  TURN_THEN_DRIVE,
  TWO_TICK_LOOP,
  UNSTUCK,
  UNTIL_SEEN,
  WITHIN_RANGE,
} from '../src/book/examples';
import { readingsRows, recordFor, timelineRows } from '../src/book/scenes';
import type { BookBlock } from '../src/book/types';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { HELP } from '../src/help/topics';
import { type Language, useLanguage } from '../src/i18n/language';
import { renderBookPage } from '../src/pages/book_page';
import { BEHIND, CORNER, FAR, HIDDEN, MOVING, QUARTER, RANGE, SHELTER, SHOT_AT, TRACK } from '../src/tutorial/stages';

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
    ...BLOCKS.flatMap((block) => (block.kind === 'challenge' ? block.hints.flatMap((hint) => [hint.en, hint.ja]) : [])),
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
    expect(page.querySelectorAll('figure.book-figure > figcaption')).toHaveLength(pictures);
    expect(page.querySelectorAll('.book-scene')).toHaveLength(BLOCKS.filter((block) => block.kind === 'scene' || block.kind === 'replay').length);
    expect(page.querySelectorAll('table.book-readings')).toHaveLength(BLOCKS.filter((block) => block.kind === 'readings').length);
    expect(page.querySelectorAll('.book-error-message').length).toBeGreaterThanOrEqual(BLOCKS.filter((block) => block.kind === 'error').length);
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
      block.kind === 'code'
        ? typeof block.code === 'string'
          ? [block.code]
          : [block.code.en, block.code.ja]
        : block.kind === 'scene'
          ? [block.scene.program]
          : block.kind === 'timeline'
            ? [block.timeline.program]
            : block.kind === 'readings'
              ? [block.readings.program]
              : [],
    );
    expect(programs.length).toBeGreaterThan(5);
    for (const program of programs) expect(compileScript(program).ok, program).toBe(true);
    // The programs shown with their errors are wrong on purpose.
    for (const block of BLOCKS) if (block.kind === 'error') expect(compileScript(block.program).ok, block.program).toBe(false);
    for (const text of allText()) expect(text).not.toContain('```');
  });

  it('shows each moment of a match before the match is over', () => {
    for (const block of BLOCKS) {
      if (block.kind !== 'scene') continue;
      const { recording } = recordFor(block.scene.stage, block.scene.program, block.scene.tick);
      expect(recording.snapshots.length, block.scene.program).toBeGreaterThan(block.scene.tick);
    }
  });

  it('points only to chapters there are', () => {
    for (const text of allText()) {
      for (const [, number] of text.matchAll(/(?:Chapter |第 )(\d+)/g)) expect(Number(number), text.slice(0, 60)).toBeLessThanOrEqual(CHAPTERS.length);
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

describe('the error shown', () => {
  it.each([
    ['en', 'Line 1: Expected indented block'],
    ['ja', '1 行目: 字下げしたブロックが必要'],
  ] as const)('is the game\'s own message, in the language of the page (%s)', (language, first) => {
    const page = inLanguage(language, renderBookPage);
    expect(page.querySelector('#debugging .book-error-message')?.textContent).toBe(first);
  });
});

describe('what the chapter on sensors says', () => {
  it('a robot that only waits reads a moving target as in sight, its distance and angle changing tick by tick', () => {
    const rows = readingsRows({ stage: MOVING, program: JUST_LOOK, ticks: [1, 10, 20, 30, 40], sensors: ['enemy_visible', 'enemy_distance', 'enemy_angle'] });
    for (const row of rows) expect(row[0]).toBe(true);
    for (let at = 1; at < rows.length; at++) {
      expect(rows[at][1]).not.toBe(rows[at - 1][1]);
      expect(rows[at][2]).not.toBe(rows[at - 1][2]);
    }
  });

  it('the target behind the block is out of sight', () => {
    const { recording } = recordFor(HIDDEN, JUST_LOOK, 1);
    expect(recording.snapshots[1].robots[0].enemyVisible).toBe(false);
  });
});

describe('what the chapter on if says', () => {
  it('drives past the block, then stops and shoots the target down', () => {
    const { recording } = recordFor(HIDDEN, SEARCH_AND_SHOOT, 600);
    expect(recording.snapshots[200].robots[0].driving).toBe('stop');
    expect(recording.snapshots[200].robots[0].enemyVisible).toBe(true);
    expect(recording.snapshots.some((snapshot) => !snapshot.robots[1].alive)).toBe(true);
  });

  it('while: drives until it sees the target, stops, and fires one shot', () => {
    const { recording } = recordFor(HIDDEN, UNTIL_SEEN, 200);
    const seen = recording.snapshots.findIndex((snapshot, tick) => tick > 0 && snapshot.robots[0].enemyVisible);
    expect(recording.snapshots[seen + 1].robots[0].driving).toBe('stop');
    expect(recording.events.filter((event) => event.robotId === recording.snapshots[0].robots[0].id && event.type === 'action' && /fire/.test(event.message))).toHaveLength(1);
  });

  it('the order is the priority: shooting first never guards and draws; guarding first guards four times and loses', () => {
    const play = (program: string) => {
      const { recording } = recordFor(SHOT_AT, program, 1200);
      const last = recording.snapshots[recording.snapshots.length - 1];
      const fell = (index: number) => recording.snapshots.findIndex((snapshot) => !snapshot.robots[index].alive);
      return { guardsLeft: last.robots[0].guards, alphaFell: fell(0), bravoFell: fell(1) };
    };
    const fireFirst = play(FIRE_FIRST);
    expect(fireFirst.guardsLeft).toBe(ROBOT_DEFAULTS.maxGuards);
    expect(fireFirst.alphaFell).toBeGreaterThan(0);
    expect(fireFirst.bravoFell).toBe(fireFirst.alphaFell);
    const guardFirst = play(GUARD_FIRST);
    expect(ROBOT_DEFAULTS.maxGuards).toBe(4);
    expect(guardFirst.guardsLeft).toBe(0);
    expect(guardFirst.alphaFell).toBeGreaterThan(0);
    expect(guardFirst.bravoFell).toBe(-1);
  });

  it('turning in a loop checks for bullets on every tick', () => {
    for (const lines of timelineRows({ stage: BEHIND, program: TURN_AND_CHECK, ticks: 6 })) expect(lines.slice(0, 2)).toEqual([1, 2]);
  });
});

describe('what the chapter on variables says', () => {
  it('counting 60 ticks drives exactly two seconds, 200, then stops', () => {
    const { recording } = recordFor(TRACK, TIMED_DRIVE, 90);
    const x = (tick: number) => recording.snapshots[tick].robots[0].x;
    expect(Math.round(x(90) - x(0))).toBe(200);
    expect(x(61)).toBe(x(90));
    expect(x(60)).toBeGreaterThan(x(59));
  });

  it('backs off after the third hit, and not before', () => {
    const { recording } = recordFor(SHOT_AT, COUNT_HITS, 110);
    const backing = recording.snapshots.findIndex((snapshot) => snapshot.robots[0].driving === 'backward');
    expect(recording.snapshots[backing].robots[0].hp).toBe(ROBOT_DEFAULTS.maxHp - 3 * ROBOT_DEFAULTS.shotDamage);
    expect(recording.snapshots[backing - 1].robots[0].driving).not.toBe('backward');
    expect(recording.snapshots[110].robots[0].driving).toBe('backward');
  });
});

describe('what the chapter on functions says', () => {
  it('giving the parts names plays exactly the same match', () => {
    const track = (program: string) =>
      recordFor(HIDDEN, program, 600).recording.snapshots.map((snapshot) => snapshot.robots.map((robot) => `${robot.x},${robot.y},${robot.rotation},${robot.hp}`).join(' '));
    expect(track(SEARCH_AND_SHOOT_IN_FUNCTIONS)).toEqual(track(SEARCH_AND_SHOOT));
  });

  it('drives until the target is in range, then stops and shoots', () => {
    const { recording } = recordFor(FAR, WITHIN_RANGE, 120);
    const stopped = recording.snapshots.findIndex((snapshot, tick) => tick > 0 && snapshot.robots[0].driving === 'stop');
    expect(recording.snapshots[stopped].robots[0].enemyDistance).toBeLessThanOrEqual(ROBOT_DEFAULTS.weaponRange + 5);
    expect(recording.snapshots[1].robots[0].enemyDistance).toBeGreaterThan(ROBOT_DEFAULTS.weaponRange);
    expect(recording.snapshots[120].robots[1].hp).toBeLessThan(ROBOT_DEFAULTS.maxHp);
  });
});

describe('what the chapter on debugging says', () => {
  it('without a check it stays at the wall; turning when blocked, it drives on along it', () => {
    const at = (program: string, tick: number) => recordFor(CORNER, program, 300).recording.snapshots[tick].robots[0];
    expect(at(STUCK, 150).x).toBe(at(STUCK, 300).x);
    expect(at(STUCK, 150).y).toBe(at(STUCK, 300).y);
    expect(at(UNSTUCK, 300).x - at(UNSTUCK, 150).x).toBeGreaterThan(200);
    expect(at(UNSTUCK, 300).label).toBe('GO');
  });
});

describe('what Part 2 says about the built-in robots', () => {
  // Each pair once, both ways round from one table: the same matches the page plays.
  const results = new Map<string, { wins: number; losses: number }>();
  const record = (robot: string, opponent: string) => {
    const key = `${robot}>${opponent}`;
    if (!results.has(key)) {
      const [played] = matchupRecords({ ...matchupOf(robot as (typeof RIVALS)[number]), opponents: [opponent] });
      results.set(key, played);
      results.set(`${opponent}>${robot}`, { wins: played.losses, losses: played.wins });
    }
    return results.get(key)!;
  };
  const beats = (robot: string, opponent: string) => {
    const { wins, losses } = record(robot, opponent);
    return wins > losses;
  };

  it('the tables play real arenas and real robots, 12 matches an opponent', () => {
    for (const id of MATCHUP_ARENAS) expect(ARENAS.some((arena) => arena.id === id), id).toBe(true);
    for (const id of RIVALS) expect(TEMPLATES.some((template) => template.id === id), id).toBe(true);
    expect(matchCount({ ...matchupOf('dumb_bot'), opponents: ['sentry_bot'] })).toBe(12);
  });

  it.each([
    ['guard_bot', 'cover_bot'],
    ['cover_bot', 'sentry_bot'],
    ['sentry_bot', 'strafe_bot'],
    ['strafe_bot', 'guard_bot'],
  ])('goes round in a ring: %s beats %s', (robot, opponent) => {
    expect(beats(robot, opponent)).toBe(true);
  });

  it.each([
    ['dumb_bot', ['cover_bot', 'aggressive_bot'], ['sentry_bot', 'strafe_bot', 'hit_and_hide_bot']],
    ['coward_bot', ['dumb_bot', 'aggressive_bot'], ['guard_bot', 'cover_bot', 'hit_and_hide_bot', 'strafe_bot']],
    ['guard_bot', ['dumb_bot', 'coward_bot', 'cover_bot'], ['strafe_bot', 'sentry_bot']],
    ['cover_bot', ['sentry_bot', 'strafe_bot'], ['dumb_bot', 'guard_bot']],
    ['hit_and_hide_bot', ['sentry_bot', 'strafe_bot', 'coward_bot'], ['guard_bot', 'cover_bot', 'aggressive_bot']],
    ['strafe_bot', ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot'], ['sentry_bot', 'cover_bot', 'hit_and_hide_bot']],
    ['sentry_bot', ['strafe_bot'], ['cover_bot', 'hit_and_hide_bot']],
  ])('%s beats %j and loses to %j', (robot, winsOver, losesTo) => {
    for (const opponent of winsOver) expect(beats(robot, opponent), opponent).toBe(true);
    for (const opponent of losesTo) expect(beats(opponent, robot), opponent).toBe(true);
  });

  it('AggressiveBot has the worst record, and beats HitAndHideBot alone', () => {
    const total = (robot: string) => RIVALS.filter((other) => other !== robot).reduce((sum, other) => sum + record(robot, other).wins, 0);
    const worst = Math.min(...RIVALS.map(total));
    expect(total('aggressive_bot')).toBe(worst);
    expect(RIVALS.filter((other) => other !== 'aggressive_bot' && beats('aggressive_bot', other))).toEqual(['hit_and_hide_bot']);
  });
});

describe('what the chapter on shooting says', () => {
  const tally = (stage: Stage, program: string, ticks = 600) => {
    const { recording } = recordFor(stage, program, ticks);
    const [alpha, target] = recording.snapshots[0].robots.map((robot) => robot.id);
    return {
      shots: recording.events.filter((event) => event.robotId === alpha && event.type === 'action' && /^fire/.test(event.message)).length,
      hits: recording.events.filter((event) => event.type === 'hit' && event.hit?.targetId === target).length,
      down: recording.snapshots.some((snapshot) => !snapshot.robots[1].alive),
    };
  };

  it('at a moving target: aim enemy hits 3 of 27; aim lead hits 10 of 13 and brings it down', () => {
    expect(tally(MOVING, AIM_AT_ENEMY)).toEqual({ shots: 27, hits: 3, down: false });
    expect(tally(MOVING, AIM_AHEAD)).toEqual({ shots: 13, hits: 10, down: true });
  });

  it('at a target standing still: 10 of 12 standing, 3 of 24 on the move', () => {
    expect(tally(BROADSIDE, AIM_AT_ENEMY)).toMatchObject({ shots: 12, hits: 10 });
    expect(tally(BROADSIDE, SHOOT_ON_THE_MOVE)).toMatchObject({ shots: 24, hits: 3 });
  });

  it('a shot strays 5 times as far on the move; 350 away, standing, it always stays within the enemy', () => {
    expect(ROBOT_DEFAULTS.movingShotSpread / ROBOT_DEFAULTS.shotSpread).toBe(5);
    const reach = ROBOT_DEFAULTS.radius + ROBOT_DEFAULTS.bulletRadius;
    expect(350 * Math.tan((ROBOT_DEFAULTS.shotSpread * Math.PI) / 180)).toBeLessThan(reach);
    expect(350 * Math.tan((ROBOT_DEFAULTS.movingShotSpread * Math.PI) / 180)).toBeGreaterThan(reach * 2);
  });

  it('Walker and Hover legs stray less on the move', () => {
    const moving = (legs: string) => statsOf({ ...STANDARD_LOADOUT, legs }).movingShotSpread;
    expect(moving('walker')).toBeLessThan(moving('standard'));
    expect(moving('hover')).toBeLessThan(moving('standard'));
  });
});

describe('what the chapter on defence says', () => {
  const fight = (program: string) => {
    const { recording } = recordFor(SHOT_AT, program, 1200);
    const last = recording.snapshots[recording.snapshots.length - 1];
    const alpha = recording.snapshots[0].robots[0].id;
    const damage = recording.events.filter((event) => event.type === 'hit' && event.hit?.targetId === alpha).reduce((sum, event) => sum + (event.hit?.damage ?? 0), 0);
    return { alphaAlive: last.robots[0].alive, bravoAlive: last.robots[1].alive, hp: last.robots[0].hp, guardsLeft: last.robots[0].guards, damage };
  };

  it('no guard: a draw; guarding on sight: four guards for nothing, and a loss; guarding at the hit: a win with 10 HP', () => {
    expect(fight(NO_GUARD)).toMatchObject({ alphaAlive: false, bravoAlive: false });
    expect(fight(GUARD_ON_SIGHT)).toMatchObject({ alphaAlive: false, bravoAlive: true, guardsLeft: 0, damage: ROBOT_DEFAULTS.maxHp });
    expect(fight(GUARD_AT_HIT)).toMatchObject({ alphaAlive: true, bravoAlive: false, hp: 10 });
    expect(ROBOT_DEFAULTS.guardRecovery).toBe(0.3);
  });

  it('hiding: down to 100 HP, then all the way back to 200, resting out of sight at tick 280', () => {
    const { recording } = recordFor(SHELTER, HIDE_AND_REST, 600);
    const hp = recording.snapshots.map((snapshot) => snapshot.robots[0].hp);
    expect(Math.min(...hp)).toBe(100);
    expect(hp[hp.length - 1]).toBe(ROBOT_DEFAULTS.maxHp);
    expect(hp[280]).toBeGreaterThan(hp[260]);
    expect(recording.snapshots[280].robots[0].driving).toBe('stop');
    expect(ROBOT_DEFAULTS.recoveryRate).toBe(20);
    expect(ROBOT_DEFAULTS.recoveryDelay).toBe(0.5);
  });
});

describe('what the chapter on parts says', () => {
  const part = (slot: Slot, id: string) => PARTS.find((candidate) => candidate.slot === slot && candidate.id === id)!;
  const gun = (id: string) => statsOf({ ...STANDARD_LOADOUT, gun: id });

  it('standard parts cost 3 each, which is the limit of 12 exactly; a part of cost 4 needs one of cost 2', () => {
    expect(COST_LIMIT).toBe(12);
    for (const slot of SLOTS) expect(part(slot, 'standard').cost).toBe(3);
    expect(Math.max(...PARTS.map((candidate) => candidate.cost))).toBe(4);
    expect(Math.min(...PARTS.map((candidate) => candidate.cost))).toBe(2);
  });

  it('Rapid and Cannon do more damage a second than the standard gun; Cannon bullets are slower; Pistol reaches less and costs 2', () => {
    const perSecond = (id: string) => gun(id).shotDamage / gun(id).shotCooldown;
    expect(perSecond('rapid')).toBeGreaterThan(perSecond('standard'));
    expect(perSecond('cannon')).toBeGreaterThan(perSecond('standard'));
    expect(gun('rapid').shotDamage).toBeLessThan(gun('standard').shotDamage);
    expect(gun('cannon').shotSpeed).toBeLessThan(gun('standard').shotSpeed);
    expect(gun('pistol').weaponRange).toBeLessThan(gun('standard').weaponRange);
    expect(part('gun', 'pistol').cost).toBe(2);
  });

  it('Short sees no further than 300; Scope only the 120 degrees ahead', () => {
    expect(statsOf({ ...STANDARD_LOADOUT, sensor: 'short' }).sensorRange).toBe(300);
    expect(statsOf({ ...STANDARD_LOADOUT, sensor: 'scope' }).sensorAngle).toBe(120);
  });

  it('shows every part of each slot', () => {
    const page = inLanguage('ja', renderBookPage);
    const rows = page.querySelectorAll('#parts table.book-parts tr');
    expect(rows.length).toBe(PARTS.length + SLOTS.length);
  });
});

describe('what the chapter on the challenges says', () => {
  const hinted = BLOCKS.flatMap((block) => (block.kind === 'challenge' ? [block] : []));

  it('has hints for every challenge of the game, in its order, once each', () => {
    expect(hinted.map((block) => block.challenge)).toEqual(CHALLENGES.map((challenge) => challenge.id));
    for (const block of hinted) {
      expect(block.hints.length, block.challenge).toBeGreaterThan(0);
      for (const hint of block.hints) expect(hint.en.trim() !== '' && hint.ja.trim() !== '', block.challenge).toBe(true);
    }
  });

  it.each(['en', 'ja'] as const)('shows each challenge with its first hint open and the rest folded, in %s', (language) => {
    const page = inLanguage(language, renderBookPage);
    const shown = page.querySelectorAll('.book-challenge');
    expect(shown).toHaveLength(CHALLENGES.length);
    shown.forEach((box, at) => {
      expect(box.querySelector('h3')?.textContent).toContain(CHALLENGES[at].title[language]);
      expect(box.querySelectorAll('div.book-hint')).toHaveLength(1);
      expect(box.querySelectorAll('details.book-hint')).toHaveLength(hinted[at].hints.length - 1);
    });
  });

  // The programs the hints lead to are kept here, out of the book: the hints tell the way, not the answer.
  const find = (id: string) => {
    const challenge = CHALLENGES.find((each) => each.id === id);
    if (challenge === undefined) throw new Error(`no challenge ${id}`);
    return challenge;
  };
  const template = (id: string) => {
    const found = TEMPLATES.find((each) => each.id === id);
    if (found === undefined) throw new Error(`no template ${id}`);
    return found.source;
  };
  const play = (id: string, source: string, parts = {}): ChallengeResult => {
    const result = playChallenge(find(id), source, parts);
    if ('errors' in result) throw new Error(result.errors.join(' '));
    return result;
  };
  /** Stands where it is, and aims and fires. */
  const STAND = 'loop\n    aim enemy\n    fire\n';
  /** Drives at the enemy until it is in range, then stops and shoots. */
  const CLOSE_IN = `loop
    if enemy_visible and enemy_distance < weapon_range - 50
        drive stop
        aim enemy
        fire
    else if enemy_visible
        face enemy
        drive forward
        wait
    else
        drive forward
        if blocked
            turn left
        wait
`;
  /** Looks for the enemy, turning at walls; once it sees it, stops, aims and fires. */
  const HUNT = `loop
    if enemy_visible
        drive stop
        if aim_angle > 2 or aim_angle < -2
            aim enemy
        else
            fire
    else
        drive forward
        if blocked
            turn left
        wait
`;
  /** The hunter that also turns to whoever shot it. */
  const HUNT_THE_SHOOTER = HUNT.replace('    else\n        drive forward', '    else if hit\n        face hit\n        drive forward\n    else\n        drive forward');

  it('first win: standing draws; searching without turning at walls draws; searching and turning, aiming first, wins', () => {
    expect(play('first-win', STAND)).toMatchObject({ cleared: false });
    expect(play('first-win', STAND).why?.en).toMatch(/draw/i);
    expect(play('first-win', SEARCH_AND_SHOOT)).toMatchObject({ cleared: false });
    expect(play('first-win', HUNT)).toMatchObject({ cleared: true });
  });

  it('pistol: driving at DumbBot loses; waiting for it wins', () => {
    expect(play('pistol', CLOSE_IN)).toMatchObject({ cleared: false });
    expect(play('pistol', STAND)).toMatchObject({ cleared: true });
  });

  it('untouchable: the standard gun reaches 400, a Cannon 520 and costs 4; 3 lines with a Cannon and a part of cost 2 clear it', () => {
    expect(statsOf(STANDARD_LOADOUT).weaponRange).toBe(400);
    const cannon = PARTS.find((part) => part.slot === 'gun' && part.id === 'cannon');
    expect(cannon?.cost).toBe(4);
    expect(statsOf({ ...STANDARD_LOADOUT, gun: 'cannon' }).weaponRange).toBe(520);
    expect(costOf({ ...STANDARD_LOADOUT, gun: 'cannon' })).toBeGreaterThan(COST_LIMIT);
    expect(linesOf(STAND)).toBe(3);
    expect(play('untouchable', STAND)).toMatchObject({ cleared: false });
    expect(play('untouchable', STAND, { gun: 'cannon', sensor: 'scope' })).toMatchObject({ cleared: true });
    expect(play('untouchable', STAND, { gun: 'cannon', body: 'light' })).toMatchObject({ cleared: true });
  });

  it('short route: 5 lines get round the block, turning left or right', () => {
    for (const way of ['left', 'right']) {
      const source = `loop\n    drive forward\n    if blocked\n        turn ${way}\n    wait\n`;
      expect(linesOf(source)).toBe(5);
      expect(play('short-route', source), way).toMatchObject({ cleared: true });
    }
  });

  it('a small victory: aiming and firing wins with 60 HP; with a Cannon and a Scope, at exactly 100', () => {
    expect(linesOf(STAND)).toBe(3);
    expect(play('small-victory', STAND)).toMatchObject({ cleared: true, record: { hp: 60 } });
    const reach = play('small-victory', STAND, { gun: 'cannon', sensor: 'scope' });
    expect(reach).toMatchObject({ cleared: true, record: { hp: 100 } });
    expect(reach.stars).toBe(3);
  });

  it('against the clock: driving at SentryBot loses; standing and shooting wins in about 10 seconds', () => {
    expect(play('speed-sentry', CLOSE_IN)).toMatchObject({ cleared: false });
    const standing = play('speed-sentry', STAND);
    expect(standing.cleared).toBe(true);
    expect(standing.record.seconds).toBeGreaterThan(9.5);
    expect(standing.record.seconds).toBeLessThan(11);
  });

  it('hide and heal: hiding once hurt clears it; hiding from the start does not', () => {
    expect(play('hide-and-heal', HIDE_AND_REST)).toMatchObject({ cleared: true });
    const atOnce = `loop
    if hidden
        drive stop
        wait
    else
        face cover
        drive forward
        wait
`;
    expect(play('hide-and-heal', atOnce)).toMatchObject({ cleared: false });
  });

  it('iron guard: the guarding of Chapter 11 wins but guards too few times; one action a round clears it', () => {
    const chapter11 = play('guard-wall', GUARD_AT_HIT);
    expect(chapter11.cleared).toBe(false);
    expect(chapter11.why?.en).toMatch(/guard/i);
    expect(chapter11.record.hp).toBeGreaterThan(0);
    const oneAction = `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else if aim_angle > 2 or aim_angle < -2
        aim enemy
    else
        fire
`;
    expect(play('guard-wall', oneAction)).toMatchObject({ cleared: true });
  });

  it('short sight: shooting only what it sees loses; turning to the shooter wins', () => {
    expect(statsOf({ ...STANDARD_LOADOUT, sensor: 'short' }).sensorRange).toBe(300);
    expect(play('short-sight', HUNT)).toMatchObject({ cleared: false });
    expect(play('short-sight', HUNT_THE_SHOOTER)).toMatchObject({ cleared: true });
  });

  it('strafe buster: SentryBot\'s program wins in about 11 seconds; standing and shooting wins untouched in 37', () => {
    const sentry = play('strafe-buster', template('sentry_bot'));
    expect(sentry.cleared).toBe(true);
    expect(Math.round(sentry.record.seconds)).toBe(11);
    const standing = play('strafe-buster', STAND);
    expect(standing.cleared).toBe(true);
    expect(standing.record.hp).toBe(statsOf(STANDARD_LOADOUT).maxHp);
    expect(Math.round(standing.record.seconds)).toBe(37);
  });

  it('light and fast: driving at AggressiveBot loses; standing wins with 40 HP; StrafeBot\'s program with 140', () => {
    expect(play('light-body', CLOSE_IN)).toMatchObject({ cleared: false });
    expect(play('light-body', STAND)).toMatchObject({ cleared: true, record: { hp: 40 } });
    expect(play('light-body', template('strafe_bot'))).toMatchObject({ cleared: true, record: { hp: 140 } });
  });

  it('three lines only: standard parts win at 100 HP; Heavy with Short keeps 120; a Cannon with a Scope keeps 140 and both stars', () => {
    expect(play('three-lines', STAND)).toMatchObject({ cleared: true, record: { hp: 100 } });
    expect(costOf({ ...STANDARD_LOADOUT, body: 'heavy', sensor: 'short' })).toBeLessThanOrEqual(COST_LIMIT);
    expect(play('three-lines', STAND, { body: 'heavy', sensor: 'short' })).toMatchObject({ cleared: true, record: { hp: 120 } });
    expect(costOf({ ...STANDARD_LOADOUT, gun: 'cannon', sensor: 'scope' })).toBeLessThanOrEqual(COST_LIMIT);
    const cannon = play('three-lines', STAND, { gun: 'cannon', sensor: 'scope' });
    expect(cannon).toMatchObject({ cleared: true, record: { hp: 140 } });
    expect(cannon.stars).toBe(3);
  });

  it('sharpshooter: DumbBot has 200 HP; aiming first clears it with the standard gun; a Cannon, at 45 a shot, in 8 shots or fewer', () => {
    expect(statsOf(STANDARD_LOADOUT).maxHp).toBe(200);
    expect(statsOf(STANDARD_LOADOUT).shotDamage).toBe(20);
    expect(statsOf({ ...STANDARD_LOADOUT, gun: 'cannon' }).shotDamage).toBe(45);
    expect(play('sharpshooter', HUNT)).toMatchObject({ cleared: true });
    const cannon = play('sharpshooter', HUNT, { gun: 'cannon', body: 'light' });
    expect(cannon.cleared).toBe(true);
    expect(find('sharpshooter').stars[0]).toEqual({ kind: 'shots', max: 8 });
    expect(cannon.starsMet[0]).toBe(true);
  });

  it('the ten-line hunter: standing never kills; the 12-line hunter kills in 42 s; the gate can go, the turn at obstacles cannot; a Rapid takes both stars', () => {
    expect(play('ten-line-hunter', STAND)).toMatchObject({ cleared: false });
    expect(linesOf(HUNT)).toBe(12);
    const full = play('ten-line-hunter', HUNT);
    expect(full.cleared).toBe(false);
    expect(full.why?.en).toMatch(/lines/);
    expect(Math.round(full.record.seconds)).toBe(42);
    const lean = find('ten-line-hunter').answer;
    expect(linesOf(lean)).toBe(10);
    expect(play('ten-line-hunter', lean)).toMatchObject({ cleared: true });
    // The other way to save two lines, keeping the aim gate and dropping the turn at obstacles, never gets the kill.
    const keepGate = HUNT.replace('        if blocked\n            turn left\n', '');
    expect(linesOf(keepGate)).toBe(10);
    expect(play('ten-line-hunter', keepGate)).toMatchObject({ cleared: false });
    const rapid = play('ten-line-hunter', lean, { gun: 'rapid' });
    expect(rapid).toMatchObject({ cleared: true, record: { hp: 182 } });
    expect(Math.round(rapid.record.seconds)).toBe(65);
    expect(rapid.stars).toBe(3);
  });

  it('putting it all together: driving at SentryBot loses; standing wins with 40 HP; CoverBot\'s program with 162', () => {
    expect(play('final', CLOSE_IN)).toMatchObject({ cleared: false });
    expect(play('final', STAND)).toMatchObject({ cleared: true, record: { hp: 40 } });
    expect(play('final', template('cover_bot'))).toMatchObject({ cleared: true, record: { hp: 162 } });
  });

  it('the champion: Short, Heavy; SentryBot\'s program wins with Sprint, Cannon and Scope, and loses without the Sprint', () => {
    expect(find('champion').stage.botLoadout).toMatchObject({ body: 'heavy', sensor: 'short' });
    expect(statsOf({ ...STANDARD_LOADOUT, sensor: 'scope' }).sensorRange).toBeGreaterThan(520);
    expect(play('champion', template('sentry_bot'), { legs: 'sprint', gun: 'cannon', sensor: 'scope' })).toMatchObject({ cleared: true });
    expect(play('champion', template('sentry_bot'), { gun: 'cannon', sensor: 'scope' })).toMatchObject({ cleared: false });
  });

  it('bring the base down: shelling the base alone brings it down without a hit taken', () => {
    const challenge = find('castle-fall');
    expect(challenge.answer).not.toContain('enemy_visible');
    expect(play('castle-fall', challenge.answer)).toMatchObject({ cleared: true, starsMet: [true, true] });
    expect(challenge.stars[1]).toEqual({ kind: 'noHit' });
  });

  it('call by name: BaseCaptain calls machine 2 alone with signal 1 to 2, and clears it', () => {
    const captain = TEAM_TEMPLATES.find((each) => each.id === 'base_captain');
    expect(captain?.source).toContain('signal 1 to 2');
    expect(captain?.source).toContain('self_id');
    expect(play('base-call-by-name', captain?.source ?? '')).toMatchObject({ cleared: true });
  });
});

describe('what the chapter on the base battle says', () => {
  it('plays real team templates on real base maps', () => {
    for (const id of TEAMS) expect(findTeamTemplate(id), id).toBeDefined();
    for (const id of TEAM_ARENAS) expect(CASTLE_ARENAS.some((arena) => arena.id === id), id).toBe(true);
    for (const block of BLOCKS) if (block.kind === 'template') expect(TEMPLATES.some((each) => each.id === block.template) || findTeamTemplate(block.template) !== undefined, block.template).toBe(true);
  });

  it('a base has 200 HP; 3 machines share a limit of 32; every machine starts with a Light body and a Pistol, cost 10', () => {
    expect(castleHpFor(TEAM_SIZE)).toBe(200);
    expect(teamCostLimitFor(TEAM_SIZE)).toBe(32);
    expect(TEAM_DEFAULT_LOADOUT).toMatchObject({ body: 'light', gun: 'pistol' });
    expect(costOf(TEAM_DEFAULT_LOADOUT)).toBe(10);
  });

  it('BaseSplit splits by self_id; BaseCall gathers with signal 1; BaseCaptain calls machine 2 alone', () => {
    expect(findTeamTemplate('castle_split')?.source).toContain('if self_id == 1');
    expect(findTeamTemplate('castle_call')?.source).toContain('signal 1');
    expect(findTeamTemplate('castle_call')?.source).toContain('ally_signal');
    expect(findTeamTemplate('base_captain')?.source).toContain('signal 1 to 2');
  });

  /** Every match of the first team against the second, from both ends, as the tables play them. */
  const matches = (first: string, second: string) =>
    TEAM_ARENAS.flatMap((arena) =>
      MATCHUP_SEEDS.flatMap((seed) =>
        [true, false].map((firstAtFront) => {
          const kit = Array.from({ length: TEAM_SIZE }, () => TEAM_DEFAULT_LOADOUT);
          const a = { name: 'A', source: findTeamTemplate(first)?.source ?? '', loadouts: kit };
          const b = { name: 'B', source: findTeamTemplate(second)?.source ?? '', loadouts: kit };
          const definition = CASTLE_ARENAS.find((each) => each.id === arena);
          if (definition === undefined) throw new Error(arena);
          const prepared = prepareCastleFight(firstAtFront ? [a, b] : [b, a], definition, TEAM_SIZE, seed);
          if (!prepared.ok) throw new Error(prepared.problems.join(' '));
          const simulation = new Simulation(prepared.fight.config);
          while (simulation.result === null) simulation.step();
          const [own, other] = firstAtFront ? [0, 1] : [1, 0];
          const alive = (team: number) => simulation.robots.filter((robot, index) => Math.floor(index / TEAM_SIZE) === team && robot.alive).length;
          const baseHp = (team: number) => simulation.bases.find((base) => base.team === team)?.hp ?? 0;
          return {
            arena,
            won: simulation.result.winnerTeam === own,
            reason: simulation.result.reason,
            seconds: simulation.tick / MATCH_DEFAULTS.tickRate,
            alive: [alive(own), alive(other)],
            bases: [baseHp(own), baseHp(other)],
          };
        }),
      ),
    );

  it('the ring: BaseRunner, BaseTurtle and BaseSplit each beat the next in every match', () => {
    for (const [winner, loser] of [['castle_runner', 'castle_turtle'], ['castle_turtle', 'castle_split'], ['castle_split', 'castle_runner']]) {
      const record = matchupRecords(teamMatchupOf(winner as (typeof TEAMS)[number])).find((each) => each.opponent === loser);
      expect(record, `${winner} against ${loser}`).toMatchObject({ wins: 12, losses: 0, draws: 0 });
    }
  });

  it('BaseRunner against BaseTurtle: the base falls within 15 seconds or so; on Castle Lanes the runners are all destroyed, and win on time with 60 off the base', () => {
    for (const match of matches('castle_runner', 'castle_turtle')) {
      expect(match.won).toBe(true);
      if (match.arena === 'castle_lanes') {
        expect(match).toMatchObject({ reason: 'timeout', alive: [0, TEAM_SIZE], bases: [200, 140] });
      } else {
        expect(match.reason).toBe('base destroyed');
        expect(match.seconds).toBeLessThan(16);
      }
    }
  });

  it('BaseTurtle against BaseSplit: time up every match, both bases untouched', () => {
    for (const match of matches('castle_turtle', 'castle_split')) expect(match).toMatchObject({ won: true, reason: 'timeout', bases: [200, 200] });
  });

  it('BaseSplit against BaseRunner: its base is sometimes worn down, but the runners are all destroyed every time and their base falls', () => {
    const played = matches('castle_split', 'castle_runner');
    for (const match of played) {
      expect(match).toMatchObject({ won: true, reason: 'base destroyed' });
      expect(match.alive[1]).toBe(0);
    }
    expect(played.some((match) => match.bases[0] < 200)).toBe(true);
  });

  it('BaseCall beats most teams, and loses more than it wins to BaseRunner', () => {
    const records = matchupRecords(teamMatchupOf('castle_call'));
    expect(records.filter((record) => record.wins > record.losses).length).toBeGreaterThanOrEqual(5);
    const runner = records.find((record) => record.opponent === 'castle_runner');
    expect((runner?.losses ?? 0) > (runner?.wins ?? 0)).toBe(true);
  });
});

describe('what the chapter on growing a strategy says', () => {
  const rounds = [GROW_1, GROW_2, GROW_3, GROW_4, GROW_HIDE].map((source) => matchupRecords(growMatchupOf({ en: '', ja: '' }, source)));
  const wins = (records: { wins: number }[]) => records.reduce((sum, record) => sum + record.wins, 0);
  const against = (records: { opponent: string; wins: number; losses: number }[], id: string) => {
    const record = records.find((each) => each.opponent === id);
    if (record === undefined) throw new Error(id);
    return record;
  };
  const [first, second, third, fourth, hiding] = rounds;

  it('plays the same 96 matches as Chapter 9', () => {
    expect(matchCount(growMatchupOf({ en: '', ja: '' }, GROW_1))).toBe(96);
  });

  it('wins 56, then 63, 68 and 76; hiding brings it down to 61', () => {
    expect(rounds.map(wins)).toEqual([56, 63, 68, 76, 61]);
  });

  it('round 1 loses to StrafeBot, CoverBot and HitAndHideBot, and beats the rest', () => {
    const lost = first.filter((record) => record.losses > record.wins).map((record) => record.opponent);
    expect(lost.sort()).toEqual(['cover_bot', 'hit_and_hide_bot', 'strafe_bot']);
  });

  it('round 2: StrafeBot from 5 wins to 11, and everyone beaten before still beaten', () => {
    expect([against(first, 'strafe_bot').wins, against(second, 'strafe_bot').wins]).toEqual([5, 11]);
    for (const record of first) if (record.wins > record.losses) expect(against(second, record.opponent).wins > against(second, record.opponent).losses, record.opponent).toBe(true);
  });

  it('round 3: the first wins against HitAndHideBot; round 4: from 2 to 9', () => {
    expect(against(second, 'hit_and_hide_bot').wins).toBe(0);
    expect(against(third, 'hit_and_hide_bot').wins).toBe(2);
    expect(against(fourth, 'hit_and_hide_bot').wins).toBe(9);
  });

  it('CoverBot is never beaten by round 4; hiding loses to AggressiveBot, beaten every time before', () => {
    expect(against(fourth, 'cover_bot').wins).toBe(0);
    expect(against(fourth, 'aggressive_bot')).toMatchObject({ wins: 12, losses: 0 });
    expect(against(hiding, 'aggressive_bot').losses).toBeGreaterThanOrEqual(10);
  });
});

describe('what the chapter on finding out why it lost says', () => {
  const chapter = CHAPTERS.find((each) => each.id === 'finding-out')!;
  const chapterText = (language: Language) => chapter.blocks.flatMap((block) => ('text' in block ? [block.text[language]] : [])).join('\n');
  const lost = playReplay(LOST_MATCH).recording;
  const won = playReplay(WON_MATCH).recording;
  const firstHurt = (recording: typeof lost, robot: number) => recording.snapshots.findIndex((snapshot) => snapshot.robots[robot].hp < 200);
  const firstFire = (recording: typeof lost, robotId: string) =>
    recording.events.find((event) => event.type === 'action' && event.message === 'fire' && event.robotId === robotId)!;

  it('comes between the base battle and growing a strategy, as Chapter 15', () => {
    expect(CHAPTERS.indexOf(chapter)).toBe(14);
    expect(CHAPTERS[15].id).toBe('growing');
  });

  it('plays the Sample against DumbBot on Open Field with seed 1, as the program screen names them; the Sample loses', () => {
    expect(LOST_MATCH.program).toBe(findTemplate('sample')?.source);
    expect(findTemplate('sample')?.name).toBe('Sample');
    expect(findTemplate(LOST_MATCH.bravo)?.name).toBe('DumbBot');
    expect(ARENAS.find((arena) => arena.id === LOST_MATCH.arena)?.name).toBe('Open Field');
    expect(LOST_MATCH.seed).toBe(1);
    expect(lost.snapshots.at(-1)?.result?.winnerId).toBe('BRAVO');
  });

  it('the Sample beats DumbBot once in 12; with 300, 10 of 12 are draws; with 320 it wins 11', () => {
    const against = (source: string) => matchupRecords(againstDumbBot({ en: 'x', ja: 'x' }, source))[0];
    expect(against(SAMPLE_AI)).toMatchObject({ wins: 1, losses: 11, draws: 0 });
    expect(against(SAMPLE_SAME)).toMatchObject({ draws: 10 });
    expect(against(SAMPLE_SOONER)).toMatchObject({ wins: 11, losses: 1 });
  });

  it('the analysis: the Sample hit with 9 of 10, DumbBot with 10 of 10; a shot takes 20 of 200; the Sample is hurt first', () => {
    const [alpha, bravo] = analyzeReplay(LOST_MATCH).robots;
    expect([alpha.hits, alpha.shots, bravo.hits, bravo.shots]).toEqual([9, 10, 10, 10]);
    expect(ROBOT_DEFAULTS.shotDamage).toBe(20);
    expect(ROBOT_DEFAULTS.maxHp).toBe(200);
    expect(firstHurt(lost, 0)).toBeLessThan(firstHurt(lost, 1));
    // The analysis is shown at the moment of the first hit: the Sample has been hit, DumbBot not yet.
    const shown = chapter.blocks.find((block) => block.kind === 'replay' && block.replay === LOST_MATCH && block.panel?.kind === 'analysis');
    expect(shown?.kind === 'replay' && shown.tick).toBe(firstHurt(lost, 0));
  });

  it('the log: DumbBot goes to ATTACK and fires at 2.000 seconds; the Sample fires first at 2.500, as it is first hit (hp=180)', () => {
    const attack = lost.events.find((event) => event.robotId === 'BRAVO' && event.message === 'label TRACK -> ATTACK');
    expect(attack?.timestamp).toBe(2);
    expect(firstFire(lost, 'BRAVO').timestamp).toBe(2);
    expect(firstFire(lost, 'ALPHA').timestamp).toBe(2.5);
    const hit = lost.events.find((event) => event.type === 'hit' && event.robotId === 'BRAVO');
    expect(hit?.timestamp).toBe(2.5);
    expect(hit?.message).toContain('hp=180');
    // All of it in the part of the log the book shows.
    for (const block of chapter.blocks) if (block.kind === 'replay' && block.panel?.kind === 'log') expect(block.panel.until).toBeGreaterThanOrEqual(hit!.tick);
  });

  it('the debugger: line 15 first runs at 2.500; at 2.000 the Sample goes by line 12 to the else, with distance 250 and the enemy just under 300', () => {
    expect(SAMPLE_AI.split('\n')[14].trim()).toBe('fire');
    expect(SAMPLE_AI.split('\n')[11].trim()).toBe('if enemy_distance < distance');
    expect(SAMPLE_AI.split('\n').slice(15, 18).map((line) => line.trim())).toEqual(['else', 'label TRACK', 'drive forward']);
    expect(SAMPLE_AI).toContain('attack(250)');
    const at = firstFire(lost, 'BRAVO').tick;
    expect(lost.snapshots.findIndex((snapshot) => snapshot.robots[0].executedLines.includes(15)) / MATCH_DEFAULTS.tickRate).toBe(2.5);
    const lines = lost.snapshots[at].robots[0].executedLines;
    expect(lines).toContain(12);
    expect(lines).toContain(17);
    expect(lines).not.toContain(15);
    // DumbBot fires from closer than 300: the Sample reads the same distance, so it is under 300 and not yet under 250.
    expect(findTemplate('dumb_bot')?.source).toContain('if enemy_distance < 300');
    const distance = lost.snapshots[at].robots[0].enemyDistance;
    expect(distance).toBeGreaterThan(290);
    expect(distance).toBeLessThan(300);
  });

  it('with attack(320) the Sample fires first, and DumbBot is hurt first', () => {
    expect(SAMPLE_SOONER).toContain('attack(320)');
    expect(firstFire(won, 'ALPHA').tick).toBeLessThan(firstFire(won, 'BRAVO').tick);
    expect(firstHurt(won, 1)).toBeLessThan(firstHurt(won, 0));
    expect(won.snapshots.at(-1)?.result?.winnerId).toBe('ALPHA');
  });

  it('shows each moment of its matches before the match is over', () => {
    for (const block of chapter.blocks) {
      if (block.kind !== 'replay') continue;
      expect(playReplay(block.replay).recording.snapshots.length).toBeGreaterThan(block.tick);
      expect(compileScript(block.replay.program).ok).toBe(true);
    }
  });

  it('names the game\'s buttons, columns and kinds of row as the game does, in both languages', () => {
    const keys: MessageKey[] = [
      'toolbar.run', 'toolbar.debug', 'editor.loadTemplate', 'analysis.tab.analysis', 'panel.inspector', 'panel.watch', 'transport.play', 'transport.pause',
      'analysis.accuracy', 'analysis.dealt', 'analysis.taken', 'analysis.guarded', 'analysis.recovered', 'analysis.distance', 'analysis.sighted',
      'log.type.sensor', 'log.type.ai', 'log.type.action', 'log.type.hit', 'log.type.warning', 'log.type.system', 'log.type.error',
    ];
    for (const language of ['en', 'ja'] as const) {
      useLanguage(language);
      try {
        const written = chapterText(language).toLowerCase();
        for (const key of keys) expect(written, `${language} ${key}`).toContain(t(key).toLowerCase());
      } finally {
        useLanguage('en');
      }
    }
  });

  it('quotes the warnings as the game words them', () => {
    const reporter = Object.values(import.meta.glob('../src/sim/event_reporter.ts', { query: '?raw', import: 'default', eager: true }))[0] as string;
    for (const warning of ['program finished', 'too many lines without an action', 'program stopped: its calls went too deep', 'out of ammo', 'out of guards', 'no teammate has that number']) {
      expect(reporter).toContain(warning);
      expect(chapterText('ja')).toContain(warning);
    }
  });

  it('numbers the picture of the debugger 1 to 12, and goes through every number', () => {
    expect(SHOTS.debugger.marks?.map((mark) => mark.n)).toEqual(Array.from({ length: 12 }, (_, at) => at + 1));
    for (const language of ['en', 'ja'] as const) {
      for (let n = 1; n <= 12; n++) expect(chapterText(language)).toMatch(new RegExp(`^\\| ${n} \\|`, 'm'));
    }
    const page = inLanguage('ja', renderBookPage);
    expect(page.querySelectorAll('.book-shot-mark')).toHaveLength(12);
    expect(page.querySelector('#finding-out img.book-shot')?.getAttribute('src')).toContain('ja');
  });


  describe('its two cases', () => {
    const trackCase = playReplay(TRACK_CASE).recording;
    const guardCase = playReplay(GUARD_CASE).recording;
    const guardFixed = playReplay(GUARD_FIXED).recording;
    const turned = playReplay({ ...LOST_MATCH, program: TURN_FIRST }).recording;
    const lineOf = (source: string, line: number) => source.split('\n')[line - 1].trim();
    /** In how many ticks the line ran, as the number left of it says. */
    const ranIn = (recording: typeof lost, line: number) => recording.snapshots.filter((snapshot) => snapshot.robots[0].executedLines.includes(line)).length;
    const actions = ['turn', 'aim', 'fire', 'guard', 'wait', 'face'];

    it('the tables of matches: 1-10-1; turning first, 10 draws; the guard under the if, the same; the guard on top, 9-3', () => {
      const against = (source: string) => matchupRecords(againstDumbBot({ en: 'x', ja: 'x' }, source))[0];
      expect(against(TRACK_NO_ACTION)).toMatchObject({ wins: 1, losses: 10, draws: 1 });
      expect(against(TURN_FIRST)).toMatchObject({ wins: 1, losses: 1, draws: 10 });
      expect(against(GUARD_UNDER)).toMatchObject({ wins: 1, losses: 1, draws: 10 });
      expect(against(GUARD_ON_TOP)).toMatchObject({ wins: 9, losses: 3, draws: 0 });
    });

    it('case 1: lost by one shot, 9 of 10 against 10 of 10; the warning at 0.033 seconds, in the part of the log shown', () => {
      expect(trackCase.snapshots.at(-1)?.result?.winnerId).toBe('BRAVO');
      const [alpha, bravo] = analyzeReplay(TRACK_CASE).robots;
      expect([alpha.hits, alpha.shots, bravo.hits, bravo.shots]).toEqual([9, 10, 10, 10]);
      const warnings = trackCase.events.filter((event) => event.type === 'warning' && event.robotId === 'ALPHA');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('too many lines without an action');
      expect(warnings[0].timestamp.toFixed(3)).toBe('0.033');
      const shown = chapter.blocks.find((block) => block.kind === 'replay' && block.replay === TRACK_CASE);
      expect(shown?.kind === 'replay' && shown.panel?.kind === 'log' && shown.panel.until).toBeGreaterThan(firstFire(trackCase, 'ALPHA').tick);
    });

    it('case 1: at 2.000 DumbBot fires and our robot turns (line 5); it fires at 2.033 (line 7), the moment shown', () => {
      expect(lineOf(TRACK_NO_ACTION, 5)).toBe('turn enemy');
      expect(lineOf(TRACK_NO_ACTION, 7)).toBe('fire');
      expect(firstFire(trackCase, 'BRAVO').timestamp).toBe(2);
      const turn = trackCase.events.find((event) => event.robotId === 'ALPHA' && event.message === 'turn enemy');
      expect([turn?.timestamp, turn?.sourceLine]).toEqual([2, 5]);
      const fire = firstFire(trackCase, 'ALPHA');
      expect([fire.timestamp.toFixed(3), fire.sourceLine]).toEqual(['2.033', 7]);
      expect(TRACK_CASE_SHOWN).toBe(fire.tick);
    });

    it('case 1: on the way in only lines 1-3 and 8-10 run, none an action; 59 ticks of lines 9 and 10, none from 11 on; ROTATION stays 180', () => {
      const tracking = trackCase.snapshots.filter((snapshot) => snapshot.robots[0].label === 'TRACK');
      expect(tracking).toHaveLength(59);
      for (const snapshot of tracking) {
        expect([...new Set(snapshot.robots[0].executedLines)].sort((a, b) => a - b)).toEqual([1, 2, 3, 8, 9, 10]);
        expect(snapshot.robots[0].rotation).toBe(180);
      }
      for (const line of [1, 2, 3, 8, 9, 10]) expect(actions.some((action) => lineOf(TRACK_NO_ACTION, line).startsWith(action))).toBe(false);
      expect([ranIn(trackCase, 9), ranIn(trackCase, 10)]).toEqual([59, 59]);
      for (let line = 11; line <= 17; line++) expect(ranIn(trackCase, line)).toBe(0);
      // DumbBot turns to the enemy on its way in.
      expect(findTemplate('dumb_bot')?.source).toMatch(/turn enemy\n\n\s+if enemy_distance < 300/);
    });

    it('case 1 mended: turn enemy is line 3; no warning; it fires at 2.000 with DumbBot, and the two go down together', () => {
      expect(lineOf(TURN_FIRST, 3)).toBe('turn enemy');
      expect(TURN_FIRST.replace('        turn enemy\n', '')).toBe(TRACK_NO_ACTION.replace('            turn enemy\n', ''));
      expect(turned.events.filter((event) => event.type === 'warning')).toHaveLength(0);
      expect(firstFire(turned, 'ALPHA').tick).toBe(firstFire(turned, 'BRAVO').tick);
      expect(firstFire(turned, 'ALPHA').timestamp).toBe(2);
      expect(turned.snapshots.at(-1)?.result?.winnerId).toBeNull();
    });

    it('case 2: the mended robot with a guard under the if; guarded 0, no guard row; line 11 never read', () => {
      expect(GUARD_UNDER.replace(/ {4}else if bullet_incoming.*\n.*guard\n/, '')).toBe(TURN_FIRST);
      expect(lineOf(GUARD_UNDER, 2)).toBe('if enemy_visible');
      expect(lineOf(GUARD_UNDER, 11)).toBe('else if bullet_incoming and bullet_distance < 36');
      expect(lineOf(GUARD_UNDER, 12)).toBe('guard');
      expect(GUARD_UNDER).toContain('bullet_incoming and bullet_distance < 36');
      expect(analyzeReplay(GUARD_CASE).robots[0].guarded).toBe(0);
      expect(guardCase.events.some((event) => event.message === 'guard')).toBe(false);
      expect(ranIn(guardCase, 11)).toBe(0);
      expect(ranIn(guardCase, 12)).toBe(0);
    });

    it('case 2: shown at the first hit; a tick before, at 2.600, a bullet is coming and the enemy in sight; so all 10 times', () => {
      expect(GUARD_CASE_SHOWN).toBe(firstHurt(guardCase, 0));
      const before = guardCase.snapshots[GUARD_CASE_SHOWN - 1].robots[0];
      expect(((GUARD_CASE_SHOWN - 1) / MATCH_DEFAULTS.tickRate).toFixed(3)).toBe('2.600');
      expect(before.incomingBullet).not.toBeNull();
      expect(before.enemyVisible).toBe(true);
      const close = guardCase.snapshots.filter((snapshot) => (snapshot.robots[0].incomingBullet?.distance ?? Infinity) < 36);
      expect(close).toHaveLength(10);
      expect(close.every((snapshot) => snapshot.robots[0].enemyVisible)).toBe(true);
    });

    it('case 2 mended: 9-3; one guard, at 2.633, the first shot taking 10 not 20; DumbBot down first, 10 HP left; 4 guards to use', () => {
      expect(lineOf(GUARD_ON_TOP, 2)).toBe('if bullet_incoming and bullet_distance < 36');
      expect(analyzeReplay(GUARD_FIXED).robots[0].guarded).toBe(1);
      const guards = guardFixed.events.filter((event) => event.robotId === 'ALPHA' && event.message === 'guard');
      expect(guards.map((event) => event.timestamp.toFixed(3))).toEqual(['2.633']);
      const firstHit = guardFixed.events.find((event) => event.type === 'hit' && event.robotId === 'BRAVO');
      expect(firstHit?.timestamp.toFixed(3)).toBe('2.633');
      expect(firstHit?.message).toContain('damage=10');
      const end = guardFixed.snapshots.at(-1)!;
      expect(end.result?.winnerId).toBe('ALPHA');
      expect(end.robots[0].hp).toBe(10);
      expect(ROBOT_DEFAULTS.maxGuards).toBe(4);
      expect(GUARD_CASE_SHOWN).toBe(guards[0].tick);
    });
  });

  it('numbers the lines of its programs, without putting the numbers into the text', () => {
    const page = inLanguage('ja', renderBookPage);
    const listings = [...page.querySelectorAll('#finding-out pre.book-code')];
    const shown = listings.find((listing) => listing.textContent === GUARD_UNDER.replace(/\n$/, ''));
    expect(shown?.querySelectorAll('.book-code-line')).toHaveLength(GUARD_UNDER.trimEnd().split('\n').length);
  });

  it('puts the game\'s own analysis and log in the page', () => {
    const page = inLanguage('ja', renderBookPage);
    const section = page.querySelector('#finding-out')!;
    expect(section.querySelectorAll('.book-replay .analysis-table')).toHaveLength(4);
    const [first, second] = [...section.querySelectorAll('.book-log')];
    expect(first.querySelectorAll('.log-row').length).toBe(lost.events.filter((event) => event.tick <= 100).length);
    // Rows after the moment shown are pale.
    expect(first.querySelectorAll('.log-row.future').length).toBe(lost.events.filter((event) => event.tick > 60 && event.tick <= 100).length);
    const trackCase = playReplay(TRACK_CASE).recording;
    expect(second.querySelectorAll('.log-row').length).toBe(trackCase.events.filter((event) => event.tick <= 90).length);
    expect(second.textContent).toContain('too many lines without an action');
  });
});
