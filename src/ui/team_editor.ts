import { castleFieldConfig, prepareCastleFight, robotIdOf } from '../arena/castle_match';
import { type CastleArenaDefinition, findCastleArena } from '../data/arenas';
import { MAX_TEAM_SIZE, TEAM_DEFAULT_LOADOUT, teamCostLimitFor, teamCostOf } from '../data/castle';
import { ROBOT_IDS } from '../data/match_defaults';
import { type Loadout, statsOf } from '../data/parts';
import { TEAM_TEMPLATES } from '../data/team_templates';
import { TeamStore } from '../project/project_store';
import { IDLE_BRAIN } from '../sim/ai_context';
import type { SimulationConfig } from '../sim/simulation';
import { requireElement } from './dom';
import { describeError } from './format';
import { RobotWorkspace } from './robot_workspace';
import { TeamGarageController } from './team_garage_controller';

/** The element that holds each team's code editor. */
export const TEAM_EDITOR_ELEMENT_IDS = ['team-code', 'team-enemy-code'];
/** The programs the two teams start with. */
const DEFAULT_TEAM_SOURCES = [TEAM_TEMPLATES[1].source, TEAM_TEMPLATES[0].source];
/** How many robots a side the team battle starts with, until the player picks another size. */
const DEFAULT_TEAM_SIZE = 3;

/** What the team editor needs of the screen around it. */
export interface TeamEditorHooks {
  /** A team's code was edited. */
  codeEdited(workspace: RobotWorkspace): void;
  /** A line number of a team's code was clicked. */
  lineClicked(workspace: RobotWorkspace, line: number): void;
  /** How the last save of one thing went: a problem, or null when it worked. */
  noteSave(what: string, problem: string | null): void;
  /** The garage of teams loads a saved team in place of one of the two. */
  loadTeam(team: number, saved: { source: string; loadouts: readonly Loadout[] }): void;
}

/**
 * The team battle's editing: the two teams' programs and the parts of their
 * machines, the size of the sides and the base map, the machine each team's
 * editor follows, and the garage of teams — kept, and kept apart from the
 * duel's. It works out what the screen needs of them (the robots' ids, the
 * waiting field, the next match); the screen decides when to show what.
 */
export class TeamEditor {
  private readonly store: TeamStore | null;
  private workspaces: RobotWorkspace[] | null = null;
  private teamGarage: TeamGarageController | null = null;
  private teamSize: number;
  private arena: CastleArenaDefinition;
  /** The parts of each team's machines: loadouts[team][machine - 1], for every machine a side may field. */
  private readonly loadouts: Loadout[][];
  /** The machine each team's editor follows and outfits (1-based). */
  private readonly picked = [1, 1];
  /** The ids of the machines whose parts changed after the last RUN / DEBUG. */
  readonly partsStale = new Set<string>();

  constructor(
    private readonly storage: Storage | null,
    private readonly hooks: TeamEditorHooks,
  ) {
    this.store = storage === null ? null : new TeamStore(storage, DEFAULT_TEAM_SOURCES);
    const info = this.store?.loadInfo();
    this.teamSize = clampTeamSize(info?.teamSize);
    this.arena = findCastleArena(info?.arena ?? null);
    this.loadouts = [0, 1].map((team) =>
      Array.from({ length: MAX_TEAM_SIZE }, (_, machine) => this.store?.loadLoadout(team, machine) ?? TEAM_DEFAULT_LOADOUT),
    );
  }

  /** Robots a side. */
  get size(): number {
    return this.teamSize;
  }

  /** The base map the team battle is fought on. */
  get castleArena(): CastleArenaDefinition {
    return this.arena;
  }

  /** The garage of teams; null until the editors are first made. */
  get garage(): TeamGarageController | null {
    return this.teamGarage;
  }

  /** The two team editors, made the first time they are wanted, with the garage of teams beside them. */
  ensureWorkspaces(): RobotWorkspace[] {
    if (this.workspaces === null) {
      this.workspaces = ROBOT_IDS.map(
        (teamName, team) =>
          new RobotWorkspace(teamName, requireElement(TEAM_EDITOR_ELEMENT_IDS[team]), this.store?.loadSource(team) ?? DEFAULT_TEAM_SOURCES[team], {
            save: (code) => this.store?.saveSource(team, code),
            edited: (workspace) => this.hooks.codeEdited(workspace),
            saveProblem: (problem) => this.hooks.noteSave(`team-code:${team}`, problem),
            lineClicked: (workspace, line) => this.hooks.lineClicked(workspace, line),
          }),
      );
      this.teamGarage = new TeamGarageController(requireElement('team-garage'), [...ROBOT_IDS], this.storage, {
        team: (team) => ({ source: this.workspaces?.[team].source ?? '', loadouts: this.fielded(team).map((loadout) => ({ ...loadout })) }),
        load: (team, saved) => this.hooks.loadTeam(team, saved),
      });
    }
    return this.workspaces;
  }

  /** Fields this many robots a side, kept for next time. */
  setSize(size: number): void {
    this.teamSize = clampTeamSize(size);
    try {
      this.store?.saveTeamSize(this.teamSize);
    } catch {
      // Storage may be full or blocked: the size then holds until the page is left.
    }
  }

  /** Fights on the base map with the id, kept for next time; why it could not be kept, or null. */
  setArena(id: string): string | null {
    this.arena = findCastleArena(id);
    try {
      this.store?.saveArena(this.arena.id);
      return null;
    } catch (error) {
      return describeError(error);
    }
  }

  /** The parts of a team's machine (1-based). */
  loadoutOf(team: number, machine: number): Loadout {
    return this.loadouts[team][machine - 1];
  }

  /** Gives a team's machine the parts, kept for next time; why they could not be kept, or null. */
  setLoadout(team: number, machine: number, loadout: Loadout): string | null {
    this.loadouts[team][machine - 1] = loadout;
    try {
      this.store?.saveLoadout(team, machine - 1, loadout);
      return null;
    } catch (error) {
      return describeError(error);
    }
  }

  /** The parts of the machines a team fields, in order. */
  fielded(team: number): Loadout[] {
    return this.loadouts[team].slice(0, this.teamSize);
  }

  /** The parts the next match is fought with, flat in spawn order. */
  flatLoadouts(): Loadout[] {
    return [0, 1].flatMap((team) => this.fielded(team));
  }

  /** What a team's machines cost together, and the team's limit. */
  costOf(team: number): { cost: number; limit: number } {
    return { cost: teamCostOf(this.loadouts[team], this.teamSize), limit: teamCostLimitFor(this.teamSize) };
  }

  /** Every robot of the next match in spawn order: ALPHA's machines, then BRAVO's. */
  robotIds(): string[] {
    return ROBOT_IDS.flatMap((name) => Array.from({ length: this.teamSize }, (_, machine) => robotIdOf(name, this.teamSize, machine + 1)));
  }

  /** The id of a team's machine (1-based). */
  robotIdOf(team: number, machine: number): string {
    return robotIdOf(ROBOT_IDS[team], this.teamSize, machine);
  }

  /** The team of each robot of the next match, in spawn order. */
  teams(): number[] {
    return Array.from({ length: this.teamSize * 2 }, (_, index) => Math.floor(index / this.teamSize));
  }

  /** The spawn index of a team's machine (1-based). */
  robotIndexOf(team: number, machine: number): number {
    return team * this.teamSize + machine - 1;
  }

  /** The team and the machine (1-based) of a spawn index. */
  machineAt(index: number): { team: number; machine: number } {
    return { team: Math.floor(index / this.teamSize), machine: (index % this.teamSize) + 1 };
  }

  /** The machine a team's editor follows, kept within the team size. */
  pickedMachine(team: number): number {
    return Math.min(this.picked[team], this.teamSize);
  }

  /** The robot a team's editor follows. */
  pickedRobotId(team: number): string {
    return this.robotIdOf(team, this.pickedMachine(team));
  }

  /** Makes a team's editor follow and outfit that machine (1-based). */
  pick(team: number, machine: number): void {
    this.picked[team] = machine;
  }

  /** The next match's field with every machine waiting: the bases, the spawns and the parts, without the programs. */
  idleConfig(seed: number): SimulationConfig {
    const loadouts = this.flatLoadouts();
    return {
      ...castleFieldConfig(this.arena, this.teamSize, seed),
      robots: this.robotIds().map((id, index) => ({ id, brain: IDLE_BRAIN, stats: statsOf(loadouts[index]) })),
    };
  }

  /** The next match: both teams' programs and machines, on the chosen base map. */
  prepareFight(seed: number) {
    const workspaces = this.ensureWorkspaces();
    return prepareCastleFight(
      [
        { name: ROBOT_IDS[0], source: workspaces[0].source, loadouts: this.fielded(0) },
        { name: ROBOT_IDS[1], source: workspaces[1].source, loadouts: this.fielded(1) },
      ],
      this.arena,
      this.teamSize,
      seed,
    );
  }
}

/** A team size as kept: within 1 to MAX_TEAM_SIZE, else the default. */
function clampTeamSize(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_TEAM_SIZE ? value : DEFAULT_TEAM_SIZE;
}
