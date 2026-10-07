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
  'command:signal': `loop
    if enemy_visible
        signal 1
    else if ally_signal == 1
        face ally
        drive forward
    wait`,
  'command:drive': `drive forward
loop
    if blocked
        drive stop
    wait`,
  'command:turn': `turn left 90
loop
    turn right`,
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
  'direction:right': `aim right 30
loop
    fire`,
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
  'direction:back': `drive forward
loop
    if blocked
        face back
    wait`,
  'direction:ally': `loop
    if ally_distance > 300
        face ally
        drive forward
    wait`,
  'direction:base': `loop
    if base_hp < 300
        face base
        drive forward
    wait`,
  'direction:enemy_base': `face enemy_base
loop
    drive forward
    fire`,
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
  'sensor:sensor_range': `loop
    if sensor_range > 800
        label SCOUT
    else
        label GUNNER
    wait`,
  'sensor:max_speed': `loop
    if max_speed > 120
        label RUNNER
    else
        label WALKER
    wait`,
  'sensor:max_hp': `loop
    if hp < max_hp / 2
        face cover
        drive forward
    wait`,
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

  'sensor:self_id': `loop
    if self_id == 1
        label GUARD
    else
        label ATTACK
    wait`,
  'sensor:allies_alive': `loop
    if allies_alive == 0
        label ALONE
        face base
        drive forward
    wait`,
  'sensor:ally_signal': `loop
    if ally_signal == 2
        face ally
        drive forward
    wait`,
  'sensor:ally_distance': `loop
    if ally_distance > 400
        face ally
        drive forward
    else
        drive stop
    wait`,
  'sensor:ally_angle': `loop
    if ally_angle > 90 or ally_angle < -90
        turn ally
    wait`,
  'sensor:ally_hp': `loop
    if ally_hp < 60 and ally_hp > 0
        signal 2
    wait`,
  'sensor:base_hp': `loop
    if base_hp < 300
        signal 9
        face base
        drive forward
    wait`,
  'sensor:base_distance': `loop
    if base_distance > 250
        face base
        drive forward
    else
        drive stop
    wait`,
  'sensor:base_angle': `loop
    if abs(base_angle) > 90
        turn base
    wait`,
  'sensor:enemy_base_hp': `loop
    if enemy_base_hp > 0 and not enemy_visible
        face enemy_base
        drive forward
    fire`,
  'sensor:enemy_base_distance': `loop
    if enemy_base_distance < weapon_range
        drive stop
        aim ahead
        fire
    else
        drive forward
    wait`,
  'sensor:enemy_base_angle': `loop
    if abs(enemy_base_angle) > 10
        turn enemy_base
    else
        drive forward
    wait`,

  // Functions of the language
  'builtin:abs': `loop
    if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
  'builtin:min': `loop
    set limit = min(weapon_range - 50, 300)
    if enemy_visible and enemy_distance < limit
        drive stop
        fire
    else
        turn enemy
        drive forward`,
  'builtin:max': `loop
    set gap = max(enemy_distance - 200, 0)
    if gap > 0
        turn enemy
        drive forward
    else
        drive stop
        fire`,
  'builtin:sqrt': `set across = 30
set up = 40
set length = sqrt(across * across + up * up)
loop
    fire`,
  'builtin:random': `drive forward
loop
    if blocked
        turn left random(30, 150)
    else
        aim enemy
        fire`,
};
