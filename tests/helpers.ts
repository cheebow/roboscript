import { compileScript } from '../src/ai/roboscript';
import { formatError } from '../src/ai/script_error';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS, type RobotStats } from '../src/data/robot_defaults';
import { findTemplate, templateSource } from '../src/data/templates';
import { type AIAction, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { Simulation, type SimulationConfig } from '../src/sim/simulation';
import type { Arena } from '../src/sim/types';

/** Shots fly perfectly straight, so hit timing in tests is exact. */
export const NO_SPREAD_STATS: RobotStats = { ...ROBOT_DEFAULTS, shotSpread: 0 };

/** No obstacles; the robots face each other 200 units apart. */
export const DUEL_ARENA: Arena = {
  width: 1000,
  height: 600,
  obstacles: [],
  spawns: [
    { x: 400, y: 300, rotation: 0 },
    { x: 600, y: 300, rotation: 180 },
  ],
};

/** Repeats the same action every tick. */
export class FixedBrain implements RobotBrain {
  private readonly action: AIAction;

  constructor(action: Partial<AIAction> = {}) {
    this.action = { ...createIdleAction(), ...action };
  }

  decide(): AIAction {
    return { ...this.action };
  }
}

export function createSimulation(
  brains: [RobotBrain, RobotBrain],
  overrides: Partial<SimulationConfig> = {},
): Simulation {
  return new Simulation({
    arena: DUEL_ARENA,
    stats: NO_SPREAD_STATS,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
    seed: MATCH_DEFAULTS.seed,
    robots: [
      { id: 'ALPHA', brain: brains[0] },
      { id: 'BRAVO', brain: brains[1] },
    ],
    ...overrides,
  });
}

/** Compiles RoboScript that is expected to be valid. */
export function compileBrain(source: string): RobotBrain {
  const result = compileScript(source);
  if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
  return result.brain;
}

/** The given template as loaded into the enemy's editor: turning right around obstacles. */
export function enemySource(templateId: string): string {
  const template = findTemplate(templateId);
  if (template === undefined) throw new Error(`No template "${templateId}"`);
  return templateSource(template, 1);
}

export function runTicks(simulation: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) simulation.step();
}

export function runToEnd(simulation: Simulation): void {
  while (simulation.result === null) simulation.step();
}
