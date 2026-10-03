import { it } from 'vitest';
import { scatterSpawns } from '../src/arena/spawns';
import { ARENAS } from '../src/data/arenas';
import { ROBOT_DEFAULTS } from '../src/data/robot_defaults';
import { TEMPLATES, findTemplate } from '../src/data/templates';
import { AGGRESSIVE_BOT as OLD_AGGRESSIVE } from '/private/tmp/claude-501/-Users-cheebow-Dev-git-roboscript/7589e664-2200-4d31-8fd7-0739b2d14b1a/scratchpad/old_aggressive';
import { GUARD_BOT as OLD_GUARD } from '/private/tmp/claude-501/-Users-cheebow-Dev-git-roboscript/7589e664-2200-4d31-8fd7-0739b2d14b1a/scratchpad/old_guard';
import { compileBrain, createSimulation, runToEnd } from './helpers';

const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88];
function rate(source: string, selfId: string): string {
  let points = 0, matches = 0;
  for (const { arena } of ARENAS) {
    for (const other of TEMPLATES) {
      if (other.id === selfId) continue;
      for (const seed of SEEDS) {
        for (const first of [true, false]) {
          const brains: [any, any] = first ? [compileBrain(source), compileBrain(other.source)] : [compileBrain(other.source), compileBrain(source)];
          const s = createSimulation(brains, { arena: scatterSpawns(arena, seed), stats: ROBOT_DEFAULTS, seed });
          runToEnd(s);
          const me = first ? 'ALPHA' : 'BRAVO';
          const w = s.result?.winnerId;
          points += w === me ? 1 : w === null ? 0.5 : 0;
          matches++;
        }
      }
    }
  }
  return `${((100 * points) / matches).toFixed(1)}% of ${matches}`;
}
it('ab', () => {
  console.log(['',
    `AggressiveBot old: ${rate(OLD_AGGRESSIVE, 'aggressive_bot')}`,
    `AggressiveBot new: ${rate(findTemplate('aggressive_bot')!.source, 'aggressive_bot')}`,
    `GuardBot old: ${rate(OLD_GUARD, 'guard_bot')}`,
    `GuardBot new: ${rate(findTemplate('guard_bot')!.source, 'guard_bot')}`,
  ].join('\n'));
});
