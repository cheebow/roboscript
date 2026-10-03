
/**
 * The player's starting program: drives up to the enemy and shoots from close
 * by. It leaves the turret where it is, pointing straight ahead, and turns the
 * whole hull at the enemy; and it has to get closer than DumbBot before it
 * fires, which is why it loses to it as shipped. Each thing it does is a
 * function, and the loop at the end only chooses between them.
 */
export const SAMPLE_AI = `# Sample: drives up to the enemy and shoots from close by. "drive" keeps the hull going; each turn, aim or fire takes one tick.

# Goes round whatever is in the way.
def avoid()
    label SEARCH
    turn left

# Shoots from within the given distance, and drives up to the enemy from further away.
def attack(distance)
    turn enemy

    if enemy_distance < distance
        label ATTACK
        drive stop
        fire
    else
        label TRACK
        drive forward

def search()
    label SEARCH
    drive forward
    wait

loop
    if blocked
        avoid()
    else
        if enemy_visible
            attack(250)
        else
            search()
`;
