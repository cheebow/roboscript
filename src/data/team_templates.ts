// Ready-made team programs for the castle match. One source drives every
// machine of the team; like the single-robot templates, each shows one idea
// plainly.

import type { Template } from './templates';

/** Everyone pushes for the enemy castle, shooting whatever shows itself on the way. */
export const CASTLE_RUSH = `# CastleRush: the whole team pushes for the enemy castle; enemies on the way are shot, and the castle once in range.
loop
    if enemy_visible and enemy_distance < weapon_range - 50
        label FIGHT
        drive stop
        aim enemy
        fire
    else if enemy_base_distance < weapon_range - 50
        # In range of the castle: stand, point everything at it, and shell it.
        label SIEGE
        drive stop
        face enemy_base
        aim ahead
        fire
    else
        label MARCH
        face enemy_base
        drive forward
`;

/** Machine 1 stays home to guard the castle; the rest push. One program, split by self_id. */
export const CASTLE_SPLIT = `# CastleSplit: machine 1 guards the castle while the others attack: one program, split by self_id.
def fight()
    drive stop
    aim enemy
    fire

loop
    if self_id == 1
        # The guard stays by its castle and shoots what comes.
        if enemy_visible and enemy_distance < weapon_range
            label GUARD
            fight()
        else if base_distance > 200
            label GO_HOME
            face base
            drive forward
        else
            label WATCH
            drive stop
            aim enemy
            wait
    else
        # The attackers push for the enemy castle.
        if enemy_visible and enemy_distance < weapon_range - 50
            label FIGHT
            fight()
        else if enemy_base_distance < weapon_range - 50
            label SIEGE
            drive stop
            face enemy_base
            aim ahead
            fire
        else
            label MARCH
            face enemy_base
            drive forward
`;

/** Whoever sees an enemy calls the team on the radio; the rest answer the call and converge. */
export const CASTLE_CALL = `# CastleCall: whoever sees an enemy calls the team with signal 1; the rest head for the caller. No call: march on the enemy castle.
# The radio holds one number for the whole team, and keeps it until someone sends another:
# a caller that loses sight takes its call back with signal 0 (a destroyed caller cannot).
set called = 0
loop
    if enemy_visible
        # Found one: keep calling while it is in sight, and fight it.
        signal 1
        set called = 1
        label FIGHT
        if enemy_distance < weapon_range - 50
            drive stop
            aim enemy
            fire
        else
            turn enemy
            drive forward
    else
        if called == 1
            signal 0
            set called = 0
        if ally_signal == 1
            # A teammate is calling: head for the nearest one and join its fight.
            label ANSWER
            face ally
            drive forward
        else
            label MARCH
            face enemy_base
            drive forward
`;

/** The team programs offered in the castle match, besides the single-robot templates. */
export const TEAM_TEMPLATES: readonly Template[] = [
  { id: 'castle_rush', name: 'CastleRush', source: CASTLE_RUSH },
  { id: 'castle_split', name: 'CastleSplit', source: CASTLE_SPLIT },
  { id: 'castle_call', name: 'CastleCall', source: CASTLE_CALL },
];

export function findTeamTemplate(id: string): Template | undefined {
  return TEAM_TEMPLATES.find((template) => template.id === id);
}
