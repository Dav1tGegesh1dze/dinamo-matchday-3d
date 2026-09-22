import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// How the game is drawn: filmic tone mapping, soft shadows, light from an HDR environment, and
// post-processing (ambient occlusion, bloom, anti-aliasing). Quality levels run from best to
// lightest; the game starts at the best and steps down while a stage stays under TARGET_FPS, so
// whatever computer runs the stand gets the best look it can hold.
const LEVELS = [
  { ao: true, bloom: true, shadows: true, pixelRatio: 1.5 },
  { ao: false, bloom: true, shadows: true, pixelRatio: 1.5 },
  { ao: false, bloom: false, shadows: true, pixelRatio: 1.25 },
  { ao: false, bloom: false, shadows: false, pixelRatio: 1 },
];
const TARGET_FPS = 50;
const WARM_UP_SECONDS = 1; // a new stage stutters while its shaders compile; don't judge that
const SAMPLE_SECONDS = 2;
// Only what is far brighter than white glows (sunlit white is about 2): lamps are drawn at GLOW on purpose.
const BLOOM = { strength: 0.5, radius: 0.5, threshold: 2 };
const SHADOW_MAP = 2048;

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmrem = new THREE.PMREMGenerator(renderer);
const hdrLoader = new HDRLoader();
const environments = new Map();
let level = 0;
let composer = null;
let view = { scene: null, camera: null };
let clock = { warm: 0, frames: 0, seconds: 0 };

// The light an HDR image in public/assets/env/<name>.hdr casts on everything (and what shiny
// surfaces reflect). Each image is prepared once.
export function loadEnvironment(name) {
  if (!environments.has(name)) {
    environments.set(
      name,
      hdrLoader.loadAsync(`assets/env/${name}.hdr`).then((hdr) => {
        const environment = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        return environment;
      }),
    );
  }
  return environments.get(name);
}

// One shadow-casting light that follows the action, so its shadows only need to cover a box of
// `reach` metres around the player. `offset` is where the light sits relative to him.
export function keyLight(scene, { colour, intensity, offset, reach }) {
  const light = new THREE.DirectionalLight(colour, intensity);
  light.castShadow = true;
  light.shadow.mapSize.setScalar(SHADOW_MAP);
  Object.assign(light.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: offset.length() * 2 });
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.03;
  scene.add(light, light.target);
  return {
    follow(position) {
      light.position.copy(position).add(offset);
      light.target.position.copy(position);
    },
  };
}

// Draws `scene` from `camera`. `seconds` is the real time since the last frame, used to measure
// the frame rate.
export function render(scene, camera, seconds) {
  if (scene !== view.scene || camera !== view.camera) {
    view = { scene, camera };
    apply();
  }
  measure(seconds);
  if (composer) composer.render(seconds);
  else renderer.render(scene, camera);
}

export function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
}

// Sets up the current quality level for the current view.
function apply() {
  const { ao, bloom, shadows, pixelRatio } = LEVELS[level];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    view.scene.traverse((node) => {
      if (node.material) [node.material].flat().forEach((material) => (material.needsUpdate = true));
    });
  }
  composer?.dispose();
  composer = null;
  if (ao || bloom) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(view.scene, view.camera));
    if (ao) composer.addPass(new GTAOPass(view.scene, view.camera));
    if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    composer.addPass(new OutputPass());
  }
  resize();
  clock = { warm: 0, frames: 0, seconds: 0 };
}

function measure(seconds) {
  if (clock.warm < WARM_UP_SECONDS) {
    clock.warm += seconds;
    return;
  }
  clock.frames++;
  clock.seconds += seconds;
  if (clock.seconds < SAMPLE_SECONDS) return;
  const fps = clock.frames / clock.seconds;
  clock.frames = clock.seconds = 0;
  if (fps < TARGET_FPS && level < LEVELS.length - 1) {
    level++;
    apply();
  }
}

// How much brighter than white a lamp is drawn, so that it glows (with bloom on).
export const GLOW = 6;

// Everything in `object` casts shadows and shows the shadows of others.
export function shadows(object) {
  object.traverse((node) => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  return object;
}
