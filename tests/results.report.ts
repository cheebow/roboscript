import { it } from 'vitest';
import { scatterSpawns } from '../src/arena/spawns';
import { ARENAS, DEFAULT_ARENA } from '../src/data/arenas';
import { LONG_WALL } from '../src/data/arenas/long_wall';
import { OPEN_FIELD } from '../src/data/arenas/open_field';
import { EFFECT_LIFETIMES, MATCH_DEFAULTS } from '../src/data/match_defaults';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { TEMPLATES } from '../src/data/templates';
import { SAMPLE_AI } from '../src/data/templates/sample';
import { recordMatch } from '../src/debug/recorder';
import type { Arena } from '../src/sim/types';
import { compileBrain, createSimulation, enemySource, mirrorTurns, runToEnd } from './helpers';
import { APPROACH, DODGE, EARLY_GUARD, GUARD, KEEP_DISTANCE, RUSH, STRAFE, TURRET, TURRET_LEAD } from './strategies';

// `npm run results`: the tables and figures of IMPLEMENTATION_STATUS.md that
// change whenever a stat, a template or an arena does. Run one part alone
// with `npm run results -- -t strategies` (or templates, default).

const { tickRate } = MATCH_DEFAULTS;
const FEW_SEEDS = [1, 2, 3, 4, 5];
const MANY_SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
const ENEMY_IDS = ['dumb_bot', 'aggressive_bot', 'coward_bot', 'guard_bot', 'cover_bot', 'strafe_bot'];
/** A match shorter than this is over almost as soon as the robots meet. */
const SHORT_SECONDS = 8;
const LONG_SECONDS = 30;

interface Outcome {
  winner: string;
  reason: string;
  ticks: number;
}

function duel(first: string, second: string, seed: number, arena: Arena): Outcome {
  const simulation = createSimulation([compileBrain(first), compileBrain(second)], { arena, stats: ROBOT_DEFAULTS, seed });
  runToEnd(simulation);
  return { winner: simulation.result?.winnerId ?? 'DRAW', reason: simulation.result?.reason ?? '', ticks: simulation.tick };
}

/** How the first program does against the second over the few seeds, as the tables word it. */
function tally(first: string, second: string, arena: Arena): string {
  const outcomes = FEW_SEEDS.map((seed) => duel(first, second, seed, arena));
  const won = outcomes.filter((outcome) => outcome.winner === 'ALPHA').length;
  const lost = outcomes.filter((outcome) => outcome.winner === 'BRAVO').length;
  const drawn = outcomes.length - won - lost;
  const timeouts = outcomes.filter((outcome) => outcome.reason === 'timeout').length;
  const note = timeouts > 0 ? `（時間切れ${timeouts}）` : '';
  if (won === outcomes.length) return `勝ち${note}`;
  if (lost === outcomes.length) return `負け${note}`;
  if (drawn === outcomes.length) return `分${note}`;
  const parts = [won > 0 ? `勝ち${won}` : '', drawn > 0 ? `分${drawn}` : '', lost > 0 ? `負け${lost}` : ''];
  return parts.filter((part) => part !== '').join(' ') + note;
}

function median(values: readonly number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

function percent(count: number, of: number): string {
  return `${((100 * count) / of).toFixed(1)}%`;
}

function print(lines: readonly string[]): void {
  console.log(['', ...lines, ''].join('\n'));
}

it('strategies: the player\'s ways of fighting against the enemy templates, and against each other', () => {
  const strategies: [string, string][] = [
    ['サンプルAIのまま', APPROACH],
    ['射撃距離を 250 → 350', APPROACH.replace('attack(250)', 'attack(350)')],
    ['遠距離維持型', KEEP_DISTANCE],
    ['動かず撃つ型', TURRET],
    ['動かず先読み型', TURRET_LEAD],
    ['突撃型', RUSH],
    ['横走り型', STRAFE],
    ['回避型', DODGE],
    ['防御型', GUARD],
    ['早すぎる防御型', EARLY_GUARD],
  ];
  const arenas: [string, Arena][] = [
    ['Center Block', DEFAULT_ARENA],
    ['Open Field', OPEN_FIELD],
    ['Long Wall', LONG_WALL],
  ];
  const lines: string[] = [];
  for (const [name, arena] of arenas) {
    lines.push(`**${name}**`, '', '| プレイヤーの戦い方 | 対 DumbBot | 対 AggressiveBot | 対 CowardBot | 対 GuardBot | 対 CoverBot | 対 StrafeBot |', '|---|---|---|---|---|---|---|');
    for (const [label, source] of strategies) {
      lines.push(`| ${label} | ${ENEMY_IDS.map((enemyId) => tally(source, enemySource(enemyId), arena)).join(' | ')} |`);
    }
    lines.push('');
  }
  lines.push('戦い方どうし（1つ目がプレイヤー）:');
  for (const { name, arena } of ARENAS) lines.push(`- 横走り型 対 動かず撃つ型、${name}: ${tally(STRAFE, mirrorTurns(TURRET), arena)}`);
  lines.push(`- 横走り型 対 動かず先読み型、Open Field: ${tally(STRAFE, mirrorTurns(TURRET_LEAD), OPEN_FIELD)}`);
  lines.push(`- 横走り型 対 遠距離維持型、Open Field: ${tally(STRAFE, mirrorTurns(KEEP_DISTANCE), OPEN_FIELD)}`);
  lines.push(`- 動かず撃つ型 対 動かず撃つ型、Center Block: ${tally(TURRET, mirrorTurns(TURRET), DEFAULT_ARENA)}`);
  print(lines);
});

it('templates: every template against every other, in every arena', () => {
  const lines: string[] = [];

  /** All pairings of two different templates, each running its program as it is. */
  const roundRobin = (label: string, field: (arena: Arena, seed: number) => Arena) => {
    const ticks: number[] = [];
    const reasons: Record<string, number> = {};
    const points = new Map<string, number>();
    const perArena: string[] = [];
    let variedLengths = 0;
    let variedWinners = 0;
    let pairings = 0;
    for (const { name, arena } of ARENAS) {
      let timeouts = 0;
      let matches = 0;
      for (const first of TEMPLATES) {
        for (const second of TEMPLATES) {
          if (first === second) continue;
          const lengths = new Set<number>();
          const winners = new Set<string>();
          for (const seed of MANY_SEEDS) {
            const outcome = duel(first.source, second.source, seed, field(arena, seed));
            ticks.push(outcome.ticks);
            reasons[outcome.reason] = (reasons[outcome.reason] ?? 0) + 1;
            lengths.add(outcome.ticks);
            winners.add(outcome.winner);
            matches++;
            if (outcome.reason === 'timeout') timeouts++;
            const score = outcome.winner === 'ALPHA' ? 1 : outcome.winner === 'DRAW' ? 0.5 : 0;
            points.set(first.name, (points.get(first.name) ?? 0) + score);
            points.set(second.name, (points.get(second.name) ?? 0) + 1 - score);
          }
          pairings++;
          variedLengths += lengths.size;
          if (winners.size > 1) variedWinners++;
        }
      }
      if (timeouts > 0) perArena.push(`${name} ${percent(timeouts, matches)}`);
    }
    const matches = ticks.length;
    const played = (matches * 2) / TEMPLATES.length;
    lines.push(
      `${label}（${matches}試合）`,
      `- 試合時間: 中央値 ${(median(ticks) / tickRate).toFixed(1)}秒、${SHORT_SECONDS}秒未満 ${percent(ticks.filter((t) => t < SHORT_SECONDS * tickRate).length, matches)}、${LONG_SECONDS}秒超 ${percent(ticks.filter((t) => t > LONG_SECONDS * tickRate).length, matches)}`,
      `- 決着: ${Object.entries(reasons).map(([reason, count]) => `${reason} ${percent(count, matches)}`).join('、')}`,
      `- 時間切れのあるマップ: ${perArena.length === 0 ? 'なし' : perArena.join('、')}`,
      `- seed ${MANY_SEEDS.length}個での試合時間の種類（平均）: ${(variedLengths / pairings).toFixed(2)}、seed で勝者が変わる組み合わせ: ${percent(variedWinners, pairings)}`,
      `- 勝率: ${TEMPLATES.map((template) => `${template.name} ${Math.round((100 * (points.get(template.name) ?? 0)) / played)}%`).join('、')}`,
      '',
    );
  };

  roundRobin('開始位置は固定', (arena) => arena);
  roundRobin('開始位置は seed でばらつく（PROGRAM / ARENA）', scatterSpawns);

  for (const [label, field] of [['固定', (arena: Arena) => arena], ['ばらつく', scatterSpawns]] as const) {
    let timeouts = 0;
    let matches = 0;
    const perArena: string[] = [];
    for (const { name, arena } of ARENAS) {
      let arenaTimeouts = 0;
      for (const template of TEMPLATES) {
        for (const seed of MANY_SEEDS) {
          matches++;
          if (duel(template.source, template.source, seed, field(arena, seed)).reason === 'timeout') arenaTimeouts++;
        }
      }
      timeouts += arenaTimeouts;
      if (arenaTimeouts > 0) perArena.push(`${name} ${percent(arenaTimeouts, TEMPLATES.length * MANY_SEEDS.length)}`);
    }
    lines.push(`同じテンプレートどうし、開始位置は${label}（${matches}試合）の時間切れ: ${percent(timeouts, matches)}${perArena.length > 0 ? `（${perArena.join('、')}）` : ''}`);
  }
  print(lines);
});

it('default: the first match, the sample against DumbBot, from the positions each seed gives', () => {
  const lines: string[] = [];
  const play = (source: string, seed: number) => {
    const simulation = createSimulation([compileBrain(source), compileBrain(enemySource('dumb_bot'))], {
      arena: scatterSpawns(DEFAULT_ARENA, seed),
      stats: ROBOT_DEFAULTS,
      seed,
    });
    runToEnd(simulation);
    return simulation;
  };
  const seeds = Array.from({ length: 100 }, (_, index) => index + 1);
  lines.push('Center Block、Sample 対 DumbBot、seed 1〜100（開始位置は seed でばらつく）:');
  for (const distance of [250, 350]) {
    const source = SAMPLE_AI.replace('attack(250)', `attack(${distance})`);
    const wins = { ALPHA: 0, BRAVO: 0, draw: 0 };
    let ticks = 0;
    for (const seed of seeds) {
      const simulation = play(source, seed);
      wins[simulation.result?.winnerId === 'ALPHA' ? 'ALPHA' : simulation.result?.winnerId === 'BRAVO' ? 'BRAVO' : 'draw']++;
      ticks += simulation.tick;
    }
    lines.push(`  attack(${distance}): ALPHA ${wins.ALPHA}勝、BRAVO ${wins.BRAVO}勝、引き分け ${wins.draw}、平均 ${(ticks / seeds.length / tickRate).toFixed(1)}秒`);
  }

  const seed = 2;
  const recording = recordMatch(
    {
      arena: scatterSpawns(DEFAULT_ARENA, seed),
      tickRate,
      maxMatchTime: MATCH_DEFAULTS.maxMatchTime,
      seed,
      robots: [
        { id: 'ALPHA', brain: compileBrain(SAMPLE_AI), stats: ROBOT_DEFAULTS },
        { id: 'BRAVO', brain: compileBrain(enemySource('dumb_bot')), stats: ROBOT_DEFAULTS },
      ],
    },
    EFFECT_LIFETIMES,
  );
  const [alphaStart, bravoStart] = recording.arena.spawns;
  lines.push('', `例: seed ${seed}（ALPHA (${alphaStart.x}, ${alphaStart.y})、BRAVO (${bravoStart.x}, ${bravoStart.y}) から。時刻、出来事、その tick に ALPHA が実行した行、HP）:`);
  const seen = new Set<string>();
  for (const event of recording.events) {
    if (event.type === 'hit') continue;
    // An action is listed the first time a robot takes it.
    const key = `${event.robotId} ${event.type} ${event.message}`;
    if (event.type === 'action' && seen.has(key)) continue;
    seen.add(key);
    const [alpha, bravo] = recording.snapshots[event.tick].robots;
    lines.push(`[${(event.tick / tickRate).toFixed(3)}] ${event.robotId ?? ''} ${event.type} ${event.message} | ${alpha.executedLines.join(', ')} | ALPHA ${alpha.hp} BRAVO ${bravo.hp}`);
  }
  const last = recording.snapshots[recording.snapshots.length - 1];
  lines.push(`${recording.snapshots.length - 1} ticks、${((recording.snapshots.length - 1) / tickRate).toFixed(3)}秒。ALPHA HP ${last.robots[0].hp}、BRAVO HP ${last.robots[1].hp}`);
  print(lines);
});
