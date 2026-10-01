export interface ScriptError {
  /** 1-based source line. */
  line: number;
  message: string;
}

export function formatError(error: ScriptError): string {
  return `Line ${error.line}: ${error.message}`;
}
