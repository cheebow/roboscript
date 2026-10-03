import { RULES_VERSION } from '../data/rules_version';
import { readLoadout } from '../data/parts';
import type { SavedRobot } from '../project/garage';

/** The form of a share code; raised when the layout of the JSON inside changes. */
export const CODE_VERSION = 1;
/** The URL parameter that carries a shared robot. */
export const ROBOT_PARAM = 'robot';

/** A robot read from a share code, with the rules it was made under. */
export interface SharedRobot {
  robot: SavedRobot;
  /** The rules version the code was made under; differs from RULES_VERSION when the game has changed since. */
  rules: string;
}

export type Decoded = { ok: true; shared: SharedRobot } | { ok: false; problem: string };

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
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(await inflate(fromBase64Url(code.trim()))));
  } catch {
    return { ok: false, problem: 'not a RoboScript share code' };
  }
  if (!isRecord(json) || json.kind !== 'robot') return { ok: false, problem: 'not a share code for a robot' };
  if (json.v !== CODE_VERSION) return { ok: false, problem: `a share code of another version (${String(json.v)})` };
  if (typeof json.name !== 'string' || typeof json.source !== 'string') return { ok: false, problem: 'a share code with no robot in it' };
  return {
    ok: true,
    shared: {
      robot: { name: json.name, source: json.source, loadout: readLoadout(json.loadout) },
      rules: typeof json.rules === 'string' ? json.rules : '',
    },
  };
}

/** The URL that opens the app with the robot: the page's address with the code as a parameter. */
export function robotUrl(pageUrl: string, code: string): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(ROBOT_PARAM, code);
  return url.toString();
}

/** The share code in what was pasted: the code itself, or a URL that carries one. */
export function codeInText(text: string): string {
  const trimmed = text.trim();
  try {
    const code = new URL(trimmed).searchParams.get(ROBOT_PARAM);
    if (code !== null) return code;
  } catch {
    // Not a URL: the text is the code.
  }
  return trimmed;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream('deflate-raw'));
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream('deflate-raw'));
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
