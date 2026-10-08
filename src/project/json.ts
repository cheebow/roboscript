/** Whether the value is a plain object, as JSON read from storage, a code or a file ought to hold. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
