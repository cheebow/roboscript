import type { DebugEvent } from '../debug/debug_event';
import type { Recording } from '../debug/recorder';
import type { Vec2 } from '../sim/types';

/** A hit, as the log tells it: who shot, who was hit, how hard, and whether it was braced against. */
export interface LoggedHit {
  tick: number;
  shooterId: string;
  targetId: string;
  damage: number;
  hp: number;
  guarded: boolean;
}

const HIT = /^(\S+) damage=(\d+) hp=(\d+)( \(guarded\))?$/;

/** The hit a log event tells of; null for any other event. */
export function readHit(event: DebugEvent): LoggedHit | null {
  if (event.type !== 'hit' || event.robotId === null) return null;
  const match = HIT.exec(event.message);
  if (match === null) return null;
  return { tick: event.tick, shooterId: event.robotId, targetId: match[1], damage: Number(match[2]), hp: Number(match[3]), guarded: match[4] !== undefined };
}

/** How one robot did in a match. */
export interface RobotAnalysis {
  id: string;
  name: string;
  shots: number;
  hits: number;
  damageDealt: number;
  damageTaken: number;
  /** Hits taken while guarding. */
  guarded: number;
  /** HP got back by resting out of sight. */
  recovered: number;
  /** How far it drove. */
  distance: number;
  /** Share (0..1) of the time it was standing that it could see an enemy. */
  sighted: number;
  /** HP at each sample of the match. */
  hp: number[];
}

/** A hit, where it happened: where the shooter and the robot hit stood. */
export interface HitPlace {
  tick: number;
  shooter: number;
  target: number;
  from: Vec2;
  at: Vec2;
}

export interface MatchAnalysis {
  robots: RobotAnalysis[];
  hits: HitPlace[];
  /** Ticks between two samples of the HP. */
  sampleEvery: number;
  ticks: number;
  tickRate: number;
}

/** About this many samples of the HP, however long the match. */
const SAMPLES = 120;

/** How each robot did, worked out from the recording only. */
export function analyze(recording: Recording, names: readonly string[]): MatchAnalysis {
  const { snapshots, events, tickRate } = recording;
  const ids = snapshots[0].robots.map((robot) => robot.id);
  const indexOf = (id: string) => ids.indexOf(id);
  const last = snapshots.length - 1;
  const sampleEvery = Math.max(1, Math.ceil(last / SAMPLES));
  const robots: RobotAnalysis[] = ids.map((id, index) => ({
    id,
    name: names[index] ?? id,
    shots: 0,
    hits: 0,
    damageDealt: 0,
    damageTaken: 0,
    guarded: 0,
    recovered: 0,
    distance: 0,
    sighted: 0,
    hp: [],
  }));

  const hits: HitPlace[] = [];
  for (const event of events) {
    if (event.type === 'action' && event.message === 'fire' && event.robotId !== null) {
      const shooter = robots[indexOf(event.robotId)];
      if (shooter !== undefined) shooter.shots++;
      continue;
    }
    const hit = readHit(event);
    if (hit === null) continue;
    const shooter = indexOf(hit.shooterId);
    const target = indexOf(hit.targetId);
    if (shooter < 0 || target < 0) continue;
    robots[shooter].hits++;
    robots[shooter].damageDealt += hit.damage;
    robots[target].damageTaken += hit.damage;
    if (hit.guarded) robots[target].guarded++;
    const at = snapshots[Math.min(hit.tick, last)].robots;
    hits.push({ tick: hit.tick, shooter, target, from: { x: at[shooter].x, y: at[shooter].y }, at: { x: at[target].x, y: at[target].y } });
  }

  const standing = ids.map(() => 0);
  const seeing = ids.map(() => 0);
  for (let tick = 0; tick <= last; tick++) {
    const now = snapshots[tick].robots;
    now.forEach((robot, index) => {
      const analysis = robots[index];
      if (tick % sampleEvery === 0 || tick === last) analysis.hp.push(robot.hp);
      if (tick === 0) return;
      const before = snapshots[tick - 1].robots[index];
      analysis.distance += Math.hypot(robot.x - before.x, robot.y - before.y);
      if (robot.hp > before.hp) analysis.recovered += robot.hp - before.hp;
      if (robot.alive) {
        standing[index]++;
        if (robot.enemyVisible) seeing[index]++;
      }
    });
  }
  robots.forEach((analysis, index) => {
    analysis.sighted = standing[index] === 0 ? 0 : seeing[index] / standing[index];
  });
  return { robots, hits, sampleEvery, ticks: last, tickRate };
}

/** How many times each line of a robot's program ran in the match, by line number. */
export function lineCounts(recording: Recording, robotId: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const snapshot of recording.snapshots) {
    const robot = snapshot.robots.find((each) => each.id === robotId);
    for (const line of robot?.executedLines ?? []) counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}
