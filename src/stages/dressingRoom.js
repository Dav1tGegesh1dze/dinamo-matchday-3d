import * as THREE from 'three';
import { buildLevel, layoutFromGrid, surface } from '../world/level.js';
import { lockerRow, bench, treatmentBed, showerHeads, hangingSign } from '../world/fixtures.js';
import { createPlayer } from '../world/player.js';
import { createFollowCamera } from '../world/camera.js';
import { createCharacter, kitPiece, KITS } from '../world/character.js';
import { loadModel, loadTexture } from '../world/loader.js';
import { updateInteractions } from '../world/interact.js';
import { showKit, lightKit, flash } from '../ui/hud.js';
import { askQuestion } from '../ui/question.js';
import { finishRun } from '../lib/run.js';
import { tunnel } from './tunnel.js';
import { listener, play, loop, loopAt } from '../world/audio.js';
import { loadEnvironment, shadows } from '../world/graphics.js';
import { t } from '../lib/i18n.js';

// The 2D game's map at 1.25 m per tile, so its 2-tile corridors are 2.5 m wide. Top left is the
// dressing room (P = spawn, s = the player's locker, b = the bench with his boots), top right the
// physio room (t = the treatment bed with the tape), the middle block is the showers, and the
// bottom-right alcove is the tunnel mouth (C = coach). The 2D game's winding tunnel is walled off:
// in 3D the tunnel is the scripted walk out that follows the coach.
const MAP = [
  '###################################',
  '#......################......######',
  '#......################......######',
  '#..P.....................t...######',
  '#............................######',
  '#s...b.######..########......######',
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
  '############..###############....C#',
  '############..###############.....#',
  '###################################',
];
const TILE = 1.25;
const WALL_HEIGHT = 3;
// The kit to find: how it looks lying there, and what picking it up changes on the player. The shirt
// and boots are the footballer model's own shirt and boots.
const KIT = {
  shirt: { look: hangingShirt, wear: { Shirt: KITS.dinamo.Shirt, Shorts: KITS.dinamo.Shorts } },
  boots: { look: () => kitPiece('Boots', KITS.dinamo.Boots), wear: { Boots: KITS.dinamo.Boots } },
  tape: { look: async () => (await loadModel('tape')).scene, wear: { Socks: KITS.dinamo.Socks } },
};
const TAPE_SCALE = 2; // the real 5 cm roll is too small to spot
const HANGING_DEPTH = 0.3; // a shirt on a hook hangs flat, not in the shape of a chest

async function hangingShirt() {
  const shirt = await kitPiece('Shirt', KITS.dinamo.Shirt);
  shirt.scale.z = HANGING_DEPTH;
  return shirt;
}
// What the rooms are made of: tiled floor, painted walls with a Dinamo-blue band, ceiling tiles with
// light panels, white tiles on the shower block's floor and walls, and the tunnel's branded panels
// and rubber mat at the tunnel mouth.
const SHOWERS = [25, 12.5, 38.75, 20.5]; // [x0, z0, x1, z1] in metres
const SHOWER_TILES = surface('shower-tiles.jpg', 1.2);
const TUNNEL_MOUTH = [36.25, 20.5, 42.5, 25]; // the alcove where the coach waits, dressed like the tunnel
const LOOK = {
  floor: surface('floor-tiles.jpg', 1.8),
  wall: surface('walls.jpg', 3),
  ceiling: surface('ceiling.jpg', 4.8),
  zones: [
    { area: SHOWERS, floor: SHOWER_TILES, wall: SHOWER_TILES },
    { area: TUNNEL_MOUTH, floor: surface('rubber.png', 1), wall: surface('tunnel-wall.png', 3) },
  ],
};
const WOOD = surface('wood.jpg', 1.2);
const SIGNS = new THREE.MeshStandardMaterial({ map: loadTexture('signs.png') });
const SIGN_HEIGHT = 2.72; // hangs above where the camera usually is
const ENVIRONMENT_INTENSITY = 0.8;
const GLOW = { strength: 0.6, speed: 3 }; // kit still to find pulses brighter in its own colour, to catch the eye
const COACH_SIZE = 0.6; // the coach blocks the player like a 0.6 m wall box
const MUSIC_VOLUME = 0.7;
const CROWD = { volume: 1, near: 3 }; // the crowd through the tunnel mouth, loud only near the coach

export const dressingRoom = {
  scene: null,
  camera: null,

  async enter(go, end) {
    this.scene = new THREE.Scene();
    this.scene.environment = await loadEnvironment('studio');
    this.scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    const layout = layoutFromGrid(MAP, TILE, WALL_HEIGHT);
    const level = buildLevel(this.scene, layout, LOOK);
    this.key = level.key;
    const rests = await this.furnish(level, layout.spots);
    this.player = await createPlayer(this.scene, level, layout.spots.P);
    this.key.follow(this.player.model.position);
    this.follow = createFollowCamera(level, this.player.model);
    this.camera = this.follow.camera;
    this.camera.add(listener);
    this.follow.update(0);

    this.held = new Set();
    this.time = 0;
    this.items = [];
    this.things = [];
    showKit(Object.keys(KIT));
    for (const [name, { look, wear }] of Object.entries(KIT)) {
      const item = shadows(await look());
      item.position.copy(rests[name].position);
      item.rotation.y = rests[name].yaw;
      if (name === 'tape') item.scale.setScalar(TAPE_SCALE);
      this.scene.add(item);
      this.items.push(item);
      const thing = {
        position: item.position,
        prompt: () => `E — ${t('pickUp')} ${t(name)}`,
        use: () => {
          this.scene.remove(item);
          this.items.splice(this.items.indexOf(item), 1);
          this.things.splice(this.things.indexOf(thing), 1);
          this.held.add(name);
          this.player.wear(wear);
          lightKit(name);
          play('pickup');
        },
      };
      this.things.push(thing);
    }

    this.coach = await createCharacter(KITS.coach);
    this.coach.object.position.copy(layout.spots.C);
    this.coach.object.rotation.y = -Math.PI / 2; // faces west, towards the player coming in
    this.coach.play('talk');
    this.scene.add(this.coach.object);
    level.walls.push(new THREE.Box3().setFromCenterAndSize(layout.spots.C, new THREE.Vector3(COACH_SIZE, 4, COACH_SIZE)));
    const coachThing = {
      position: this.coach.object.position,
      prompt: () => `E — ${t('talkToCoach')}`,
      use: async () => {
        if (this.held.size < Object.keys(KIT).length) return flash(t('kitFirst'));
        this.things.splice(this.things.indexOf(coachThing), 1);
        if (await askQuestion(1)) {
          flash(t('substitutedIn'));
          go(tunnel);
        } else {
          finishRun(false);
          flash(t('stayOnBench'));
          end();
        }
      },
    };
    this.things.push(coachThing);

    this.music = await loop('maze-music', MUSIC_VOLUME);
    this.crowd = await loopAt('crowd', CROWD.volume, this.coach.object, CROWD.near);
  },

  // The rooms' furniture, props and signs. Everything solid is added to the level's walls, so the
  // player and camera collide with it. Returns where each piece of kit rests: the player's shirt in
  // his locker, the boots on the bench, the tape on the treatment bed.
  async furnish(level, spots) {
    const add = ({ object, boxes }) => {
      this.scene.add(shadows(object));
      level.walls.push(...boxes);
    };
    const prop = async (name, x, z, yaw = 0, scale = 1) => {
      const { scene: object } = await loadModel(name);
      object.position.set(x, 0, z);
      object.rotation.y = yaw;
      object.scale.setScalar(scale);
      this.scene.add(shadows(object));
      level.walls.push(new THREE.Box3().setFromObject(object));
    };

    // Dressing room: lockers on the west and north walls with a Dinamo shirt in each, a bench in the
    // middle, the tactics board and a stack of crates.
    const west = lockerRow({ axis: 'z', at: 1.25, from: 1.25, to: 8.75, inward: 1 }, WOOD);
    const north = lockerRow({ axis: 'x', at: 1.25, from: 2.3, to: 8.75, inward: 1 }, WOOD);
    add(west);
    add(north);
    const own = west.hooks.reduce((best, hook) => (hook.distanceTo(spots.s) < best.distanceTo(spots.s) ? hook : best));
    const shirts = [...west.hooks.map((hook) => [hook, Math.PI / 2]), ...north.hooks.map((hook) => [hook, 0])];
    for (const [hook, yaw] of shirts.filter(([hook]) => hook !== own)) {
      const shirt = await hangingShirt();
      shirt.position.copy(hook);
      shirt.rotation.y = yaw;
      this.scene.add(shirt);
    }
    const centre = bench(spots.b, 2, 'x', WOOD);
    add(centre);
    await prop('chalkboard', 4.6, 8.2, Math.PI);
    await prop('crate', 2.6, 8.3);
    await prop('crate', 3.05, 8.3, 0.3);
    add(hangingSign(new THREE.Vector3(8.75, SIGN_HEIGHT, 5), Math.PI / 2, 0, SIGNS, WALL_HEIGHT));

    // Physio room: the treatment bed, shelves against the north wall, crates in the corner.
    const bed = treatmentBed(spots.t);
    add(bed);
    await prop('shelves', 33.6, 1.55, 0, 0.1);
    await prop('shelves', 34.8, 1.55, 0, 0.1);
    await prop('crate', 35.7, 6.9, 0.5);
    add(hangingSign(new THREE.Vector3(28.75, SIGN_HEIGHT, 5), Math.PI / 2, 1, SIGNS, WALL_HEIGHT));

    // Showers: heads on the stall walls, a wet-floor sign at the entrance.
    const heads = [];
    for (const z of [15, 18]) {
      heads.push(
        { position: new THREE.Vector3(25, 0, z), facing: [1, 0] },
        { position: new THREE.Vector3(27.5, 0, z), facing: [-1, 0] },
        { position: new THREE.Vector3(30, 0, z), facing: [1, 0] },
        { position: new THREE.Vector3(32.5, 0, z), facing: [-1, 0] },
        { position: new THREE.Vector3(36.25, 0, z), facing: [1, 0] },
      );
    }
    add(showerHeads(heads));
    await prop('wet-floor-sign', 26.8, 20.9, 0.4);
    add(hangingSign(new THREE.Vector3(26.25, SIGN_HEIGHT, 20.3), 0, 2, SIGNS, WALL_HEIGHT));

    // The tunnel mouth.
    add(hangingSign(new THREE.Vector3(37.5, SIGN_HEIGHT, 21.9), 0, 3, SIGNS, WALL_HEIGHT));

    return {
      shirt: { position: own, yaw: Math.PI / 2 },
      boots: { position: spots.b.clone().setY(centre.top), yaw: 0 },
      tape: { position: spots.t.clone().add(new THREE.Vector3(0.55, bed.top, 0)), yaw: 0 },
    };
  },

  exit() {
    this.music.stop();
    this.crowd.stop();
  },

  update(dt) {
    this.time += dt;
    this.player.update(dt, this.follow.yaw);
    this.follow.update(dt);
    this.key.follow(this.player.model.position);
    this.coach.update(dt);
    const glow = GLOW.strength * (0.5 + 0.5 * Math.sin(this.time * GLOW.speed));
    for (const item of this.items) {
      item.traverse((node) => node.isMesh && node.material.emissive.copy(node.material.color).multiplyScalar(glow));
    }
    updateInteractions(this.player.model, this.things);
  },
};
