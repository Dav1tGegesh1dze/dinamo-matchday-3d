import * as THREE from 'three';
import { buildStadium } from '../world/stadium.js';
import { createCharacter, turnTowards, KITS } from '../world/character.js';
import { createPlayer } from '../world/player.js';
import { createFollowCamera } from '../world/camera.js';
import { loadModel } from '../world/loader.js';
import { showKit, showPrompt, showBoard, hideBoard, showObjective, showMarker, hideMarker } from '../ui/hud.js';
import { run } from '../lib/run.js';
import { t } from '../lib/i18n.js';
import { rollBall, BALL_RADIUS } from '../world/ball.js';
import { pitch, addOpponents } from './pitch.js';
import { listener, loop } from '../world/audio.js';
import { shadows } from '../world/graphics.js';

// The run out, played by the player with the dressing room's controls: from inside the tunnel, past
// the fourth official holding up the substitution board, to the kick-off spot in the centre circle.
// The objective says where to go, and a marker shows the spot and how far it is (at the screen edge,
// pointing the way, while the spot is off screen). On the spot the player settles facing the goal
// and a team-mate's pass arrives at his feet; the pitch stage takes over from there. The opponents
// are already in place.
const START = new THREE.Vector3(0, 0, 60); // in the tunnel, 6 m from its mouth
const KICK_OFF = new THREE.Vector3(-1, 0, 0.6); // where he receives the ball
const ARRIVED = 1.5; // metres from the kick-off spot that count as there
const SETTLE_SPEED = 3; // m/s, onto the spot while the pass comes
const MARKER_EDGE = 0.9; // how near the screen edge the marker goes, as a fraction of half the screen
const OFFICIAL = new THREE.Vector3(-3, 0, 38.5);
const BOARD_OFFSET = new THREE.Vector3(0.45, 1.35, 0); // held up in front of the official's chest
const BOARD_RANGE = 8; // metres; the board's name shows when the player is this close
const ATTACK = [1, 0]; // the player attacks the goal at +x
const PASS = { from: new THREE.Vector3(-16, 0.11, -14), seconds: 1.6 };
const TEAMMATE = new THREE.Vector3(-16.6, 0, -14.4); // stands just behind the ball he passes
const PERSON = 0.6; // people block the player like a 0.6 m wall box
const TURN_RATE = 8;
const FANS = { walkOut: 0.5, flashes: 1 }; // the crowd is up for the walk out, cameras flashing
// The crowd swells from muffled in the tunnel to full on the pitch.
const CROWD = { inTunnel: 0.15, onPitch: 0.5, pitchZ: 40, tunnelZ: 58 }; // volumes, and where the swell starts and ends

export const tunnel = {
  scene: null,
  camera: null,

  async enter(go) {
    this.go = go;
    this.scene = new THREE.Scene();
    showKit([]);
    showPrompt(null);
    const { floors, walls, key, crowd } = await buildStadium(this.scene);
    this.key = key;
    this.fans = crowd;
    this.fans.excite(FANS.walkOut, FANS.flashes);

    for (const side of [-1, 1]) {
      const goal = shadows((await loadModel('goal')).scene);
      goal.position.x = side * 52.5;
      goal.rotation.y = side > 0 ? Math.PI : 0;
      this.scene.add(goal);
      walls.push(new THREE.Box3().setFromObject(goal));
    }

    this.official = await createCharacter(KITS.official);
    this.official.object.position.copy(OFFICIAL);
    this.official.object.rotation.y = Math.PI / 2;
    this.official.moveAt(0);
    this.scene.add(this.official.object);
    this.board = shadows((await loadModel('board')).scene);
    this.board.position.copy(OFFICIAL).add(BOARD_OFFSET);
    this.board.rotation.y = Math.PI / 2;
    this.scene.add(this.board);

    this.teammate = await createCharacter(KITS.dinamo);
    this.teammate.object.position.copy(TEAMMATE);
    this.teammate.object.rotation.y = Math.atan2(KICK_OFF.x - TEAMMATE.x, KICK_OFF.z - TEAMMATE.z); // faces the kick-off spot
    this.teammate.moveAt(0);
    this.scene.add(this.teammate.object);

    this.opponents = await addOpponents(this.scene);

    this.ball = shadows((await loadModel('ball')).scene);
    this.ball.position.copy(PASS.from);
    this.scene.add(this.ball);

    const people = [OFFICIAL, TEAMMATE, ...this.opponents.map(({ object }) => object.position)].map((at) =>
      new THREE.Box3().setFromCenterAndSize(at, new THREE.Vector3(PERSON, 4, PERSON)),
    );
    this.runner = await createPlayer(this.scene, { floors, walls: [...walls, ...people] }, START, KITS.dinamo);
    this.player = this.runner.character;
    this.key.follow(START);
    this.follow = createFollowCamera({ walls }, this.player.object);
    this.camera = this.follow.camera;
    this.camera.add(listener);
    this.follow.update(0);
    this.crowd = await loop('crowd', CROWD.inTunnel);
    this.arrived = false;
    this.passTime = 0;
    this.handedOver = false;
    this.screen = new THREE.Vector3();
    this.spot = new THREE.Vector3();
    showObjective(t('runOut'), t('sprint'));
  },

  update(dt) {
    if (this.arrived) this.receivePass(dt);
    else this.runOut(dt);

    const { position } = this.player.object;
    this.key.follow(position);
    this.fans.update(dt);
    const inside = THREE.MathUtils.smoothstep(position.z, CROWD.pitchZ, CROWD.tunnelZ);
    this.crowd.setVolume(THREE.MathUtils.lerp(CROWD.onPitch, CROWD.inTunnel, inside));
    this.official.update(dt);
    this.teammate.update(dt);
    for (const opponent of this.opponents) opponent.update(dt);
    this.follow.update(dt);
    this.camera.updateMatrixWorld(); // so the board and the marker sit on this frame's view
    this.placeBoard();
    if (!this.arrived) this.placeMarker();
  },

  // The player runs where he likes; reaching the kick-off spot completes the objective.
  runOut(dt) {
    this.runner.update(dt, this.follow.yaw);
    const { x, z } = this.player.object.position;
    if (Math.hypot(KICK_OFF.x - x, KICK_OFF.z - z) > ARRIVED) return;
    this.arrived = true;
    showObjective(null);
    hideMarker();
  },

  // He settles on the kick-off spot and turns to face the goal while the ball rolls from a
  // team-mate to his feet. Once it has arrived, the pitch stage takes over.
  receivePass(dt) {
    const model = this.player.object;
    const dx = KICK_OFF.x - model.position.x;
    const dz = KICK_OFF.z - model.position.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, SETTLE_SPEED * dt);
    if (step > 0) {
      model.position.x += (dx / distance) * step;
      model.position.z += (dz / distance) * step;
    }
    this.player.moveAt(step < distance ? SETTLE_SPEED : 0);
    turnTowards(model, ...ATTACK, TURN_RATE * dt);
    this.follow.driftBehind(dt);
    this.player.update(dt);

    this.passTime = Math.min(PASS.seconds, this.passTime + dt);
    const feet = new THREE.Vector3(model.position.x + ATTACK[0] * 0.5, BALL_RADIUS, model.position.z + ATTACK[1] * 0.5);
    const eased = 1 - (1 - this.passTime / PASS.seconds) ** 2; // slows down as it arrives
    rollBall(this.ball, new THREE.Vector3().lerpVectors(PASS.from, feet, eased));
    if (this.passTime === PASS.seconds && !this.handedOver) {
      this.handedOver = true;
      this.go(pitch);
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

  // The marker is HTML too: over the kick-off spot with its distance, or, when the spot is off screen
  // or behind the camera, at the screen edge on the side it lies, pointing the way.
  placeMarker() {
    const { x: px, z: pz } = this.player.object.position;
    const metres = Math.round(Math.hypot(KICK_OFF.x - px, KICK_OFF.z - pz));
    const spot = this.spot.copy(KICK_OFF).applyMatrix4(this.camera.matrixWorldInverse); // x right, y up, −z ahead
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    let x = spot.x / (tan * this.camera.aspect);
    let y = spot.y / tan;
    if (spot.z < 0) {
      x /= -spot.z; // ahead: its place on the screen, −1…1 each way
      y /= -spot.z;
    }
    const reach = Math.max(Math.abs(x), Math.abs(y)) / MARKER_EDGE;
    const off = spot.z >= 0 || reach > 1;
    if (off && reach === 0) y = -MARKER_EDGE; // straight behind: point down
    else if (off) {
      x /= reach;
      y /= reach;
    }
    showMarker(
      `${metres} ${t('metres')}`,
      ((x + 1) / 2) * window.innerWidth,
      ((1 - y) / 2) * window.innerHeight,
      off ? Math.atan2(-y, x) : null,
    );
  },
};
