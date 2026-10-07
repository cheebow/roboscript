/**
 * Share links: a share code in the address of the game, after `#`, so that
 * opening the link opens the game and takes the robot or the match in. What
 * comes after `#` never reaches a server.
 */
export type LinkKind = 'robot' | 'match' | 'team' | 'castle';

const LINK = /^#(robot|match|team|castle)=([A-Za-z0-9_-]+)$/;

/** The link that opens the game at `page` (its address, without anything after `#`) with the share code in it. */
export function shareLink(kind: LinkKind, code: string, page: string): string {
  return `${page.split('#')[0]}#${kind}=${code}`;
}

/** The share code in the part of an address after `#`, and what it is of; null when there is none. */
export function readShareLink(hash: string): { kind: LinkKind; code: string } | null {
  const match = LINK.exec(hash);
  return match === null ? null : { kind: match[1] as LinkKind, code: match[2] };
}
