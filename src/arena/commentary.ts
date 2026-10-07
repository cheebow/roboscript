import type { Recording } from '../debug/recorder';
import { type MessageKey, t } from '../i18n/messages';
import { readHit } from './analysis';

/** One line of the commentary, said when the replay gets to its tick. */
export interface CommentaryLine {
  tick: number;
  text: string;
  /** Bigger is more worth saying: a quieter line close after a louder one is left out. */
  weight: number;
}

/** How many ways each kind of line can be said: keys `commentary.<kind>.<n>`, n from 1. */
const VARIANTS = {
  start: 3,
  startRoyale: 2,
  startTeam: 2,
  castleHit: 2,
  castleHalf: 2,
  castleDestroyed: 2,
  wonTeam: 2,
  sighted: 3,
  firstHit: 3,
  bigHit: 3,
  streak: 2,
  half: 3,
  danger: 3,
  guarded: 3,
  hiding: 3,
  lowAmmo: 2,
  comeback: 3,
  lastSeconds: 2,
  destroyed: 3,
  won: 3,
  drew: 2,
} as const;
type Kind = keyof typeof VARIANTS;

/** ticks: a quieter line this soon after another is left out, so the lines can be read. */
const QUIET_GAP = 30;
/** A hit of this much damage or more is a big one. */
const BIG_HIT = 40;
/** HP between the two robots of a duel that makes a lead, and its turning round a comeback. */
const LEAD = 60;
/** Shots left that count as running low. */
const LOW_AMMO = 5;
/** sec before the end of the time when the last seconds are called. */
const LAST_SECONDS = 10;


/**
 * The commentary of a recorded match, in the language of the screen: what
 * happened, worth saying, as it happened. Read from the recording only, so it
 * changes nothing; the same match is always told the same way (the wording is
 * picked by the match's seed).
 */
export function commentaryOf(
  recording: Recording,
  names: readonly string[],
  maxMatchTime: number,
  teamNames?: readonly string[],
): CommentaryLine[] {
  const { snapshots, tickRate, seed } = recording;
  const lines: CommentaryLine[] = [];
  const say = (tick: number, kind: Kind, weight: number, params: Record<string, string | number> = {}) => {
    const variant = 1 + (hash(seed, tick, kind) % VARIANTS[kind]);
    lines.push({ tick, text: t(`commentary.${kind}.${variant}` as MessageKey, params), weight });
  };
  const nameOf = (id: string) => names[snapshots[0].robots.findIndex((robot) => robot.id === id)] ?? id;
  const teamMatch = recording.teams !== undefined;
  const teamNameOf = (team: number) => teamNames?.[team] ?? `TEAM ${team + 1}`;
  const duel = names.length === 2 && !teamMatch;

  if (teamMatch) say(0, 'startTeam', 3, { first: teamNameOf(0), second: teamNameOf(1), count: names.length / 2 });
  else say(0, duel ? 'start' : 'startRoyale', 3, { first: names[0], second: names[1] ?? '', names: names.join(' / '), count: names.length });

  // The castles: the first blow on each, its half, and its fall.
  (recording.bases ?? []).forEach((base, index) => {
    let whole = true;
    let overHalf = true;
    for (let tick = 1; tick < snapshots.length; tick++) {
      const hp = snapshots[tick].bases[index] ?? base.maxHp;
      const before = snapshots[tick - 1].bases[index] ?? base.maxHp;
      if (hp >= before) continue;
      const params = { team: teamNameOf(base.team) };
      if (hp <= 0) {
        say(tick, 'castleDestroyed', 4, params);
        break;
      }
      if (whole) {
        whole = false;
        say(tick, 'castleHit', 2, params);
      } else if (overHalf && hp <= base.maxHp / 2) {
        overHalf = false;
        say(tick, 'castleHalf', 3, params);
      }
    }
  });

  // From the hits in the log: who hit whom, how hard, and whether it was braced against.
  const hitsBy = new Map<string, number>();
  let lastShooter: string | null = null;
  let firstHit = true;
  for (const event of recording.events) {
    const hit = readHit(event);
    if (hit === null) continue;
    const { targetId: target, damage, hp } = hit;
    const guarded = hit.guarded ? true : undefined;
    const shooter = nameOf(hit.shooterId);
    const victim = nameOf(target);
    const maxHp = recording.stats[snapshots[0].robots.findIndex((robot) => robot.id === target)]?.maxHp ?? 200;
    const before = hp + damage;
    const streak = lastShooter === shooter ? (hitsBy.get(shooter) ?? 0) + 1 : 1;
    hitsBy.set(shooter, streak);
    lastShooter = shooter;
    const params = { shooter, victim, damage, hp };
    if (hp <= 0) continue;
    if (guarded !== undefined) say(event.tick, 'guarded', 3, params);
    else if (firstHit) say(event.tick, 'firstHit', 2, params);
    else if (before > maxHp / 4 && hp <= maxHp / 4) say(event.tick, 'danger', 3, params);
    else if (before > maxHp / 2 && hp <= maxHp / 2) say(event.tick, 'half', 2, params);
    else if (damage >= BIG_HIT) say(event.tick, 'bigHit', 2, params);
    else if (streak === 3) say(event.tick, 'streak', 1, params);
    firstHit = false;
  }

  // From the snapshots: sightings, hiding, ammo, the lead of a duel, the end.
  const sighted = new Set<string>();
  const lowOnAmmo = new Set<string>();
  let leader: number | null = null;
  for (let tick = 1; tick < snapshots.length; tick++) {
    const now = snapshots[tick].robots;
    const before = snapshots[tick - 1].robots;
    now.forEach((robot, index) => {
      const name = names[index];
      if (robot.alive && robot.enemyVisible && !sighted.has(name)) {
        sighted.add(name);
        say(tick, 'sighted', 1, { name, enemy: robot.targetId === null ? '' : nameOf(robot.targetId) });
      }
      if (robot.alive && robot.recovering && !before[index].recovering) say(tick, 'hiding', 2, { name });
      if (robot.alive && robot.ammo <= LOW_AMMO && robot.ammo > 0 && !lowOnAmmo.has(name)) {
        lowOnAmmo.add(name);
        say(tick, 'lowAmmo', 1, { name, ammo: robot.ammo });
      }
      if (!robot.alive && before[index].alive) say(tick, 'destroyed', 4, { name });
    });
    if (duel && now.every((robot) => robot.alive)) {
      const gap = now[0].hp - now[1].hp;
      const ahead = gap >= LEAD ? 0 : gap <= -LEAD ? 1 : null;
      if (ahead !== null && leader !== null && ahead !== leader) say(tick, 'comeback', 3, { name: names[ahead], other: names[1 - ahead] });
      if (ahead !== null) leader = ahead;
    }
  }
  const lastSecondsTick = Math.round((maxMatchTime - LAST_SECONDS) * tickRate);
  if (lastSecondsTick > 0 && lastSecondsTick < snapshots.length - 1 && snapshots[lastSecondsTick].robots.filter((robot) => robot.alive).length > 1) {
    say(lastSecondsTick, 'lastSeconds', 3, { seconds: LAST_SECONDS });
  }
  const end = snapshots.length - 1;
  const result = snapshots[end].result;
  if (result !== null) {
    if (result.winnerTeam !== undefined) {
      if (result.winnerTeam === null) say(end, 'drew', 4);
      else say(end, 'wonTeam', 4, { name: teamNameOf(result.winnerTeam) });
    } else if (result.winnerId === null) say(end, 'drew', 4);
    else say(end, 'won', 4, { name: nameOf(result.winnerId) });
  }

  return spaced(lines.sort((a, b) => a.tick - b.tick || b.weight - a.weight));
}

/** Leaves out a line that comes too soon after another that is as loud or louder: the loudest of a moment is said. */
function spaced(lines: readonly CommentaryLine[]): CommentaryLine[] {
  const kept: CommentaryLine[] = [];
  for (const line of lines) {
    const last = kept[kept.length - 1];
    if (last !== undefined && line.tick - last.tick < QUIET_GAP && line.weight <= last.weight && line.weight < 4) continue;
    kept.push(line);
  }
  return kept;
}

/** A number from the seed, the moment and the kind of line: the same match picks the same wording. */
function hash(seed: number, tick: number, kind: string): number {
  let value = (seed ^ (tick * 2654435761)) >>> 0;
  for (let index = 0; index < kind.length; index++) value = (Math.imul(value, 31) + kind.charCodeAt(index)) >>> 0;
  return value;
}
