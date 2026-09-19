import * as THREE from 'three';
import { loadModel } from './loader.js';

// Kit colours by material name (the Animated Men Pack names its materials Shirt, Pants, Socks, ...).
export const KITS = {
  dinamo: { Shirt: 0x1450a0, Pants: 0x0f3f86, Socks: 0xffffff },
};

const FADE_SECONDS = 0.25;

// A rigged person: the model, its kit colours, and its animation clips by short name
// ('HumanArmature|Man_Walk' → 'Walk'). play(name) cross-fades from the current clip.
export async function createCharacter(name, kit, scale) {
  const { scene, animations } = await loadModel(name);
  scene.scale.setScalar(scale);
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

    update(dt) {
      mixer.update(dt);
    },
  };
}
