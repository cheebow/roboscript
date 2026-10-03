import { t } from '../i18n/messages';
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

export class Toolbar {
  private readonly message = requireElement('message');
  private readonly pauseButton = requireElement<HTMLButtonElement>('pause');

  constructor(handlers: ToolbarHandlers, arenas: Choices) {
    setUpPicker('arena', arenas, handlers.selectArena);

    requireElement('run').addEventListener('click', handlers.run);
    requireElement('debug').addEventListener('click', handlers.debug);
    this.pauseButton.addEventListener('click', handlers.playPause);
    requireElement('reset').addEventListener('click', handlers.reset);
  }

  /** Shows the given arena as the one picked, as when a shared match brings its own. */
  setArena(id: string): void {
    requireElement<HTMLSelectElement>('arena').value = id;
  }

  setMessage(text: string): void {
    if (this.message.textContent !== text) this.message.textContent = text;
  }

  /** `available` is false when there is no match to play. */
  setPlayback(available: boolean, playing: boolean): void {
    const label = playing ? t('toolbar.pause') : t('toolbar.play');
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
