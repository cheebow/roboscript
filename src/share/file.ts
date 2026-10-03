import { type ContestRecord, type ReadRecord, readRecord } from '../arena/contest_record';
import { RULES_VERSION } from '../data/rules_version';
import { t } from '../i18n/messages';
import { type SavedRobot, readSavedRobot } from '../project/garage';

/** The name every RoboScript file carries, so that other JSON is not taken for one. */
const FILE_FORMAT = 'roboscript';
/** The form of a file; raised when its layout changes. */
const FILE_VERSION = 1;
export const FILE_EXTENSION = '.roboscript.json';

/** What a file holds, with the rules it was made under. */
export type SharedFile =
  | { kind: 'robot'; rules: string; robot: SavedRobot }
  | { kind: 'contest'; rules: string; savedAt: string; contest: ReadRecord }
  | { kind: 'match'; rules: string; match: SharedMatch };

/** A match as it is shared: its robots in the order they start, its arena by id, and its seed. */
export interface SharedMatch {
  robots: SavedRobot[];
  arenaId: string;
  seed: number;
}

/** How many robots a match may have. */
const MATCH_ROBOTS = { least: 2, most: 4 };

export function matchFileText(match: SharedMatch): string {
  return JSON.stringify(
    {
      format: FILE_FORMAT,
      v: FILE_VERSION,
      kind: 'match',
      rules: RULES_VERSION,
      arena: match.arenaId,
      seed: match.seed,
      robots: match.robots.map((robot) => ({ name: robot.name, loadout: robot.loadout, source: robot.source })),
    },
    null,
    2,
  );
}

export function robotFileText(robot: SavedRobot): string {
  return JSON.stringify(
    { format: FILE_FORMAT, v: FILE_VERSION, kind: 'robot', rules: RULES_VERSION, robot: { name: robot.name, loadout: robot.loadout, source: robot.source } },
    null,
    2,
  );
}

export function contestFileText(contest: ContestRecord, savedAt: Date): string {
  return JSON.stringify(
    { format: FILE_FORMAT, v: FILE_VERSION, kind: 'contest', rules: RULES_VERSION, savedAt: savedAt.toISOString(), contest },
    null,
    2,
  );
}

/** What a file holds, or what is wrong with it. */
export function readSharedFile(text: string): { ok: true; file: SharedFile } | { ok: false; problem: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: t('file.notAFile') };
  }
  if (typeof json !== 'object' || json === null || (json as { format?: unknown }).format !== FILE_FORMAT) {
    return { ok: false, problem: t('file.notAFile') };
  }
  const file = json as Record<string, unknown>;
  if (file.v !== FILE_VERSION) return { ok: false, problem: t('share.otherVersion', { version: String(file.v) }) };
  const rules = typeof file.rules === 'string' ? file.rules : '';
  if (file.kind === 'robot') {
    const robot = readSavedRobot(file.robot);
    if (robot === null) return { ok: false, problem: t('share.noRobot') };
    return { ok: true, file: { kind: 'robot', rules, robot } };
  }
  if (file.kind === 'contest') {
    const contest = readRecord(file.contest);
    if (contest === null) return { ok: false, problem: t('file.brokenContest') };
    return { ok: true, file: { kind: 'contest', rules, savedAt: typeof file.savedAt === 'string' ? file.savedAt : '', contest } };
  }
  if (file.kind === 'match') {
    const robots = Array.isArray(file.robots) ? file.robots.map(readSavedRobot) : [];
    if (robots.length < MATCH_ROBOTS.least || robots.length > MATCH_ROBOTS.most || robots.some((robot) => robot === null)) {
      return { ok: false, problem: t('share.notTwoRobots') };
    }
    if (typeof file.arena !== 'string' || !Number.isInteger(file.seed)) return { ok: false, problem: t('share.noArenaOrSeed') };
    return { ok: true, file: { kind: 'match', rules, match: { robots: robots as SavedRobot[], arenaId: file.arena, seed: file.seed as number } } };
  }
  return { ok: false, problem: t('file.unknownKind') };
}

/** A name for a file: what it is called, without the characters file systems refuse. */
export function fileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safe === '' ? 'roboscript' : safe}${FILE_EXTENSION}`;
}

/** Has the browser save the text as a file of the given name. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Asks for a file and gives its text; nothing happens when none is chosen. */
export function chooseFile(onText: (text: string) => void, onProblem: (problem: string) => void = () => {}): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = `${FILE_EXTENSION},.json,application/json`;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file !== undefined) readText(file, onText, onProblem);
  });
  input.click();
}

/**
 * Takes a file dropped on the element, giving its text. The element is marked
 * while a file is over it. `accepts` says whether to take files at the moment;
 * while it does not, a dropped file goes past as if the element were not there.
 */
export function acceptDrops(
  element: HTMLElement,
  onText: (text: string) => void,
  { accepts = () => true, onProblem = () => {} }: { accepts?: () => boolean; onProblem?: (problem: string) => void } = {},
): void {
  // Entering a child of the element leaves the element itself: count, so that the mark stays until the file is really gone.
  let over = 0;
  const unmark = () => {
    over = 0;
    element.classList.remove('drop-target');
  };
  element.addEventListener('dragenter', (event) => {
    if (!accepts() || !event.dataTransfer?.types.includes('Files')) return;
    over++;
    element.classList.add('drop-target');
  });
  element.addEventListener('dragover', (event) => {
    if (!accepts() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    element.classList.add('drop-target');
  });
  element.addEventListener('dragleave', () => {
    over = Math.max(0, over - 1);
    if (over === 0) element.classList.remove('drop-target');
  });
  element.addEventListener('drop', (event) => {
    unmark();
    if (!accepts()) return;
    const file = event.dataTransfer?.files[0];
    if (file === undefined) return;
    event.preventDefault();
    readText(file, onText, onProblem);
  });
}

function readText(file: File, onText: (text: string) => void, onProblem: (problem: string) => void): void {
  file.text().then(onText, () => onProblem(t('file.couldNotRead')));
}
