/** Shown where a value does not exist, e.g. the target while no enemy is visible. */
export const NO_VALUE = '-';

const DECIMALS = 1;
const SECONDS_DECIMALS = 2;
const TIMESTAMP_DECIMALS = 3;
/** Width of a timestamp before padding, e.g. "02.130". */
const TIMESTAMP_WIDTH = 6;

export function formatNumber(value: number): string {
  return value.toFixed(DECIMALS);
}

export function formatSeconds(seconds: number): string {
  return seconds.toFixed(SECONDS_DECIMALS);
}

/** Match time as shown in the debug log, e.g. "02.130". */
export function formatTimestamp(seconds: number): string {
  return seconds.toFixed(TIMESTAMP_DECIMALS).padStart(TIMESTAMP_WIDTH, '0');
}

/** What went wrong, in words, for a message: the error's own message when it has one. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
