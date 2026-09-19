import * as THREE from 'three';
import { loadModel } from './loader.js';

// Kit colours by material name (the Animated Men Pack names its materials Shirt, Pants, Socks, ...).
export const KITS = {
  dinamo: { Shirt: 0x1450a0, Pants: 0x0f3f86, Socks: 0xffffff },
  official: { Shirt: 0x151515, Pants: 0x151515, Socks: 0x151515 },
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
  scene.scale.setScalar(PACK_SCALE);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.material = node.material.clone(); // copies share materials; each person gets their own colours
    node.material.metalness = 0;
    if (kit[node.material.name] !== undefined) node.material.color.setHex(kit[node.material.name]);
  });

  const mixer = new THREE.AnimationMixer(scene);
  const actions = Object.fromEntries(
    animations.map((clip) => [clip.name.split('_').pop(), mixer.clipAction(clip)]),
  );
  let current = null;

  return {
    object: scene,

    play(clip, timeScale = 1) {
      const next = actions[clip];
      next.timeScale = timeScale;
      if (next === current) return;
      next.reset().play();
      if (current) next.crossFadeFrom(current, FADE_SECONDS, false);
      current = next;
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
