import { t } from '../i18n/messages';

export interface ScriptError {
  /** 1-based source line. */
  line: number;
  message: string;
}

export function formatError(error: ScriptError): string {
  return t('error.line', { line: error.line, message: error.message });
}
