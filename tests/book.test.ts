// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compileScript } from '../src/ai/roboscript';
import { BOOK, CHAPTERS, MATCHUP_ARENAS, RIVALS, matchupOf } from '../src/book/chapters';
import { matchCount, matchupRecords } from '../src/book/matchups';
import { BROADSIDE } from '../src/book/stages';
import { ARENAS } from '../src/data/arenas';
import { COST_LIMIT, PARTS, SLOTS, STANDARD_LOADOUT, type Slot, statsOf } from '../src/data/parts';
import { TEMPLATES } from '../src/data/templates';
import type { Stage } from '../src/tutorial/types';
import {
  AIM_AHEAD,
  AIM_AT_ENEMY,
  COUNT_HITS,
  DRIVE_ON,
  FACE_BEHIND,
  FIRE_FIRST,
  GUARD_AT_HIT,
  GUARD_FIRST,
  GUARD_ON_SIGHT,
  HIDE_AND_REST,
  JUST_LOOK,
  KEEP_FIRING,
  LONG_TURN,
  NO_ACTION_LOOP,
  NO_GUARD,
  ONE_SHOT,
  SEARCH_AND_SHOOT,
  SEARCH_AND_SHOOT_IN_FUNCTIONS,
  SHOOT_ON_THE_MOVE,
  STUCK,
  TICK_BY_TICK,
  TIMED_DRIVE,
  TURN_AND_CHECK,
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
        ? [block.code]
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
