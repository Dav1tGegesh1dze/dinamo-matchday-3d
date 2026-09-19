import * as THREE from 'three';
import { createCharacter, turnTowards, KITS } from '../world/character.js';
import { rollBall, BALL_RADIUS } from '../world/ball.js';
import { askQuestion } from '../ui/question.js';
import { flash } from '../ui/hud.js';
import { finishRun } from '../lib/run.js';
import { t } from '../lib/i18n.js';
import { tunnel } from './tunnel.js';
import { play as playSound } from '../world/audio.js';

// The attack on the goal at +x, in the stadium the tunnel stage built. The player dribbles up to
// each opponent and is asked questions 2, 3 and 4. Right: he beats the defender, or scores past
// the keeper. Wrong or too slow: the defender tackles him, or the keeper saves.
const OPPONENTS = [
  { kit: KITS.rival, x: 16, stopX: 12.5 }, // defender 1, question 2
  { kit: KITS.rival, x: 30, stopX: 26.5 }, // defender 2, question 3
  { kit: KITS.keeper, x: 51.2, stopX: 40 }, // goalkeeper, question 4, from the penalty spot
];
const LANE_Z = 0.6; // the line the player attacks along
const DRIBBLE_SPEED = 3;
const TACKLE_SPEED = 4.5;
const TACKLE_REACH = 0.5; // the defender stops this far from the ball
const POKE = { seconds: 0.8, to: new THREE.Vector3(0, 0, 4) }; // then pokes it this far to the side
const BALL_AHEAD = 0.5; // metres in front of the player's feet while dribbling
const SIDESTEP = 2.4; // how wide the player goes round a beaten defender
const TURN_RATE = 8;
const SHOT = { seconds: 0.7, height: 1.2 }; // flight time and how high the arc rises
const TOP_CORNER = new THREE.Vector3(53, 2.1, -2.9);
const KEEPER_HANDS = new THREE.Vector3(50.7, 1.2, 0.6);
const DIVE = { seconds: 0.5, sideways: 1.6, lean: 1.3 }; // the keeper dives the wrong way on a goal

// The opponents stand in position from the start of the walk out.
export async function addOpponents(scene) {
  return Promise.all(
    OPPONENTS.map(async ({ kit, x }) => {
      const opponent = await createCharacter('footballer', kit);
      opponent.object.position.set(x, 0, LANE_Z);
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
    this.play();
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
  },

  exit() {
    tunnel.crowd.stop();
  },

  // Runs `step(dt)` every frame until it returns true.
  until(step) {
    return new Promise((done) => (this.action = { step, done }));
  },

  async play() {
    for (const [index, opponent] of tunnel.opponents.entries()) {
      const stage = index + 2;
      const { x, stopX } = OPPONENTS[index];
      await this.dribbleTo(stopX, LANE_Z);
      const right = await askQuestion(stage);
      if (!right) return stage === 4 ? this.saved(opponent) : this.tackled(opponent);
      if (stage === 4) return this.goal(opponent);
      await this.dribbleTo(x, LANE_Z - SIDESTEP);
      await this.dribbleTo(x + 3, LANE_Z);
    }
  },

  // Jogs to x, z with the ball rolling just ahead of his feet.
  dribbleTo(x, z) {
    const model = tunnel.player.object;
    return this.until((dt) => {
      const dx = x - model.position.x;
      const dz = z - model.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance === 0) return true;
      const step = Math.min(distance, DRIBBLE_SPEED * dt);
      model.position.x += (dx / distance) * step;
      model.position.z += (dz / distance) * step;
      turnTowards(model, dx, dz, TURN_RATE * dt);
      tunnel.player.moveAt(step === distance ? 0 : DRIBBLE_SPEED);
      const facing = model.rotation.y;
      rollBall(tunnel.ball, new THREE.Vector3(
        model.position.x + Math.sin(facing) * BALL_AHEAD,
        BALL_RADIUS,
        model.position.z + Math.cos(facing) * BALL_AHEAD,
      ));
      return step === distance;
    });
  },

  // The defender runs in and pokes the ball away; the run ends.
  async tackled(defender) {
    tunnel.player.moveAt(0);
    const model = defender.object;
    const ball = tunnel.ball.position;
    await this.until((dt) => {
      const dx = ball.x - model.position.x;
      const dz = ball.z - model.position.z;
      const distance = Math.hypot(dx, dz);
      const remaining = distance - TACKLE_REACH;
      const step = Math.min(remaining, TACKLE_SPEED * dt);
      if (step > 0) {
        model.position.x += (dx / distance) * step;
        model.position.z += (dz / distance) * step;
        turnTowards(model, dx, dz, TURN_RATE * dt);
      }
      defender.moveAt(step === remaining ? 0 : TACKLE_SPEED);
      return step === remaining;
    });
    const from = ball.clone();
    const to = from.clone().add(POKE.to);
    let time = 0;
    await this.until((dt) => {
      time = Math.min(POKE.seconds, time + dt);
      const eased = 1 - (1 - time / POKE.seconds) ** 2;
      rollBall(tunnel.ball, new THREE.Vector3().lerpVectors(from, to, eased));
      return time === POKE.seconds;
    });
    finishRun(false);
    playSound('tackle');
    flash(t('tackled'));
    this.end();
  },

  // The shot goes into the top corner while the keeper dives the other way. The clock stops on the
  // winning answer, as in the 2D game.
  async goal(keeper) {
    finishRun(true);
    tunnel.player.moveAt(0);
    const start = tunnel.ball.position.clone();
    const diveFrom = keeper.object.position.z;
    let time = 0;
    await this.until((dt) => {
      time = Math.min(SHOT.seconds, time + dt);
      const progress = time / SHOT.seconds;
      this.fly(start, TOP_CORNER, progress);
      const dive = Math.min(1, time / DIVE.seconds);
      keeper.object.position.z = diveFrom + DIVE.sideways * dive;
      keeper.object.rotation.z = -DIVE.lean * dive;
      return progress === 1;
    });
    playSound('goal');
    flash(t('goal'));
    this.end();
  },

  // The shot goes straight into the keeper's hands; the run ends.
  async saved(keeper) {
    finishRun(false);
    tunnel.player.moveAt(0);
    const start = tunnel.ball.position.clone();
    let time = 0;
    await this.until((dt) => {
      time = Math.min(SHOT.seconds, time + dt);
      this.fly(start, KEEPER_HANDS, time / SHOT.seconds);
      return time === SHOT.seconds;
    });
    keeper.moveAt(0);
    playSound('save');
    flash(t('saved'));
    this.end();
  },

  // The ball in flight: a straight line from `from` to `to`, lifted into an arc.
  fly(from, to, progress) {
    const ball = tunnel.ball;
    ball.position.lerpVectors(from, to, progress);
    ball.position.y += 4 * SHOT.height * progress * (1 - progress);
    ball.rotation.x += 0.4;
  },
};
