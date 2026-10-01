/** Shown where a value does not exist, e.g. the target while no enemy is visible. */
export const NO_VALUE = '-';

const DECIMALS = 1;
const TIME_DECIMALS = 2;

export function formatNumber(value: number): string {
  return value.toFixed(DECIMALS);
}

export function formatSeconds(seconds: number): string {
  return seconds.toFixed(TIME_DECIMALS);
}
