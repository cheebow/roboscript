import { RULES_VERSION } from '../data/rules_version';
import type { Loadout } from '../data/parts';
import { t } from '../i18n/messages';
import { Garage, MAX_NAME_LENGTH, type SavedRobot, garageName } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { decodeRobot, encodeRobot } from '../share/codec';
import { downloadText, fileName, readSharedFile, robotFileText } from '../share/file';
import { describeError } from './format';
import { GaragePanel } from './garage_panel';
import { Notice } from './notice';

/** The robots on the program screen, as the garage sees them: what to save from, and where to load into. */
export interface Workbench {
  /** The program and parts the robot at the given spawn index has now. */
  robot(robotIndex: number): { source: string; loadout: Loadout };
  /** Puts the saved robot's program and parts in place of the robot's own. */
  load(robotIndex: number, robot: SavedRobot): void;
}

/**
 * The garage and its panel: saving the robots of the program screen under a
 * name, loading them back, deleting them, and taking robots in from share
 * codes and files. What each did is said under the garage.
 */
export class GarageController {
  /** What the last action did, or why it could not: under the garage. */
  private readonly notice = new Notice();
  private readonly garage: Garage | null;
  private readonly panel: GaragePanel;

  constructor(
    container: HTMLElement,
    private readonly robotIds: readonly string[],
    storage: KeyValueStorage | null,
    private readonly workbench: Workbench,
  ) {
    this.garage = storage === null ? null : new Garage(storage);
    this.panel = new GaragePanel(container, robotIds, {
      save: (name, robotIndex) => this.save(name, robotIndex),
      load: (name, robotIndex) => this.load(name, robotIndex),
      remove: (name) => this.remove(name),
      share: (name) => this.share(name),
      importCode: (code) => this.importCode(code),
      saveFile: (name) => this.saveFile(name),
      importFile: (text) => this.importFile(text),
    });
    container.append(this.notice.element);
    this.show();
  }

  /** The saved robots, read afresh. */
  list(): SavedRobot[] {
    return this.garage?.list() ?? [];
  }

  /** Keeps robots received with a match, each under a name of its own; the names they are kept under. Throws without storage. */
  keep(robots: readonly SavedRobot[]): string[] {
    if (this.garage === null) throw new Error(t('garage.noStorage'));
    const { garage } = this;
    const names = robots.map((robot) => garage.importRobot(robot));
    this.show();
    return names;
  }

  /** Keeps the robot, its code and its parts as they are now, under the name typed. */
  private save(typedName: string, robotIndex: number): void {
    const name = garageName(typedName);
    const robotId = this.robotIds[robotIndex];
    if (name === null) {
      this.notice.show(t('garage.noName', { robot: robotId, max: MAX_NAME_LENGTH }), true);
      return;
    }
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return;
    }
    try {
      const replaced = this.garage.save({ name, ...this.workbench.robot(robotIndex) });
      this.notice.show(t(replaced ? 'garage.savedInstead' : 'garage.saved', { robot: robotId, name }));
    } catch (error) {
      this.notice.show(t('garage.couldNotSave', { name, reason: describeError(error) }), true);
    }
    this.show();
  }

  /** Puts a saved robot's code and parts in place of the robot's own. The code can be brought back by undoing in its editor. */
  private load(name: string, robotIndex: number): void {
    const saved = this.garage?.find(name);
    if (saved === undefined) return;
    this.workbench.load(robotIndex, saved);
    this.notice.show(t('garage.loaded', { name, robot: this.robotIds[robotIndex] }));
  }

  private remove(name: string): void {
    if (this.garage === null) return;
    try {
      this.garage.remove(name);
      this.notice.show(t('garage.deleted', { name }));
    } catch (error) {
      this.notice.show(t('garage.couldNotDelete', { name, reason: describeError(error) }), true);
    }
    this.show();
  }

  /** The share code of a saved robot. */
  private async share(name: string): Promise<string | null> {
    const saved = this.garage?.find(name);
    return saved === undefined ? null : encodeRobot(saved);
  }

  /** Keeps the robot in a share code, and says so, or says what is wrong with the code. True when it was kept. */
  private async importCode(code: string): Promise<boolean> {
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return false;
    }
    const decoded = await decodeRobot(code);
    if (!decoded.ok) {
      this.notice.show(t('garage.couldNotImport', { problem: decoded.problem }), true);
      return false;
    }
    return this.keepOne(decoded.shared.robot, decoded.shared.rules);
  }

  /** Has the browser save a robot of the garage as a file. */
  private saveFile(name: string): void {
    const saved = this.garage?.find(name);
    if (saved !== undefined) downloadText(fileName(saved.name), robotFileText(saved));
  }

  /** Keeps the robot of a robot file, or says what is wrong with the file. */
  private importFile(text: string): void {
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return;
    }
    const read = readSharedFile(text);
    if (!read.ok || read.file.kind !== 'robot') {
      this.notice.show(t('file.couldNotOpen', { problem: read.ok ? t('file.notARobot') : read.problem }), true);
      return;
    }
    this.keepOne(read.file.robot, read.file.rules);
  }

  /** Keeps a robot received from someone and says so, with a word when it was made under other rules; true when it was kept. */
  private keepOne(robot: SavedRobot, rules: string): boolean {
    if (this.garage === null) return false;
    let kept = false;
    try {
      const name = this.garage.importRobot(robot);
      const received = name === robot.name ? t('garage.received', { name }) : t('garage.receivedAs', { name: robot.name, kept: name });
      const otherRules = rules === RULES_VERSION ? '' : t('garage.otherRules', { rules: rules || t('share.unknown'), now: RULES_VERSION });
      this.notice.show(`${received}${otherRules}`);
      kept = true;
    } catch (error) {
      this.notice.show(t('garage.couldNotKeep', { name: robot.name, reason: describeError(error) }), true);
    }
    this.show();
    return kept;
  }

  private show(): void {
    this.panel.show(this.list().map((robot) => robot.name));
  }
}
