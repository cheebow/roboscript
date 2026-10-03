import { createElement } from './dom';

/**
 * The little markup of the tutorial's texts, as elements: paragraphs parted by
 * blank lines, "- " lists, ``` code blocks, `code` and **bold** in a line.
 */
export function renderMarkup(text: string): HTMLElement {
  const root = createElement('div', 'markup');
  const lines = text.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      index++;
    } else if (line.startsWith('```')) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      index++;
      root.append(createElement('pre', 'markup-code', code.join('\n')));
    } else if (line.startsWith('- ')) {
      const list = createElement('ul', 'markup-list');
      while (index < lines.length && lines[index].startsWith('- ')) {
        const item = createElement('li', '');
        item.append(...inline(lines[index++].slice(2)));
        list.append(item);
      }
      root.append(list);
    } else {
      const words: string[] = [];
      while (index < lines.length && lines[index].trim() !== '' && !lines[index].startsWith('```') && !lines[index].startsWith('- ')) {
        words.push(lines[index++]);
      }
      const paragraph = createElement('p', 'markup-paragraph');
      paragraph.append(...inline(words.join(' ')));
      root.append(paragraph);
    }
  }
  return root;
}

/** `code` and **bold** within a line; the rest as text. */
function inline(text: string): Node[] {
  const nodes: Node[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > last) nodes.push(document.createTextNode(text.slice(last, match.index)));
    if (match[1] !== undefined) {
      nodes.push(createElement('code', 'markup-inline', match[1]));
    } else {
      // Bold may hold code: **`fire`**.
      const strong = createElement('strong', '');
      strong.append(...inline(match[2]));
      nodes.push(strong);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
  return nodes;
}
