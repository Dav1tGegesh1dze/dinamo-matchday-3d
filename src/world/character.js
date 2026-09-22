import * as THREE from 'three';
import { loadModel } from './loader.js';
import { shadows } from './graphics.js';

// Everyone is footballer.glb (Quaternius's Universal Base Character, 1.82 m) with its kit painted on:
// its body is split into Skin, Shirt, Sleeves, Shorts, Legs, Socks and Boots, and a kit colours the
// parts it covers. Sleeves and Legs stay skin unless a kit covers them (long sleeves, trousers).
export const KITS = {
  training: { Shirt: 0x7d8590, Shorts: 0x222222, Socks: 0x333333, Boots: 0xeeeeee },
  dinamo: { Shirt: 0x1450a0, Shorts: 0x0f3f86, Socks: 0xffffff, Boots: 0x111111 },
  official: { Shirt: 0x151515, Shorts: 0x151515, Socks: 0x151515, Boots: 0x111111 },
  rival: { Shirt: 0xc8102e, Shorts: 0xc8102e, Socks: 0xffffff, Boots: 0x111111 },
  keeper: { Shirt: 0x1f9e4a, Sleeves: 0x1f9e4a, Shorts: 0x151515, Socks: 0x1f9e4a, Boots: 0x111111 },
  coach: { Shirt: 0x0b2a5a, Sleeves: 0x0b2a5a, Shorts: 0x0b2a5a, Legs: 0x0b2a5a, Socks: 0x0b2a5a, Boots: 0x222222 },
};

// What each move is called in animations.glb (Quaternius's Universal Animation Library).
const CLIPS = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  talk: 'Idle_Talking_Loop',
  shoot: 'Jump_Start', // the crouch and spring reads as winding up the strike
  hurdle: 'Jump_Loop',
  dive: 'Jump_Loop', // tipped sideways by the pitch stage
  fall: 'Death01',
  celebrate: 'Dance_Loop',
  slide: 'Sitting_Idle_Loop', // tipped back by the pitch stage, it is a sliding tackle
};
const FADE_SECONDS = 0.25;
// Ground speed (m/s) at which each gait's feet don't slide, measured from the clips.
const GAITS = [
  { clip: 'walk', speed: 0.9, below: 2 },
  { clip: 'jog', speed: 3, below: 4 },
  { clip: 'sprint', speed: 5, below: Infinity },
];

// A person in `kit`. play(move) cross-fades to one of the CLIPS.
export async function createCharacter(kit) {
  const { scene } = await loadModel('footballer');
  const { animations } = await loadModel('animations');
  dress(scene, kit);
  shareSkeleton(scene);

  const mixer = new THREE.AnimationMixer(scene);
  const actions = Object.fromEntries(
    Object.entries(CLIPS).map(([move, name]) => [move, mixer.clipAction(animations.find((clip) => clip.name === name))]),
  );
  let current = null;

  return {
    object: scene,

    // Recolours the parts named, e.g. { Boots: 0x111111 } when he puts his boots on.
    wear(colours) {
      paint(scene, colours);
    },

    // Cross-fades to `move`. `once` plays it a single time and holds the last frame (a fall, a dive).
    play(move, timeScale = 1, once = false) {
      const next = actions[move];
      next.timeScale = timeScale;
      if (next === current) return;
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.play();
      if (current) next.crossFadeFrom(current, FADE_SECONDS, false);
      current = next;
    },

    // Holds one frame of `move`, `at` seconds in. It shows at once, with no cross-fade, so it also
    // reads in a frozen moment.
    pose(move, at) {
      this.play(move, 0);
      actions[move].time = at;
      mixer.update(FADE_SECONDS);
    },

    // Idle when still, otherwise the walk, jog or sprint that suits `speed` (m/s), played so the
    // feet keep pace with the ground.
    moveAt(speed) {
      if (speed === 0) return this.play('idle');
      const gait = GAITS.find(({ below }) => speed < below);
      this.play(gait.clip, speed / gait.speed);
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

// One kit part of the footballer on its own, in the model's T-pose: 'Shirt' is a football shirt
// laid out flat, 'Boots' a pair of boots standing side by side. Used for the kit you pick up.
export async function kitPiece(part, colour) {
  const { scene } = await loadModel('footballer');
  dress(scene, { [part]: colour });
  scene.traverse((node) => {
    if (node.isMesh) node.visible = node.material.name === part;
  });
  return scene;
}

// footballer.glb's parts (body, hair, eyes, eyebrows) all follow its one skin, but the loader gives
// each part its own copy of the skeleton. With one shared skeleton the bones are worked out and sent
// to the graphics card once a frame instead of once per part.
function shareSkeleton(scene) {
  let skeleton = null;
  scene.traverse((node) => {
    if (node.isSkinnedMesh) node.skeleton = skeleton ??= node.skeleton;
  });
}

function dress(scene, kit) {
  shadows(scene);
  scene.traverse((node) => {
    if (node.isMesh) node.material = node.material.clone(); // copies share materials; each person gets their own colours
  });
  paint(scene, kit);
}

// A painted part is plain cloth: the skin texture (still on Sleeves and Legs) comes off.
function paint(scene, colours) {
  scene.traverse((node) => {
    if (!node.isMesh || !(node.material.name in colours)) return;
    node.material.map = null;
    node.material.normalMap = null;
    node.material.color.setHex(colours[node.material.name]);
    node.material.needsUpdate = true;
  });
}
