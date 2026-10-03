
/**
 * Closes in to weapon range, then keeps its hull side-on to the enemy and
 * drives to and fro across the enemy's line of fire while the turret tracks
 * where the enemy will be. A shot aimed at where it is now passes behind it.
 * It turns back at walls, and when an obstacle comes between it and the enemy.
 * Each of these is a function of its own, and the loop at the end puts them together.
 */
export const STRAFE_BOT = `# Drives across the enemy's line of fire, and shoots where the enemy will be.
set forward = 1   # which way it is crossing: 1 forward, 0 backward
set crossing = 0  # 1 once it is close enough to cross and shoot
set lost = 0      # ticks since it lost sight of the enemy while crossing

def abs(value)
    if value < 0
        return -value
    return value

def turn_back_at_walls()
    if forward == 1 and wall_ahead < 20
        set forward = 0
    if forward == 0 and wall_behind < 20
        set forward = 1

def keep_crossing()
    if forward == 1
        drive forward
    else
        drive backward

# Turns the hull until the enemy is on its left or right side.
def turn_side_on()
    if enemy_angle >= 0 and enemy_angle < 75 or enemy_angle < -105
        turn left
    else
        turn right

def close_in()
    label TRACK
    drive forward
    turn enemy

def cross_and_shoot()
    label ATTACK
    keep_crossing()
    if abs(abs(enemy_angle) - 90) > 15
        turn_side_on()
    else
        if abs(lead_angle) > 3
            aim lead
        else
            fire

# Something came between them: go back the way it came, for a while.
def cross_blind()
    if lost == 0
        set forward = 1 - forward
    set lost = lost + 1
    if lost > 60
        set crossing = 0
    keep_crossing()
    aim lead

def search()
    label SEARCH
    drive forward
    if blocked
        if other_way == 1
            turn right
        else
            turn left
    else
        wait

# Two robots that go round obstacles the same way can chase each other for good.
set other_way = 0  # 1 while it goes round obstacles on the other side
set lost = 0       # ticks since it last saw the enemy
loop
    if enemy_visible
        set lost = 0
    else
        # Ten seconds without a sight of the enemy: try going round the other way.
        set lost = lost + 1
        if lost > 300
            set lost = 0
            set other_way = 1 - other_way
    turn_back_at_walls()

    if enemy_visible
        set lost = 0
        if enemy_distance < weapon_range - 60
            set crossing = 1
        if enemy_distance > weapon_range - 10
            set crossing = 0

        if crossing == 0
            close_in()
        else
            cross_and_shoot()
    else
        if crossing == 1
            cross_blind()
        else
            search()
`;
