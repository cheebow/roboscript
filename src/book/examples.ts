// The programs of the book that its text says something exact about: how
// many ticks a line takes, which lines run together. tests/book.test.ts plays
// each one and checks that the game still does what the text says.

/** Chapter 1: the first program read line by line. */
export const FIRST_PROGRAM = `loop
    turn enemy
    fire
`;

/** Chapter 2: one shot, then the program is over. */
export const ONE_SHOT = `fire
`;

/** Chapter 2: shooting over and over. */
export const KEEP_FIRING = `loop
    fire
`;

/** Chapter 2: driving is a setting: it goes on by itself. */
export const DRIVE_ON = `drive forward
`;

/** Chapter 2: a quarter turn to the left, then straight on. */
export const TURN_THEN_DRIVE = `turn left 90
drive forward
`;

/** Chapter 3: which line runs on which tick. Line 2 takes no time, so line 3 runs in the same tick. */
export const TICK_BY_TICK = `turn left
drive forward
fire
wait
turn right
`;

/** Chapter 3: one line that takes 15 ticks. */
export const LONG_TURN = `turn left 90
fire
`;

/** Chapter 3: turning right round to an enemy behind: one line for a whole second. */
export const FACE_BEHIND = `face enemy
fire
`;

/** Chapter 3: a loop with two actions in it takes two ticks a round. */
export const TWO_TICK_LOOP = `loop
    turn left
    fire
`;

/** Chapter 3: a loop without an action never gets to the end of its tick. */
export const NO_ACTION_LOOP = `loop
    drive forward
`;

/** Chapter 4: a robot that only looks, so its sensors can be read tick by tick. */
export const JUST_LOOK = `loop
    wait
`;

/** Chapter 5: drive until the target comes into sight, then stop and shoot once. */
export const UNTIL_SEEN = `drive forward
while not enemy_visible
    wait
drive stop
aim enemy
fire
`;

/** Chapter 5: drive until the target comes into sight, then shoot it, for as long as it is in sight. */
export const SEARCH_AND_SHOOT = `drive forward
loop
    if enemy_visible
        drive stop
        aim enemy
        fire
    else
        wait
`;

/** Chapter 5: a bullet coming comes first. */
export const GUARD_FIRST = `loop
    if bullet_incoming
        guard
    else if enemy_visible
        aim enemy
        fire
`;

/** Chapter 5: the same two checks the other way round. */
export const FIRE_FIRST = `loop
    if enemy_visible
        aim enemy
        fire
    else if bullet_incoming
        guard
`;

/** Chapter 5: turning a tick at a time, checking for bullets on every one. */
export const TURN_AND_CHECK = `loop
    if bullet_incoming
        guard
    else
        turn enemy
`;

/** Chapter 6: drive for exactly two seconds, counting the ticks. */
export const TIMED_DRIVE = `set ticks = 0
drive forward
while ticks < 60
    set ticks = ticks + 1
    wait
drive stop
`;

/** Chapter 6: remember the HP of the tick before, and back off after the third hit. */
export const COUNT_HITS = `set last_hp = hp
set hits = 0
loop
    if hp < last_hp
        set hits = hits + 1
    set last_hp = hp
    if hits >= 3
        drive backward
    wait
`;

/** Chapter 7: SEARCH_AND_SHOOT, its parts given names. It plays exactly the same match. */
export const SEARCH_AND_SHOOT_IN_FUNCTIONS = `def attack()
    drive stop
    aim enemy
    fire

def search()
    wait

drive forward
loop
    if enemy_visible
        attack()
    else
        search()
`;

/** Chapter 7: a function that gives back a number. */
export const WITHIN_RANGE = `def margin()
    return weapon_range - enemy_distance

drive forward
loop
    if margin() > 0
        drive stop
        aim enemy
        fire
    else
        wait
`;

/** Chapter 7: a function that takes time cannot be asked for a value. */
export const VALUE_THAT_TAKES_TIME = `def near()
    wait
    return 1

loop
    if near()
        fire
    wait
`;

/** Chapter 8: three common mistakes. */
export const MISSING_INDENT = `loop
fire
`;
export const MISSPELT = `loop
    fier
`;
export const NEVER_SET = `loop
    if hp < limit
        guard
    wait
`;

/** Chapter 8: drives into the wall and stays there. */
export const STUCK = `drive forward
loop
    wait
`;

/** Chapter 8: the same, turning when the way is blocked, with labels to see which branch runs. */
export const UNSTUCK = `drive forward
loop
    if blocked
        label TURN
        turn right
    else
        label GO
        wait
`;
