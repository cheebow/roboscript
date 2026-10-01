import { createElement, requireElement } from './dom';
import { formatTimestamp } from './format';

export interface TransportHandlers {
  /** Toggles between playing and paused. */
  playPause(): void;
  /** Plays without stopping at breakpoints. */
  playOn(): void;
  step(): void;
  stepBack(): void;
  seek(tick: number): void;
  setSpeed(speed: number): void;
}

/** What the transport row shows; null when there is no match to play. */
export interface TransportState {
  tick: number;
  lastTick: number;
  tickRate: number;
  playing: boolean;
  /** Whether there are breakpoints to play past: only when debugging. */
  canPlayOn: boolean;
  /** Whether there is anything left to step forward / back to. */
  canStep: boolean;
  canStepBack: boolean;
}

const SELECTED_CLASS = 'selected';
const PAUSE_LABEL = 'PAUSE';
const PLAY_LABEL = 'PLAY';

/** The replay controls under the battle view: play / pause, play past breakpoints, single steps (a line or a tick), seek bar, speed, clock. */
export class Transport {
  private readonly playButton = requireElement<HTMLButtonElement>('transport-play');
  private readonly playOnButton = requireElement<HTMLButtonElement>('play-on');
  private readonly stepBackButton = requireElement<HTMLButtonElement>('step-back');
  private readonly stepButton = requireElement<HTMLButtonElement>('step');
  private readonly seekBar = requireElement<HTMLInputElement>('seek');
  private readonly clock = requireElement('clock');
  private readonly speedButtons = new Map<number, HTMLButtonElement>();

  constructor(speeds: readonly number[], handlers: TransportHandlers) {
    this.playButton.addEventListener('click', handlers.playPause);
    this.playOnButton.addEventListener('click', handlers.playOn);
    this.stepBackButton.addEventListener('click', handlers.stepBack);
    this.stepButton.addEventListener('click', handlers.step);
    this.seekBar.addEventListener('input', () => handlers.seek(this.seekBar.valueAsNumber));

    const buttons = speeds.map((speed) => {
      const button = createElement('button', 'tool-button speed', `${speed}x`);
      button.type = 'button';
      button.addEventListener('click', () => handlers.setSpeed(speed));
      this.speedButtons.set(speed, button);
      return button;
    });
    requireElement('speeds').replaceChildren(...buttons);
  }

  update(state: TransportState | null, speed: number): void {
    const tick = state?.tick ?? 0;
    const lastTick = state?.lastTick ?? 0;

    const playLabel = state?.playing ? PAUSE_LABEL : PLAY_LABEL;
    if (this.playButton.textContent !== playLabel) this.playButton.textContent = playLabel;
    this.playButton.disabled = state === null;
    this.playOnButton.disabled = state === null || !state.canPlayOn;
    this.stepBackButton.disabled = state === null || !state.canStepBack;
    this.stepButton.disabled = state === null || !state.canStep;
    this.seekBar.disabled = state === null;
    if (this.seekBar.max !== String(lastTick)) this.seekBar.max = String(lastTick);
    if (this.seekBar.valueAsNumber !== tick) this.seekBar.value = String(tick);

    const clock =
      state === null ? '' : `${formatTimestamp(tick / state.tickRate)} / ${formatTimestamp(lastTick / state.tickRate)}`;
    if (this.clock.textContent !== clock) this.clock.textContent = clock;

    for (const [value, button] of this.speedButtons) button.classList.toggle(SELECTED_CLASS, value === speed);
  }
}
