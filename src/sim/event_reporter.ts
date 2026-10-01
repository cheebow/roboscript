import type { DebugEvent, DebugEventType } from '../debug/debug_event';
import type { AIAction, MoveDirection, RobotState, TurnDirection } from './ai_context';
import type { MatchResult } from './simulation';

export interface DebugEventSink {
  log(event: DebugEvent): void;
}

const STOPPED = 'stop';

/**
 * Describes what happens in a Simulation as debug events. Movement and turning
 * are reported only when they change, so the log stays readable.
 */
export class EventReporter {
  private tick = 0;
  private readonly lastMove = new Map<string, MoveDirection | null>();
  private readonly lastTurn = new Map<string, TurnDirection | null>();
  private readonly warnedOutOfAmmo = new Set<string>();

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

  stateChanged(robotId: string, from: RobotState, to: RobotState, sourceLine: number | null): void {
    this.emit('ai', robotId, `state ${from} -> ${to}`, sourceLine);
  }

  actionDecided(robotId: string, action: AIAction): void {
    if (action.move !== (this.lastMove.get(robotId) ?? null)) {
      this.emit('action', robotId, `move ${action.move ?? STOPPED}`, action.sourceLines.move);
    }
    if (action.turn !== (this.lastTurn.get(robotId) ?? null)) {
      this.emit('action', robotId, `turn ${action.turn ?? STOPPED}`, action.sourceLines.turn);
    }
    this.lastMove.set(robotId, action.move);
    this.lastTurn.set(robotId, action.turn);
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

  hit(shooterId: string, targetId: string, damage: number, remainingHp: number): void {
    this.emit('hit', shooterId, `${targetId} damage=${damage} hp=${remainingHp}`);
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
