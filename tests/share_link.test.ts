import { describe, expect, it } from 'vitest';
import { readShareLink, shareLink } from '../src/share/link';

describe('share links', () => {
  it('put the code after # in the address of the game, and read it back', () => {
    const link = shareLink('robot', 'abc_DEF-123', 'https://example.github.io/roboscript/');
    expect(link).toBe('https://example.github.io/roboscript/#robot=abc_DEF-123');
    expect(readShareLink(new URL(link).hash)).toEqual({ kind: 'robot', code: 'abc_DEF-123' });
  });

  it('leave out whatever came after # in the address they are made from', () => {
    expect(shareLink('match', 'xyz', 'https://example.org/game/?seed=3#robot=old')).toBe('https://example.org/game/?seed=3#match=xyz');
  });

  it('find nothing in an address without a code', () => {
    expect(readShareLink('')).toBeNull();
    expect(readShareLink('#robot=')).toBeNull();
    expect(readShareLink('#arena=abc')).toBeNull();
    expect(readShareLink('#robot=a b')).toBeNull();
  });
});

describe('team share links', () => {
  it('carry a team code after #team=, and read it back', () => {
    expect(shareLink('team', 'abc-123', 'https://example.test/game/#old')).toBe('https://example.test/game/#team=abc-123');
    expect(readShareLink('#team=abc-123')).toEqual({ kind: 'team', code: 'abc-123' });
    expect(readShareLink('#castle=xyz')).toEqual({ kind: 'castle', code: 'xyz' });
  });
});
