import * as THREE from 'three';
import { buildStadium } from '../world/stadium.js';
import { createCharacter, turnTowards, KITS } from '../world/character.js';
import { createFollowCamera } from '../world/camera.js';
import { loadModel } from '../world/loader.js';
import { showKit, showPrompt, showBoard, hideBoard } from '../ui/hud.js';
import { run } from '../lib/run.js';

// The walk out, played by itself: from inside the tunnel, out past the fourth official holding up
// the substitution board, to the centre circle, where a team-mate's pass arrives at the player's
// feet from a team-mate. The mouse still orbits the camera; the camera drifts back behind the player when left alone.
const START = new THREE.Vector3(0, 0, 64);
const LEGS = [
  { to: [0, 52], speed: 1.3 }, // walk out of the tunnel
  { to: [-1.2, 38.5], speed: 1.3 }, // up to the fourth official
  { wait: 2.5 }, // the board shows the player's name
  { to: [-1, 0.6], speed: 3 }, // jog to the centre circle
];
const OFFICIAL = new THREE.Vector3(-3, 0, 38.5);
const BOARD_OFFSET = new THREE.Vector3(0.45, 1.35, 0); // held up in front of the official's chest
const BOARD_RANGE = 8; // metres; the board's name shows when the player is this close
const ATTACK = [1, 0]; // the player attacks the goal at +x
const PASS = { from: new THREE.Vector3(-16, 0.11, -14), seconds: 1.6 };
const TEAMMATE = new THREE.Vector3(-16.6, 0, -14.4); // stands just behind the ball he passes
const BALL_RADIUS = 0.11;
const TURN_RATE = 8;
const CAMERA_DRIFT = 1.2; // how fast the camera swings back behind the player

export const tunnel = {
  scene: new THREE.Scene(),
  camera: null,

  async enter() {
    showKit([]);
    showPrompt(null);
    const { walls } = buildStadium(this.scene);

    for (const side of [-1, 1]) {
      const { scene: goal } = await loadModel('goal');
      goal.position.x = side * 52.5;
      goal.rotation.y = side > 0 ? Math.PI : 0;
      this.scene.add(goal);
    }

    this.player = await createCharacter('footballer', KITS.dinamo);
    this.player.object.position.copy(START);
    this.player.object.rotation.y = Math.PI;
    this.player.moveAt(0);
    this.scene.add(this.player.object);

    this.official = await createCharacter('footballer', KITS.official);
    this.official.object.position.copy(OFFICIAL);
    this.official.object.rotation.y = Math.PI / 2;
    this.official.moveAt(0);
    this.scene.add(this.official.object);
    ({ scene: this.board } = await loadModel('board'));
    this.board.position.copy(OFFICIAL).add(BOARD_OFFSET);
    this.board.rotation.y = Math.PI / 2;
    this.scene.add(this.board);

    this.teammate = await createCharacter('footballer', KITS.dinamo);
    this.teammate.object.position.copy(TEAMMATE);
    this.teammate.object.rotation.y = Math.atan2(-1 - TEAMMATE.x, 0.6 - TEAMMATE.z); // faces the centre circle
    this.teammate.moveAt(0);
    this.scene.add(this.teammate.object);

    ({ scene: this.ball } = await loadModel('ball'));
    this.ball.position.copy(PASS.from);
    this.scene.add(this.ball);

    this.follow = createFollowCamera({ walls }, this.player.object);
    this.camera = this.follow.camera;
    this.follow.update(0);
    this.leg = 0;
    this.waited = 0;
    this.passTime = 0;
    this.screen = new THREE.Vector3();
  },

  update(dt) {
    const model = this.player.object;
    const leg = LEGS[this.leg];
    if (leg?.wait !== undefined) {
      this.player.moveAt(0);
      this.waited += dt;
      if (this.waited >= leg.wait) this.leg++;
    } else if (leg) {
      const dx = leg.to[0] - model.position.x;
      const dz = leg.to[1] - model.position.z;
      const distance = Math.hypot(dx, dz);
      const step = Math.min(distance, leg.speed * dt);
      model.position.x += (dx / distance) * step;
      model.position.z += (dz / distance) * step;
      turnTowards(model, dx, dz, TURN_RATE * dt);
      this.player.moveAt(leg.speed);
      if (step === distance) this.leg++;
    } else {
      this.receivePass(dt);
    }

    const behind = model.rotation.y + Math.PI - this.follow.yaw;
    this.follow.yaw += Math.atan2(Math.sin(behind), Math.cos(behind)) * Math.min(1, CAMERA_DRIFT * dt);
    this.player.update(dt);
    this.official.update(dt);
    this.teammate.update(dt);
    this.follow.update(dt);
    this.placeBoard();
  },

  // The ball rolls from a team-mate to just in front of the player, who turns to face the goal.
  receivePass(dt) {
    const model = this.player.object;
    this.player.moveAt(0);
    turnTowards(model, ...ATTACK, TURN_RATE * dt);
    if (this.passTime >= PASS.seconds) return;
    this.passTime = Math.min(PASS.seconds, this.passTime + dt);
    const feet = new THREE.Vector3(model.position.x + ATTACK[0] * 0.5, BALL_RADIUS, model.position.z + ATTACK[1] * 0.5);
    const before = this.ball.position.clone();
    const eased = 1 - (1 - this.passTime / PASS.seconds) ** 2; // slows down as it arrives
    this.ball.position.lerpVectors(PASS.from, feet, eased);
    const moved = this.ball.position.clone().sub(before);
    if (moved.lengthSq() > 0) {
      this.ball.rotateOnWorldAxis(new THREE.Vector3(moved.z, 0, -moved.x).normalize(), moved.length() / BALL_RADIUS);
    }
  },

  // The board's name is HTML, drawn over the 3D board when the player is near it.
  placeBoard() {
    if (this.player.object.position.distanceTo(OFFICIAL) > BOARD_RANGE) return hideBoard();
    this.screen.copy(this.board.position).project(this.camera);
    if (this.screen.z > 1) return hideBoard();
    showBoard(
      `▲ ${run.name}`,
      ((this.screen.x + 1) / 2) * window.innerWidth,
      ((1 - this.screen.y) / 2) * window.innerHeight,
    );
  },
};
