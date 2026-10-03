import { createButton, createElement } from './dom';

/** The files every robot has in the project tree. */
export const ROBOT_FILES = ['main.bot', 'config'] as const;
export type RobotFile = (typeof ROBOT_FILES)[number];

/** One file of one robot. */
export interface ProjectFile {
  /** Index of the robot the file belongs to; 0 is the player's. */
  robotIndex: number;
  file: RobotFile;
}

const BRANCH = '├─ ';
const LAST_BRANCH = '└─ ';

/** The project tree: one node per robot, each with its files. Clicking a file tells the app which one to show. */
export class ProjectPanel {
  private readonly entries: { file: ProjectFile; element: HTMLButtonElement }[] = [];

  constructor(container: HTMLElement, robotIds: readonly string[], onSelect: (file: ProjectFile) => void) {
    const nodes: HTMLElement[] = [];
    robotIds.forEach((robotId, robotIndex) => {
      nodes.push(createElement('div', 'tree-node', robotId));
      ROBOT_FILES.forEach((name, index) => {
        const file: ProjectFile = { robotIndex, file: name };
        const branch = index === ROBOT_FILES.length - 1 ? LAST_BRANCH : BRANCH;
        const element = createButton('tree-file', `${branch}${name}`, '', () => onSelect(file));
        this.entries.push({ file, element });
        nodes.push(element);
      });
    });
    container.replaceChildren(...nodes);
  }

  markSelected(selected: ProjectFile): void {
    for (const { file, element } of this.entries) {
      element.classList.toggle('selected', file.robotIndex === selected.robotIndex && file.file === selected.file);
    }
  }
}
