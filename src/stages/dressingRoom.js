import * as THREE from 'three';
import { buildLevel, layoutFromGrid } from '../world/level.js';
import { createPlayer } from '../world/player.js';
import { createFollowCamera } from '../world/camera.js';

// The 2D game's map at 1.25 m per tile, so its 2-tile corridors are 2.5 m wide. Top left is the
// dressing room (P = spawn), top right the physio room, the middle rooms are the showers, and the
// bottom-right alcove is the tunnel mouth. The 2D game's winding tunnel is walled off: in 3D the
// tunnel is the scripted walk out that follows the coach.
const MAP = [
  '###################################',
  '#......################......######',
  '#......################......######',
  '#..P.........................######',
  '#............................######',
  '#......######..########......######',
  '#......######..####################',
  '#############..####################',
  '#############..####################',
  '###............####################',
  '###............#####...........####',
  '###..############..#...........####',
  '###..#......#####..#..##..###..####',
  '###.........#####..#..##..###..####',
  '###.........#####..#..##..###..####',
  '###..############..#..##..###..####',
  '###...................#######..####',
  '###..................########..####',
  '############..###############.....#',
  '############..###############.....#',
  '###################################',
];
const TILE = 1.25;
const WALL_HEIGHT = 3;

export const dressingRoom = {
  scene: new THREE.Scene(),
  camera: null,

  async enter() {
    const layout = layoutFromGrid(MAP, TILE, WALL_HEIGHT);
    const level = buildLevel(this.scene, layout);
    this.player = await createPlayer(this.scene, level, layout.spots.P);
    this.follow = createFollowCamera(level, this.player.model);
    this.camera = this.follow.camera;
    this.follow.update(0);
  },

  update(dt) {
    this.player.update(dt, this.follow.yaw);
    this.follow.update(dt);
  },
};
