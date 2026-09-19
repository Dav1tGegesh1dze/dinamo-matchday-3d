import * as THREE from 'three';
import { buildLevel, layoutFromGrid } from '../world/level.js';
import { createPlayer } from '../world/player.js';
import { createFollowCamera } from '../world/camera.js';
import { createCharacter } from '../world/character.js';
import { loadModel } from '../world/loader.js';
import { updateInteractions } from '../world/interact.js';
import { showKit, lightKit, flash } from '../ui/hud.js';
import { askQuestion } from '../ui/question.js';
import { finishRun } from '../lib/run.js';
import { tunnel } from './tunnel.js';
import { listener, play, loop, loopAt } from '../world/audio.js';
import { t } from '../lib/i18n.js';

// The 2D game's map at 1.25 m per tile, so its 2-tile corridors are 2.5 m wide. Top left is the
// dressing room (P = spawn, s = shirt, b = boots), top right the physio room (t = tape), the middle rooms are the showers, and the
// bottom-right alcove is the tunnel mouth (C = coach). The 2D game's winding tunnel is walled off: in 3D the
// tunnel is the scripted walk out that follows the coach.
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
const KIT = { shirt: 's', boots: 'b', tape: 't' }; // item → map letter
const ITEM_HEIGHT = 0.9; // kit items float at hand height and turn slowly, so they catch the eye
const ITEM_SPIN = 1.5; // radians per second
const COACH_SIZE = 0.6; // the coach blocks the player like a 0.6 m wall box
const MUSIC_VOLUME = 0.7;
const CROWD = { volume: 1, near: 3 }; // the crowd through the tunnel mouth, loud only near the coach

export const dressingRoom = {
  scene: null,
  camera: null,

  async enter(go, end) {
    this.scene = new THREE.Scene();
    const layout = layoutFromGrid(MAP, TILE, WALL_HEIGHT);
    const level = buildLevel(this.scene, layout);
    this.player = await createPlayer(this.scene, level, layout.spots.P);
    this.follow = createFollowCamera(level, this.player.model);
    this.camera = this.follow.camera;
    this.camera.add(listener);
    this.follow.update(0);

    this.held = new Set();
    this.items = [];
    this.things = [];
    showKit(Object.keys(KIT));
    for (const [name, letter] of Object.entries(KIT)) {
      const { scene: item } = await loadModel(name);
      item.position.copy(layout.spots[letter]).setY(ITEM_HEIGHT);
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
          lightKit(name);
          play('pickup');
        },
      };
      this.things.push(thing);
    }

    this.coach = await createCharacter('coach', {});
    this.coach.object.position.copy(layout.spots.C);
    this.coach.object.rotation.y = -Math.PI / 2; // faces west, towards the player coming in
    this.coach.play('Idle');
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

  exit() {
    this.music.stop();
    this.crowd.stop();
  },

  update(dt) {
    this.player.update(dt, this.follow.yaw);
    this.follow.update(dt);
    this.coach.update(dt);
    for (const item of this.items) item.rotation.y += ITEM_SPIN * dt;
    updateInteractions(this.player.model, this.things);
  },
};
