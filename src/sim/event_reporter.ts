import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import type { AIAction, ProgramStatus } from './ai_context';
import type { MatchResult } from './simulation';

export interface DebugEventSink {
  log(event: DebugEvent): void;
}

/**
 * Describes what happens in a Simulation as debug events. A robot usually
 * repeats the same few actions tick after tick, so driving, turning and aiming are
 * each reported only when they come into use: when that action, from that
 * source line, has not been taken for about a second.
 */
export class EventReporter {
  private tick = 0;
  /** The tick on which each robot last took each action. */
  private readonly lastTaken = new Map<string, number>();
  private readonly lastStatus = new Map<string, ProgramStatus>();
  private readonly warnedOutOfAmmo = new Set<string>();
  private readonly warnedOutOfGuards = new Set<string>();

  constructor(
    private readonly sink: DebugEventSink,
    private readonly tickRate: number,
  ) {}

  /** Events reported from now on belong to this tick. */
  beginTick(tick: number): void {
    this.tick = tick;
  }

  matchStarted(seed: number): void {
    this.emit('system', null, `match started seed=${seed}`);
  }

  sensorChanged(robotId: string, enemyId: string, visible: boolean): void {
    this.emit('sensor', robotId, `${visible ? 'enemy detected' : 'enemy lost'}: ${enemyId}`);
  }

  labelChanged(robotId: string, from: string, to: string, sourceLine: number | null): void {
    this.emit('ai', robotId, `label ${from} -> ${to}`, sourceLine);
  }

  actionDecided(robotId: string, action: AIAction): void {
    if (action.drive !== null) this.actionTaken(robotId, `drive ${action.drive}`, action.sourceLines.drive);
    if (action.turn !== null) this.actionTaken(robotId, `turn ${action.turn}`, action.sourceLines.turn);
    if (action.aim !== null) this.actionTaken(robotId, `aim ${action.aim}`, action.sourceLines.aim);
    if (action.guard) this.actionTaken(robotId, 'guard', action.sourceLines.guard);
    this.programStatusIs(robotId, action.status);
  }

  private actionTaken(robotId: string, description: string, sourceLine: number | null): void {
    const key = `${robotId} ${description} ${sourceLine}`;
    const last = this.lastTaken.get(key);
    if (last === undefined || this.tick - last > this.tickRate) this.emit('action', robotId, description, sourceLine);
    this.lastTaken.set(key, this.tick);
  }

  /** Reports a program that has ended or that stalls, when it gets into that state. */
  private programStatusIs(robotId: string, status: ProgramStatus): void {
    if (status === (this.lastStatus.get(robotId) ?? 'running')) return;
    this.lastStatus.set(robotId, status);
    if (status === 'finished') {
      this.emit('warning', robotId, 'program finished: the robot stops (use loop to keep it going)');
    } else if (status === 'stalled') {
      this.emit('warning', robotId, 'too many lines without an action: the robot waits (a loop needs turn, aim, fire, guard or wait)');
    }
  }

  fired(robotId: string, sourceLine: number | null): void {
    this.emit('action', robotId, 'fire', sourceLine);
  }

  /** Reported once per robot, the first time it tries to fire with no ammo left. */
  outOfAmmo(robotId: string, sourceLine: number | null): void {
    if (this.warnedOutOfAmmo.has(robotId)) return;
    this.warnedOutOfAmmo.add(robotId);
    this.emit('warning', robotId, 'out of ammo', sourceLine);
  }

  /** Reported once per robot, the first time it tries to guard with no guards left. */
  outOfGuards(robotId: string, sourceLine: number | null): void {
    if (this.warnedOutOfGuards.has(robotId)) return;
    this.warnedOutOfGuards.add(robotId);
    this.emit('warning', robotId, 'out of guards', sourceLine);
  }

  /** `guarded`: the target was braced, so the damage is less than the shot's. */
  hit(shooterId: string, targetId: string, damage: number, remainingHp: number, guarded: boolean): void {
    this.emit('hit', shooterId, `${targetId} damage=${damage} hp=${remainingHp}${guarded ? ' (guarded)' : ''}`);
  }

  matchEnded(result: MatchResult): void {
    const outcome = result.winnerId === null ? 'draw' : `winner: ${result.winnerId}`;
    this.emit('system', null, `${outcome} (${result.reason})`);
  }

  private emit(type: DebugEventType, robotId: string | null, message: string, sourceLine: number | null = null): void {
    this.sink.log({
      tick: this.tick,
      timestamp: this.tick / this.tickRate,
      robotId,
      type,
      message,
      sourceLine,
    });
  }
}
