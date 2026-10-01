import { requireElement } from './dom';

export interface ToolbarHandlers {
  run(): void;
  pause(): void;
  reset(): void;
}

const PAUSE_LABEL = 'PAUSE';
const RESUME_LABEL = 'RESUME';

export class Toolbar {
  private readonly projectName = requireElement('project-name');
  private readonly message = requireElement('message');
  private readonly pauseButton = requireElement<HTMLButtonElement>('pause');

  constructor(handlers: ToolbarHandlers) {
    requireElement('run').addEventListener('click', handlers.run);
    this.pauseButton.addEventListener('click', handlers.pause);
    requireElement('reset').addEventListener('click', handlers.reset);
  }

  setProjectName(name: string): void {
    this.projectName.textContent = name;
  }

  setMessage(text: string): void {
    if (this.message.textContent !== text) this.message.textContent = text;
  }

  /** `canPause` is false when there is no match in progress. */
  setPauseState(canPause: boolean, paused: boolean): void {
    const label = paused ? RESUME_LABEL : PAUSE_LABEL;
    if (this.pauseButton.textContent !== label) this.pauseButton.textContent = label;
    this.pauseButton.disabled = !canPause;
  }
}
