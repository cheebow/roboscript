import { createElement, requireElement } from './dom';
import { t } from '../i18n/messages';
import { formatTimestamp } from './format';

export interface TransportHandlers {
  /** Toggles between playing and paused. */
  playPause(): void;
  step(): void;
  stepBack(): void;
  /** Goes to the next / the previous time the marked line runs. */
  nextRun(): void;
  previousRun(): void;
  seek(tick: number): void;
  setSpeed(speed: number): void;
}

/** What the transport row shows; null when there is no match to play. */
export interface TransportState {
  tick: number;
  lastTick: number;
  tickRate: number;
  playing: boolean;
  /** Ticks to mark on the seek bar: the moments the marked line runs. The same array for as long as they stay the same. */
  marks: readonly number[];
  /** Whether there is anything left to step forward / back to. */
  canStep: boolean;
  canStepBack: boolean;
}

const SELECTED_CLASS = 'selected';
/** Half the width of the seek bar's thumb, in CSS pixels: the thumb's middle stops this far short of either end. */
const SEEK_THUMB_HALF_PX = 4.5;
const MARK_WIDTH_PX = 1;
const MARK_COLOR_VARIABLE = '--syntax-value';

/** The replay controls under the battle view: play / pause, single steps (a line or a tick), jumps between the runs of the marked line, seek bar with marks, speed, clock. */
export class Transport {
  private readonly playButton = requireElement<HTMLButtonElement>('transport-play');
  private readonly stepBackButton = requireElement<HTMLButtonElement>('step-back');
  private readonly stepButton = requireElement<HTMLButtonElement>('step');
  private readonly previousRunButton = requireElement<HTMLButtonElement>('previous-run');
  private readonly nextRunButton = requireElement<HTMLButtonElement>('next-run');
  private readonly seekBar = requireElement<HTMLInputElement>('seek');
  private readonly marksCanvas = requireElement<HTMLCanvasElement>('seek-marks');
  /** What the marks were last drawn for, to skip frames on which nothing changed. */
  private drawnMarks: { marks: readonly number[]; lastTick: number; width: number } | null = null;
  private readonly clock = requireElement('clock');
  private readonly speedButtons = new Map<number, HTMLButtonElement>();

  constructor(speeds: readonly number[], handlers: TransportHandlers) {
    this.playButton.addEventListener('click', handlers.playPause);
    this.stepBackButton.addEventListener('click', handlers.stepBack);
    this.stepButton.addEventListener('click', handlers.step);
    this.previousRunButton.addEventListener('click', handlers.previousRun);
    this.nextRunButton.addEventListener('click', handlers.nextRun);
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

    const playLabel = state?.playing ? t('transport.pause') : t('transport.play');
    if (this.playButton.textContent !== playLabel) this.playButton.textContent = playLabel;
    this.playButton.disabled = state === null;
    this.stepBackButton.disabled = state === null || !state.canStepBack;
    this.stepButton.disabled = state === null || !state.canStep;
    // Only with a marked line that runs at all is there anywhere to jump to.
    const nowhereToJump = state === null || state.marks.length === 0;
    this.previousRunButton.disabled = nowhereToJump;
    this.nextRunButton.disabled = nowhereToJump;
    this.seekBar.disabled = state === null;
    if (this.seekBar.max !== String(lastTick)) this.seekBar.max = String(lastTick);
    if (this.seekBar.valueAsNumber !== tick) this.seekBar.value = String(tick);

    this.drawMarks(state?.marks ?? [], lastTick);

    const clock =
      state === null ? '' : `${formatTimestamp(tick / state.tickRate)} / ${formatTimestamp(lastTick / state.tickRate)}`;
    if (this.clock.textContent !== clock) this.clock.textContent = clock;

    for (const [value, button] of this.speedButtons) button.classList.toggle(SELECTED_CLASS, value === speed);
  }

  /** Draws a thin line on the seek bar at every marked tick, lined up with where the thumb would be. */
  private drawMarks(marks: readonly number[], lastTick: number): void {
    const canvas = this.marksCanvas;
    const width = canvas.clientWidth;
    const drawn = this.drawnMarks;
    if (drawn !== null && drawn.marks === marks && drawn.lastTick === lastTick && drawn.width === width) return;
    this.drawnMarks = { marks, lastTick, width };

    const density = window.devicePixelRatio;
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(canvas.clientHeight * density);
    const context = canvas.getContext('2d');
    if (context === null || marks.length === 0 || lastTick === 0) return;

    context.scale(density, density);
    context.fillStyle = getComputedStyle(canvas).getPropertyValue(MARK_COLOR_VARIABLE);
    const travel = width - SEEK_THUMB_HALF_PX * 2;
    for (const tick of marks) {
      const x = SEEK_THUMB_HALF_PX + (tick / lastTick) * travel;
      context.fillRect(Math.round(x - MARK_WIDTH_PX / 2), 0, MARK_WIDTH_PX, canvas.clientHeight);
    }
  }
}
