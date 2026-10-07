import { MAX_TEAM_SIZE } from '../data/castle';
import { RULES_VERSION } from '../data/rules_version';
import { t } from '../i18n/messages';
import { type SavedRobot, type SavedTeam, readSavedRobot, readSavedTeam } from '../project/garage';

/** The form of a share code; raised when the layout of the JSON inside changes. */
export const CODE_VERSION = 1;

/**
 * bytes: the most a share code may hold once inflated. Four robots with long
 * programs come to a few tens of kilobytes; a crafted code that inflates to
 * gigabytes is refused before it can use up the browser's memory.
 */
export const MAX_INFLATED_BYTES = 1024 * 1024;

/** A robot read from a share code, with the rules it was made under. */
export interface SharedRobot {
  robot: SavedRobot;
  /** The rules version the code was made under; differs from RULES_VERSION when the game has changed since. */
  rules: string;
}

export type Decoded = { ok: true; shared: SharedRobot } | { ok: false; problem: string };

/** A match read from a share code: the two robots in spawn order, the arena and the seed, with the rules it was made under. */
export interface SharedMatch {
  /** 2 to 4 robots, in the order they start. */
  robots: SavedRobot[];
  arenaId: string;
  seed: number;
  rules: string;
}

export type DecodedMatch = { ok: true; shared: SharedMatch } | { ok: false; problem: string };

/** The robot as a share code: its JSON, deflated and written in URL-safe base64. */
export async function encodeRobot(robot: SavedRobot): Promise<string> {
  const json = JSON.stringify({
    v: CODE_VERSION,
    kind: 'robot',
    rules: RULES_VERSION,
    name: robot.name,
    loadout: robot.loadout,
    source: robot.source,
  });
  return toBase64Url(await deflate(new TextEncoder().encode(json)));
}

/** The robot in a share code, or what is wrong with the code. */
export async function decodeRobot(code: string): Promise<Decoded> {
  const json = await decodePayload(code);
  if (json === null) return { ok: false, problem: t('share.notACode') };
  if (!isRecord(json) || json.kind !== 'robot') return { ok: false, problem: t('share.notARobot') };
  if (json.v !== CODE_VERSION) return { ok: false, problem: t('share.otherVersion', { version: String(json.v) }) };
  const robot = readSavedRobot(json);
  if (robot === null) return { ok: false, problem: t('share.noRobot') };
  return { ok: true, shared: { robot, rules: rulesOf(json) } };
}

/** A match as a share code: both robots as they fought, the arena and the seed. */
export async function encodeMatch(match: { robots: readonly SavedRobot[]; arenaId: string; seed: number }): Promise<string> {
  const json = JSON.stringify({
    v: CODE_VERSION,
    kind: 'match',
    rules: RULES_VERSION,
    arena: match.arenaId,
    seed: match.seed,
    robots: match.robots.map((robot) => ({ name: robot.name, loadout: robot.loadout, source: robot.source })),
  });
  return toBase64Url(await deflate(new TextEncoder().encode(json)));
}

/** The match in a share code, or what is wrong with the code. */
export async function decodeMatch(code: string): Promise<DecodedMatch> {
  const json = await decodePayload(code);
  if (json === null) return { ok: false, problem: t('share.notACode') };
  if (!isRecord(json) || json.kind !== 'match') return { ok: false, problem: t('share.notAMatch') };
  if (json.v !== CODE_VERSION) return { ok: false, problem: t('share.otherVersion', { version: String(json.v) }) };
  const robots = Array.isArray(json.robots) ? json.robots.map(readSavedRobot) : [];
  // A duel, or a battle royale of up to four.
  if (robots.length < 2 || robots.length > 4 || robots.some((robot) => robot === null)) return { ok: false, problem: t('share.notTwoRobots') };
  if (typeof json.arena !== 'string' || !Number.isInteger(json.seed)) return { ok: false, problem: t('share.noArenaOrSeed') };
  return {
    ok: true,
    shared: { robots: robots as SavedRobot[], arenaId: json.arena, seed: json.seed as number, rules: rulesOf(json) },
  };
}

/** A team read from a share code, with the rules it was made under. */
export interface SharedTeam {
  team: SavedTeam;
  rules: string;
}

export type DecodedTeam = { ok: true; shared: SharedTeam } | { ok: false; problem: string };

/** A castle match read from a share code: both teams in spawn order (team 0 first), the arena, the size and the seed. */
export interface SharedCastleMatch {
  teams: [SavedTeam, SavedTeam];
  arenaId: string;
  /** Robots a side. */
  teamSize: number;
  seed: number;
  rules: string;
}

export type DecodedCastleMatch = { ok: true; shared: SharedCastleMatch } | { ok: false; problem: string };

/**
 * A team as a share code. New kinds keep CODE_VERSION 1: a game from before
 * them reads the code cleanly as "not a robot" rather than as another version.
 */
export async function encodeTeam(team: SavedTeam): Promise<string> {
  const json = JSON.stringify({
    v: CODE_VERSION,
    kind: 'team',
    rules: RULES_VERSION,
    name: team.name,
    source: team.source,
    loadouts: team.loadouts,
  });
  return toBase64Url(await deflate(new TextEncoder().encode(json)));
}

/** The team in a share code, or what is wrong with the code. */
export async function decodeTeam(code: string): Promise<DecodedTeam> {
  const json = await decodePayload(code);
  if (json === null) return { ok: false, problem: t('share.notACode') };
  if (!isRecord(json) || json.kind !== 'team') return { ok: false, problem: t('share.notATeam') };
  if (json.v !== CODE_VERSION) return { ok: false, problem: t('share.otherVersion', { version: String(json.v) }) };
  const team = readSavedTeam(json);
  if (team === null) return { ok: false, problem: t('share.noTeam') };
  return { ok: true, shared: { team, rules: rulesOf(json) } };
}

/** A castle match as a share code: both teams as they fought, the arena, the size and the seed. */
export async function encodeCastleMatch(match: {
  teams: readonly [SavedTeam, SavedTeam];
  arenaId: string;
  teamSize: number;
  seed: number;
}): Promise<string> {
  const json = JSON.stringify({
    v: CODE_VERSION,
    kind: 'castle',
    rules: RULES_VERSION,
    arena: match.arenaId,
    size: match.teamSize,
    seed: match.seed,
    teams: match.teams.map((team) => ({ name: team.name, source: team.source, loadouts: team.loadouts })),
  });
  return toBase64Url(await deflate(new TextEncoder().encode(json)));
}

/** The castle match in a share code, or what is wrong with the code. */
export async function decodeCastleMatch(code: string): Promise<DecodedCastleMatch> {
  const json = await decodePayload(code);
  if (json === null) return { ok: false, problem: t('share.notACode') };
  if (!isRecord(json) || json.kind !== 'castle') return { ok: false, problem: t('share.notACastleMatch') };
  if (json.v !== CODE_VERSION) return { ok: false, problem: t('share.otherVersion', { version: String(json.v) }) };
  const teams = Array.isArray(json.teams) ? json.teams.map(readSavedTeam) : [];
  const size = json.size;
  if (teams.length !== 2 || teams.some((team) => team === null)) return { ok: false, problem: t('share.notTwoTeams') };
  if (!Number.isInteger(size) || (size as number) < 1 || (size as number) > MAX_TEAM_SIZE) return { ok: false, problem: t('share.notTwoTeams') };
  if ((teams as SavedTeam[]).some((team) => team.loadouts.length < (size as number))) return { ok: false, problem: t('share.notTwoTeams') };
  if (typeof json.arena !== 'string' || !Number.isInteger(json.seed)) return { ok: false, problem: t('share.noArenaOrSeed') };
  return {
    ok: true,
    shared: {
      teams: teams as [SavedTeam, SavedTeam],
      arenaId: json.arena,
      teamSize: size as number,
      seed: json.seed as number,
      rules: rulesOf(json),
    },
  };
}

/** The JSON inside a share code; null when the text is not one. */
async function decodePayload(code: string): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await inflate(fromBase64Url(code.trim()))));
  } catch {
    return null;
  }
}

function rulesOf(json: Record<string, unknown>): string {
  return typeof json.rules === 'string' ? json.rules : '';
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream('deflate-raw'));
}

/** The inflated bytes; throws once there are more than MAX_INFLATED_BYTES of them, without reading on. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const reader = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.length;
    if (size > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(read.value);
  }
  const whole = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    whole.set(chunk, at);
    at += chunk.length;
  }
  return whole;
}

async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  // A copy, so that the bytes sit in an ArrayBuffer of their own, as a Blob wants.
  const stream = new Blob([bytes.slice()]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('not base64url');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
