import { t } from '../i18n/messages';
import { type SavedTeam, sameTeam } from '../project/garage';
import type { KeyValueStorage } from '../project/project_store';
import { decodeTeam, encodeTeam } from '../share/codec';
import { teamFileText } from '../share/file';
import { shareLink } from '../share/link';
import { type Shelf, ShelfController } from './garage_controller';

/** The two teams of the team battle, as the garage sees them: what to save from, and where to load into. */
export interface TeamWorkbench {
  /** The program and the machines' parts the given team has now (as many loadouts as it fields). */
  team(team: number): { source: string; loadouts: SavedTeam['loadouts'] };
  /** Puts the saved team's program and parts in place of the team's own. */
  load(team: number, saved: SavedTeam): void;
}

/** The teams' shelf of the garage, apart from the single robots'. */
const TEAM_SHELF: Shelf<SavedTeam> = {
  list: (garage) => garage.listTeams(),
  find: (garage, name) => garage.findTeam(name),
  save: (garage, team) => garage.saveTeam(team),
  remove: (garage, name) => garage.removeTeam(name),
  import: (garage, team) => garage.importTeam(team),
  same: sameTeam,
  encode: encodeTeam,
  decode: async (code) => {
    const decoded = await decodeTeam(code);
    return decoded.ok ? { ok: true, kept: decoded.shared.team, rules: decoded.shared.rules } : decoded;
  },
  fileText: teamFileText,
  fromFile: (file) => (file.kind === 'team' ? file.team : null),
  notAFile: 'file.notATeam',
};

/**
 * The garage of teams, in the team battle: saving either team under a name,
 * loading one back, deleting, and sharing teams as codes, links and files.
 * Teams are kept apart from the single robots, under names of their own.
 */
export class TeamGarageController extends ShelfController<SavedTeam> {
  constructor(container: HTMLElement, teamNames: readonly string[], storage: KeyValueStorage | null, workbench: TeamWorkbench) {
    super(
      container,
      teamNames.map((name) => t('team.name', { team: name })),
      storage,
      TEAM_SHELF,
      {
        take: (team) => workbench.team(team),
        load: (team, saved) => workbench.load(team, saved),
      },
      {
        link: (name, code) => ({
          url: shareLink('team', code, window.location.href),
          title: t('share.teamTitle', { name }),
          text: t('share.teamText', { name }),
        }),
        // The teams are told apart by their names (A / B), not by the word TEAM they share.
        loadLabels: teamNames.map((name) => name[0]),
        texts: {
          nameLabel: t('garage.team.nameLabel'),
          empty: t('garage.team.empty'),
          intakeTitle: t('garage.team.intakeTitle'),
          openFileTitle: t('garage.team.openFileTitle'),
        },
      },
    );
  }
}
