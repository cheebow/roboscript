import type { CommentaryLine } from '../arena/commentary';
import type { Recording } from '../debug/recorder';
import type { ReplayManager } from '../debug/replay_manager';
import { t } from '../i18n/messages';
import type { KeyValueStorage } from '../project/project_store';
import type { MatchResult } from '../sim/simulation';
import { formatReason } from '../view/battle_view';
import { createButton, createElement } from './dom';
import { formatSeconds } from './format';
import { Notice } from './notice';
import { type ShareLink, createShareBox } from './share_box';
import { type ArenaScene, WatchedMatch } from './watched_match';

/** What the app needs of a screen where matches are watched: the arena, the contest and the team battle's watching. */
export interface WatchingScreen {
  /** The replay of the match being shown; null while there is none. */
  readonly replay: ReplayManager | null;
  /** What to draw: the match being shown, or what waits while there is none. */
  scene(): ArenaScene;
  /** Per robot of the match being shown, whether its way to cover is drawn. */
  coverRoutes(): readonly boolean[];
  /** The commentary of the match being shown. */
  commentary(): readonly CommentaryLine[];
  /** The names the robots of the match being shown fight under; empty while there is none. */
  fightNames(): readonly string[];
  /** The line for the toolbar. */
  message(): string;
  /** Called every frame while the screen is shown. */
  update(): void;
}

/**
 * The frame every watching screen shares: the match being watched and what
 * the battle view and the app read of it, and the notice under the panel.
 * Each screen says what waits while no match is shown, what the toolbar
 * says, and what to do every frame.
 */
export abstract class WatchScreen implements WatchingScreen {
  protected readonly watched = new WatchedMatch();
  /** What the last action did, or why it could not: under the panel. */
  protected readonly notice = new Notice();

  /** What the battle view shows while no match is. */
  protected abstract idleScene(): ArenaScene;
  abstract message(): string;
  abstract update(): void;

  scene(): ArenaScene {
    return this.watched.scene(this.idleScene());
  }

  get replay(): ReplayManager | null {
    return this.watched.replay;
  }

  coverRoutes(): readonly boolean[] {
    return this.watched.coverRoutes();
  }

  commentary(): readonly CommentaryLine[] {
    return this.watched.commentary;
  }

  fightNames(): readonly string[] {
    return this.watched.fight?.names ?? [];
  }

  /** A result's entry with a share button beside it; pressing the button shows the match's share code under the row. */
  protected shareableRow(entry: HTMLElement, share: () => Promise<{ code: string; link: ShareLink; saveFile: () => void }>): HTMLElement {
    const row = createElement('div', 'result-row');
    const button = createButton('garage-action', t('share.button'), t('arena.share.title'));
    let box: HTMLElement | null = null;
    /** Set while the code is being made: a second press meanwhile is not a second request. */
    let making = false;
    button.addEventListener('click', () => {
      if (box !== null) {
        box.remove();
        box = null;
        return;
      }
      if (making) return;
      making = true;
      share()
        .then(({ code, link, saveFile }) => {
          const save = createButton('tool-button share-action', t('garage.saveFile'), t('arena.saveFile.title'), saveFile);
          box = createShareBox(code, 'garage-share result-share', [save], link);
          row.after(box);
        })
        .catch(() => {
          this.notice.show(t('arena.couldNotShare'), true);
        })
        .finally(() => {
          making = false;
        });
    });
    const line = createElement('div', 'result-line');
    line.append(entry, button);
    row.append(line);
    return row;
  }
}

/** The result of a match that was watched to its end, from its recording; null when it has none. */
export function finalResult(recording: Recording): MatchResult | null {
  return recording.snapshots[recording.snapshots.length - 1].result;
}

/** The line of a result list for a match: its number, how it went, how it ended, how long it took, and where. */
export function resultLine(number: number, outcome: string, result: MatchResult, recording: Recording, map: string): string {
  const seconds = (recording.snapshots.length - 1) / recording.tickRate;
  return t('arena.result', { number, outcome, reason: formatReason(result.reason), seconds: formatSeconds(seconds), map });
}

/** Puts the entry on top of a result list, and brings the top into view. */
export function prependResult(results: HTMLElement, entry: HTMLElement): void {
  results.prepend(entry);
  results.scrollTop = 0;
}

/** What a screen kept of its line-up under the key; null when nothing usable is kept. */
export function readLineup(storage: KeyValueStorage | null, key: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Keeps a screen's line-up under the key. Storage may be full or blocked: the line-up then holds until the page is left. */
export function saveLineup(storage: KeyValueStorage | null, key: string, lineup: Record<string, unknown>): void {
  try {
    storage?.setItem(key, JSON.stringify({ version: 1, ...lineup }));
  } catch {
    // Kept until the page is left.
  }
}

/** The ids picked for the slots, with any kept one in place of the default; a kept entry that is no id is passed over. */
export function restorePicked(picked: readonly string[], kept: unknown): string[] {
  if (!Array.isArray(kept)) return [...picked];
  return picked.map((id, index) => (typeof kept[index] === 'string' ? (kept[index] as string) : id));
}
