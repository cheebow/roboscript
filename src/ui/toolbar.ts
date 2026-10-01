import { requireElement } from './dom';

export interface ToolbarHandlers {
  /** Called with the id of the arena the player picked. */
  selectArena(id: string): void;
  run(): void;
  debug(): void;
  /** Toggles between playing and paused. */
  playPause(): void;
  reset(): void;
}

/** One entry of a toolbar picker. */
export interface Choice {
  id: string;
  name: string;
}

/** What a picker offers, and which entry is selected to begin with. */
export interface Choices {
  options: readonly Choice[];
  selectedId: string;
}

const PAUSE_LABEL = 'PAUSE';
const PLAY_LABEL = 'PLAY';

export class Toolbar {
  private readonly projectName = requireElement('project-name');
  private readonly message = requireElement('message');
  private readonly pauseButton = requireElement<HTMLButtonElement>('pause');

  constructor(handlers: ToolbarHandlers, arenas: Choices) {
    setUpPicker('arena', arenas, handlers.selectArena);

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

function setUpPicker(elementId: string, choices: Choices, onSelect: (id: string) => void): void {
  const picker = requireElement<HTMLSelectElement>(elementId);
  picker.replaceChildren(...choices.options.map((choice) => new Option(choice.name, choice.id)));
  picker.value = choices.selectedId;
  picker.addEventListener('change', () => onSelect(picker.value));
}
