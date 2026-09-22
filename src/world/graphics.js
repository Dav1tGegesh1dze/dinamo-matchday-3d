import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// How the game is drawn: filmic tone mapping, soft shadows, light from an HDR environment, and bloom
// with anti-aliasing. Quality levels run from best to lightest; the game starts at the best and
// steps down while a stage stays under TARGET_FPS, so whatever computer runs the stand gets the best
// look it can hold. (Ambient occlusion is left out on purpose: it cost half of every frame.)
const LEVELS = [
  { bloom: true, shadows: true, pixelRatio: 1.5 },
  { bloom: false, shadows: true, pixelRatio: 1.25 },
  { bloom: false, shadows: false, pixelRatio: 1 },
  { bloom: false, shadows: false, pixelRatio: 0.75 },
];
const TARGET_FPS = 55;
const WARM_UP_SECONDS = 1; // a stage's first frames can be uneven; don't judge them
const SAMPLE_SECONDS = 2;
// Only what is far brighter than white glows (sunlit white is about 2): lamps are drawn at GLOW on purpose.
const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2 };
const SHADOW_MAP = 2048;

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const pmrem = new THREE.PMREMGenerator(renderer);
const hdrLoader = new HDRLoader();
const images = new Map();
const environments = new Map();
const scenePass = new RenderPass(); // draws whichever stage is showing
let level = 0;
let composer = null;
let clock = { warm: 0, frames: 0, seconds: 0 };
apply();

// An HDR image from public/assets/env/<name>.hdr, as a sky to show behind everything.
export function loadSky(name) {
  if (!images.has(name)) {
    images.set(
      name,
      hdrLoader.loadAsync(`assets/env/${name}.hdr`).then((hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        return hdr;
      }),
    );
  }
  return images.get(name);
}

// The light the same image casts on everything (and what shiny surfaces reflect). Prepared once.
export function loadEnvironment(name) {
  if (!environments.has(name)) environments.set(name, loadSky(name).then((hdr) => pmrem.fromEquirectangular(hdr).texture));
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

// Gets `scene` ready to show without stutters: compiles its shaders in the background where the
// browser can, then draws it once with nothing culled, so that every object's first draw (which
// builds its graphics pipeline and uploads its textures) happens now, not when it first comes into
// view. Wait for it before showing the scene.
export async function prepare(scene, camera) {
  const target = composer ? composer.readBuffer : null; // where the scene is drawn; shaders differ for the screen and a buffer
  renderer.setRenderTarget(target);
  const compiled = renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);
  await compiled;
  const culled = [];
  scene.traverse((node) => {
    if (node.frustumCulled) culled.push(node);
    node.frustumCulled = false;
  });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  for (const node of culled) node.frustumCulled = true;
}

// Draws `scene` from `camera`. `seconds` is the real time since the last frame, used to measure
// the frame rate.
export function render(scene, camera, seconds) {
  if (scene !== scenePass.scene || camera !== scenePass.camera) {
    Object.assign(scenePass, { scene, camera });
    clock = { warm: 0, frames: 0, seconds: 0 };
  }
  measure(seconds);
  if (composer) composer.render(seconds);
  else renderer.render(scene, camera);
}

export function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
}

// Sets up the current quality level. The bloom's passes are built once, at the start, and stay
// until a slower machine turns bloom off.
function apply() {
  const { bloom, shadows, pixelRatio } = LEVELS[level];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    scenePass.scene?.traverse((node) => {
      if (node.material) [node.material].flat().forEach((material) => (material.needsUpdate = true));
    });
  }
  if (bloom && !composer) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(scenePass);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    composer.addPass(new OutputPass());
  } else if (!bloom && composer) {
    composer.passes.forEach((pass) => pass.dispose());
    composer.dispose();
    composer = null;
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

// Frees what a finished scene holds on the graphics card: geometry, textures, bone data and shadow
// maps. The garbage collector doesn't see graphics memory, so a stand that plays all day has to give
// it back by hand. Compiled materials are kept, ready for the next run; what it shares with the next
// run's scenes is sent to the graphics card again when they are prepared.
export function release(scene) {
  scene.traverse((node) => {
    node.geometry?.dispose();
    if (node.isInstancedMesh) node.dispose();
    node.skeleton?.dispose();
    node.shadow?.dispose();
    for (const material of [node.material ?? []].flat()) {
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
    }
  });
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
