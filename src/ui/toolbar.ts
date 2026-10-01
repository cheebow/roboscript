import { requireElement } from './dom';

export interface ToolbarHandlers {
  run(): void;
  debug(): void;
  /** Toggles between playing and paused. */
  playPause(): void;
  reset(): void;
}

const PAUSE_LABEL = 'PAUSE';
const PLAY_LABEL = 'PLAY';

export class Toolbar {
  private readonly projectName = requireElement('project-name');
  private readonly message = requireElement('message');
  private readonly pauseButton = requireElement<HTMLButtonElement>('pause');

  constructor(handlers: ToolbarHandlers) {
    requireElement('run').addEventListener('click', handlers.run);
    requireElement('debug').addEventListener('click', handlers.debug);
    this.pauseButton.addEventListener('click', handlers.playPause);
    requireElement('reset').addEventListener('click', handlers.reset);
  }

  setProjectName(name: string): void {
    this.projectName.textContent = name;
  }

  setMessage(text: string): void {
    if (this.message.textContent !== text) this.message.textContent = text;
  }

  /** `available` is false when there is no match to play. */
  setPlayback(available: boolean, playing: boolean): void {
    const label = playing ? PAUSE_LABEL : PLAY_LABEL;
    if (this.pauseButton.textContent !== label) this.pauseButton.textContent = label;
    this.pauseButton.disabled = !available;
  }
}
