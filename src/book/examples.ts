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
