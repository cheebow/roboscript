import { RULES_VERSION } from '../data/rules_version';
import type { Loadout } from '../data/parts';
import { type MessageKey, t } from '../i18n/messages';
import { type SavedRobot, Garage, MAX_NAME_LENGTH, garageName, sameRobot } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { decodeRobot, encodeRobot } from '../share/codec';
import { type SharedFile, downloadText, fileName, readSharedFile, robotFileText } from '../share/file';
import { describeError } from './format';
import { GaragePanel, type GaragePanelOptions } from './garage_panel';
import { Notice } from './notice';

/** The robots on the program screen, as the garage sees them: what to save from, and where to load into. */
export interface Workbench {
  /** The program and parts the robot at the given spawn index has now. */
  robot(robotIndex: number): { source: string; loadout: Loadout };
  /** Puts the saved robot's program and parts in place of the robot's own. */
  load(robotIndex: number, robot: SavedRobot): void;
}

/**
 * One shelf of the garage (the robots, or the teams), as the shared
 * controller works it: where it is kept, how it is shared, and what a file
 * of it looks like.
 */
export interface Shelf<Kept extends { name: string }> {
  list(garage: Garage): Kept[];
  find(garage: Garage, name: string): Kept | undefined;
  /** Keeps under its own name; whether one kept under it was replaced. */
  save(garage: Garage, kept: Kept): boolean;
  remove(garage: Garage, name: string): void;
  /** Keeps under a free name, numbering if need be; the name it is kept under. */
  import(garage: Garage, kept: Kept): string;
  same(a: Kept, b: Kept): boolean;
  encode(kept: Kept): Promise<string>;
  decode(code: string): Promise<{ ok: true; kept: Kept; rules: string } | { ok: false; problem: string }>;
  fileText(kept: Kept): string;
  /** What of a shared file this shelf keeps; null when the file holds another kind. */
  fromFile(file: SharedFile): Kept | null;
  /** Said when a file holds another kind. */
  notAFile: MessageKey;
}

/**
 * A shelf of the garage and its panel: saving what the screen holds under a
 * name, loading it back, deleting, and taking in share codes and files.
 * What each action did is said under the garage.
 */
export class ShelfController<Kept extends { name: string }> {
  /** What the last action did, or why it could not: under the garage. */
  private readonly notice = new Notice();
  private readonly garage: Garage | null;
  private readonly panel: GaragePanel;

  constructor(
    container: HTMLElement,
    /** What each save / load button is about, by index, as shown to the player. */
    private readonly targets: readonly string[],
    storage: KeyValueStorage | null,
    private readonly shelf: Shelf<Kept>,
    private readonly bench: {
      /** What the target at the given index holds now, ready to be kept under a name. */
      take(index: number): Omit<Kept, 'name'>;
      /** Puts what was kept in place of the target's own. */
      load(index: number, kept: Kept): void;
    },
    panelOptions: GaragePanelOptions = {},
  ) {
    this.garage = storage === null ? null : new Garage(storage);
    this.panel = new GaragePanel(
      container,
      targets,
      {
        save: (name, index) => this.save(name, index),
        load: (name, index) => this.load(name, index),
        remove: (name) => this.remove(name),
        share: (name) => this.share(name),
        importCode: (code) => this.importCode(code),
        saveFile: (name) => this.saveFile(name),
        importFile: (text) => this.importFile(text),
      },
      panelOptions,
    );
    container.append(this.notice.element);
    this.show();
  }

  /** What the shelf keeps, read afresh. */
  list(): Kept[] {
    return this.garage === null ? [] : this.shelf.list(this.garage);
  }

  /** Keeps what came with a match, each under a name of its own; the names. Throws without storage. */
  keep(received: readonly Kept[]): string[] {
    const { garage } = this;
    if (garage === null) throw new Error(t('garage.noStorage'));
    const names = received.map((kept) => this.shelf.import(garage, kept));
    this.show();
    return names;
  }

  /** Keeps the target's code and parts as they are now, under the name typed. */
  private save(typedName: string, index: number): void {
    const name = garageName(typedName);
    const target = this.targets[index];
    if (name === null) {
      this.notice.show(t('garage.noName', { robot: target, max: MAX_NAME_LENGTH }), true);
      return;
    }
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return;
    }
    try {
      const replaced = this.shelf.save(this.garage, { name, ...this.bench.take(index) } as Kept);
      this.notice.show(t(replaced ? 'garage.savedInstead' : 'garage.saved', { robot: target, name }));
    } catch (error) {
      this.notice.show(t('garage.couldNotSave', { name, reason: describeError(error) }), true);
    }
    this.show();
  }

  /** Puts what was kept under the name in place of the target's own. The code can be brought back by undoing in its editor. */
  private load(name: string, index: number): void {
    if (this.garage === null) return;
    const saved = this.shelf.find(this.garage, name);
    if (saved === undefined) return;
    this.bench.load(index, saved);
    this.notice.show(t('garage.loaded', { name, robot: this.targets[index] }));
  }

  private remove(name: string): void {
    if (this.garage === null) return;
    try {
      this.shelf.remove(this.garage, name);
      this.notice.show(t('garage.deleted', { name }));
    } catch (error) {
      this.notice.show(t('garage.couldNotDelete', { name, reason: describeError(error) }), true);
    }
    this.show();
  }

  /** The share code of something kept under the name. */
  private async share(name: string): Promise<string | null> {
    if (this.garage === null) return null;
    const saved = this.shelf.find(this.garage, name);
    return saved === undefined ? null : this.shelf.encode(saved);
  }

  /** Keeps what is in a share code, and says so, or says what is wrong with the code. True when it was kept. */
  async importCode(code: string): Promise<boolean> {
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return false;
    }
    const decoded = await this.shelf.decode(code);
    if (!decoded.ok) {
      this.notice.show(t('garage.couldNotImport', { problem: decoded.problem }), true);
      return false;
    }
    return this.keepOne(decoded.kept, decoded.rules);
  }

  /** Has the browser save what is kept under the name as a file. */
  private saveFile(name: string): void {
    if (this.garage === null) return;
    const saved = this.shelf.find(this.garage, name);
    if (saved !== undefined) downloadText(fileName(saved.name), this.shelf.fileText(saved));
  }

  /** Keeps what is in a file of this shelf's kind, or says what is wrong with the file. */
  private importFile(text: string): void {
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return;
    }
    const read = readSharedFile(text);
    const kept = read.ok ? this.shelf.fromFile(read.file) : null;
    if (!read.ok || kept === null) {
      this.notice.show(t('file.couldNotOpen', { problem: read.ok ? t(this.shelf.notAFile) : read.problem }), true);
      return;
    }
    this.keepOne(kept, read.ok ? read.file.rules : '');
  }

  /** Keeps something received from someone and says so, with a word when it was made under other rules; true when it was kept. */
  private keepOne(received: Kept, rules: string): boolean {
    const { garage } = this;
    if (garage === null) return false;
    // The same thing again (a link opened twice, a code pasted twice): already there, not kept a second time.
    const same = this.shelf.list(garage).find((saved) => this.shelf.same(saved, received));
    if (same !== undefined) {
      this.notice.show(t('garage.alreadyThere', { name: same.name }));
      return true;
    }
    let kept = false;
    try {
      const name = this.shelf.import(garage, received);
      const text = name === received.name ? t('garage.received', { name }) : t('garage.receivedAs', { name: received.name, kept: name });
      const otherRules = rules === RULES_VERSION ? '' : t('garage.otherRules', { rules: rules || t('share.unknown'), now: RULES_VERSION });
      this.notice.show(`${text}${otherRules}`);
      kept = true;
    } catch (error) {
      this.notice.show(t('garage.couldNotKeep', { name: received.name, reason: describeError(error) }), true);
    }
    this.show();
    return kept;
  }

  private show(): void {
    this.panel.show(this.list().map((kept) => kept.name));
  }
}

/** The robots' shelf of the garage. */
const ROBOT_SHELF: Shelf<SavedRobot> = {
  list: (garage) => garage.list(),
  find: (garage, name) => garage.find(name),
  save: (garage, robot) => garage.save(robot),
  remove: (garage, name) => garage.remove(name),
  import: (garage, robot) => garage.importRobot(robot),
  same: sameRobot,
  encode: encodeRobot,
  decode: async (code) => {
    const decoded = await decodeRobot(code);
    return decoded.ok ? { ok: true, kept: decoded.shared.robot, rules: decoded.shared.rules } : decoded;
  },
  fileText: robotFileText,
  fromFile: (file) => (file.kind === 'robot' ? file.robot : null),
  notAFile: 'file.notARobot',
};

/** The garage of single robots, on the program screen. */
export class GarageController extends ShelfController<SavedRobot> {
  constructor(container: HTMLElement, robotIds: readonly string[], storage: KeyValueStorage | null, workbench: Workbench) {
    super(container, robotIds, storage, ROBOT_SHELF, {
      take: (index) => workbench.robot(index),
      load: (index, robot) => workbench.load(index, robot),
    });
  }
}
