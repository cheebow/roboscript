/**
 * A short program for each word of the language, shown under it in the list
 * of all words. Each is a whole program that runs as it is (a test sees to
 * that), so that it can be put in the editor and tried. Keyed by the kind
 * and the word: `hit` is both a sensor and a direction.
 */
export const WORD_EXAMPLES: Readonly<Record<string, string>> = {
  // Control
  'control:if': `loop
    if enemy_visible
        fire
    wait`,
  'control:else': `loop
    if enemy_visible
        fire
    else
        turn left`,
  'control:loop': `loop
    turn left
    fire`,
  'control:while': `loop
    while not enemy_visible
        turn left
    fire`,
  'control:break': `loop
    while not enemy_visible
        turn left
        if hit
            break
    fire`,
  'control:def': `def shoot()
    aim enemy
    fire

loop
    shoot()`,
  'control:return': `def room()
    return weapon_range - enemy_distance

loop
    if room() > 50
        fire
    wait`,
  'control:true': `def ready()
    return true

loop
    if ready()
        fire
    wait`,
  'control:false': `def ready()
    return false

loop
    if ready()
        fire
    wait`,
  'control:and': `loop
    if enemy_visible and enemy_distance < weapon_range
        fire
    wait`,
  'control:or': `loop
    if blocked or hit
        turn left
    else
        wait`,
  'control:not': `loop
    if not enemy_visible
        turn left
    else
        fire`,

  // Commands
  'command:set': `set shots = 0
loop
    fire
    set shots = shots + 1`,
  'command:label': `loop
    if enemy_visible
        label ATTACK
        fire
    else
        label SEARCH
        turn left`,
  'command:drive': `drive forward
loop
    if blocked
        drive stop
    wait`,
  'command:turn': `loop
    turn left`,
  'command:face': `loop
    face enemy
    fire`,
  'command:aim': `loop
    aim enemy
    fire`,
  'command:fire': `loop
    fire`,
  'command:guard': `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else
        wait`,
  'command:wait': `loop
    wait`,

  // Directions
  'direction:forward': `drive forward
loop
    wait`,
  'direction:backward': `drive backward
loop
    wait`,
  'direction:stop': `drive forward
loop
    if blocked
        drive stop
    wait`,
  'direction:left': `loop
    turn left`,
  'direction:right': `loop
    aim right`,
  'direction:enemy': `loop
    turn enemy
    aim enemy
    fire`,
  'direction:lead': `loop
    aim lead
    fire`,
  'direction:ahead': `loop
    aim ahead
    drive forward
    wait`,
  'direction:cover': `loop
    if cover_visible and not hidden
        face cover
        drive forward
    else
        drive stop
    wait`,
  'direction:hit': `loop
    if hit
        face hit
    wait`,

  // Sensors
  'sensor:enemy_visible': `loop
    if enemy_visible
        fire
    else
        turn left`,
  'sensor:blocked': `drive forward
loop
    if blocked
        turn left
    wait`,
  'sensor:blocked_behind': `drive backward
loop
    if blocked_behind
        drive forward
    wait`,
  'sensor:bullet_incoming': `loop
    if bullet_incoming
        drive forward
    else
        drive stop
    wait`,
  'sensor:cover_visible': `loop
    if cover_visible
        face cover
        drive forward
    wait`,
  'sensor:enemy_distance': `loop
    if enemy_distance > 300
        drive forward
    else
        drive stop
    turn enemy`,
  'sensor:enemy_angle': `loop
    if enemy_angle > 0
        turn right
    else
        turn left`,
  'sensor:hp': `loop
    if hp < 60
        label HURT
    fire`,
  'sensor:ammo': `loop
    if ammo > 0
        fire
    else
        wait`,
  'sensor:guards': `loop
    if guards > 0 and bullet_incoming and bullet_distance < 36
        guard
    else
        wait`,
  'sensor:bullet_distance': `loop
    if bullet_incoming and bullet_distance < 36
        guard
    else
        wait`,
  'sensor:bullet_angle': `loop
    if bullet_incoming and bullet_angle > 0
        turn left
    else
        wait`,
  'sensor:cover_distance': `loop
    if cover_distance > 0
        face cover
        drive forward
    else
        drive stop
    wait`,
  'sensor:cover_angle': `loop
    if cover_angle > 0
        turn right
    else
        turn left`,
  'sensor:wall_ahead': `drive forward
loop
    if wall_ahead < 50
        turn left
    wait`,
  'sensor:wall_behind': `drive backward
loop
    if wall_behind < 50
        drive stop
    wait`,
  'sensor:wall_left': `loop
    if wall_left < wall_right
        turn right
    else
        turn left`,
  'sensor:wall_right': `loop
    if wall_right < 50
        turn left
    wait`,
  'sensor:aim_angle': `loop
    if aim_angle > 2 or aim_angle < -2
        aim enemy
    else
        fire`,
  'sensor:lead_angle': `loop
    if lead_angle > 2 or lead_angle < -2
        aim lead
    else
        fire`,
  'sensor:gun_angle': `loop
    if gun_angle > 90
        aim ahead
    else
        aim right`,
  'sensor:weapon_range': `loop
    if enemy_distance < weapon_range
        fire
    else
        turn enemy
        drive forward`,
  'sensor:enemy_speed': `loop
    if enemy_speed > 0
        aim lead
    else
        aim enemy
    fire`,
  'sensor:enemy_heading': `loop
    if enemy_heading > 0
        aim right
    else
        aim left
    fire`,
  'sensor:reload': `loop
    if reload > 0
        aim enemy
    else
        fire`,
  'sensor:hit': `loop
    if hit
        label OUCH
        face hit
    fire`,
  'sensor:hit_angle': `loop
    if hit_angle > 0
        turn right
    else
        wait`,
  'sensor:touching_enemy': `loop
    if touching_enemy
        drive backward
    else
        drive stop
    fire`,
  'sensor:hidden': `loop
    if hidden
        drive stop
        wait
    else
        face cover
        drive forward`,
};
