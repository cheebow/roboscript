import { compileScript } from '../src/ai/roboscript';
import { formatError } from '../src/ai/script_error';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS, type RobotStats } from '../src/data/robot_defaults';
import { findTemplate, templateSource } from '../src/data/templates';
import { type AIAction, type AIContext, type RobotBrain, createIdleAction } from '../src/sim/ai_context';
import { Simulation, type SimulationConfig } from '../src/sim/simulation';
import type { Arena } from '../src/sim/types';

/** Shots fly perfectly straight, so hit timing in tests is exact. */
export const NO_SPREAD_STATS: RobotStats = { ...ROBOT_DEFAULTS, shotSpread: 0 };

/** The same, with guards to spare, for robots that guard on every tick. */
export const TIRELESS_GUARD_STATS: RobotStats = { ...NO_SPREAD_STATS, maxGuards: 10_000 };

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

/** What a robot at full strength senses with nothing around it: no enemy seen, no bullets, no walls. */
export const QUIET_CONTEXT: AIContext = {
  enemyVisible: false,
  enemyDistance: 0,
  enemyAngle: 0,
  enemyX: 0,
  enemyY: 0,
  hp: ROBOT_DEFAULTS.maxHp,
  ammo: ROBOT_DEFAULTS.maxAmmo,
  guards: ROBOT_DEFAULTS.maxGuards,
  blocked: false,
  blockedBehind: false,
  wallAhead: 0,
  wallBehind: 0,
  wallLeft: 0,
  wallRight: 0,
  bulletIncoming: false,
  bulletDistance: 0,
  bulletAngle: 0,
  coverVisible: false,
  coverDistance: 0,
  coverAngle: 0,
  aimAngle: 0,
  leadAngle: 0,
  gunAngle: 0,
};

const TURN = /\bturn (left|right)\b/g;

/** The program with every `turn left` and `turn right` swapped: a program for the player made to go round obstacles like the enemy. */
export function mirrorTurns(source: string): string {
  return source.replace(TURN, (_, side: string) => `turn ${side === 'left' ? 'right' : 'left'}`);
}

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
