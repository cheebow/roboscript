import { SAMPLE_AI } from '../src/data/templates/sample';

// Ways a player might write their AI (SPEC §32), used to check that the choice
// of strategy changes who wins. Those that move turn left around obstacles,
// like the sample AI, so they meet the enemy on the same side.

/** Drives up to the enemy and shoots from close by: the sample AI as shipped. */
export const APPROACH = SAMPLE_AI;

/** Shoots from the edge of weapon range and backs off when the enemy comes closer. */
export const KEEP_DISTANCE = `loop
    if blocked
        turn left
    else
        if enemy_visible
            turn enemy

            if enemy_distance < 400
                fire

                if enemy_distance < 350
                    move backward
            else
                move forward
        else
            move forward
`;

/** Never moves: turns to the enemy and shoots once it is in sight and in range. */
export const TURRET = `loop
    if enemy_visible
        turn enemy

        if enemy_distance < 400
            fire
    else
        wait
`;

/** Never stops: keeps driving at the enemy and shoots from the edge of weapon range onwards. */
export const RUSH = `loop
    if blocked
        turn left
    else
        move forward

        if enemy_visible
            turn enemy

            if enemy_distance < 400
                fire
`;

/** The sample AI from further away (the first improvement a player makes), as lines to put inside another program. */
function fight(indent: string): string {
  return `if blocked
    turn left
else
    if enemy_visible
        turn enemy

        if enemy_distance < 350
            fire
        else
            move forward
    else
        move forward`.replace(/^/gm, indent);
}

/** Gets out of the way of every bullet: turns side-on to it and drives off its path, to and fro between the walls. */
function sidestep(indent: string): string {
  return `if bullet_angle > 50 and bullet_angle < 130 or bullet_angle < -50 and bullet_angle > -130
    if forward == 1 and wall_ahead < 10
        set forward = 0
    if forward == 0 and wall_behind < 10
        set forward = 1
    if forward == 1
        move forward
    else
        move backward
else
    turn left`.replace(/^/gm, indent);
}

/** Never shoots: only gets out of the way of the bullets coming at it. */
export const SIDESTEP = `set forward = 1
loop
    if bullet_incoming
${sidestep('        ')}
    else
        wait
`;

/**
 * Wears the enemy down: fights until the first bullet comes, then only dodges
 * for as long as it takes the enemy to fire off all its ammo, then attacks.
 */
export const DODGE = `set forward = 1
set ticks = 0
loop
    if ticks > 0
        set ticks = ticks + 1
    if bullet_incoming
        if ticks == 0
            set ticks = 1
${sidestep('        ')}
    else
        if ticks == 0 or ticks > 1300
${fight('            ')}
        else
            wait
`;

/**
 * The sample AI firing from further away, and bracing on the very tick a
 * bullet hits: it looks for the bullet before every action.
 */
export const GUARD = `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else
        if blocked
            turn left
        else
            if enemy_visible
                turn enemy

                if bullet_incoming and bullet_distance < 36
                    guard
                else
                    if enemy_distance < 350
                        fire
                    else
                        move forward
            else
                move forward
`;

/** The same, but looking for the bullet only once per round of the loop, and so bracing a tick or two early. */
export const EARLY_GUARD = `loop
    if bullet_incoming and bullet_distance < 50
        guard
    else
${fight('        ')}
`;

export const STRATEGIES = {
  approach: APPROACH,
  keep_distance: KEEP_DISTANCE,
  turret: TURRET,
  rush: RUSH,
  dodge: DODGE,
  guard: GUARD,
  early_guard: EARLY_GUARD,
} as const;
