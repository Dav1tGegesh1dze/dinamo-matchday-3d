import * as THREE from 'three';
import { t } from './lib/i18n.js';
import { dressingRoom } from './stages/dressingRoom.js';

// Stage controller: one renderer, one canvas, one loop. The active stage owns its scene and camera,
// and it only updates while the mouse is locked, so Escape pauses the game.
const MAX_STEP = 0.05;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
document.body.append(renderer.domElement);

const overlay = document.getElementById('overlay');
overlay.textContent = t('clickToStart');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  overlay.hidden = document.pointerLockElement === renderer.domElement;
});

let stage;

async function enter(next) {
  stage = next;
  await stage.enter();
  resize();
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  stage.camera.aspect = window.innerWidth / window.innerHeight;
  stage.camera.updateProjectionMatrix();
}

await enter(dressingRoom);
window.addEventListener('resize', resize);

let last = 0;
renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - last) / 1000, MAX_STEP);
  last = time;
  if (document.pointerLockElement === renderer.domElement) stage.update(dt);
  renderer.render(stage.scene, stage.camera);
});
