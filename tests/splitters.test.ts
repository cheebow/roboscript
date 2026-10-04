import { describe, expect, it } from 'vitest';
import {
  BATTLE_MIN_WIDTH,
  BOTTOM_MIN_HEIGHT,
  EDITOR_MIN_WIDTH,
  TOP_MIN_HEIGHT,
  clampBottomHeight,
  clampEditorWidth,
  readLayout,
  writeLayout,
} from '../src/ui/splitters';

describe('splitter sizes', () => {
  it('keep the editor at least its minimum width, and leave the battle view its minimum', () => {
    expect(clampEditorWidth(100, 1440)).toBe(EDITOR_MIN_WIDTH);
    expect(clampEditorWidth(500, 1440)).toBe(500);
    expect(clampEditorWidth(2000, 1440)).toBe(1440 - 180 - 6 - BATTLE_MIN_WIDTH);
    expect(clampEditorWidth(500.4, 1440)).toBe(500);
    // Beside the wider tutorial or challenge column, less room is left.
    expect(clampEditorWidth(2000, 1440, 380)).toBe(1440 - 380 - 6 - BATTLE_MIN_WIDTH);
  });

  it('keep the bottom row at least its minimum height, and leave the top row its minimum', () => {
    expect(clampBottomHeight(10, 900)).toBe(BOTTOM_MIN_HEIGHT);
    expect(clampBottomHeight(300, 900)).toBe(300);
    expect(clampBottomHeight(2000, 900)).toBe(900 - 34 - 6 - TOP_MIN_HEIGHT);
  });
});

describe('saved layout', () => {
  it('comes back as it was written', () => {
    const layout = { editorWidth: 520, bottomHeight: null };
    expect(readLayout(writeLayout(layout))).toEqual(layout);
  });

  it('is all defaults when nothing was saved, or what was saved cannot be read', () => {
    const none = { editorWidth: null, bottomHeight: null };
    expect(readLayout(null)).toEqual(none);
    expect(readLayout('not json')).toEqual(none);
    expect(readLayout('42')).toEqual(none);
    expect(readLayout('{"editorWidth":"wide","bottomHeight":1e999}')).toEqual(none);
  });
});
