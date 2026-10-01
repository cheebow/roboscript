import { createElement } from './dom';

export const PROJECT_FILES = ['main.bot', 'config'] as const;
export type ProjectFile = (typeof PROJECT_FILES)[number];

const BRANCH = '├─ ';
const LAST_BRANCH = '└─ ';

/** The project tree. Clicking a file tells the app which one to show. */
export class ProjectPanel {
  private readonly entries = new Map<ProjectFile, HTMLButtonElement>();

  constructor(container: HTMLElement, projectName: string, onSelect: (file: ProjectFile) => void) {
    const nodes: HTMLElement[] = [createElement('div', 'tree-node', projectName)];
    PROJECT_FILES.forEach((file, index) => {
      const branch = index === PROJECT_FILES.length - 1 ? LAST_BRANCH : BRANCH;
      const entry = createElement('button', 'tree-file', `${branch}${file}`);
      entry.type = 'button';
      entry.addEventListener('click', () => onSelect(file));
      this.entries.set(file, entry);
      nodes.push(entry);
    });
    container.replaceChildren(...nodes);
  }

  markSelected(selected: ProjectFile): void {
    for (const [file, entry] of this.entries) entry.classList.toggle('selected', file === selected);
  }
}
