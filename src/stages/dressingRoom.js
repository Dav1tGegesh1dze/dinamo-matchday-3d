import * as THREE from 'three';
import { buildLevel } from '../world/level.js';
import { createPlayer } from '../world/player.js';
import { createFollowCamera } from '../world/camera.js';

// Blockout test room, 12 × 10 m: outer walls, a half-length partition, a pillar and a bench.
// Boxes are { x, z, w, d, h } in metres: centre on the floor, width (x), depth (z), height.
const LAYOUT = {
  floor: { w: 12, d: 10 },
  boxes: [
    { x: 0, z: -5, w: 12.2, d: 0.2, h: 3 },
    { x: 0, z: 5, w: 12.2, d: 0.2, h: 3 },
    { x: -6, z: 0, w: 0.2, d: 10, h: 3 },
    { x: 6, z: 0, w: 0.2, d: 10, h: 3 },
    { x: -1, z: -2.5, w: 0.2, d: 5, h: 3 },
    { x: 2.5, z: -1.5, w: 0.8, d: 0.8, h: 3 },
    { x: -5.3, z: 1.5, w: 0.8, d: 4, h: 0.5 },
  ],
};
const SPAWN = new THREE.Vector3(0, 0, 3);

export const dressingRoom = {
  scene: new THREE.Scene(),
  camera: null,

  async enter() {
    const level = buildLevel(this.scene, LAYOUT);
    this.player = await createPlayer(this.scene, level, SPAWN);
    this.follow = createFollowCamera(level, this.player.model);
    this.camera = this.follow.camera;
    this.follow.update(0);
  },

  update(dt) {
    this.player.update(dt, this.follow.yaw);
    this.follow.update(dt);
  },
};
