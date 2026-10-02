import { it } from 'vitest';
import { ARENAS } from '../src/data/arenas';
import { MATCH_DEFAULTS } from '../src/data/match_defaults';
import {
  COST_LIMIT,
  type Loadout,
  PARTS,
  type Part,
  SLOTS,
  STANDARD_LOADOUT,
  costOf,
  partIn,
  partsOf,
  statsOf,
} from '../src/data/parts';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { TEMPLATES, type Template, templateSource } from '../src/data/templates';
import { playSeries } from '../src/sim/series';
import { compileBrain } from './helpers';

const SEEDS = [1, 2];
const ARENA_LIST = ARENAS.map(({ arena }) => arena);
/** The distances at which the templates decide to shoot or to close in. */
const ATTACK_DISTANCE = /(enemy_distance [<>] |attack\()(\d+)/g;

/**
 * The template as a player would tune it for the loadout's gun: the distances
 * it shoots from, written for the standard gun, in proportion to the gun's range.
 */
function tunedSource(template: Template, spawnIndex: number, loadout: Loadout): string {
  const reach = statsOf(loadout).weaponRange / ROBOT_DEFAULTS.weaponRange;
  return templateSource(template, spawnIndex).replace(
    ATTACK_DISTANCE,
    (_, before: string, distance: string) => `${before}${Math.round(Number(distance) * reach)}`,
  );
}

interface Score {
  matches: number;
  /** Wins, with a draw counting as half a win. */
  points: number;
  timeouts: number;
}

const NO_SCORE: Score = { matches: 0, points: 0, timeouts: 0 };

function add(a: Score, b: Score): Score {
  return { matches: a.matches + b.matches, points: a.points + b.points, timeouts: a.timeouts + b.timeouts };
}

function percent({ matches, points }: Score): string {
  return matches === 0 ? '  -' : `${Math.round((100 * points) / matches)}`.padStart(3);
}

/** How a robot with the loadout fares against one of standard parts that runs the same template. */
function fight(loadout: Loadout, template: Template): Score {
  const { matches, wins, draws, reasons } = playSeries({
    contenders: [
      {
        id: 'PARTS',
        stats: statsOf(loadout),
        createBrain: (spawnIndex) => compileBrain(tunedSource(template, spawnIndex, loadout)),
      },
      {
        id: 'STANDARD',
        stats: ROBOT_DEFAULTS,
        createBrain: (spawnIndex) => compileBrain(templateSource(template, spawnIndex)),
      },
    ],
    arenas: ARENA_LIST,
    seeds: SEEDS,
    tickRate: MATCH_DEFAULTS.tickRate,
    maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
  });
  return { matches, points: wins[0] + draws / 2, timeouts: reasons.timeout };
}

function describe(loadout: Loadout): string {
  return SLOTS.map((slot) => partIn(loadout, slot).name.padEnd(8)).join(' ');
}

function allLoadouts(): Loadout[] {
  let loadouts: Partial<Loadout>[] = [{}];
  for (const slot of SLOTS) {
    loadouts = loadouts.flatMap((loadout) => partsOf(slot).map((part) => ({ ...loadout, [slot]: part.id })));
  }
  return loadouts as Loadout[];
}

function isStandard(loadout: Loadout): boolean {
  return SLOTS.every((slot) => loadout[slot] === STANDARD_LOADOUT[slot]);
}

const HEADER = `${'cost'.padStart(4)}  ${'all'.padStart(3)}  ${TEMPLATES.map((template) => template.name.slice(0, 6).padStart(6)).join(' ')}  timeouts`;
const INTRO = 'Win rate (%) against a robot of standard parts running the same template.';

function row(cost: number, scores: Score[]): string {
  const total = scores.reduce(add, NO_SCORE);
  const perTemplate = scores.map((score) => percent(score).padStart(6)).join(' ');
  return `${`${cost}`.padStart(4)}  ${percent(total)}  ${perTemplate}  ${`${total.timeouts}`.padStart(4)}/${total.matches}`;
}

// Run one of the two alone with `npm run balance -- -t swapped` or `-t limit`.

it('reports each part swapped into the standard robot', () => {
  const lines = ['', INTRO, `One part swapped, the rest standard (the cost limit of ${COST_LIMIT} is not applied here):`];
  lines.push(`${''.padEnd(16)} ${HEADER}`);
  for (const part of PARTS) {
    if (part.id === STANDARD_LOADOUT[part.slot]) continue;
    const loadout = { ...STANDARD_LOADOUT, [part.slot]: part.id };
    const scores = TEMPLATES.map((template) => fight(loadout, template));
    lines.push(`${`${part.slot} ${part.name}`.padEnd(16)} ${row(costOf(loadout), scores)}`);
  }
  console.log([...lines, ''].join('\n'));
});

it('reports every loadout within the cost limit', () => {
  const allowed = allLoadouts().filter((loadout) => !isStandard(loadout) && costOf(loadout) <= COST_LIMIT);
  const results = allowed.map((loadout) => {
    const scores = TEMPLATES.map((template) => fight(loadout, template));
    const total = scores.reduce(add, NO_SCORE);
    return { loadout, scores, rate: total.points / total.matches };
  });
  results.sort((a, b) => b.rate - a.rate);

  const lines = ['', INTRO, `Every loadout within the cost limit (${results.length}), strongest first:`];
  lines.push(`${' '.repeat(describe(STANDARD_LOADOUT).length)} ${HEADER}`);
  for (const { loadout, scores } of results) lines.push(`${describe(loadout)} ${row(costOf(loadout), scores)}`);

  const byPart = new Map<Part, Score>();
  for (const { loadout, scores } of results) {
    for (const slot of SLOTS) {
      const part = partIn(loadout, slot);
      byPart.set(part, scores.reduce(add, byPart.get(part) ?? NO_SCORE));
    }
  }
  lines.push('', 'Each part, over the loadouts within the limit that carry it:');
  for (const part of PARTS) {
    const score = byPart.get(part);
    if (score !== undefined) lines.push(`${`${part.slot} ${part.name}`.padEnd(16)} ${percent(score)}`);
  }
  const rates = results.map((result) => Math.round(result.rate * 100));
  lines.push('', `Range over the loadouts: ${Math.min(...rates)}% to ${Math.max(...rates)}%`, '');
  console.log(lines.join('\n'));
});
