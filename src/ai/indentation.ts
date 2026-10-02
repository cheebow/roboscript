import { withoutComment } from './reference';

/** Statements whose following lines are indented one step further. */
const BLOCK_OPENERS = new Set(['if', 'else', 'loop', 'while', 'def']);

interface CodeLine {
  indent: number;
  firstWord: string;
}

/** The line's indentation and first word; null for a blank or comment-only line. */
function codeOf(text: string): CodeLine | null {
  const code = withoutComment(text);
  if (code.trim() === '') return null;
  return { indent: code.length - code.trimStart().length, firstWord: /^[A-Za-z_]+/.exec(code.trimStart())?.[0] ?? '' };
}

/**
 * How many spaces the given line should be indented by, going by the lines
 * above it: one `unit` deeper after a line that opens a block, level with the
 * line above otherwise. An `else` lines up with the `if` it belongs to: the
 * nearest one above, no deeper than the `else` already is, that has no `else` yet.
 */
export function indentFor(lines: readonly string[], lineIndex: number, unit: number): number {
  const above = lines
    .slice(0, lineIndex)
    .map(codeOf)
    .filter((line) => line !== null);
  const previous = above[above.length - 1];
  const natural = previous === undefined ? 0 : previous.indent + (BLOCK_OPENERS.has(previous.firstWord) ? unit : 0);

  const current = codeOf(lines[lineIndex] ?? '');
  if (current?.firstWord !== 'else') return natural;
  return matchingIfIndent(above, Math.min(current.indent, natural)) ?? natural;
}

/** The indentation of the `if` an `else` at (or to the right of) `maxIndent` would belong to, searching upwards. */
function matchingIfIndent(above: readonly CodeLine[], maxIndent: number): number | null {
  // Lines deeper than the shallowest one passed so far are inside blocks that have closed.
  let ceiling = maxIndent;
  const takenBy = new Set<number>();
  for (let index = above.length - 1; index >= 0; index--) {
    const { indent, firstWord } = above[index];
    if (indent > ceiling) continue;
    ceiling = indent;
    if (firstWord === 'else') takenBy.add(indent);
    else if (firstWord === 'if' && !takenBy.delete(indent)) return indent;
  }
  return null;
}
