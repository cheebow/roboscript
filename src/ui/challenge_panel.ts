import { t } from '../i18n/messages';
import type { KeyValueStorage } from '../project/project_store';
import type { Recording } from '../debug/recorder';
import type { ReplayManager } from '../debug/replay_manager';
import {
  CHALLENGES,
  type Challenge,
  type ChallengeResult,
  challengeLoadout,
  challengeMatch,
  describeCondition,
  describeGoal,
  judgeChallenge,
} from '../challenge';
import { type Best, CHALLENGES_KEY, better, readChallengeProgress, writeChallengeProgress, type ChallengeProgress } from '../challenge/progress';
import type { Stage, TutorialAction } from '../tutorial/types';
import { ActionMenu } from './action_menu';
import type { Coach } from './coach';
import { type Loadout, PARTS, STANDARD_LOADOUT, type Slot } from '../data/parts';
import { createButton, createElement } from './dom';
import { renderMarkup } from './markup';
import { local } from './tutorial_panel';

/** What the challenges need of the rest of the screen. */
export interface ChallengeHooks {
  /** The code in the editor. */
  code(): string;
  /** Puts code in the editor; `undoable` when the player may take it back (an answer). */
  setCode(code: string, undoable: boolean): void;
  /** Another challenge was picked: its field, its robots and its code are to be shown, and any match left. */
  challengeChanged(): void;
  /** Leave the challenges. */
  exit(): void;
  /** Shows ALPHA's parts (true) or the code (false) where the editor is. */
  showParts(shown: boolean): void;
}

/** "★★☆": stars out of three. */
export function starsText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

/**
 * The challenges: set matches with conditions to clear them by, and two more
 * for stars. Any can be tried in any order. Keeps the code of each, and the
 * best each was cleared with.
 */
export class ChallengePanel implements Coach {
  private progress: ChallengeProgress;
  private index: number;
  /** How the last match went, until it is watched; then until the replay gets to the result. */
  private result: ChallengeResult | null = null;
  private pending: { result: ChallengeResult; replay: ReplayManager } | null = null;
  private readonly header = createElement('div', 'tutorial-header');
  private readonly content = createElement('div', 'tutorial-content');
  private readonly status = createElement('div', 'tutorial-status');
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly listMenu: ActionMenu;

  constructor(
    container: HTMLElement,
    private readonly storage: KeyValueStorage | null,
    private readonly hooks: ChallengeHooks,
  ) {
    this.progress = readChallengeProgress(storage?.getItem(CHALLENGES_KEY) ?? null);
    const at = CHALLENGES.findIndex((challenge) => challenge.id === this.progress.current);
    this.index = at < 0 ? 0 : at;

    const list = ActionMenu.inPanel(t('challenge.list'), t('challenge.list.title'), (id) => this.goTo(CHALLENGES.findIndex((challenge) => challenge.id === id)));
    this.listMenu = list.menu;
    const exit = createButton('tool-button', t('challenge.exit'), t('challenge.exit.title'), () => hooks.exit());
    const top = createElement('div', 'tutorial-top');
    top.append(list.element, exit);

    this.previousButton = createButton('tool-button', t('tutorial.previous'), '', () => this.goTo(this.index - 1));
    this.nextButton = createButton('tool-button', t('tutorial.next'), '', () => this.goTo(this.index + 1));
    const nav = createElement('div', 'tutorial-nav');
    nav.append(this.previousButton, this.nextButton);

    container.replaceChildren(top, this.header, this.content, this.status, nav);
  }

  get challenge(): Challenge {
    return CHALLENGES[this.index];
  }

  get stage(): Stage {
    return this.challenge.stage;
  }

  /** The parts chosen, with those the challenge fixes put on. */
  get loadout(): Loadout {
    return challengeLoadout(this.challenge, this.progress.loadout);
  }

  get fixedSlots(): ReadonlySet<Slot> {
    return new Set(Object.keys(this.challenge.parts ?? {}) as Slot[]);
  }

  match(source: string, loadout: Loadout) {
    return challengeMatch(this.challenge, source, loadout);
  }

  /** Judges the match; it is shown whole, to its end. */
  played(recording: Recording): Recording {
    this.result = judgeChallenge(this.challenge, this.hooks.code(), recording);
    return recording;
  }

  watch(replay: ReplayManager): void {
    const { result } = this;
    this.result = null;
    if (result === null) return;
    this.pending = { result, replay };
    this.setStatus(t('tutorial.watching'), 'waiting');
  }

  matchRefused(why: 'errors' | 'cost'): void {
    this.pending = null;
    this.setStatus(t(why === 'cost' ? 'tutorial.fixCost' : 'tutorial.fixErrors'), 'problem');
  }

  acted(_action: TutorialAction): void {}

  setLoadout(loadout: Loadout): void {
    this.progress.loadout = { ...loadout };
    this.save();
  }

  codeEdited(code: string): void {
    this.progress.code[this.challenge.id] = code;
    this.save();
  }

  /** The result comes out as the replay gets to the moment it was decided. */
  update(): void {
    const { pending } = this;
    if (pending === null) return;
    const { result, replay } = pending;
    const last = replay.recording.snapshots.length - 1;
    if (replay.tick < Math.min(result.tick, last)) return;
    this.pending = null;
    if (!result.cleared) {
      this.setStatus(result.why === null ? t('tutorial.notYet') : local(result.why), 'problem');
      return;
    }
    const { id } = this.challenge;
    const best: Best = { stars: result.stars, ...result.record };
    const before = this.progress.best[id];
    const kept = better(before, best);
    this.progress.best[id] = kept;
    this.save();
    const newBest = kept === best && before !== undefined && kept !== before;
    this.setStatus(t('challenge.cleared', { stars: starsText(result.stars), record: recordText(best) }) + (newBest ? t('challenge.newBest') : ''), 'done');
    this.renderList();
    this.renderHeader();
  }

  open(): void {
    this.goTo(this.index);
  }

  close(): void {}

  private goTo(index: number): void {
    if (index < 0 || index >= CHALLENGES.length) return;
    this.index = index;
    this.result = null;
    this.pending = null;
    this.progress.current = this.challenge.id;
    this.save();
    this.hooks.challengeChanged();
    this.hooks.setCode(this.progress.code[this.challenge.id] ?? this.challenge.start, false);
    this.render();
  }

  private render(): void {
    const { challenge } = this;
    this.renderHeader();

    const views = createElement('div', 'tutorial-views');
    views.append(
      createButton('tool-button', t('tutorial.showCode'), '', () => this.hooks.showParts(false)),
      createButton('tool-button', t('tutorial.showParts'), '', () => this.hooks.showParts(true)),
    );

    const goal = createElement('div', 'tutorial-task');
    const goalList = createElement('ul', 'challenge-conditions');
    goalList.append(createElement('li', '', local(describeGoal(challenge.goal))));
    for (const condition of challenge.require ?? []) goalList.append(createElement('li', '', local(describeCondition(condition))));
    goal.append(createElement('div', 'tutorial-task-label', t('challenge.goal')), goalList);

    const stars = createElement('div', 'challenge-stars');
    const starList = createElement('ul', 'challenge-conditions');
    starList.append(
      createElement('li', '', `+★ ${local(describeCondition(challenge.stars[0]))}`),
      createElement('li', '', `+★ ${local(describeCondition(challenge.stars[1]))}`),
    );
    stars.append(createElement('div', 'tutorial-task-label', t('challenge.stars')), starList);

    const parts = createElement(
      'p',
      'challenge-parts',
      challenge.parts === undefined ? t('challenge.free') : t('challenge.fixed', { parts: describeParts(challenge.parts) }),
    );

    const details = createElement('details', 'tutorial-answer');
    details.append(createElement('summary', '', t('challenge.answer')));
    const { answer, answerParts } = challenge;
    details.append(createElement('div', 'tutorial-answer-parts', t('tutorial.answerParts', { parts: answerParts === undefined ? t('challenge.standardParts') : describeParts(answerParts) })));
    details.append(
      createElement('pre', 'markup-code', answer),
      createButton('tool-button', t('tutorial.useAnswer'), t('tutorial.useAnswer.title'), () => {
        // The answer is played with its parts, and standard parts elsewhere.
        this.hooks.setCode(answer, true);
        this.setLoadout({ ...STANDARD_LOADOUT, ...answerParts });
        this.hooks.challengeChanged();
      }),
    );
    const help = createElement('div', 'tutorial-help');
    help.append(details);

    this.content.replaceChildren(views, renderMarkup(local(challenge.brief)), goal, stars, parts, help);
    this.content.scrollTop = 0;
    this.renderList();
    this.setStatus(t('challenge.notYet'), 'waiting');
    this.previousButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index === CHALLENGES.length - 1;
  }

  private renderHeader(): void {
    const { challenge } = this;
    const best = this.progress.best[challenge.id];
    this.header.replaceChildren(
      createElement('div', 'tutorial-chapter', t('challenge.number', { number: this.index + 1, count: CHALLENGES.length })),
      createElement('h3', 'tutorial-title', `${local(challenge.title)}  ${starsText(best?.stars ?? 0)}`),
    );
    if (best !== undefined) this.header.append(createElement('div', 'challenge-best', t('challenge.best', { stars: starsText(best.stars), record: recordText(best) })));
  }

  private renderList(): void {
    this.listMenu.setItems(
      CHALLENGES.map((challenge, at) => ({
        id: challenge.id,
        label: `${starsText(this.progress.best[challenge.id]?.stars ?? 0)} ${t('challenge.item', { number: at + 1, title: local(challenge.title) })}`,
      })),
    );
  }

  private setStatus(text: string, kind: 'done' | 'problem' | 'waiting'): void {
    this.status.textContent = text;
    this.status.dataset.kind = kind;
    this.status.hidden = text === '';
  }

  private save(): void {
    writeChallengeProgress(this.storage, this.progress);
  }
}

/** "12 lines · 13.2 s · HP 120". */
function recordText(record: { lines: number; seconds: number; hp: number }): string {
  return t('challenge.record', { lines: record.lines, seconds: record.seconds.toFixed(1), hp: record.hp });
}

/** "GUN Pistol": the parts named. */
function describeParts(parts: Partial<Loadout>): string {
  return Object.entries(parts)
    .map(([slot, id]) => `${slot.toUpperCase()} ${PARTS.find((part) => part.slot === slot && part.id === id)?.name ?? id}`)
    .join(', ');
}
