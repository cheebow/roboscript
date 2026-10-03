import { currentLanguage } from '../i18n/language';
import { t } from '../i18n/messages';
import type { KeyValueStorage } from '../project/project_store';
import type { Recording } from '../debug/recorder';
import type { ReplayManager } from '../debug/replay_manager';
import { CHAPTERS, STEPS, judgeStep } from '../tutorial';
import type { Outcome } from '../tutorial/checks';
import { TUTORIAL_KEY, readProgress, writeProgress, type Progress } from '../tutorial/progress';
import type { Stage, Step, Text, TutorialAction } from '../tutorial/types';
import { ActionMenu } from './action_menu';
import { type Loadout, PARTS, STANDARD_LOADOUT } from '../data/parts';
import { createButton, createElement } from './dom';
import { renderMarkup } from './markup';

/** What the tutorial needs of the rest of the screen. */
export interface TutorialHooks {
  /** The code in the tutorial's editor. */
  code(): string;
  /** Puts code in the tutorial's editor; `undoable` when the player may take it back (an answer). */
  setCode(code: string, undoable: boolean): void;
  /** The step changed: its field, its robots and its code are to be shown, and any match left. */
  stepChanged(step: Step): void;
  /** Leave the tutorial. */
  exit(): void;
  /** Shows ALPHA's parts (true) or the code (false) where the editor is. */
  showParts(shown: boolean): void;
}

const GLOW_CLASS = 'tutorial-glow';

/** The text in the language of the screen. */
export function local(text: Text): string {
  return currentLanguage() === 'ja' ? text.ja : text.en;
}

/**
 * The tutorial: one step at a time, an explanation and a task, cleared by
 * what the player's program does in a match, or by reading on. Keeps where the
 * player is, what they cleared, and their code for each step.
 */
export class TutorialPanel {
  private progress: Progress;
  private index: number;
  /** Hints shown so far in this step. */
  private hintsShown = 0;
  /** What the last match of this step will show once played up to its moment. */
  private pending: { outcome: Outcome; replay: ReplayManager } | null = null;
  private readonly header = createElement('div', 'tutorial-header');
  private readonly content = createElement('div', 'tutorial-content');
  private readonly status = createElement('div', 'tutorial-status');
  private readonly previousButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly chapterMenu: ActionMenu;

  constructor(
    container: HTMLElement,
    private readonly storage: KeyValueStorage | null,
    private readonly hooks: TutorialHooks,
  ) {
    this.progress = readProgress(storage?.getItem(TUTORIAL_KEY) ?? null);
    const at = STEPS.findIndex(({ step }) => step.id === this.progress.current);
    this.index = at < 0 ? 0 : at;

    const chapters = ActionMenu.inPanel(t('tutorial.chapters'), t('tutorial.chapters.title'), (id) => this.goTo(STEPS.findIndex(({ step }) => step.id === id)));
    this.chapterMenu = chapters.menu;
    const exit = createButton('tool-button', t('tutorial.exit'), t('tutorial.exit.title'), () => hooks.exit());
    const top = createElement('div', 'tutorial-top');
    top.append(chapters.element, exit);

    this.previousButton = createButton('tool-button', t('tutorial.previous'), '', () => this.goTo(this.index - 1));
    this.nextButton = createButton('tool-button tutorial-next', t('tutorial.next'), '', () => {
      if (this.index === STEPS.length - 1) hooks.exit();
      else this.goTo(this.index + 1);
    });
    const nav = createElement('div', 'tutorial-nav');
    nav.append(this.previousButton, this.nextButton);

    container.replaceChildren(top, this.header, this.content, this.status, nav);
  }

  get step(): Step {
    return STEPS[this.index].step;
  }

  /** The field the step shows: its own, or for a step without one, that of the next step with one (else the last before). */
  get stage(): Stage | undefined {
    for (let at = this.index; at < STEPS.length; at++) if (STEPS[at].step.stage !== undefined) return STEPS[at].step.stage;
    for (let at = this.index; at >= 0; at--) if (STEPS[at].step.stage !== undefined) return STEPS[at].step.stage;
    return undefined;
  }

  /** How the match went for this step; for a step whose check is a match. */
  judge(recording: Recording): Outcome {
    return judgeStep(this.step, this.hooks.code(), recording);
  }

  /** ALPHA's parts for this step: those chosen, for a step about parts; standard parts elsewhere. */
  get loadout(): Loadout {
    return this.step.parts === true ? this.progress.loadout : STANDARD_LOADOUT;
  }

  /** The parts chosen in a step about parts: kept, and counted as the step's action. */
  setLoadout(loadout: Loadout): void {
    this.progress.loadout = { ...loadout };
    this.save();
    this.acted('part');
  }

  /** The code the step starts with: kept from before, its own, or what the step before ended with. */
  codeFor(index: number): string {
    const { step } = STEPS[index];
    const kept = this.progress.code[step.id];
    if (kept !== undefined) return kept;
    if (step.start !== undefined) return step.start;
    return index > 0 ? this.codeFor(index - 1) : '';
  }

  /** Shows the step the player was at, as the tutorial is opened. */
  open(): void {
    this.goTo(this.index);
  }

  /** Puts the pointing away, as the tutorial is left. */
  close(): void {
    this.glow([]);
  }

  /** The player's code changed: kept for this step. */
  codeEdited(code: string): void {
    this.progress.code[this.step.id] = code;
    this.save();
  }

  /** A match was played and judged: its result is shown once the replay gets to that moment. */
  matchPlayed(outcome: Outcome, replay: ReplayManager): void {
    if (this.step.check.kind !== 'match') return;
    this.pending = { outcome, replay };
    this.showStatus();
  }

  /** The program had errors: no match. */
  matchRefused(): void {
    this.pending = null;
    if (this.step.check.kind === 'match' && !this.cleared) this.setStatus(t('tutorial.fixErrors'), 'problem');
  }

  /** Something the player did on the screen. */
  acted(action: TutorialAction): void {
    if (this.step.check.kind === 'action' && this.step.check.action === action) this.clear();
  }

  /** Called every frame: a match result comes out as the replay gets to it. */
  update(): void {
    const { pending } = this;
    if (pending === null) return;
    const { outcome, replay } = pending;
    if (outcome.done && replay.tick >= outcome.tick) {
      this.pending = null;
      this.clear();
    } else if (!outcome.done && replay.tick >= replay.recording.snapshots.length - 1) {
      this.pending = null;
      this.setStatus(local(outcome.why), 'problem');
    }
  }

  private get cleared(): boolean {
    return this.progress.cleared.includes(this.step.id);
  }

  private goTo(index: number): void {
    if (index < 0 || index >= STEPS.length) return;
    this.index = index;
    this.hintsShown = 0;
    this.pending = null;
    this.progress.current = this.step.id;
    this.save();
    this.hooks.stepChanged(this.step);
    this.hooks.setCode(this.codeFor(index), false);
    this.render();
  }

  private render(): void {
    const { chapter, step } = STEPS[this.index];
    const inChapter = chapter.steps.indexOf(step) + 1;
    const chapterNumber = CHAPTERS.indexOf(chapter);
    this.header.replaceChildren(
      createElement('div', 'tutorial-chapter', t('tutorial.chapter', { number: chapterNumber, title: local(chapter.title), step: inChapter, steps: chapter.steps.length })),
      createElement('h3', 'tutorial-title', local(step.title)),
    );

    const parts: HTMLElement[] = [];
    if (step.parts === true) {
      // Where the editor is: the code, or ALPHA's parts.
      const views = createElement('div', 'tutorial-views');
      const code = createButton('tool-button', t('tutorial.showCode'), '', () => this.hooks.showParts(false));
      const partsButton = createButton('tool-button', t('tutorial.showParts'), '', () => this.hooks.showParts(true));
      views.append(code, partsButton);
      parts.push(views);
    }
    parts.push(renderMarkup(local(step.body)));
    if (step.task !== undefined) {
      const task = createElement('div', 'tutorial-task');
      task.append(createElement('div', 'tutorial-task-label', t('tutorial.task')), renderMarkup(local(step.task)));
      parts.push(task);
    }
    const hints = step.hints ?? [];
    if (hints.length > 0 || step.answer !== undefined) {
      const help = createElement('div', 'tutorial-help');
      hints.slice(0, this.hintsShown).forEach((hint, at) => {
        const shown = createElement('div', 'tutorial-hint');
        shown.append(createElement('span', 'tutorial-hint-label', t('tutorial.hintNumber', { number: at + 1 })), renderMarkup(local(hint)));
        help.append(shown);
      });
      const buttons = createElement('div', 'tutorial-help-buttons');
      if (this.hintsShown < hints.length) {
        buttons.append(createButton('tool-button', t('tutorial.hint'), t('tutorial.hint.title'), () => {
          this.hintsShown++;
          this.render();
        }));
      } else if (step.answer !== undefined) {
        const answer = step.answer;
        const answerParts = step.answerParts;
        const details = createElement('details', 'tutorial-answer');
        const summary = createElement('summary', '', t('tutorial.answer'));
        const use = createButton('tool-button', t('tutorial.useAnswer'), t('tutorial.useAnswer.title'), () => {
          this.hooks.setCode(answer, true);
          if (answerParts !== undefined) this.setLoadout({ ...STANDARD_LOADOUT, ...answerParts });
        });
        details.append(summary);
        if (answerParts !== undefined) details.append(createElement('div', 'tutorial-answer-parts', t('tutorial.answerParts', { parts: describeParts(answerParts) })));
        details.append(createElement('pre', 'markup-code', answer), use);
        buttons.append(details);
      }
      help.append(buttons);
      parts.push(help);
    }
    this.content.replaceChildren(...parts);
    this.content.scrollTop = 0;

    this.glow(step.highlight ?? []);
    this.chapterMenu.setItems(
      CHAPTERS.map((chapter, number) => ({
        id: chapter.id,
        label: t('tutorial.chapterItem', { number, title: local(chapter.title) }),
        items: chapter.steps.map((each) => ({
          id: each.id,
          label: `${this.progress.cleared.includes(each.id) ? '✓ ' : '　'}${local(each.title)}`,
        })),
      })),
    );
    this.showStatus();
  }

  private showStatus(): void {
    const { step } = this;
    if (this.cleared) this.setStatus(t('tutorial.cleared'), 'done');
    else if (this.pending !== null) this.setStatus(t('tutorial.watching'), 'waiting');
    else if (step.check.kind === 'read') this.setStatus('', 'waiting');
    else this.setStatus(t('tutorial.notYet'), 'waiting');
    this.previousButton.disabled = this.index === 0;
    const last = this.index === STEPS.length - 1;
    this.nextButton.disabled = step.check.kind !== 'read' && !this.cleared;
    this.nextButton.textContent = last ? t('tutorial.end') : t('tutorial.next');
  }

  private setStatus(text: string, kind: 'done' | 'problem' | 'waiting'): void {
    this.status.textContent = text;
    this.status.dataset.kind = kind;
    this.status.hidden = text === '';
  }

  private clear(): void {
    if (!this.cleared) this.progress.cleared.push(this.step.id);
    this.save();
    this.showStatus();
  }

  private glow(ids: readonly string[]): void {
    for (const element of document.querySelectorAll(`.${GLOW_CLASS}`)) element.classList.remove(GLOW_CLASS);
    for (const id of ids) document.getElementById(id)?.classList.add(GLOW_CLASS);
  }

  private save(): void {
    writeProgress(this.storage, this.progress);
  }
}

/** "GUN Cannon, SENSOR Scope": the parts of an answer that are not standard. */
function describeParts(parts: Partial<Loadout>): string {
  return Object.entries(parts)
    .map(([slot, id]) => `${slot.toUpperCase()} ${PARTS.find((part) => part.slot === slot && part.id === id)?.name ?? id}`)
    .join(', ');
}
