import * as THREE from 'three';
import { loadModel } from './loader.js';

// Kit colours by material name. The Animated Men Pack names its materials Shirt, Pants, Socks, ...;
// Shoes was split off from Eyes in footballer.glb so boots can change colour on their own.
export const KITS = {
  training: { Shirt: 0x7d8590, Pants: 0x222222, Socks: 0x333333, Shoes: 0xeeeeee },
  dinamo: { Shirt: 0x1450a0, Pants: 0x0f3f86, Socks: 0xffffff, Shoes: 0x111111 },
  official: { Shirt: 0x151515, Pants: 0x151515, Socks: 0x151515, Shoes: 0x111111 },
  rival: { Shirt: 0xc8102e, Pants: 0xc8102e, Socks: 0xffffff, Shoes: 0x111111 },
  keeper: { Shirt: 0x1f9e4a, Pants: 0x151515, Socks: 0x1f9e4a, Shoes: 0x111111 },
};

const FADE_SECONDS = 0.25;
const PACK_SCALE = 0.374; // Animated Men Pack models are 4.81 units tall; this makes them 1.8 m
// Ground speed (m/s) at which each clip's feet don't slide, measured from the clips.
const WALK_CLIP_SPEED = 1.3;
const RUN_CLIP_SPEED = 3.4;
const RUN_ABOVE = 2; // m/s; faster than this uses Run instead of Walk

// A rigged person: the model, its kit colours, and its animation clips by short name
// ('HumanArmature|Man_Walk' → 'Walk'). play(name) cross-fades from the current clip.
export async function createCharacter(name, kit) {
  const { scene, animations } = await loadModel(name);
  dress(scene, kit);

  const mixer = new THREE.AnimationMixer(scene);
  const actions = Object.fromEntries(
    animations.map((clip) => [clip.name.split('_').pop(), mixer.clipAction(clip)]),
  );
  let current = null;

  return {
    object: scene,

    // Recolours the named materials, e.g. { Shoes: 0x111111 } when he puts his boots on.
    wear(colours) {
      paint(scene, colours);
    },

    // Cross-fades to `clip`. `once` plays it a single time and holds the last frame (a fall, a dive).
    play(clip, timeScale = 1, once = false) {
      const next = actions[clip];
      next.timeScale = timeScale;
      if (next === current) return;
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.play();
      if (current) next.crossFadeFrom(current, FADE_SECONDS, false);
      current = next;
    },

    // Holds one frame of `clip`, `at` seconds in (the Sitting pose, tipped back, is a sliding tackle).
    // It shows at once, with no cross-fade, so it also reads in a frozen moment.
    pose(clip, at) {
      this.play(clip, 0);
      actions[clip].time = at;
      mixer.update(FADE_SECONDS);
    },

    // Idle when still, otherwise Walk or Run played at the speed that matches `speed` (m/s).
    moveAt(speed) {
      if (speed === 0) this.play('Idle');
      else if (speed > RUN_ABOVE) this.play('Run', speed / RUN_CLIP_SPEED);
      else this.play('Walk', speed / WALK_CLIP_SPEED);
    },

    update(dt) {
      mixer.update(dt);
    },
  };
}

// Turns `model` smoothly (by `amount` of the remaining angle, at most all of it) to face direction x, z.
export function turnTowards(model, x, z, amount) {
  const turn = Math.atan2(x, z) - model.rotation.y;
  model.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, amount);
}

// One part of the footballer on its own, in its rest pose and full size: 'Shirt' is a football shirt,
// 'Shoes' a pair of boots standing side by side. Used for the kit you pick up in the dressing room.
export async function kitPiece(material, colour) {
  const { scene } = await loadModel('footballer');
  dress(scene, { [material]: colour });
  scene.traverse((node) => {
    if (node.isMesh) node.visible = node.material.name === material;
  });
  return scene;
}

function dress(scene, kit) {
  scene.scale.setScalar(PACK_SCALE);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.material = node.material.clone(); // copies share materials; each person gets their own colours
    node.material.metalness = 0;
  });
  paint(scene, kit);
}

function paint(scene, colours) {
  scene.traverse((node) => {
    if (node.isMesh && colours[node.material.name] !== undefined) node.material.color.setHex(colours[node.material.name]);
  });
}
