import { describe, expect, it } from 'vitest';
import { analyze } from '../src/arena/analysis';
import { prepareCastleFight } from '../src/arena/castle_match';
import { commentaryOf } from '../src/arena/commentary';
import { CASTLE_ARENAS } from '../src/data/arenas';
import { EFFECT_LIFETIMES } from '../src/data/match_defaults';
import { TEAM_DEFAULT_LOADOUT } from '../src/data/castle';
import { TEAM_TEMPLATES } from '../src/data/team_templates';
import { recordMatch } from '../src/debug/recorder';

const KIT = [TEAM_DEFAULT_LOADOUT, TEAM_DEFAULT_LOADOUT, TEAM_DEFAULT_LOADOUT];

/** A castle match recorded to its end: CastleRush (A) against CastleSplit (B), which Rush usually wins by the castle. */
function recordCastle(seed = 7) {
  const prepared = prepareCastleFight(
    [
      { name: 'Attackers', source: TEAM_TEMPLATES[0].source, loadouts: KIT },
      { name: 'Keepers', source: TEAM_TEMPLATES[1].source, loadouts: KIT },
    ],
    CASTLE_ARENAS[0],
    3,
    seed,
  );
  if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
  return { recording: recordMatch(prepared.fight.config, EFFECT_LIFETIMES), fight: prepared.fight };
}

describe('the commentary of a castle match', () => {
  it('opens with the teams, follows the castles, and crowns the winning team', () => {
    const { recording, fight } = recordCastle();
    const lines = commentaryOf(recording, fight.names, 120, ['Attackers', 'Keepers']);
    const text = lines.map((line) => line.text).join('\n');
    expect(text).toMatch(/Attackers/);
    expect(text).toMatch(/Keepers/);
    // The start names the teams, not six robots.
    expect(lines[0].text).not.toMatch(/Attackers-1/);
    const result = recording.snapshots[recording.snapshots.length - 1].result;
    expect(result?.winnerTeam).not.toBeUndefined();
    if (result?.reason === 'base destroyed') {
      expect(text).toMatch(/castle|城/i);
    }
    // The ending names a team whenever somebody won.
    if (result?.winnerTeam !== null && result?.winnerTeam !== undefined) {
      const winner = ['Attackers', 'Keepers'][result.winnerTeam];
      expect(lines[lines.length - 1].text).toContain(winner);
    }
  });

  it('says a castle is under fire once enemy bullets wear it down', () => {
    const { recording, fight } = recordCastle();
    const anyCastleDamage = recording.snapshots.some((snapshot) => snapshot.bases.some((hp, i) => hp < (recording.bases?.[i].maxHp ?? 0)));
    const lines = commentaryOf(recording, fight.names, 120, ['Attackers', 'Keepers']);
    const text = lines.map((line) => line.text).join('\n');
    if (anyCastleDamage) expect(text).toMatch(/castle|城/i);
  });
});

describe('the analysis of a castle match', () => {
  it('carries the teams, the castles over the match, and the damage dealt to castles', () => {
    const { recording, fight } = recordCastle();
    const analysis = analyze(recording, fight.names);
    expect(analysis.teams).toEqual([0, 0, 0, 1, 1, 1]);
    expect(analysis.bases).toHaveLength(2);
    for (const base of analysis.bases ?? []) {
      expect(base.hp.length).toBeGreaterThan(1);
      expect(base.hp[0]).toBe(base.maxHp);
    }
    // Castle damage is counted apart from robot damage, and somebody dealt some (Rush shells the castle).
    const result = recording.snapshots[recording.snapshots.length - 1].result;
    if (result?.reason === 'base destroyed') {
      const total = analysis.robots.reduce((sum, robot) => sum + robot.castleDamage, 0);
      const fallen = (analysis.bases ?? []).find((base) => base.hp[base.hp.length - 1] <= 0);
      expect(fallen).toBeDefined();
      expect(total).toBeGreaterThanOrEqual(fallen?.maxHp ?? 0);
    }
  });
});
