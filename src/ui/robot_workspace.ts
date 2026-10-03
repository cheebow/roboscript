import { CodeEditor } from './code_editor';
import { t } from '../i18n/messages';

const SAVE_DELAY_MS = 400;

export interface WorkspaceCallbacks {
  /** Persists the program. May throw. */
  save(source: string): void;
  /** Called after every edit, including a template being loaded. */
  edited(workspace: RobotWorkspace): void;
  /** Called with a description when saving fails, and with null once it works again. */
  saveProblem(problem: string | null): void;
  /** Called when the number or the margin of a line is clicked. */
  lineClicked(workspace: RobotWorkspace, line: number): void;
}

/**
 * One robot's program as the player works on it: its editor, whether it has
 * changed since the last run, and saving it shortly after each edit.
 */
export class RobotWorkspace {
  readonly editor: CodeEditor;
  /** True once the code was edited after the last RUN / DEBUG: its line numbers no longer match the recording. */
  stale = false;
  private saveTimer: number | null = null;

  constructor(
    readonly robotId: string,
    container: HTMLElement,
    source: string,
    private readonly callbacks: WorkspaceCallbacks,
  ) {
    this.editor = new CodeEditor(
      container,
      source,
      () => this.handleEdit(),
      (line) => this.callbacks.lineClicked(this, line),
    );
  }

  get source(): string {
    return this.editor.source;
  }

  /** Replaces the whole program, e.g. with a template. Can be undone in the editor. */
  load(source: string): void {
    this.editor.setSource(source);
  }

  /** Saves right away if an edit is still waiting to be saved. */
  flush(): void {
    if (this.saveTimer !== null) this.save();
  }

  private handleEdit(): void {
    this.callbacks.edited(this);
    // Save shortly after the last edit, so typing does not write on every key.
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  private save(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      this.callbacks.save(this.source);
      this.callbacks.saveProblem(null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.callbacks.saveProblem(t('program.couldNotSaveCode', { robot: this.robotId, reason }));
    }
  }
}
