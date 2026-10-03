import { afterEach, describe, expect, it } from 'vitest';
import { LANGUAGE, describeDirection, describeWord } from '../src/ai/reference';
import { compileScript } from '../src/ai/roboscript';
import { formatError } from '../src/ai/script_error';
import { PARTS } from '../src/data/parts';
import { detectLanguage, otherLanguage, useLanguage } from '../src/i18n/language';
import { type MessageKey, en, ja, t } from '../src/i18n/messages';
import { PART_SUMMARIES_JA, partSummary } from '../src/i18n/parts';
import { WORDS_JA } from '../src/i18n/words';

afterEach(() => useLanguage('en'));

describe('t', () => {
  it('gives the English by default, with the parameters filled in', () => {
    expect(t('garage.loaded', { name: 'Striker', robot: 'ALPHA' })).toBe('Striker loaded into ALPHA');
  });

  it('gives the Japanese once that language is in use', () => {
    useLanguage('ja');
    expect(t('garage.loaded', { name: 'Striker', robot: 'ALPHA' })).toBe('Striker を ALPHA に読み込みました');
    expect(t('tab.program')).toBe('プログラム');
  });

  it('leaves a placeholder that is given no value, so that a missing parameter shows', () => {
    expect(t('garage.loaded', { name: 'Striker' })).toBe('Striker loaded into {robot}');
  });

  it('has every text in both languages, and the same placeholders in each', () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(ja[key], key).toBeTruthy();
      expect(placeholders(ja[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('detectLanguage', () => {
  it('takes the saved language first, then the browser\'s, else English', () => {
    expect(detectLanguage('ja', 'en-US')).toBe('ja');
    expect(detectLanguage('en', 'ja')).toBe('en');
    expect(detectLanguage(null, 'ja-JP')).toBe('ja');
    expect(detectLanguage(null, 'ja')).toBe('ja');
    expect(detectLanguage(null, 'fr')).toBe('en');
    expect(detectLanguage('klingon', undefined)).toBe('en');
    expect(otherLanguage('en')).toBe('ja');
    expect(otherLanguage('ja')).toBe('en');
  });
});

describe('Japanese for the errors of a program', () => {
  it('is what the compiler reports once that language is in use', () => {
    const errorsOf = (source: string) => {
      const result = compileScript(source);
      return result.ok ? [] : result.errors.map(formatError);
    };
    expect(errorsOf('shoot')).toEqual(['Line 1: Unknown command "shoot"']);
    useLanguage('ja');
    expect(errorsOf('shoot')).toEqual(['1 行目: "shoot" という命令はない']);
    expect(errorsOf('def f(a)\n    return a\nloop\n    f(1, 2)')).toEqual(['4 行目: "f" の引数は 1 個（2 個渡している）']);
  });
});

describe('Japanese for the words and the parts', () => {
  it('covers every word of the language', () => {
    for (const { word } of LANGUAGE) expect(WORDS_JA[word], word).toBeDefined();
  });

  it('is what the reference gives in Japanese, and the English otherwise', () => {
    expect(describeWord('fire')?.hint).toBe('shoot, 1 tick');
    useLanguage('ja');
    expect(describeWord('fire')?.hint).toBe('撃つ、1 tick');
    expect(describeWord('fire')?.kind).toBe('command');
    expect(describeDirection('hit')?.hint).toBe('最後に撃たれた方へ');
    expect(describeWord('no_such_word')).toBeUndefined();
  });

  it('has a watch label for every word the watch panel shows', () => {
    const shown = ['enemy_visible', 'hp', 'wall_right', 'cover_angle'];
    for (const word of shown) {
      expect(en[`watch.${word}` as MessageKey]).toBe(word);
      expect(ja[`watch.${word}` as MessageKey]).toBeTruthy();
    }
    // What a program cannot read is not shown under a name that looks like a word of the language.
    expect(en['watch.last_seen_x']).toBe('(enemy last seen x)');
  });

  it('covers every part', () => {
    for (const part of PARTS) expect(PART_SUMMARIES_JA[`${part.slot}:${part.id}`], part.id).toBeDefined();
    const cannon = PARTS.find((part) => part.id === 'cannon');
    if (cannon === undefined) throw new Error('Expected the Cannon');
    expect(partSummary(cannon)).toBe(cannon.summary);
    useLanguage('ja');
    expect(partSummary(cannon)).toBe(PART_SUMMARIES_JA['gun:cannon']);
  });
});
