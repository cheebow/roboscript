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
