import { type CommentaryLine, commentaryOf } from '../arena/commentary';
import type { Fight } from '../arena/match';
import type { Loadout } from '../data/parts';
import type { RobotStats } from '../data/robot_defaults';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS, REPLAY_TAIL_TICKS } from '../data/match_defaults';
import { recordMatch } from '../debug/recorder';
import type { Recording } from '../debug/recorder';
import { ReplayManager } from '../debug/replay_manager';
import type { Snapshot } from '../debug/snapshot';
import { t } from '../i18n/messages';
import type { Arena } from '../sim/types';
import { formatOutcome } from '../view/battle_view';

/** What the battle view draws on the arena and contest screens. */
export interface ArenaScene {
  snapshot: Snapshot;
  arena: Arena;
  stats: readonly RobotStats[];
  loadouts: readonly Loadout[];
}

/** Plays a recorded match back at the given speed, following the named robot's program. */
export function createReplay(recording: Recording, speed: number, focus: string): ReplayManager {
  return new ReplayManager(recording, {
    maxFrameTime: MATCH_DEFAULTS.maxFrameTime,
    tailTicks: REPLAY_TAIL_TICKS,
    speed,
    focus,
  });
}

/** The match a screen is showing, if any: recorded once, then played back as often as asked. */
export class WatchedMatch {
  replay: ReplayManager | null = null;
  fight: Fight | null = null;
  /** The commentary of the match, worked out from its recording. */
  commentary: readonly CommentaryLine[] = [];

  /** Records the fight and plays it from the start. */
  watch(fight: Fight, speed: number): void {
    this.fight = fight;
    const recording = recordMatch(fight.config, EFFECT_LIFETIMES);
    this.commentary = commentaryOf(recording, fight.names, fight.config.maxMatchTime);
    this.replay = createReplay(recording, speed, fight.names[0]);
    this.replay.restart();
  }

  leave(): void {
    this.replay = null;
    this.fight = null;
    this.commentary = [];
  }

  /** What to draw: the match, or `idle` while there is none. */
  scene(idle: ArenaScene): ArenaScene {
    const { replay, fight } = this;
    if (replay === null || fight === null) return idle;
    const { recording } = replay;
    return { snapshot: replay.view, arena: recording.arena, stats: recording.stats, loadouts: fight.loadouts };
  }

  /** Per robot, whether to draw its way to cover: for those whose program looks for it. */
  coverRoutes(): readonly boolean[] {
    return this.fight === null ? [] : this.fight.features.map((features) => features.cover);
  }

  /** How the match stands: who won, or whether it is playing; null while there is no match. */
  status(): string | null {
    const { replay } = this;
    if (replay === null) return null;
    const { result } = replay.snapshot;
    if (result !== null) return formatOutcome(result);
    return replay.playing ? t('program.playing') : t('program.paused');
  }
}
