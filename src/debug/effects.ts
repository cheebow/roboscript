import type { TickEvent, TickEventKind } from '../sim/simulation';

/** How many ticks each kind of effect lasts. */
export type EffectLifetimes = Readonly<Record<TickEventKind, number>>;

/** A visual effect as it appears on one tick. */
export interface EffectSnapshot {
  kind: TickEventKind;
  x: number;
  y: number;
  /** Ticks since the effect started; 0 on the tick it happened. */
  age: number;
  /** The index of the robot it is about, for the effects that are a robot's own. */
  robot?: number;
  /** The index of the robot it came from, for the effects that travel between robots. */
  from?: number;
}

interface ActiveEffect extends TickEvent {
  startTick: number;
}

/**
 * Turns the momentary events of a match into effects that last a few ticks.
 * Recording them tick by tick lets a replay show the right frame of every
 * effect wherever it is paused or jumped to.
 */
export class EffectTracker {
  private active: ActiveEffect[] = [];

  constructor(private readonly lifetimes: EffectLifetimes) {}

  /** Starts an effect for each event of this tick and returns every effect still running. */
  update(tick: number, events: readonly TickEvent[]): EffectSnapshot[] {
    // A robot shows one letter at a time: a new signal replaces the one still flying to or shown over it,
    // so a chattering radio cannot pile envelopes up.
    for (const event of events) {
      if (event.kind !== 'signalHeard' || event.robot === undefined) continue;
      this.active = this.active.filter((effect) => effect.kind !== 'signalHeard' || effect.robot !== event.robot);
    }
    this.active.push(...events.map((event) => ({ ...event, startTick: tick })));
    this.active = this.active.filter((effect) => tick - effect.startTick < this.lifetimes[effect.kind]);
    return this.active.map(({ kind, x, y, startTick, robot, from }) => ({
      kind,
      x,
      y,
      age: tick - startTick,
      ...(robot === undefined ? {} : { robot }),
      ...(from === undefined ? {} : { from }),
    }));
  }
}
