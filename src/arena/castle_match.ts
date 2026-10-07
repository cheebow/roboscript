import type { ProgramFeatures } from '../ai/features';
import { compileScript } from '../ai/roboscript';
import { formatError } from '../ai/script_error';
import type { CastleArenaDefinition } from '../data/arenas';
import { castleSpawnsFor } from '../data/arenas/castle_common';
import { MAX_TEAM_SIZE, teamCostLimitFor } from '../data/castle';
import { MATCH_DEFAULTS } from '../data/match_defaults';
import { type Loadout, costOf, statsOf } from '../data/parts';
import { t } from '../i18n/messages';
import type { RobotBrain } from '../sim/ai_context';
import type { Fight, Refusal } from './match';

/** One side of a castle match: a name, one program, and the parts of each of its machines. */
export interface TeamSide {
  name: string;
  source: string;
  /** One loadout per machine, `teamSize` of them. */
  loadouts: readonly Loadout[];
}

/**
 * Sets up a castle match of `teamSize` robots a side: team 0 (the first side)
 * holds the right end, team 1 the left. Every machine of a team runs its own
 * copy of the team's program; the robots are called NAME-1, NAME-2, ...
 * Refused when a program does not compile or a team's parts cost more
 * together than the team limit.
 */
export function prepareCastleFight(
  sides: readonly [TeamSide, TeamSide],
  arena: CastleArenaDefinition,
  teamSize: number,
  seed: number,
): { ok: true; fight: Fight } | Refusal {
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > MAX_TEAM_SIZE) {
    return { ok: false, problems: [`A castle match takes 1 to ${MAX_TEAM_SIZE} robots a side, not ${teamSize}`] };
  }
  const problems: string[] = [];
  const limit = teamCostLimitFor(teamSize);
  const teamBrains: RobotBrain[][] = [];
  const teamFeatures: ProgramFeatures[] = [];
  sides.forEach((side) => {
    const cost = side.loadouts.slice(0, teamSize).reduce((sum, loadout) => sum + costOf(loadout), 0);
    if (cost > limit) problems.push(t('castle.costOverLimit', { team: side.name, cost, limit }));
    // Each machine runs its own copy of the program: one compile per machine, so no state is shared.
    const brains: RobotBrain[] = [];
    for (let machine = 0; machine < teamSize; machine++) {
      const compiled = compileScript(side.source);
      if (compiled.ok) {
        brains.push(compiled.brain);
        if (machine === 0) teamFeatures.push(compiled.features);
      } else {
        problems.push(...compiled.errors.map((error) => t('arena.problem', { robot: side.name, problem: formatError(error) })));
        break;
      }
    }
    teamBrains.push(brains);
  });
  if (problems.length > 0) return { ok: false, problems };

  const names = sides.flatMap((side) =>
    Array.from({ length: teamSize }, (_, machine) => robotIdOf(side.name, teamSize, machine + 1)),
  );
  const loadouts = sides.flatMap((side) => side.loadouts.slice(0, teamSize).map((loadout) => ({ ...loadout })));
  const features = sides.flatMap((_, team) => Array.from({ length: teamSize }, () => teamFeatures[team]));
  return {
    ok: true,
    fight: {
      names,
      loadouts,
      features,
      config: {
        arena: { ...arena.arena, spawns: castleSpawnsFor(teamSize) },
        tickRate: MATCH_DEFAULTS.tickRate,
        maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
        seed,
        robots: names.map((id, index) => ({
          id,
          brain: teamBrains[Math.floor(index / teamSize)][index % teamSize],
          stats: statsOf(loadouts[index]),
        })),
        teams: sides.flatMap((_, team) => Array.from({ length: teamSize }, () => team)),
        bases: arena.basesFor(teamSize),
      },
    },
  };
}

/** What a machine of a team is called in the match: the team's name alone for one robot a side, else NAME-1, NAME-2, ... */
export function robotIdOf(teamName: string, teamSize: number, machine: number): string {
  return teamSize === 1 ? teamName : `${teamName}-${machine}`;
}
