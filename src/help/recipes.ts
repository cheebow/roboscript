// The recipes of the help: short programs, one for each thing a player may want a robot to do.
// Each one runs as it is; tests/recipes.test.ts checks that it does what its text says.
import type { Text } from '../tutorial/types';

export interface Recipe {
  id: string;
  title: Text;
  text: Text;
  code: string;
}

export interface RecipeGroup {
  title: Text;
  recipes: readonly Recipe[];
}

export const RECIPE_GROUPS: readonly RecipeGroup[] = [
  {
    title: { en: 'The flow of the program', ja: '流れ' },
    recipes: [
      {
        id: 'once',
        title: { en: 'Do something only once, at the start', ja: '始めに 1 回だけ何かをする' },
        text: {
          en: 'The program runs from the top just once, so lines above `loop` run once at the start of the match. This one turns 90 degrees left first, then keeps shooting at the enemy.',
          ja: 'プログラムは上から 1 回だけ流れるので、`loop` より上に書いた行は、試合の始めに 1 回だけ動きます。この例は、まず左へ 90 度向いてから、敵を撃ち続けます。',
        },
        code: `turn left 90
loop
    face enemy
    fire`,
      },
      {
        id: 'wait-seconds',
        title: { en: 'Wait for some seconds', ja: '○秒待つ' },
        text: {
          en: 'A second is 30 ticks, so 30 `wait`s make a second. Made into a function, it is written in seconds: `wait_seconds(2)`. This one drives for 2 seconds, then stops.',
          ja: '1 秒は 30 tick なので、`wait` を 30 回で 1 秒です。関数にしておくと、`wait_seconds(2)` のように秒で書けます。この例は 2 秒走ってから止まります。',
        },
        code: `def wait_seconds(s)
    set n = 0
    while n < s * 30
        wait
        set n = n + 1

drive forward
wait_seconds(2)
drive stop`,
      },
      {
        id: 'every',
        title: { en: 'Do something else every so often', ja: 'ときどき別のことをする' },
        text: {
          en: 'Add 1 to `t` on every round of the `loop`. With one action a round, `t` counts the ticks. Every 90 ticks (3 seconds) the robot turns 90 degrees right; on the other ticks it aims at the enemy and shoots.',
          ja: '`loop` を 1 周するたびに `t` を 1 増やします。1 周で行動を 1 つだけにすると、`t` は過ぎた tick の数になります。90 tick（3 秒）ごとに右へ 90 度曲がり、そのほかの tick は敵を狙って撃ちます。',
        },
        code: `set t = 0
drive forward
loop
    set t = t + 1
    if t == 90
        set t = 0
        turn right 90
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'random-turn',
        title: { en: 'Turn a different way each time, to be hard to read', ja: '毎回ちがう向きに曲がって、動きを読まれにくくする' },
        text: {
          en: '`random(-90, 90)` is a whole number from -90 to 90, a different one each time; `turn right` by a negative angle turns left. Every 2 seconds the robot turns a different way, so an enemy that aims ahead of it misses more. The numbers come from the seed of the match, so the same match turns the same way every time.',
          ja: '`random(-90, 90)` は、-90 から 90 までの整数で、毎回ちがう数になります。`turn right` にマイナスの角度を書くと、左へ回ります。2 秒ごとにちがう向きへ曲がるので、動く先を狙ってくる敵の弾が外れやすくなります。数は試合の seed から作るので、同じ試合なら毎回同じ向きに曲がります。',
        },
        code: `set t = 0
drive forward
loop
    set t = t + 1
    if t == 60 or blocked
        set t = 0
        turn right random(-90, 90)
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'search',
        title: { en: 'Look round until the enemy is found', ja: '見つかるまで探す' },
        text: {
          en: '`while` repeats its block as long as the condition holds, and goes on to the next line once it does not. Here the robot turns left for as long as it sees no enemy; the moment it sees one it leaves the `while` and shoots. The `loop` brings it back to the `while`, which lets it through at once while the enemy is in sight. Handy with the Scope sensor, which sees only ahead.',
          ja: '`while` は、条件が正しいあいだ中身を繰り返し、正しくなくなったら次の行へ進みます。ここでは、敵が見えないあいだ左へ回り続け、見えた瞬間に `while` を抜けて撃ちます。`loop` で `while` に戻ってきても、敵が見えていればすぐに通り抜けます。前しか見えない Scope のセンサーで役立ちます。',
        },
        code: `loop
    while not enemy_visible
        label SEARCH
        turn left
    label FIGHT
    if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'mode',
        title: { en: 'Remember a plan in a variable', ja: '作戦を変数で覚えておく' },
        text: {
          en: 'A sensor tells what is happening now; a variable remembers what happened. `mode` is the plan: 1 charges in, 2 keeps away. `hits` counts the shots taken, and the third one switches the plan for good. The first half picks the driving by the plan, the second half does one action. Add more numbers for more plans.',
          ja: 'センサーは「今」のことしか分かりませんが、変数は「これまで」を覚えておけます。`mode` が作戦で、1 は突っ込む、2 は距離をとる。`hits` で撃たれた回数を数え、3 発目で作戦を切り替えて、もう戻しません。前半で作戦に合わせて走り方を決め、後半で行動を 1 つします。数を増やせば、作戦をいくつでも持てます。',
        },
        code: `set mode = 1
set hits = 0
loop
    if hit
        set hits = hits + 1
        if hits >= 3
            set mode = 2
    if mode == 1
        label CHARGE
        drive forward
    else if enemy_visible and enemy_distance < 350 and not blocked_behind
        label KEEP_AWAY
        drive backward
    else
        label KEEP_AWAY
        drive stop
    if blocked
        turn left
    else if abs(enemy_angle) > 5
        turn enemy
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
    ],
  },
  {
    title: { en: 'Moving', ja: '動く' },
    recipes: [
      {
        id: 'distance',
        title: { en: 'Shoot from the right distance', ja: 'ちょうどいい距離で撃つ' },
        text: {
          en: 'The first half decides how to drive; the second chooses one action. Further than the weapon reaches, the robot closes in; nearer than 200, it backs off (unless a wall is behind it); in between, it stops. Change the numbers to keep another distance.',
          ja: '前半で走り方を決め、後半で行動を 1 つ選びます。射程より遠ければ寄り、200 より近ければ下がり（後ろが壁でなければ）、その間なら止まります。数を変えると、保つ距離が変わります。',
        },
        code: `loop
    if not enemy_visible or enemy_distance > weapon_range - 50
        drive forward
    else if enemy_distance < 200 and not blocked_behind
        drive backward
    else
        drive stop
    if blocked
        turn left
    else if abs(enemy_angle) > 5
        turn enemy
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'around',
        title: { en: 'Go round obstacles to the enemy', ja: '障害物を回り込んで近づく' },
        text: {
          en: 'With an obstacle or a wall ahead, the robot turns left; otherwise it turns to the enemy and drives on. So it goes round the corners of obstacles, and stops to shoot once the enemy is in range. Write `turn right` to go round the other side.',
          ja: '前に障害物か壁があれば左へ回り、なければ敵の方を向いて進みます。こうして障害物の角を回り込み、敵が射程に入ったら止まって撃ちます。`turn right` にすると、反対側から回り込みます。',
        },
        code: `loop
    if blocked
        turn left
    else if enemy_visible and enemy_distance < weapon_range - 50
        drive stop
        aim enemy
        fire
    else
        turn enemy
        drive forward`,
      },
      {
        id: 'dodge',
        title: { en: 'Get out of the way of bullets', ja: '弾をよける' },
        text: {
          en: '`bullet_incoming` is true when a bullet will hit the robot if it stays where it is. A bullet from the side is dodged by driving forward, off its path; for one from ahead or behind, the robot turns first. With no bullet coming, it stops and shoots.',
          ja: '`bullet_incoming` は、今の場所にいると当たる弾があるとき真です。弾が横から来るなら、前へ走れば弾の通り道から出られます。前か後ろから来るなら、まず向きを変えます。弾が来ていないときは、止まって撃ちます。',
        },
        code: `loop
    if bullet_incoming
        if abs(bullet_angle) > 45 and abs(bullet_angle) < 135
            drive forward
            wait
        else
            drive stop
            turn left
    else if abs(aim_angle) > 2
        drive stop
        aim enemy
    else
        drive stop
        fire`,
      },
      {
        id: 'circle',
        title: { en: 'Circle the enemy, shooting', ja: '敵の周りを回りながら撃つ' },
        text: {
          en: 'Driving with the enemy on its right hand (`enemy_angle` 90), the robot goes round it, and the turret, which turns apart from the hull, keeps shooting. Further than 250 it keeps the enemy at 45 instead, to spiral in. One action a tick: turn the hull, or aim, or shoot. Write -90 and -45 to circle the other way.',
          ja: '敵を右手（`enemy_angle` が 90）に見ながら走ると、敵の周りを回ります。砲塔は車体とは別に回るので、回りながら撃ち続けられます。250 より遠ければ、敵を 45 に見て、渦を巻くように近づきます。1 tick の行動は 1 つ（車体を回す・狙う・撃つのどれか）です。-90 と -45 にすると、反対回りになります。',
        },
        code: `loop
    drive forward
    set want = 90
    if enemy_distance > 250
        set want = 45
    if blocked
        turn left
    else if enemy_angle < want - 10
        turn left
    else if enemy_angle > want + 10
        turn right
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'walls',
        title: { en: 'Turn before the wall', ja: '壁の手前で曲がる' },
        text: {
          en: '`blocked` is true only once the robot has run into something. `wall_ahead` is how far the wall or obstacle ahead is, so the robot can start turning right 80 before it, and never stop against it. After the turn the wall runs along its left side; `wall_left` keeps it from scraping along it, turning right a little more whenever it comes closer than 20. Meanwhile the turret shoots at whatever it sees.',
          ja: '`blocked` は、ぶつかってから正しくなります。`wall_ahead` は前の壁や障害物までの距離なので、80 手前から右へ曲がり始めて、ぶつからずに走り続けられます。曲がったあとは壁が左側に来るので、`wall_left` が 20 より近くなったら少し右へ曲がり、壁にこすらないようにします。そのあいだも、砲塔は見えた敵を撃ちます。',
        },
        code: `drive forward
loop
    if wall_ahead < 80 or wall_left < 20
        label TURN
        turn right
    else
        label RUN
        if not enemy_visible
            wait
        else if abs(aim_angle) > 2
            aim enemy
        else
            fire`,
      },
      {
        id: 'stick',
        title: { en: 'Close in until touching, and shoot point-blank', ja: 'くっつくまで近づいて、間近で撃つ' },
        text: {
          en: 'The robot drives at the enemy until `touching_enemy`, and keeps pushing to stay there. Shots from that close hardly ever miss. It takes fire all the way in, so it suits heavy armour and a short gun.',
          ja: '敵にぶつかる（`touching_enemy`）まで走り、ぶつかってからも押し続けて離れません。間近で撃つ弾は、まず外れません。近づくあいだは撃たれ続けるので、重い装甲と射程の短い銃に向きます。',
        },
        code: `loop
    drive forward
    if touching_enemy
        label STICK
    else
        label CLOSE_IN
    if abs(enemy_angle) > 5 and not touching_enemy
        turn enemy
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'walker-march',
        title: { en: 'March in, firing all the way (for the Walker legs)', ja: '撃ちながら歩いて詰める（Walker 向き）' },
        text: {
          en: 'For a robot with the **Walker** legs (set in `config`). Other legs stop to shoot, because shots on the move scatter five times as much; the Walker\'s barely scatter, so it marches at the enemy firing the whole way in, and keeps firing pressed right up against it. The same program on Standard legs hits far less.',
          ja: '`config` で脚を **Walker** にしたロボットのためのレシピです。走りながらの弾は 5 倍ばらけるので、ふつうの脚は止まって撃ちます。Walker はほとんどばらけないので、撃ちながら歩いて敵に詰め、密着したら押しつけたまま撃ち続けます。同じプログラムでも、Standard の脚では命中がずっと下がります。',
        },
        code: `drive forward
loop
    if blocked
        turn left 90
    else if not enemy_visible
        turn enemy
    else if enemy_distance > weapon_range - 50
        turn enemy
    else if abs(aim_angle) > 3
        aim enemy
    else
        fire`,
      },
      {
        id: 'hover-run',
        title: { en: 'Never stop (for the Hover legs)', ja: '止まらずに走り撃ちする（Hover 向き）' },
        text: {
          en: 'For a robot with the **Hover** legs (set in `config`). It never stops: it shoots on the move, and turns a different way at every wall. A way of fighting that never stops plays to the Hover: fast, hard to hit, gliding so smoothly that its shots scatter little on the move — and its weakness, that it cannot stop at once, never shows. The same program on Standard legs wins far less.',
          ja: '`config` で脚を **Hover** にしたロボットのためのレシピです。止まらずに走りながら撃ち、壁に当たるたびにちがう向きへ曲がります。止まらない戦い方は Hover の良さがそのまま出ます。速くて弾が当たりにくく、浮いて滑らかに走るので走りながらの弾もばらけにくく、「すぐ止まれない」弱点は一度も出ません。同じプログラムでも、Standard の脚では勝率がずっと下がります。',
        },
        code: `drive forward
loop
    if blocked or touching_enemy
        turn left random(60, 120)
    else if not enemy_visible
        wait
    else if abs(aim_angle) > 3
        aim enemy
    else
        fire`,
      },
    ],
  },
  {
    title: { en: 'Looking for the enemy', ja: '探す' },
    recipes: [
      {
        id: 'last-seen',
        title: { en: 'Lost it: go where it was last seen', ja: '見失ったら、最後に見た場所へ行く' },
        text: {
          en: 'When the enemy is out of sight, `enemy_distance` and `turn enemy` are about where it was last seen. So the robot drives there, and looks round once it arrives. Before it has ever seen the enemy, `enemy_distance` is 0: it just looks round.',
          ja: '敵が見えないとき、`enemy_distance` と `turn enemy` は「最後に見た場所」を指します。そこで、その場所まで走り、着いたら見回します。一度も見ていなければ `enemy_distance` は 0 なので、その場で見回します。',
        },
        code: `loop
    if enemy_visible
        label FIGHT
        drive stop
        if abs(aim_angle) > 2
            aim enemy
        else
            fire
    else if enemy_distance > 50
        label CHASE
        drive forward
        if blocked
            turn left
        else
            turn enemy
    else
        label LOOK
        drive stop
        turn left`,
      },
      {
        id: 'look-around',
        title: { en: 'Look all round, then move on', ja: 'ぐるっと見回してから、場所を変える' },
        text: {
          en: 'Four quarter turns, `turn left 90`, make one look all round: `looked` counts them. If nothing showed up, the robot drives on for 2 seconds (`t` counts the ticks down) and looks again. Why not `turn left 360` at once? A turn by an angle goes on to its end even once an enemy shows, and a whole turn ends facing where it began: the enemy seen on the way is behind it again. A quarter at a time, it checks after each one.',
          ja: '`turn left 90` を 4 回で、ぐるっと 1 周見回します（`looked` で回数を数えます）。何も見えなければ 2 秒走って（`t` で残りの tick を数えます）、また見回します。`turn left 360` で一度に回らないのは、角度つきの turn は途中で敵が見えても最後まで回り、1 周すると元の向きに戻ってしまうからです（途中で見えた敵が、また後ろになる）。90 度ずつなら、回るたびに確かめられます。',
        },
        code: `set looked = 0
set t = 0
loop
    if enemy_visible
        label FIGHT
        drive stop
        if abs(aim_angle) > 2
            aim enemy
        else
            fire
    else if looked < 4
        label LOOK
        drive stop
        turn left 90
        set looked = looked + 1
        if looked == 4
            set t = 60
    else if t > 0
        label MOVE
        set t = t - 1
        drive forward
        if blocked
            turn left
        else
            wait
    else
        set looked = 0`,
      },
    ],
  },
  {
    title: { en: 'Aiming and shooting', ja: '狙う・撃つ' },
    recipes: [
      {
        id: 'aimed',
        title: { en: 'Shoot once the aim is right', ja: '狙いが合ってから撃つ' },
        text: {
          en: '`aim_angle` is the angle from the turret to the enemy; `abs(aim_angle)` is how far off it is, to the left or the right. Until it is within 2 degrees, the robot aims with `aim enemy`; then it shoots. Fewer shots go to waste.',
          ja: '`aim_angle` は、砲塔から敵までの角度です。`abs(aim_angle)` は、左右どちらにずれていても、そのずれの大きさになります。2 度以内に入るまでは `aim enemy` で狙いを合わせ、入ってから撃ちます。むだになる弾が減ります。',
        },
        code: `loop
    if not enemy_visible
        wait
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'in-range',
        title: { en: 'Shoot only what the gun reaches', ja: '届く敵だけを撃つ' },
        text: {
          en: 'A bullet flies only as far as `weapon_range`, then is gone. Further than that the robot does not shoot but drives in (round obstacles), and opens fire once the enemy is in reach. Not a bullet goes out that cannot reach, and it works with any gun, as `weapon_range` reads your own.',
          ja: '弾は `weapon_range` までしか飛ばず、そこで消えます。それより遠ければ撃たずに近づき（障害物は回り込み）、届くようになってから撃ちます。届かない弾は 1 発も撃ちません。`weapon_range` は自分の銃の射程を読むので、どの銃でもそのまま使えます。',
        },
        code: `loop
    if not enemy_visible or enemy_distance > weapon_range
        label APPROACH
        drive forward
        if blocked
            turn left
        else
            turn enemy
    else
        label FIRE
        drive stop
        if abs(aim_angle) > 2
            aim enemy
        else
            fire`,
      },
      {
        id: 'stop-to-fire',
        title: { en: 'Keep moving, and stop only to shoot', ja: '走り回り、撃つときだけ止まる' },
        text: {
          en: 'A shot fired on the move scatters five times as much as one fired standing still. The robot drives about while it aims, and stops only on the tick it shoots: it waits for `reload == 0` (ready to fire) first, so it hardly ever stands still. At a wall, it turns 90 degrees left.',
          ja: '走りながら撃つと、止まって撃つときの 5 倍ばらけます。走り回りながら狙いを合わせ、撃つ tick だけ止まります。`reload == 0`（撃てるとき）になってから止まるので、ほとんど止まらずに済みます。壁に当たったら左へ 90 度曲がります。',
        },
        code: `drive forward
loop
    if blocked
        turn left 90
    else if enemy_visible and reload == 0 and abs(aim_angle) < 2
        drive stop
        fire
        drive forward
    else
        aim enemy`,
      },
      {
        id: 'lead',
        title: { en: 'Aim where the enemy will be', ja: '動く敵の先を狙う' },
        text: {
          en: '`aim lead` aims where the enemy will be when a bullet gets there, if it keeps moving as it does. Enemies driving across are hit more often. The robot shoots once `lead_angle` is within 2 degrees.',
          ja: '`aim lead` は、敵が今の動きを続けたときに、弾が届くころにいる位置を狙います。横に走る敵に当たりやすくなります。`lead_angle` が ±2 度に入ったら撃ちます。',
        },
        code: `loop
    if not enemy_visible
        wait
    else if abs(lead_angle) > 2
        aim lead
    else
        fire`,
      },
      {
        id: 'low-ammo',
        title: { en: 'Low on ammo: close in before shooting', ja: '弾が少なくなったら、近づいてから撃つ' },
        text: {
          en: 'The variable `limit` holds how near the enemy must be to shoot. Below 10 bullets, the robot closes in to 150 before it shoots, so the last bullets hit more often.',
          ja: '変数 `limit` に、撃ち始める距離を入れます。弾が 10 発より少なくなったら、150 まで近づいてから撃つので、残りの弾が当たりやすくなります。',
        },
        code: `loop
    set limit = weapon_range - 50
    if ammo < 10
        set limit = 150
    if enemy_visible and enemy_distance < limit
        drive stop
        aim enemy
        fire
    else
        turn enemy
        drive forward`,
      },
    ],
  },
  {
    title: { en: 'Defending', ja: '守る' },
    recipes: [
      {
        id: 'guard',
        title: { en: 'Guard just as a bullet hits', ja: '当たる瞬間だけ guard する' },
        text: {
          en: '`guard` halves the damage of a bullet that hits on that tick. There are only 4 a match, so the robot uses one only when a bullet is nearer than 36, about to hit. With one action a round, it looks for bullets on every tick.',
          ja: '`guard` は、その tick に当たった弾のダメージを半分にします。1 試合に 4 回しか使えないので、弾が 36 より近い（すぐに当たる）ときだけ使います。1 周で行動を 1 つにして、毎 tick 弾を確かめます。',
        },
        code: `loop
    if bullet_incoming and bullet_distance < 36 and guards > 0
        guard
    else if not enemy_visible
        wait
    else if abs(aim_angle) > 2
        aim enemy
    else
        fire`,
      },
      {
        id: 'face-hit',
        title: { en: 'Shot at: turn to the shooter', ja: '撃たれたら、撃たれた方を向く' },
        text: {
          en: '`hit` is true when the robot has been shot; `face hit` turns it until it faces where the bullet came from. It helps a robot with the Scope sensor, which sees only ahead, when it is shot from behind. With no enemy in sight, the robot turns left to look for one.',
          ja: '`hit` は、撃たれたとき真になります。`face hit` で、弾が来た方を向くまで回ります。前しか見えない Scope のセンサーで、後ろから撃たれたときに役立ちます。敵が見えなければ、左へ回って探します。',
        },
        code: `loop
    if hit
        face hit
    if enemy_visible
        aim enemy
        fire
    else
        turn left`,
      },
      {
        id: 'peek',
        title: { en: 'Show itself only when it can shoot', ja: '撃てるときだけ顔を出す' },
        text: {
          en: '`reload` is how many seconds until the robot can shoot again. After each shot, the robot goes to cover until the next shot is ready, then comes out and shoots. It takes less damage in a shoot-out.',
          ja: '`reload` は、次に撃てるまでの秒数です。撃ったら、次の弾の準備ができるまで隠れ場所へ行き、準備ができたら出てきて撃ちます。撃ち合いで受けるダメージが減ります。',
        },
        code: `loop
    if reload > 0 and cover_visible and cover_distance > 0
        face cover
        drive forward
        wait
    else if reload > 0
        drive stop
        wait
    else if not enemy_visible
        turn enemy
        drive forward
        wait
    else if abs(aim_angle) > 2
        drive stop
        aim enemy
    else
        fire`,
      },
      {
        id: 'flee',
        title: { en: 'Run from an enemy in sight', ja: '敵を見たら逃げる' },
        text: {
          en: 'Seeing an enemy, the robot runs for cover (`turn cover` steers one tick at a time, so it rounds the corners on the way). With no cover to go to, it backs away facing the enemy, which keeps it in sight; turning its back would take time under fire. With a wall behind it, it fights. Out of sight, it stops, and a robot that stays hidden and still gets HP back.',
          ja: '敵が見えたら、隠れ場所へ走ります（`turn cover` は 1 tick ずつ曲がるので、角を回り込みながら進みます）。隠れ場所がなければ、敵を向いたまま後ろへ下がります。敵から目を離さずに済み、背中を向けるために回る間に撃たれることもありません。後ろが壁なら撃ち返します。見えなくなったら止まります。見られずにじっとしていると HP が回復します。',
        },
        code: `loop
    if enemy_visible
        if cover_visible
            label FLEE
            turn cover
            drive forward
        else if blocked_behind
            label CORNERED
            turn enemy
            drive stop
            fire
        else
            label BACK_OFF
            turn enemy
            drive backward
    else
        label HIDE
        drive stop
        wait`,
      },
      {
        id: 'hide',
        title: { en: 'Hurt: hide and recover', ja: 'HP が減ったら隠れて休む' },
        text: {
          en: 'Below 120 HP, the robot goes to cover. Standing still where no enemy sees it, it gets back 20 HP a second. At 180 it goes back to the fight.',
          ja: 'HP が 120 より少なくなったら、隠れ場所へ行きます。敵から見えない場所で止まっていると、HP が 1 秒に 20 回復します。180 まで回復したら、戦いに戻ります。',
        },
        code: `loop
    if hp < 120 and cover_visible and not hidden
        face cover
        drive forward
        wait
    else if hidden and hp < 180
        drive stop
        wait
    else if not enemy_visible
        turn enemy
        drive forward
        wait
    else if abs(aim_angle) > 2
        drive stop
        aim enemy
    else
        fire`,
      },
    ],
  },
  {
    title: { en: 'Making it easy to follow', ja: '分かりやすくする' },
    recipes: [
      {
        id: 'label',
        title: { en: 'Show what the robot is doing', ja: '今していることを表示する' },
        text: {
          en: '`label` names what the robot is doing. The name shows under the robot (while debugging) and in the inspector, and goes in the log when it changes. It changes nothing in how the robot moves, but in debugging it shows at once where the robot switched from one thing to another. This is "Go round obstacles to the enemy" with a name for each part.',
          ja: '`label` で、今していることに名前を付けます。名前はロボットの下（デバッグ中）と状態の欄に出て、変わるとログに出ます。動きは変わりませんが、デバッグのとき、どこで動きが切り替わったかがすぐ分かります。この例は「障害物を回り込んで近づく」の、それぞれの部分に名前を付けたものです。',
        },
        code: `loop
    if blocked
        label AROUND
        turn left
    else if enemy_visible and enemy_distance < weapon_range - 50
        label ATTACK
        drive stop
        aim enemy
        fire
    else
        label APPROACH
        turn enemy
        drive forward`,
      },
    ],
  },
  {
    title: { en: 'As a team (the base battle)', ja: 'チームで（基地戦）' },
    recipes: [
      {
        id: 'call-team',
        title: { en: 'Call the team when you find the enemy', ja: '見つけたら呼ぶ、呼ばれたら駆けつける' },
        text: {
          en: 'One number on the radio is a protocol: here 1 means "I see an enemy". Whoever sees one keeps calling and fights; whoever sees nothing but hears the call heads for its nearest teammate; and with no call, everyone marches on the base. A caller that loses sight takes the call back with `signal 0`.',
          ja: '無線の数 1 つが取り決め（プロトコル）になります。ここでは 1 を「敵を見つけた」の意味にします。見えている機体は呼び続けて戦い、見えていない機体は呼ばれたら一番近い味方のところへ走り、だれも呼んでいなければ基地へ進みます。見失ったら `signal 0` で呼びを取り下げます。',
        },
        code: `set called = 0
loop
    if enemy_visible
        signal 1
        set called = 1
        drive stop
        aim enemy
        fire
    else
        if called == 1
            signal 0
            set called = 0
        if ally_signal == 1
            face ally
            drive forward
            wait
        else
            face enemy_base
            drive forward
            wait`,
      },
      {
        id: 'equip-roles',
        title: { en: 'Roles that follow the parts', ja: '役割を装備に合わせる' },
        text: {
          en: 'One program, different machines: `sensor_range` reads your own machine\'s sensor, so the far-sighted machine hangs back and covers while the short-sighted ones push the base. Swap the parts on the config tabs and the roles follow, with no code to change.',
          ja: '同じプログラムでも、機体が違えば動きを変えられます。`sensor_range` は自分の機体のセンサーを読むので、目のいい機体は後ろに残って援護し、目の短い機体が基地へ押し込みます。config のタブで装備を入れ替えれば、コードを直さなくても役割が付いてきます。',
        },
        code: `loop
    if sensor_range > 800
        label WATCHER
        drive stop
        aim enemy
        if enemy_visible and enemy_distance < weapon_range
            fire
        else
            wait
    else if enemy_visible and enemy_distance < weapon_range - 50
        label FIGHT
        drive stop
        aim enemy
        fire
    else
        label MARCH
        face enemy_base
        drive forward
        wait`,
      },
      {
        id: 'finish-base',
        title: { en: 'Every enemy down: go and take the base', ja: '敵が全滅したら、基地を落としに行く' },
        text: {
          en: '`enemies_alive` is how many enemies are left, seen or not: every enemy falls to your team\'s bullets, and the shooter tells the rest by radio. While any are left, the robot keeps to its own base and shoots what comes into reach. Once it reads 0, it marches on the enemy base and shells it: a team that stays home after that only runs out the clock.',
          ja: '`enemies_alive` は敵の生存数です。敵を倒すのは必ず自分のチームの弾なので、撃った機体が無線で知らせ、見えていない敵の分まで分かります。敵が残っているあいだは自分の基地の近くで、届く敵を撃ちます。0 になったら敵の基地へ進んで砲撃します。全滅させたあとも守りにこもっていると、時間切れになるだけです。',
        },
        code: `loop
    if enemies_alive == 0
        if enemy_base_distance > weapon_range - 50
            label MARCH
            face enemy_base
            drive forward
            wait
        else
            label SIEGE
            drive stop
            face enemy_base
            aim ahead
            fire
    else if enemy_visible and enemy_distance < weapon_range
        label FIGHT
        drive stop
        aim enemy
        fire
    else if base_distance > 150
        label HOME
        face base
        drive forward
        wait
    else
        label GUARD
        drive stop
        aim enemy
        wait`,
      },
      {
        id: 'last-one',
        title: { en: 'The last one left: hold the base', ja: '最後の 1 台になったら、基地を守る' },
        text: {
          en: '`allies_alive` is how many teammates are left, not counting the robot itself. While it has company the robot attacks; once it reads 0, the robot is the last one, and it goes home to hold the base, as time up goes by the bases\' HP.',
          ja: '`allies_alive` は、自分を除いた味方の生存数です。味方がいるあいだは攻め、0 になったら自分が最後の 1 台なので、基地へ戻って守ります。時間切れは基地の HP で決まるからです。',
        },
        code: `loop
    if allies_alive == 0 and base_distance > 150
        label GO_HOME
        face base
        drive forward
        wait
    else if allies_alive == 0
        label HOLD
        drive stop
        aim enemy
        if enemy_visible and enemy_distance < weapon_range
            fire
        else
            wait
    else if enemy_visible and enemy_distance < weapon_range - 50
        label FIGHT
        drive stop
        aim enemy
        fire
    else
        label MARCH
        face enemy_base
        drive forward
        wait`,
      },
      {
        id: 'defend-base',
        title: { en: 'The base is hit: go back', ja: '基地が削られたら戻る' },
        text: {
          en: '`full` remembers the base\'s HP at the start. While the base is untouched, the robot attacks; once `base_hp` is lower, someone is at the base, and the robot goes back to guard it, and stays. It stops before it turns for home: turning on the move swings it wide, into a teammate turning the same way.',
          ja: '`full` に、始めの基地の HP を覚えておきます。基地が無傷のあいだは攻め、`base_hp` が減ったら、だれかが基地を撃っているので、戻って守り、そのまま残ります。戻るときは止まってから向きを変えます。走りながら回ると大回りになり、同じように戻る味方とぶつかるからです。',
        },
        code: `set full = base_hp
loop
    if base_hp < full and base_distance > 200
        label RETURN
        drive stop
        face base
        drive forward
        wait
    else if enemy_visible and enemy_distance < weapon_range - 50
        label FIGHT
        drive stop
        aim enemy
        fire
    else if base_hp < full
        label DEFEND
        drive stop
        aim enemy
        wait
    else
        label MARCH
        face enemy_base
        drive forward
        wait`,
      },
      {
        id: 'call-by-name',
        title: { en: 'Call one helper by name', ja: '助けを 1 台だけ名指しで呼ぶ' },
        text: {
          en: 'Machine 1 keeps the base. When an enemy comes into reach, it calls machine 2 alone with `signal 1 to 2`; the others never hear it and march on. Machine 2 checks with `ally_signal_from` that the call is from machine 1, and comes back to help for the rest of the match. Calling everyone home would leave nobody attacking.',
          ja: '1 号機は基地の番をします。敵が届くところに来たら、`signal 1 to 2` で 2 号機だけを呼びます。ほかの機体には届かないので、そのまま攻め続けます。2 号機は `ally_signal_from` で 1 号機からの呼び出しだと確かめて、そこからは基地へ戻って守ります。全員を呼び戻すと、攻める機体がいなくなります。',
        },
        code: `loop
    if self_id == 1
        label KEEPER
        if base_distance > 150
            face base
            drive forward
            wait
        else if enemy_visible and enemy_distance < weapon_range
            signal 1 to 2
            drive stop
            aim enemy
            fire
        else
            drive stop
            aim enemy
            wait
    else if ally_signal == 1 and ally_signal_from == 1
        label HELP
        if enemy_visible and enemy_distance < weapon_range
            drive stop
            aim enemy
            fire
        else if base_distance > 150
            face base
            drive forward
            wait
        else
            drive stop
            aim enemy
            wait
    else
        label MARCH
        face enemy_base
        drive forward
        wait`,
      },
    ],
  },
];

export const RECIPES: readonly Recipe[] = RECIPE_GROUPS.flatMap((group) => group.recipes);

/** The text of the recipes topic in one language: a heading for each group, and for each recipe its title, text and code. */
export function recipesText(language: keyof Text, intro: string, outro: string): string {
  const groups = RECIPE_GROUPS.map((group) => {
    const recipes = group.recipes.map((recipe) => `**${recipe.title[language]}**\n\n${recipe.text[language]}\n\n\`\`\`\n${recipe.code}\n\`\`\``);
    return [`## ${group.title[language]}`, ...recipes].join('\n\n');
  });
  return [intro, ...groups, outro].join('\n\n');
}
