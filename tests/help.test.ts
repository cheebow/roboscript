import { describe, expect, it } from 'vitest';
import { LANGUAGE, allWords } from '../src/ai/reference';
import { HELP, WORDS_TOPIC } from '../src/help/topics';

describe('the help', () => {
  it('has both parts, each topic with a title and a text in both languages', () => {
    expect(HELP.map((section) => section.id)).toEqual(['app', 'script']);
    for (const topic of HELP.flatMap((section) => section.topics)) {
      expect(topic.title.en.trim(), topic.id).not.toBe('');
      expect(topic.title.ja.trim(), topic.id).not.toBe('');
      if (topic.id === WORDS_TOPIC) continue;
      expect(topic.body.en.trim(), topic.id).not.toBe('');
      expect(topic.body.ja.trim(), topic.id).not.toBe('');
    }
  });

  it('has topics with ids of their own', () => {
    const ids = HELP.flatMap((section) => section.topics.map((topic) => topic.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists every word of the language in the guide, hit as a direction too', () => {
    const listed = allWords();
    for (const reference of LANGUAGE) expect(listed.some((word) => word.word === reference.word && word.kind === reference.kind), reference.word).toBe(true);
    expect(listed.filter((word) => word.word === 'hit').map((word) => word.kind).sort()).toEqual(['direction', 'sensor']);
  });

  it('writes the code in its examples so that it runs', async () => {
    const { parse } = await import('../src/ai/parser');
    const script = HELP.find((section) => section.id === 'script')!;
    for (const topic of script.topics) {
      for (const text of [topic.body.en, topic.body.ja]) {
        for (const block of text.matchAll(/```\n([\s\S]*?)```/g)) {
          const { errors } = parse(block[1]);
          expect(errors.map((error) => error.message), `${topic.id}: ${block[1]}`).toEqual([]);
        }
      }
    }
  });
});
