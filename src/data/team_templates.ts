// Ready-made team programs for the base battle. One source drives every
// machine of the team; like the single-robot templates, each shows one idea
// plainly.

import type { Template } from './templates';

/**
 * Everyone runs straight for the enemy base and shells it; enemies are
 * shot only when they stand right in the way. Walls are felt along with a
 * turn, as the single-robot templates do.
 */
export const CASTLE_RUSH = `# BaseRush: the whole team runs for the enemy base and shells it. Enemies are shot only when they block the way.
loop
    if blocked
        # A wall or a corner in the way: feel along it.
        turn left
    else if enemy_base_distance < weapon_range - 50
        # In range of the base: stand and shell it.
        label SIEGE
        drive stop
        face enemy_base
        aim ahead
        fire
    else if enemy_visible and enemy_distance < weapon_range - 50
        # In the way, or shooting at us from ahead: clear it out, then march on.
        label FIGHT
        drive stop
        aim enemy
        fire
    else
        label MARCH
        face enemy_base
        drive forward
        wait
`;

/** Machine 1 stays home to guard the base; the rest push. One program, split by self_id. */
export const CASTLE_SPLIT = `# BaseSplit: machine 1 guards the base while the others attack: one program, split by self_id.
def fight()
    drive stop
    aim enemy
    fire

loop
    if self_id == 1
        # The guard stays by its base and shoots what comes.
        if enemy_visible and enemy_distance < weapon_range
            label GUARD
            fight()
        else if base_distance > 200
            label GO_HOME
            face base
            drive forward
            wait
        else
            label WATCH
            drive stop
            aim enemy
            wait
    else
        # The attackers push for the enemy base, fighting whatever shows itself.
        if blocked
            turn left
        else if enemy_visible and enemy_distance < weapon_range - 50
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
            wait
`;

/** Whoever sees an enemy calls the team on the radio; the rest answer the call and converge. */
export const CASTLE_CALL = `# BaseCall: whoever sees an enemy calls the team with signal 1; the rest head for the caller. No call: march on the enemy base.
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
        if blocked
            turn left
        else if ally_signal == 1
            # A teammate is calling: head for the nearest one and join its fight.
            label ANSWER
            face ally
            drive forward
            wait
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
            wait
`;

/**
 * Everyone stays home and defends. A match nobody ends goes to the team with
 * the healthier base, so a wall of defenders forces the enemy to come.
 */
export const CASTLE_TURTLE = `# BaseTurtle: the whole team walls in its own base. Time up goes by base HP, so the enemy has to come to us.
loop
    if enemy_visible and enemy_distance < weapon_range
        label GUARD
        drive stop
        aim enemy
        fire
    else if base_distance > 220
        label GO_HOME
        if blocked
            turn left
        else
            face base
            drive forward
            wait
    else
        label WATCH
        drive stop
        aim enemy
        wait
`;

/** Attacks while the team is whole; a fallen teammate sends everyone home to defend. */
export const CASTLE_RALLY = `# BaseRally: attack while the team is whole; once a teammate falls (allies_alive drops), the rest fall back and hold the base.
def fight()
    drive stop
    aim enemy
    fire

loop
    if allies_alive < 2
        # Somebody is down: no more pushing, the base comes first.
        if enemy_visible and enemy_distance < weapon_range
            label GUARD
            fight()
        else if base_distance > 220
            label FALL_BACK
            if blocked
                turn left
            else
                face base
                drive forward
                wait
        else
            label HOLD
            drive stop
            aim enemy
            wait
    else if blocked
        turn left
    else if enemy_visible and enemy_distance < weapon_range - 50
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
        wait
`;

/** Nothing but the base: it never fires at a robot. The purest race — trade bases and win by being faster. */
export const CASTLE_RUNNER = `# BaseRunner: nothing but the base. It never fires at a robot: it runs, and it shells.
loop
    if blocked
        turn left
    else if enemy_base_distance < weapon_range - 50
        label SIEGE
        drive stop
        face enemy_base
        aim ahead
        fire
    else
        label RUN
        face enemy_base
        drive forward
        wait
`;

/**
 * A football line-up: a keeper on the base, defenders on a line before it,
 * attackers away at the enemy base. Built for five; smaller teams field
 * the front of the line-up.
 */
export const CASTLE_FORMATION = `# BaseFormation: machine 1 keeps the base, 2 and 3 hold a line before it, the rest attack. A line-up by self_id.
def fight()
    drive stop
    aim enemy
    fire

loop
    if self_id == 1
        # The keeper stands on the base and shields it with its hull.
        if enemy_visible and enemy_distance < weapon_range
            label KEEPER
            fight()
        else if base_distance > 120
            label GO_HOME
            if blocked
                turn left
            else
                face base
                drive forward
                wait
        else
            label KEEPER
            drive stop
            aim enemy
            wait
    else if self_id <= 3
        # The defenders hold a line before the base.
        if enemy_visible and enemy_distance < weapon_range
            label DEFEND
            fight()
        else if base_distance > 260
            label LINE_UP
            if blocked
                turn left
            else
                face base
                drive forward
                wait
        else
            label DEFEND
            drive stop
            aim enemy
            wait
    else
        # The attackers go for the enemy base.
        if blocked
            turn left
        else if enemy_visible and enemy_distance < weapon_range - 50
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
            wait
`;

/** Machine 1 walks in front and soaks the first fire; the hit is the signal for the rest to run for the base. */
export const CASTLE_DECOY = `# BaseDecoy: machine 1 walks in front; the moment it is hit it turns decoy, and the rest run for the base.
loop
    if self_id == 1
        # The leader: being hit means the enemy has shown itself - call the run.
        if hit
            signal 1
        if ally_signal == 1 and bullet_incoming
            # The decoy holds the enemy's eyes: brace what is coming...
            label BRACE
            guard
        else if ally_signal == 1
            # ...and shoot back, as loudly as it can.
            label DECOY
            if enemy_visible
                drive stop
                aim enemy
                fire
            else
                face enemy_base
                drive forward
                wait
        else if enemy_base_distance < weapon_range - 50
            # Nobody has shot the leader: walk up and shell the base itself.
            label SIEGE
            drive stop
            face enemy_base
            aim ahead
            fire
        else if blocked
            turn left
        else
            label LEAD
            face enemy_base
            drive forward
            wait
    else if ally_signal == 1 or allies_alive == 0
        # The call is out (or the leader fell): the base, now.
        if enemy_base_distance < weapon_range - 50
            label SIEGE
            drive stop
            face enemy_base
            aim ahead
            fire
        else if enemy_visible and enemy_distance < weapon_range - 50
            # Only what blocks the way gets shot.
            label CLEAR
            drive stop
            aim enemy
            fire
        else if blocked
            turn left
        else
            label RUN
            face enemy_base
            drive forward
            wait
    else if ally_distance > 150
        # No call yet: stay on the leader's heels.
        label FOLLOW
        face ally
        drive forward
        wait
    else
        label WAIT
        drive stop
        wait
`;

/** The team programs offered in the base battle, besides the single-robot templates. */
export const TEAM_TEMPLATES: readonly Template[] = [
  { id: 'castle_rush', name: 'BaseRush', source: CASTLE_RUSH },
  { id: 'castle_split', name: 'BaseSplit', source: CASTLE_SPLIT },
  { id: 'castle_call', name: 'BaseCall', source: CASTLE_CALL },
  { id: 'castle_turtle', name: 'BaseTurtle', source: CASTLE_TURTLE },
  { id: 'castle_rally', name: 'BaseRally', source: CASTLE_RALLY },
  { id: 'castle_runner', name: 'BaseRunner', source: CASTLE_RUNNER },
  { id: 'castle_formation', name: 'BaseFormation', source: CASTLE_FORMATION },
  { id: 'castle_decoy', name: 'BaseDecoy', source: CASTLE_DECOY },
];

export function findTeamTemplate(id: string): Template | undefined {
  return TEAM_TEMPLATES.find((template) => template.id === id);
}
