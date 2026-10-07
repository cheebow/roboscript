import { RULES_VERSION } from '../data/rules_version';
import { SLOTS } from '../data/parts';
import { t } from '../i18n/messages';
import { Garage, MAX_NAME_LENGTH, type SavedTeam, garageName } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { decodeTeam, encodeTeam } from '../share/codec';
import { downloadText, fileName, readSharedFile, teamFileText } from '../share/file';
import { shareLink } from '../share/link';
import { describeError } from './format';
import { GaragePanel } from './garage_panel';
import { Notice } from './notice';

/** The two teams of the team battle, as the garage sees them: what to save from, and where to load into. */
export interface TeamWorkbench {
  /** The program and the machines' parts the given team has now (as many loadouts as it fields). */
  team(team: number): { source: string; loadouts: SavedTeam['loadouts'] };
  /** Puts the saved team's program and parts in place of the team's own. */
  load(team: number, saved: SavedTeam): void;
}

/**
 * The garage of teams, in the team battle: saving either team under a name,
 * loading one back, deleting, and sharing teams as codes, links and files.
 * Teams are kept apart from the single robots, under names of their own.
 */
export class TeamGarageController {
  private readonly notice = new Notice();
  private readonly garage: Garage | null;
  private readonly panel: GaragePanel;

  constructor(
    container: HTMLElement,
    private readonly teamNames: readonly string[],
    storage: KeyValueStorage | null,
    private readonly workbench: TeamWorkbench,
  ) {
    this.garage = storage === null ? null : new Garage(storage);
    this.panel = new GaragePanel(
      container,
      teamNames.map((name) => t('team.name', { team: name })),
      {
        save: (name, team) => this.save(name, team),
        load: (name, team) => this.load(name, team),
        remove: (name) => this.remove(name),
        share: (name) => this.share(name),
        importCode: (code) => this.importCode(code),
        saveFile: (name) => this.saveFile(name),
        importFile: (text) => this.importFile(text),
      },
      {
        link: (name, code) => ({
          url: shareLink('team', code, window.location.href),
          title: t('share.teamTitle', { name }),
          text: t('share.teamText', { name }),
        }),
      },
    );
    container.append(this.notice.element);
    this.show();
  }

  /** The saved teams, read afresh. */
  list(): SavedTeam[] {
    return this.garage?.listTeams() ?? [];
  }

  /** Keeps the team, its program and its machines' parts as they are now, under the name typed. */
  private save(typedName: string, team: number): void {
    const name = garageName(typedName);
    const teamName = t('team.name', { team: this.teamNames[team] });
    if (name === null) {
      this.notice.show(t('garage.noName', { robot: teamName, max: MAX_NAME_LENGTH }), true);
      return;
    }
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return;
    }
    try {
      const replaced = this.garage.saveTeam({ name, ...this.workbench.team(team) });
      this.notice.show(t(replaced ? 'garage.savedInstead' : 'garage.saved', { robot: teamName, name }));
    } catch (error) {
      this.notice.show(t('garage.couldNotSave', { name, reason: describeError(error) }), true);
    }
    this.show();
  }

  /** Puts a saved team's program and parts in place of the team's own. The code can be brought back by undoing in its editor. */
  private load(name: string, team: number): void {
    const saved = this.garage?.findTeam(name);
    if (saved === undefined) return;
    this.workbench.load(team, saved);
    this.notice.show(t('garage.loaded', { name, robot: t('team.name', { team: this.teamNames[team] }) }));
  }

  private remove(name: string): void {
    if (this.garage === null) return;
    try {
      this.garage.removeTeam(name);
      this.notice.show(t('garage.deleted', { name }));
    } catch (error) {
      this.notice.show(t('garage.couldNotDelete', { name, reason: describeError(error) }), true);
    }
    this.show();
  }

  /** The share code of a saved team. */
  private async share(name: string): Promise<string | null> {
    const saved = this.garage?.findTeam(name);
    return saved === undefined ? null : encodeTeam(saved);
  }

  /** Keeps the team in a share code, and says so, or says what is wrong with the code. True when it was kept. */
  async importCode(code: string): Promise<boolean> {
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return false;
    }
    const decoded = await decodeTeam(code);
    if (!decoded.ok) {
      this.notice.show(t('garage.couldNotImport', { problem: decoded.problem }), true);
      return false;
    }
    return this.keepOne(decoded.shared.team, decoded.shared.rules);
  }

  /** Has the browser save a team of the garage as a file. */
  private saveFile(name: string): void {
    const saved = this.garage?.findTeam(name);
    if (saved !== undefined) downloadText(fileName(saved.name), teamFileText(saved));
  }

  /** Keeps the team of a team file, or says what is wrong with the file. */
  private importFile(text: string): void {
    if (this.garage === null) {
      this.notice.show(t('garage.noStorage'), true);
      return;
    }
    const read = readSharedFile(text);
    if (!read.ok || read.file.kind !== 'team') {
      this.notice.show(t('file.couldNotOpen', { problem: read.ok ? t('share.notATeam') : read.problem }), true);
      return;
    }
    this.keepOne(read.file.team, read.file.rules);
  }

  /** Keeps a team received from someone and says so, with a word when it was made under other rules; true when it was kept. */
  private keepOne(team: SavedTeam, rules: string): boolean {
    if (this.garage === null) return false;
    const same = this.garage.listTeams().find((saved) => sameTeam(saved, team));
    if (same !== undefined) {
      this.notice.show(t('garage.alreadyThere', { name: same.name }));
      return true;
    }
    let kept = false;
    try {
      const name = this.garage.importTeam(team);
      const received = name === team.name ? t('garage.received', { name }) : t('garage.receivedAs', { name: team.name, kept: name });
      const otherRules = rules === RULES_VERSION ? '' : t('garage.otherRules', { rules: rules || t('share.unknown'), now: RULES_VERSION });
      this.notice.show(`${received}${otherRules}`);
      kept = true;
    } catch (error) {
      this.notice.show(t('garage.couldNotKeep', { name: team.name, reason: describeError(error) }), true);
    }
    this.show();
    return kept;
  }

  private show(): void {
    this.panel.show(this.list().map((team) => team.name));
  }
}

/** Whether two teams are the same: the same name, program, and machines' parts. */
function sameTeam(a: SavedTeam, b: SavedTeam): boolean {
  if (a.name !== b.name || a.source !== b.source || a.loadouts.length !== b.loadouts.length) return false;
  return a.loadouts.every((loadout, index) => SLOTS.every((slot) => loadout[slot] === b.loadouts[index][slot]));
}
