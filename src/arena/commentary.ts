import type { Recording } from '../debug/recorder';
import { type MessageKey, t } from '../i18n/messages';
import type { MatchResult } from '../sim/simulation';
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
  kitEven: 2,
  kitContrast: 2,
  planAllOut: 2,
  planSplit: 2,
  planTurtle: 2,
  castleHit: 2,
  castleHalf: 2,
  castleBrink: 2,
  castleDestroyed: 2,
  wiped: 2,
  lastRobot: 2,
  wonTeam: 2,
  wonTeamJudgeCastle: 2,
  wonTeamJudgeHp: 2,
  wonTeamLastStand: 2,
  quietCastleLead: 2,
  quietTeamLead: 2,
  quietLead: 2,
  quietEven: 2,
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
/** ticks: in the climax (a castle near falling, a team wiped, the last seconds) the lines may come this close. */
const CLIMAX_GAP = 15;
/** A hit of this much damage or more is a big one. */
const BIG_HIT = 40;
/** HP between the two robots of a duel that makes a lead, and its turning round a comeback. */
const LEAD = 60;
/** Shots left that count as running low. */
const LOW_AMMO = 5;
/** sec before the end of the time when the last seconds are called. */
const LAST_SECONDS = 10;
/** sec into a team match when each side's plan is read from its movements. */
const PLAN_TIME = 3;
/** px a robot must have closed on the enemy castle by then to count among the attackers. */
const PLAN_ADVANCE = 80;
/** sec of silence after which the state of the match is summed up. */
const QUIET_SUMMARY = 15;


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
  const end = snapshots.length - 1;
  const lines: CommentaryLine[] = [];
  const line = (tick: number, kind: Kind, weight: number, params: Record<string, string | number> = {}): CommentaryLine => {
    const variant = 1 + (hash(seed, tick, kind) % VARIANTS[kind]);
    return { tick, text: t(`commentary.${kind}.${variant}` as MessageKey, params), weight };
  };
  const say = (tick: number, kind: Kind, weight: number, params: Record<string, string | number> = {}) => {
    lines.push(line(tick, kind, weight, params));
  };
  const nameOf = (id: string) => names[snapshots[0].robots.findIndex((robot) => robot.id === id)] ?? id;
  const teams = recording.teams;
  const teamMatch = teams !== undefined;
  const teamNameOf = (team: number) => teamNames?.[team] ?? `TEAM ${team + 1}`;
  const teamList = teams === undefined ? [] : [...new Set(teams)];
  const duel = names.length === 2 && !teamMatch;
  /** From here on the lines may come twice as fast: the match is boiling over. */
  let climaxFrom = Number.POSITIVE_INFINITY;

  if (teamMatch) say(0, 'startTeam', 3, { first: teamNameOf(0), second: teamNameOf(1), count: names.length / 2 });
  else say(0, duel ? 'start' : 'startRoyale', 3, { first: names[0], second: names[1] ?? '', names: names.join(' / '), count: names.length });

  // A duel of unlike machines gets its matchup read out; a mirror match its own word.
  if (duel && recording.stats.length === 2) {
    const [a, b] = recording.stats;
    const same = (['maxHp', 'moveSpeed', 'shotDamage', 'weaponRange', 'maxAmmo', 'sensorRange'] as const).every(
      (stat) => a[stat] === b[stat],
    );
    const tick = Math.min(45, end);
    if (same) say(tick, 'kitEven', 2, { first: names[0], second: names[1] });
    else if (a.maxHp > b.maxHp && a.moveSpeed < b.moveSpeed) say(tick, 'kitContrast', 2, { tank: names[0], runner: names[1] });
    else if (b.maxHp > a.maxHp && b.moveSpeed < a.moveSpeed) say(tick, 'kitContrast', 2, { tank: names[1], runner: names[0] });
  }

  // A castle match: a few seconds in, each side's plan is read from who has moved on the enemy castle.
  if (teamMatch && teamList.length === 2 && (recording.bases?.length ?? 0) === 2) {
    const planTick = Math.round(PLAN_TIME * tickRate);
    if (planTick < end - QUIET_GAP) {
      teamList.forEach((team, order) => {
        const enemyBase = recording.bases?.find((base) => base.team !== team);
        if (enemyBase === undefined) return;
        const centreX = enemyBase.rect.x + enemyBase.rect.width / 2;
        const centreY = enemyBase.rect.y + enemyBase.rect.height / 2;
        let members = 0;
        let attackers = 0;
        snapshots[planTick].robots.forEach((robot, index) => {
          if (teams?.[index] !== team || !robot.alive) return;
          members++;
          const spawn = snapshots[0].robots[index];
          const closed = Math.hypot(spawn.x - centreX, spawn.y - centreY) - Math.hypot(robot.x - centreX, robot.y - centreY);
          if (closed > PLAN_ADVANCE) attackers++;
        });
        if (members < 2) return;
        const tick = planTick + order * (QUIET_GAP + 15);
        const params = { team: teamNameOf(team), attackers, guards: members - attackers };
        if (attackers === members) say(tick, 'planAllOut', 2, params);
        else if (attackers === 0) say(tick, 'planTurtle', 2, params);
        else say(tick, 'planSplit', 2, params);
      });
    }
  }

  // The castles: the first blow on each, its half, the brink, and its fall.
  (recording.bases ?? []).forEach((base, index) => {
    let whole = true;
    let overHalf = true;
    let overBrink = true;
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
      } else if (overBrink && hp <= base.maxHp / 4) {
        overBrink = false;
        climaxFrom = Math.min(climaxFrom, tick);
        say(tick, 'castleBrink', 4, params);
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
    // The team calls, said a beat after the blow that caused them: down to one, and wiped out with the castle holding on.
    for (const team of teamList) {
      const living = (robots: readonly (typeof now)[number][]) =>
        robots.filter((robot, index) => teams?.[index] === team && robot.alive).length;
      const aliveNow = living(now);
      const aliveBefore = living(before);
      const sayTick = Math.min(tick + 20, end);
      if (aliveBefore >= 2 && aliveNow === 1) say(sayTick, 'lastRobot', 4, { team: teamNameOf(team) });
      if (aliveBefore > 0 && aliveNow === 0 && tick < end) {
        const baseIndex = recording.bases?.findIndex((base) => base.team === team) ?? -1;
        if (baseIndex >= 0 && snapshots[tick].bases[baseIndex] > 0) {
          climaxFrom = Math.min(climaxFrom, tick);
          say(sayTick, 'wiped', 4, { team: teamNameOf(team) });
        }
      }
    }
    if (duel && now.every((robot) => robot.alive)) {
      const gap = now[0].hp - now[1].hp;
      const ahead = gap >= LEAD ? 0 : gap <= -LEAD ? 1 : null;
      if (ahead !== null && leader !== null && ahead !== leader) say(tick, 'comeback', 3, { name: names[ahead], other: names[1 - ahead] });
      if (ahead !== null) leader = ahead;
    }
  }
  const lastSecondsTick = Math.round((maxMatchTime - LAST_SECONDS) * tickRate);
  if (lastSecondsTick > 0 && lastSecondsTick < snapshots.length - 1 && snapshots[lastSecondsTick].robots.filter((robot) => robot.alive).length > 1) {
    climaxFrom = Math.min(climaxFrom, lastSecondsTick);
    say(lastSecondsTick, 'lastSeconds', 3, { seconds: LAST_SECONDS });
  }
  const result = snapshots[end].result;
  if (result !== null) {
    if (result.winnerTeam !== undefined) {
      if (result.winnerTeam === null) say(end, 'drew', 4);
      else say(end, teamEnding(recording, result.winnerTeam, result.reason), 4, { name: teamNameOf(result.winnerTeam) });
    } else if (result.winnerId === null) say(end, 'drew', 4);
    else say(end, 'won', 4, { name: nameOf(result.winnerId) });
  }

  const kept = spaced(
    lines.sort((a, b) => a.tick - b.tick || b.weight - a.weight),
    climaxFrom,
  );
  return withSummaries(kept, recording, line, teamNameOf, names);
}

/** How a team's judged or outright win is told: the castle duel it won, the HP it kept, or the castle its wiped-out team left standing. */
function teamEnding(recording: Recording, winner: number, reason: MatchResult['reason']): Kind {
  if (reason !== 'timeout' && reason !== 'out of ammo') return 'wonTeam';
  const final = recording.snapshots[recording.snapshots.length - 1];
  const alive = final.robots.filter((robot, index) => recording.teams?.[index] === winner && robot.alive).length;
  if (alive === 0) return 'wonTeamLastStand';
  const baseHpOf = (team: number) => {
    const index = recording.bases?.findIndex((base) => base.team === team) ?? -1;
    return index >= 0 ? final.bases[index] : null;
  };
  const won = baseHpOf(winner);
  const lost = baseHpOf(1 - winner);
  if (won !== null && lost !== null && won > lost) return 'wonTeamJudgeCastle';
  return 'wonTeamJudgeHp';
}

/** Leaves out a line that comes too soon after another that is as loud or louder: the loudest of a moment is said. */
function spaced(lines: readonly CommentaryLine[], climaxFrom: number): CommentaryLine[] {
  const kept: CommentaryLine[] = [];
  for (const line of lines) {
    const last = kept[kept.length - 1];
    const gap = line.tick >= climaxFrom ? CLIMAX_GAP : QUIET_GAP;
    if (last !== undefined && line.tick - last.tick < gap && line.weight <= last.weight && line.weight < 4) continue;
    kept.push(line);
  }
  return kept;
}

/**
 * Fills a long silence with the state of the match: which castle, or which
 * side, stands better where nothing has happened for a while.
 */
function withSummaries(
  kept: readonly CommentaryLine[],
  recording: Recording,
  line: (tick: number, kind: Kind, weight: number, params?: Record<string, string | number>) => CommentaryLine,
  teamNameOf: (team: number) => string,
  names: readonly string[],
): CommentaryLine[] {
  const { snapshots, tickRate, teams } = recording;
  const silence = Math.round(QUIET_SUMMARY * tickRate);
  const filled: CommentaryLine[] = [];
  let lastTick: number | undefined;
  /** What the last summary amounted to: while nothing changes, there is nothing new to say. */
  let saidSummary: string | null = null;
  for (const next of kept) {
    while (lastTick !== undefined) {
      const tick = lastTick + silence;
      // Room to be read before the next line, and nothing to sum up once the match is deciding itself.
      if (tick + 2 * QUIET_GAP > next.tick || tick >= snapshots.length - 1) break;
      const summary = summaryAt(recording, tick, teamNameOf, names, teams);
      if (summary === null) break;
      lastTick = tick;
      const told = summary.kind + JSON.stringify(summary.params);
      if (told === saidSummary) continue;
      filled.push(line(tick, summary.kind, 1, summary.params));
      saidSummary = told;
    }
    filled.push(next);
    lastTick = next.tick;
    // Anything else said is news: afterwards the state is worth summing up again.
    saidSummary = null;
  }
  return filled;
}

/** What sums the match up at a tick, if its state says anything. */
function summaryAt(
  recording: Recording,
  tick: number,
  teamNameOf: (team: number) => string,
  names: readonly string[],
  teams: readonly number[] | undefined,
): { kind: Kind; params: Record<string, string | number> } | null {
  const snapshot = recording.snapshots[tick];
  if (teams !== undefined) {
    const teamList = [...new Set(teams)];
    if (teamList.length !== 2) return null;
    const baseHpOf = (team: number) => {
      const index = recording.bases?.findIndex((base) => base.team === team) ?? -1;
      return index >= 0 ? snapshot.bases[index] : null;
    };
    const castles = teamList.map(baseHpOf);
    if (castles[0] !== null && castles[1] !== null && castles[0] !== castles[1]) {
      const ahead = castles[0] > castles[1] ? 0 : 1;
      return { kind: 'quietCastleLead', params: { team: teamNameOf(teamList[ahead]) } };
    }
    const hpOf = (team: number) =>
      snapshot.robots.reduce((sum, robot, index) => sum + (teams[index] === team && robot.alive ? robot.hp : 0), 0);
    const totals = teamList.map(hpOf);
    if (Math.abs(totals[0] - totals[1]) >= LEAD) {
      const ahead = totals[0] > totals[1] ? 0 : 1;
      return { kind: 'quietTeamLead', params: { team: teamNameOf(teamList[ahead]) } };
    }
    return { kind: 'quietEven', params: {} };
  }
  const living = snapshot.robots.map((robot, index) => ({ robot, name: names[index] })).filter(({ robot }) => robot.alive);
  if (living.length !== 2) return null;
  const gap = living[0].robot.hp - living[1].robot.hp;
  if (Math.abs(gap) >= LEAD) return { kind: 'quietLead', params: { name: gap > 0 ? living[0].name : living[1].name } };
  return { kind: 'quietEven', params: {} };
}

/** A number from the seed, the moment and the kind of line: the same match picks the same wording. */
function hash(seed: number, tick: number, kind: string): number {
  let value = (seed ^ (tick * 2654435761)) >>> 0;
  for (let index = 0; index < kind.length; index++) value = (Math.imul(value, 31) + kind.charCodeAt(index)) >>> 0;
  return value;
}
