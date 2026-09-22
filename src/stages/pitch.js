import * as THREE from 'three';
import { createCharacter, KITS } from '../world/character.js';
import { rollBall, BALL_RADIUS } from '../world/ball.js';
import { askQuestion } from '../ui/question.js';
import { flash } from '../ui/hud.js';
import { finishRun } from '../lib/run.js';
import { t } from '../lib/i18n.js';
import { tunnel } from './tunnel.js';
import { play as playSound } from '../world/audio.js';

// The attack on the goal at +x, in the stadium the tunnel stage built. Each defender runs at the
// player and slides in; the question (2, then 3) freezes the moment. Right: the player hurdles the
// tackle and carries on. Wrong or too slow: the slide takes the ball and the player goes down. At
// the penalty spot the keeper faces question 4: right, the shot flies into the top corner while he
// dives the other way; wrong, he dives the right way and holds it.
const OPPONENTS = [
  { kit: KITS.rival, x: 16 }, // defender 1, question 2
  { kit: KITS.rival, x: 30 }, // defender 2, question 3
  { kit: KITS.keeper, x: 51.2 }, // goalkeeper, question 4
];
const PENALTY_SPOT_X = 40;
const LANE_Z = 0.6; // the line the player attacks along
const DRIBBLE_SPEED = 3;
const BALL_AHEAD = 0.5; // metres in front of the player's feet while dribbling
const CHARGE_GAP = 9; // the defender runs at the player once they are this close…
const CHARGE_SPEED = 4;
const SLIDE_GAP = 3.2; // …and slides in from here, feet first
const SLIDE = { pose: 0.5, tilt: -0.9, drop: -0.1, seconds: 0.7, distance: 2.4 }; // the sitting pose tipped back
const HURDLE = { seconds: 1.1, distance: 4.6, height: 0.55 }; // the player's jump over the slide
const GET_UP_SECONDS = 0.4;
const POKE = { to: new THREE.Vector3(0, 0, 4), seconds: 0.8 }; // where a winning tackle knocks the ball
const SHOT = { seconds: 0.7, height: 1.2 };
const TOP_CORNER = new THREE.Vector3(53, 2.1, -2.9);
const SAVE_AT = new THREE.Vector3(51.1, 0.5, 3); // the ball in the keeper's hands at the end of his dive
const DIVE = { seconds: 0.5, sideways: 1.4, lean: 1.3 };
// How the crowd feels (excitement, camera flashes): watching the duels, a goal, a chance lost.
const MOOD = { play: [0.35, 0.15], goal: [1, 0.6], lost: [0.05, 0] };

// The opponents stand in position from the start of the walk out.
export async function addOpponents(scene) {
  return Promise.all(
    OPPONENTS.map(async ({ kit, x }) => {
      const opponent = await createCharacter(kit);
      opponent.object.position.set(x, 0, LANE_Z);
      opponent.object.rotation.order = 'YXZ'; // turn first, then tip back for the slide
      opponent.object.rotation.y = -Math.PI / 2; // faces the player coming from -x
      opponent.moveAt(0);
      scene.add(opponent.object);
      return opponent;
    }),
  );
}

export const pitch = {
  scene: null,
  camera: null,

  async enter(go, end) {
    this.end = end;
    this.scene = tunnel.scene;
    this.camera = tunnel.camera;
    this.action = null;
    tunnel.fans.excite(...MOOD.play);
    this.play();
  },

  exit() {
    tunnel.crowd.stop();
  },

  update(dt) {
    if (this.action?.step(dt)) {
      const { done } = this.action;
      this.action = null;
      done();
    }
    tunnel.player.update(dt);
    for (const opponent of tunnel.opponents) opponent.update(dt);
    tunnel.follow.driftBehind(dt);
    tunnel.follow.update(dt);
    tunnel.key.follow(tunnel.player.object.position);
    tunnel.fans.update(dt);
  },

  // Runs `step(dt, seconds so far)` every frame until it returns true.
  until(step) {
    let time = 0;
    return new Promise((done) => {
      this.action = { step: (dt) => step(dt, (time += dt)), done };
    });
  },

  async play() {
    const [first, second, keeper] = tunnel.opponents;
    for (const [defender, stage] of [[first, 2], [second, 3]]) {
      await this.charge(defender);
      if (!(await askQuestion(stage))) return this.tackled(defender);
      await this.hurdle(defender);
    }
    await this.dribble((player) => player.x >= PENALTY_SPOT_X);
    if (await askQuestion(4)) return this.goal(keeper);
    return this.saved(keeper);
  },

  // The player dribbles towards +x, the ball rolling just ahead of his feet, until `arrived`.
  dribble(arrived, alongside = () => {}) {
    const player = tunnel.player;
    return this.until((dt) => {
      player.object.position.x += DRIBBLE_SPEED * dt;
      player.moveAt(DRIBBLE_SPEED);
      this.ballAtFeet();
      alongside(dt);
      if (!arrived(player.object.position)) return false;
      player.moveAt(0);
      return true;
    });
  },

  ballAtFeet(lift = 0) {
    const feet = tunnel.player.object.position;
    rollBall(tunnel.ball, new THREE.Vector3(feet.x + BALL_AHEAD, BALL_RADIUS + lift, LANE_Z));
  },

  // Dribble on; the defender runs at the player once close, and goes into his slide.
  async charge(defender) {
    const model = defender.object;
    await this.dribble(
      (player) => model.position.x - player.x <= SLIDE_GAP,
      (dt) => {
        if (model.position.x - tunnel.player.object.position.x > CHARGE_GAP) return;
        model.position.x -= CHARGE_SPEED * dt;
        defender.moveAt(CHARGE_SPEED);
      },
    );
    defender.pose('slide', SLIDE.pose);
    model.rotation.x = SLIDE.tilt;
    model.position.y = SLIDE.drop;
  },

  // The defender's slide: `distance` metres towards -x over SLIDE.seconds, slowing down.
  slide(defender, from, time, distance = SLIDE.distance) {
    const progress = Math.min(1, time / SLIDE.seconds);
    defender.object.position.x = from - distance * (1 - (1 - progress) ** 2);
    return progress === 1;
  },

  // Right answer: the player hurdles the slide with the ball and lands running; the defender gets
  // up behind him and turns to watch.
  async hurdle(defender) {
    const player = tunnel.player;
    const model = defender.object;
    const slideFrom = model.position.x;
    const jumpFrom = player.object.position.x;
    player.play('hurdle');
    await this.until((dt, time) => {
      const progress = Math.min(1, time / HURDLE.seconds);
      const lift = Math.sin(Math.PI * progress) * HURDLE.height;
      player.object.position.x = jumpFrom + HURDLE.distance * progress;
      player.object.position.y = lift;
      this.ballAtFeet(lift * 0.8);
      if (this.slide(defender, slideFrom, time)) {
        const up = Math.min(1, (time - SLIDE.seconds) / GET_UP_SECONDS);
        model.rotation.x = SLIDE.tilt * (1 - up);
        model.position.y = SLIDE.drop * (1 - up);
        model.rotation.y = -Math.PI / 2 + Math.PI * up; // turns round to watch him go
        if (up > 0) defender.moveAt(0);
      }
      return progress === 1 && time >= SLIDE.seconds + GET_UP_SECONDS;
    });
    player.object.position.y = 0;
  },

  // Wrong answer: the slide reaches the ball and pokes it away, and the player goes down.
  async tackled(defender) {
    const player = tunnel.player;
    const slideFrom = defender.object.position.x;
    const reach = slideFrom - (tunnel.ball.position.x + 0.2); // his boots end at the ball
    await this.until((dt, time) => this.slide(defender, slideFrom, time, reach));
    player.play('fall', 1, true);
    playSound('tackle');
    const from = tunnel.ball.position.clone();
    const to = from.clone().add(POKE.to);
    await this.until((dt, time) => {
      const progress = Math.min(1, time / POKE.seconds);
      rollBall(tunnel.ball, new THREE.Vector3().lerpVectors(from, to, 1 - (1 - progress) ** 2));
      return progress === 1;
    });
    finishRun(false);
    tunnel.fans.excite(...MOOD.lost);
    flash(t('tackled'));
    this.end();
  },

  // The shot goes into the top corner while the keeper dives the other way, and the player
  // celebrates. The clock stops on the winning answer, as in the 2D game.
  async goal(keeper) {
    finishRun(true);
    await this.shoot(keeper, TOP_CORNER);
    tunnel.player.play('celebrate');
    tunnel.fans.excite(...MOOD.goal);
    playSound('goal');
    flash(t('goal'));
    this.end();
  },

  // The keeper dives the right way and holds the shot.
  async saved(keeper) {
    finishRun(false);
    await this.shoot(keeper, SAVE_AT);
    tunnel.player.moveAt(0);
    playSound('save');
    tunnel.fans.excite(...MOOD.lost);
    flash(t('saved'));
    this.end();
  },

  // The player strikes the ball towards `target` in an arc while the keeper dives to his right (+z):
  // away from the top corner on a goal, onto the ball on a save.
  shoot(keeper, target) {
    const start = tunnel.ball.position.clone();
    const diveFrom = keeper.object.position.z;
    tunnel.player.play('shoot', 1.5, true);
    keeper.play('dive');
    return this.until((dt, time) => {
      const progress = Math.min(1, time / SHOT.seconds);
      tunnel.ball.position.lerpVectors(start, target, progress);
      tunnel.ball.position.y += 4 * SHOT.height * progress * (1 - progress);
      tunnel.ball.rotation.x += 0.4;
      const dive = Math.min(1, time / DIVE.seconds);
      keeper.object.position.z = diveFrom + DIVE.sideways * dive;
      keeper.object.rotation.z = -DIVE.lean * dive;
      return progress === 1;
    });
  },
};
